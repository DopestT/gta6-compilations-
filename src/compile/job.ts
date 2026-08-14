import { CompilationPlan, EngineJob, PlatformName } from "../types.js";
import { buildDescription, burnInDisclosure, hashtagsFor, primaryTitle } from "../metadata/titles.js";

export interface JobOptions {
  brand?: string;
  projectName?: string;
  platforms?: PlatformName[];
  /** Anything with synthetic footage stays private until a human signs off. */
  visibility?: EngineJob["visibility"];
  now?: Date;
}

const ALL_PLATFORMS: PlatformName[] = ["youtube", "tiktok", "instagram", "x", "facebook"];

/**
 * Turn a plan into a youtubeengine job.
 *
 * The disclosure, when one is required, is written into three places: the
 * description, the burned-in caption, and the hook text. Dropping any single
 * field cannot silently strip the label.
 */
export function buildEngineJob(plan: CompilationPlan, options: JobOptions = {}): EngineJob {
  if (plan.clips.length === 0) {
    throw new Error(`Plan "${plan.theme}" has no clips. Nothing to build.`);
  }

  const now = (options.now ?? new Date()).toISOString().replace(/\.\d{3}Z$/, "Z");
  const disclosure = burnInDisclosure(plan);
  const title = primaryTitle(plan);

  // Synthetic footage never auto-publishes.
  const visibility = options.visibility ?? (disclosure ? "private" : "unlisted");

  return {
    jobId: `gta6-${plan.slug}`,
    projectName: options.projectName ?? "GTA VI Compilations",
    brand: options.brand ?? "gta6-compilations",
    sourceType: "video",
    sourceFiles: plan.clips.map((c) => c.file),
    targetPlatforms: options.platforms ?? ALL_PLATFORMS,
    title,
    description: buildDescription(plan),
    hashtags: hashtagsFor(plan),
    tags: ["gta6", "gta vi", "vice city", "compilation", plan.slug],
    category: "Gaming",
    visibility,
    scheduledTime: null,
    endCard: {
      enabled: true,
      text: disclosure ?? "Subscribe for the next drop.",
      position: "bottom",
    },
    watermark: { enabled: true, text: "GTA VI Compilations", position: "top-right" },
    captions: {
      text: disclosure ?? title,
      style: "bold-creator",
      burnIn: true,
    },
    music: { volume: 0.18 },
    voiceover: {},
    thumbnailFrame: 1,
    hookText: disclosure ?? title,
    callToAction: "Subscribe for the next drop.",
    render: {
      fps: 60,
      width: 1080,
      height: 1920,
      cropMode: "smart-center",
      normalizeAudio: true,
    },
    status: "pending",
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}
