import { Clip, CompilationPlan, Registry } from "../types.js";
import { auditClip, creditLine, disclosureLine, hasBlockingIssues } from "../provenance/rules.js";

export interface PlanOptions {
  theme: string;
  /** Target runtime in seconds. Clips are added until adding the next would overshoot. */
  targetSeconds: number;
  maxClips?: number;
  /** Only consider clips carrying this tag. Defaults to the theme itself. */
  tag?: string;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Select clips for a compilation.
 *
 * Only approved clips that pass their own provenance audit are eligible — a
 * clip with a blocking issue can never reach a plan, so it can never reach a
 * rendered video.
 */
export function planCompilation(registry: Registry, options: PlanOptions): CompilationPlan {
  const { theme, targetSeconds } = options;
  const tag = (options.tag ?? theme).toLowerCase();
  const maxClips = options.maxClips ?? Number.POSITIVE_INFINITY;

  const eligible = registry.clips.filter((clip) => {
    if (clip.status !== "approved") return false;
    if (!clip.tags.some((t) => t.toLowerCase() === tag)) return false;
    return !hasBlockingIssues(auditClip(clip));
  });

  // Longest first so the runtime budget fills with substantial clips rather
  // than a pile of two-second fragments.
  const ordered = [...eligible].sort((a, b) => b.durationSeconds - a.durationSeconds);

  const chosen: Clip[] = [];
  let total = 0;

  for (const clip of ordered) {
    if (chosen.length >= maxClips) break;
    if (total + clip.durationSeconds > targetSeconds) continue;
    chosen.push(clip);
    total += clip.durationSeconds;
  }

  return {
    theme,
    slug: slugify(theme),
    clips: chosen,
    totalSeconds: total,
    disclosures: collectDisclosures(chosen),
    credits: collectCredits(chosen),
  };
}

function collectDisclosures(clips: readonly Clip[]): string[] {
  const lines = new Set<string>();
  for (const clip of clips) {
    const line = disclosureLine(clip.provenance);
    if (line) lines.add(line);
  }
  return [...lines];
}

function collectCredits(clips: readonly Clip[]): string[] {
  const lines: string[] = [];
  for (const clip of clips) {
    const line = creditLine(clip);
    if (line) lines.push(line);
  }
  return lines;
}
