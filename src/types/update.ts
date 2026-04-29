export interface UpdateAsset {
  name: string;
  url: string;
  size: number;
}

export interface UpdateInfo {
  current_version: string;
  latest_version: string;
  has_update: boolean;
  release_url: string;
  release_notes: string;
  published_at: string | null;
  asset: UpdateAsset | null;
}

export type UpdateDownloadStage = "downloading" | "done" | "failed";

export interface UpdateDownloadProgress {
  downloaded_bytes: number;
  total_bytes: number;
  stage: UpdateDownloadStage;
}
