import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Alert, Empty, Space, Spin, Tag, Tooltip, Typography } from "antd";
import {
  AppstoreOutlined,
  MinusOutlined,
  PictureOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  extractPreviewThumbnails,
  getAppSettings,
  setPreviewColumns,
  type PreviewThumbnail,
} from "../services/api";

const MIN_COUNT = 9;
const MAX_COUNT = 99;
const STEP = 9;
const DEFAULT_COLUMNS = 3;
const MIN_COLUMNS = 1;
const MAX_COLUMNS = 12;

const STEPPER_HEIGHT = 36;

const stepperWrapperStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "stretch",
  height: STEPPER_HEIGHT,
  borderRadius: 10,
  overflow: "hidden",
  border: "1px solid var(--ant-color-border-secondary, #e5e7eb)",
  background: "var(--ant-color-bg-container, #ffffff)",
  boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
};

const stepperButtonStyle: CSSProperties = {
  width: 36,
  height: "100%",
  padding: 0,
  border: 0,
  background: "transparent",
  color: "var(--ant-color-text-secondary, rgba(0,0,0,0.65))",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 13,
  transition: "background 0.15s ease, color 0.15s ease",
};

const stepperButtonDisabledStyle: CSSProperties = {
  cursor: "not-allowed",
  color: "var(--ant-color-text-disabled, rgba(0,0,0,0.25))",
  background: "transparent",
};

const stepperLabelStyle: CSSProperties = {
  minWidth: 104,
  padding: "0 14px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  borderLeft: "1px solid var(--ant-color-border-secondary, #f0f0f0)",
  borderRight: "1px solid var(--ant-color-border-secondary, #f0f0f0)",
  background: "var(--ant-color-fill-quaternary, rgba(0,0,0,0.02))",
  fontSize: 13,
  whiteSpace: "nowrap",
  color: "var(--ant-color-text, rgba(0,0,0,0.88))",
};

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
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
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

  useEffect(() => {
    let disposed = false;
    getAppSettings()
      .then((settings) => {
        if (disposed) return;
        setColumns(clampColumns(settings.preview_columns));
      })
      .catch((error) => {
        console.debug("Failed to load preview columns setting", error);
      });

    return () => {
      disposed = true;
    };
  }, []);

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
  const handleColumnsDecrement = () => {
    updateColumns(columns - 1);
  };
  const handleColumnsIncrement = () => {
    updateColumns(columns + 1);
  };
  const updateColumns = (nextColumns: number) => {
    const normalizedColumns = clampColumns(nextColumns);
    if (normalizedColumns === columns) return;
    setColumns(normalizedColumns);
    void setPreviewColumns(normalizedColumns).catch((error) => {
      console.debug("Failed to save preview columns setting", error);
    });
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
          flexWrap: "wrap",
          background: "var(--ant-color-bg-container, #ffffff)",
        }}
      >
        <Space>
          <Typography.Text strong>视频预览</Typography.Text>
          <Tag color="blue" style={{ marginInlineEnd: 0 }}>当前 {count} 张</Tag>
        </Space>
        <Space size={10} wrap>
          <Stepper
            icon={<AppstoreOutlined style={{ color: "var(--ant-color-primary, #1677ff)" }} />}
            label={<>每行 <strong style={{ margin: "0 2px" }}>{columns}</strong> 张</>}
            onMinus={handleColumnsDecrement}
            onPlus={handleColumnsIncrement}
            minusDisabled={columns <= MIN_COLUMNS}
            plusDisabled={columns >= MAX_COLUMNS}
            minusTooltip="每行少 1 张"
            plusTooltip="每行多 1 张"
            minusAriaLabel="每行减少 1 张"
            plusAriaLabel="每行增加 1 张"
          />
          <Stepper
            icon={<PictureOutlined style={{ color: "var(--ant-color-primary, #1677ff)" }} />}
            label={<>共 <strong style={{ margin: "0 2px" }}>{count}</strong> 张</>}
            onMinus={handleDecrement}
            onPlus={handleIncrement}
            minusDisabled={loading || count <= MIN_COUNT}
            plusDisabled={loading || count >= MAX_COUNT}
            minusTooltip={`减少 ${STEP} 张预览图`}
            plusTooltip={`增加 ${STEP} 张预览图`}
            minusAriaLabel={`减少 ${STEP} 张预览图`}
            plusAriaLabel={`增加 ${STEP} 张预览图`}
          />
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
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
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

interface StepperProps {
  icon?: ReactNode;
  label: ReactNode;
  onMinus: () => void;
  onPlus: () => void;
  minusDisabled?: boolean;
  plusDisabled?: boolean;
  minusTooltip?: string;
  plusTooltip?: string;
  minusAriaLabel?: string;
  plusAriaLabel?: string;
}

function Stepper({
  icon,
  label,
  onMinus,
  onPlus,
  minusDisabled,
  plusDisabled,
  minusTooltip,
  plusTooltip,
  minusAriaLabel,
  plusAriaLabel,
}: StepperProps) {
  return (
    <div style={stepperWrapperStyle}>
      <Tooltip title={minusTooltip}>
        <button
          type="button"
          aria-label={minusAriaLabel}
          onClick={onMinus}
          disabled={minusDisabled}
          style={{
            ...stepperButtonStyle,
            ...(minusDisabled ? stepperButtonDisabledStyle : {}),
          }}
          onMouseEnter={(event) => {
            if (minusDisabled) return;
            event.currentTarget.style.background =
              "var(--ant-color-fill-tertiary, rgba(0,0,0,0.04))";
            event.currentTarget.style.color =
              "var(--ant-color-primary, #1677ff)";
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = "transparent";
            event.currentTarget.style.color =
              "var(--ant-color-text-secondary, rgba(0,0,0,0.65))";
          }}
        >
          <MinusOutlined />
        </button>
      </Tooltip>
      <div style={stepperLabelStyle}>
        {icon}
        <span>{label}</span>
      </div>
      <Tooltip title={plusTooltip}>
        <button
          type="button"
          aria-label={plusAriaLabel}
          onClick={onPlus}
          disabled={plusDisabled}
          style={{
            ...stepperButtonStyle,
            ...(plusDisabled ? stepperButtonDisabledStyle : {}),
          }}
          onMouseEnter={(event) => {
            if (plusDisabled) return;
            event.currentTarget.style.background =
              "var(--ant-color-fill-tertiary, rgba(0,0,0,0.04))";
            event.currentTarget.style.color =
              "var(--ant-color-primary, #1677ff)";
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = "transparent";
            event.currentTarget.style.color =
              "var(--ant-color-text-secondary, rgba(0,0,0,0.65))";
          }}
        >
          <PlusOutlined />
        </button>
      </Tooltip>
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

function clampColumns(columns: number) {
  return Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, columns));
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
