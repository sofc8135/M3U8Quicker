use std::path::PathBuf;
use std::sync::Arc;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use crate::error::AppError;
use crate::ffmpeg;
use crate::state::AppState;

const PREVIEW_THUMBNAIL_WIDTH: u32 = 320;
pub const MIN_THUMBNAIL_COUNT: usize = 9;
pub const MAX_THUMBNAIL_COUNT: usize = 99;

#[derive(Debug)]
pub struct PreviewSession {
    pub url: String,
    pub extra_headers: Option<String>,
    pub cache_dir: PathBuf,
    pub duration_secs: Mutex<Option<f64>>,
    pub cancel_token: CancellationToken,
}

#[derive(Debug, Clone, Serialize)]
pub struct PreviewThumbnail {
    pub index: usize,
    pub time_secs: f64,
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PreviewThumbnailEvent {
    pub token: String,
    pub count: usize,
    pub thumbnail: PreviewThumbnail,
}

pub async fn create_session(
    app_handle: &AppHandle,
    state: &AppState,
    url: String,
    extra_headers: Option<String>,
) -> Result<String, AppError> {
    let token = Uuid::new_v4().to_string();
    let cache_dir = preview_root_dir(app_handle)?.join(&token);
    tokio::fs::create_dir_all(&cache_dir).await?;

    let session = Arc::new(PreviewSession {
        url,
        extra_headers,
        cache_dir,
        duration_secs: Mutex::new(None),
        cancel_token: CancellationToken::new(),
    });

    let mut sessions = state.preview_sessions.lock().await;
    sessions.insert(token.clone(), session);
    Ok(token)
}

pub async fn extract_thumbnails(
    app_handle: &AppHandle,
    state: &AppState,
    token: &str,
    count: usize,
) -> Result<Vec<PreviewThumbnail>, AppError> {
    if !(MIN_THUMBNAIL_COUNT..=MAX_THUMBNAIL_COUNT).contains(&count) {
        return Err(AppError::InvalidInput(format!(
            "缩略图数量必须在 {}~{} 之间",
            MIN_THUMBNAIL_COUNT, MAX_THUMBNAIL_COUNT
        )));
    }

    let session = {
        let sessions = state.preview_sessions.lock().await;
        sessions
            .get(token)
            .cloned()
            .ok_or_else(|| AppError::InvalidInput("预览会话不存在或已关闭".to_string()))?
    };

    let ffmpeg_path = ffmpeg::resolve_ffmpeg_path(app_handle)
        .await
        .ok_or_else(|| AppError::InvalidInput("请先在设置中开启并配置 FFmpeg".to_string()))?;
    let cancel_token = session.cancel_token.clone();

    let duration_secs = {
        let mut guard = session.duration_secs.lock().await;
        if let Some(value) = *guard {
            value
        } else {
            let value = ffmpeg::probe_media_duration_secs_cancellable(
                &ffmpeg_path,
                &session.url,
                session.extra_headers.as_deref(),
                &cancel_token,
            )
            .await?;
            if !(value.is_finite() && value > 0.0) {
                return Err(AppError::Conversion(
                    "无法识别视频时长，无法生成预览".to_string(),
                ));
            }
            *guard = Some(value);
            value
        }
    };

    let mut results = Vec::with_capacity(count);
    for index in 0..count {
        if cancel_token.is_cancelled() {
            return Err(AppError::InvalidInput("预览已取消".to_string()));
        }
        let time = duration_secs * (index as f64 + 0.5) / (count as f64);
        let output_path = session.cache_dir.join(format!("{:03}.jpg", index));
        if !tokio::fs::try_exists(&output_path).await.unwrap_or(false) {
            ffmpeg::extract_thumbnail_jpeg_cancellable(
                &ffmpeg_path,
                &session.url,
                session.extra_headers.as_deref(),
                time,
                &output_path,
                PREVIEW_THUMBNAIL_WIDTH,
                &cancel_token,
            )
            .await?;
        }
        let thumbnail = PreviewThumbnail {
            index,
            time_secs: time,
            path: output_path.to_string_lossy().into_owned(),
        };
        let _ = app_handle.emit(
            "preview-thumbnail",
            PreviewThumbnailEvent {
                token: token.to_string(),
                count,
                thumbnail: thumbnail.clone(),
            },
        );
        results.push(thumbnail);
    }

    Ok(results)
}

pub async fn close_session(state: &AppState, token: &str) {
    let session = {
        let mut sessions = state.preview_sessions.lock().await;
        sessions.remove(token)
    };
    if let Some(session) = session {
        session.cancel_token.cancel();
        let _ = tokio::fs::remove_dir_all(&session.cache_dir).await;
    }
}

fn preview_root_dir(app_handle: &AppHandle) -> Result<PathBuf, AppError> {
    let cache_dir = app_handle
        .path()
        .app_cache_dir()
        .map_err(|e| AppError::Internal(format!("无法获取应用缓存目录: {}", e)))?;
    Ok(cache_dir.join("preview"))
}
