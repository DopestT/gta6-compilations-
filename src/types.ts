/**
 * Core types for the GTA VI compilation pipeline.
 *
 * The job shape mirrors youtubeengine's `EngineJob` so a built job can be
 * dropped straight into that engine's /jobs folder and processed unchanged.
 */

/** Where a clip actually came from. Drives every downstream labeling rule. */
export type Provenance =
  | "official-rockstar"
  | "user-gameplay"
  | "fan-made"
  | "ai-generated"
  | "unknown";

export type ClipStatus = "approved" | "review" | "rejected";

export interface Clip {
  id: string;
  title: string;
  /** Path to the media file, relative to the repo root. */
  file: string;
  durationSeconds: number;
  provenance: Provenance;
  /** Where it was found. Required for anything not filmed in-house. */
  sourceUrl?: string;
  /** Original creator, for credit lines. */
  creator?: string;
  /** ISO date the footage was captured or published. */
  capturedAt?: string;
  tags: string[];
  status: ClipStatus;
  notes?: string;
}

export interface Registry {
  version: number;
  updatedAt: string;
  clips: Clip[];
}

export type IssueSeverity = "error" | "warning";

export interface AuditIssue {
  clipId: string;
  code: string;
  severity: IssueSeverity;
  message: string;
}

export interface CompilationPlan {
  theme: string;
  slug: string;
  clips: Clip[];
  totalSeconds: number;
  /** Disclosure lines required by the provenance mix in this plan. */
  disclosures: string[];
  /** Credit lines, one per clip that needs attribution. */
  credits: string[];
}

/* ------------------------------------------------------------------ *
 * youtubeengine-compatible job shape
 * ------------------------------------------------------------------ */

export type PlatformName = "youtube" | "tiktok" | "instagram" | "x" | "facebook";
export type JobStatus = "pending" | "processing" | "completed" | "failed";
export type Visibility = "private" | "unlisted" | "public";

export interface EngineJob {
  jobId: string;
  projectName: string;
  brand: string;
  sourceType: "video";
  sourceFiles: string[];
  targetPlatforms: PlatformName[];
  title: string;
  description: string;
  hashtags: string[];
  tags: string[];
  category: string;
  visibility: Visibility;
  scheduledTime: string | null;
  endCard: { enabled: boolean; text: string; position: "bottom" };
  watermark: { enabled: boolean; text: string; position: "top-right" };
  captions: { text: string; style: string; burnIn: boolean };
  music: { volume: number };
  voiceover: Record<string, never>;
  thumbnailFrame: number;
  hookText: string;
  callToAction: string;
  render: {
    fps: 30 | 60;
    width: number;
    height: number;
    cropMode: "smart-center";
    normalizeAudio: boolean;
  };
  status: JobStatus;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}
