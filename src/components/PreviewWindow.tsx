import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Empty, Space, Spin, Tag, Typography } from "antd";
import { MinusOutlined, PlusOutlined } from "@ant-design/icons";
import { convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  extractPreviewThumbnails,
  type PreviewThumbnail,
} from "../services/api";

const MIN_COUNT = 9;
const MAX_COUNT = 99;
const STEP = 9;

interface PreviewThumbnailEvent {
  token: string;
  count: number;
  thumbnail: PreviewThumbnail;
}

export function PreviewWindow() {
  const token = useMemo(
    () => new URLSearchParams(window.location.search).get("token") ?? "",
    []
  );
  const [count, setCount] = useState(MIN_COUNT);
  const [thumbnails, setThumbnails] = useState<PreviewThumbnail[]>([]);
  const [loadedKey, setLoadedKey] = useState<number | null>(null);
  const [errorText, setErrorText] = useState<string | null>(
    token ? null : "预览参数缺失，无法打开窗口。"
  );
  const loading = Boolean(token) && loadedKey !== count;

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void listen<PreviewThumbnailEvent>("preview-thumbnail", (event) => {
      const payload = event.payload;
      if (payload.token !== token || payload.count !== count) {
        return;
      }
      setThumbnails((current) =>
        upsertThumbnail(current, payload.thumbnail)
      );
    }).then((fn) => {
      if (cancelled) {
        fn();
        return [];
      }
      unlisten = fn;
      return extractPreviewThumbnails(token, count);
    }).then((items) => {
      if (cancelled) return;
      setThumbnails(sortThumbnails(items));
      setErrorText(null);
      setLoadedKey(count);
    }).catch((error) => {
      if (cancelled) return;
      setErrorText(formatError(error));
      setLoadedKey(count);
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [token, count]);

  const resetPreviewState = () => {
    setThumbnails([]);
    setLoadedKey(null);
    setErrorText(null);
  };

  const handleDecrement = () => {
    resetPreviewState();
    setCount((current) => Math.max(MIN_COUNT, current - STEP));
  };
  const handleIncrement = () => {
    resetPreviewState();
    setCount((current) => Math.min(MAX_COUNT, current + STEP));
  };
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--ant-color-bg-layout, #f5f5f5)",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid rgba(0,0,0,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          background: "var(--ant-color-bg-container, #ffffff)",
        }}
      >
        <Space>
          <Typography.Text strong>视频预览</Typography.Text>
          <Tag color="blue">当前 {count} 张</Tag>
        </Space>
        <Space>
          <Button
            icon={<MinusOutlined />}
            onClick={handleDecrement}
            disabled={loading || count <= MIN_COUNT}
          >
            少 9 张
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={handleIncrement}
            disabled={loading || count >= MAX_COUNT}
          >
            多 9 张
          </Button>
        </Space>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 16, position: "relative" }}>
        {errorText ? (
          <Alert type="error" showIcon message="预览失败" description={errorText} />
        ) : null}
        {loading && thumbnails.length === 0 ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Spin tip="正在抽取缩略图..." size="large" />
          </div>
        ) : null}
        {!loading && !errorText && thumbnails.length === 0 ? (
          <Empty description="暂无缩略图" />
        ) : null}
        {thumbnails.length > 0 ? (
          <div style={{ position: "relative" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12,
              }}
            >
              {thumbnails.map((thumb) => (
                <ThumbnailCard key={thumb.index} thumb={thumb} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ThumbnailCard({ thumb }: { thumb: PreviewThumbnail }) {
  return (
    <div
      style={{
        background: "var(--ant-color-bg-container, #ffffff)",
        borderRadius: 8,
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      }}
    >
      <img
        src={convertFileSrc(thumb.path)}
        alt={`thumbnail-${thumb.index}`}
        style={{ width: "100%", display: "block", aspectRatio: "16 / 9", objectFit: "cover" }}
      />
      <div
        style={{
          padding: "6px 10px",
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          color: "var(--ant-color-text-secondary, rgba(0,0,0,0.65))",
        }}
      >
        <span>#{thumb.index + 1}</span>
        <span>{formatTimestamp(thumb.time_secs)}</span>
      </div>
    </div>
  );
}

function upsertThumbnail(
  thumbnails: PreviewThumbnail[],
  next: PreviewThumbnail
) {
  const withoutCurrent = thumbnails.filter((item) => item.index !== next.index);
  return sortThumbnails([...withoutCurrent, next]);
}

function sortThumbnails(thumbnails: PreviewThumbnail[]) {
  return [...thumbnails].sort((left, right) => left.index - right.index);
}

function formatTimestamp(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (value: number) => value.toString().padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

function formatError(error: unknown): string {
  const text = String(error ?? "").trim();
  if (!text) return "未知错误";
  return text.replace(
    /^(Invalid input|Conversion error|Network error|IO error):\s*/i,
    ""
  );
}
