import { AuditIssue, Clip, Provenance, Registry } from "../types.js";

/**
 * GTA VI ships 2026-11-19. Nothing captured before that date can be player
 * gameplay, because no build exists outside Rockstar. Clips claiming
 * `user-gameplay` with an earlier capture date are provably mislabeled.
 */
export const GAME_RELEASE_DATE = "2026-11-19";

/** Words that assert the footage is real, playable gameplay. */
const GAMEPLAY_CLAIM_PATTERN = /\b(gameplay|playing|playthrough|walkthrough|first[- ]person|3rd[- ]person|third[- ]person)\b/i;

/** Provenances that may honestly be presented as gameplay footage. */
const GAMEPLAY_SAFE: ReadonlySet<Provenance> = new Set<Provenance>([
  "official-rockstar",
  "user-gameplay",
]);

/** Provenances that must carry a visible disclosure on the finished video. */
const NEEDS_DISCLOSURE: ReadonlySet<Provenance> = new Set<Provenance>([
  "fan-made",
  "ai-generated",
]);

/** Provenances that require attribution to the original creator. */
const NEEDS_CREDIT: ReadonlySet<Provenance> = new Set<Provenance>([
  "official-rockstar",
  "user-gameplay",
  "fan-made",
  "ai-generated",
]);

export function requiresDisclosure(provenance: Provenance): boolean {
  return NEEDS_DISCLOSURE.has(provenance);
}

/**
 * The line that must appear in the description and burned into the video for
 * a given provenance. Returns null when no disclosure is required.
 */
export function disclosureLine(provenance: Provenance): string | null {
  switch (provenance) {
    case "ai-generated":
      return "Contains AI-generated footage. Not actual GTA VI gameplay.";
    case "fan-made":
      return "Contains fan-made concept footage. Not actual GTA VI gameplay.";
    default:
      return null;
  }
}

export function creditLine(clip: Clip): string | null {
  if (!NEEDS_CREDIT.has(clip.provenance)) return null;
  const who = clip.creator ?? "unknown creator";
  const where = clip.sourceUrl ? ` — ${clip.sourceUrl}` : "";
  return `${clip.title}: ${who}${where}`;
}

/**
 * Audit a single clip against the labeling rules.
 *
 * Errors block a build. Warnings are surfaced but do not block.
 */
export function auditClip(clip: Clip, releaseDate = GAME_RELEASE_DATE): AuditIssue[] {
  const issues: AuditIssue[] = [];

  const issue = (code: string, severity: AuditIssue["severity"], message: string) =>
    issues.push({ clipId: clip.id, code, severity, message });

  if (clip.provenance === "unknown") {
    issue(
      "unknown-provenance",
      "error",
      "Provenance is unknown. Trace the clip to its original source before using it.",
    );
  }

  if (NEEDS_CREDIT.has(clip.provenance) && !clip.sourceUrl) {
    issue(
      "missing-source-url",
      "error",
      `Provenance "${clip.provenance}" requires a sourceUrl for attribution.`,
    );
  }

  if (NEEDS_CREDIT.has(clip.provenance) && !clip.creator) {
    issue("missing-creator", "warning", "No creator recorded, credit line will read 'unknown creator'.");
  }

  // A clip cannot be player-captured gameplay before the game exists.
  if (clip.provenance === "user-gameplay" && clip.capturedAt && clip.capturedAt < releaseDate) {
    issue(
      "impossible-capture-date",
      "error",
      `Marked user-gameplay but captured ${clip.capturedAt}, before the ${releaseDate} release. No player build existed yet.`,
    );
  }

  // The title must not assert gameplay unless the provenance supports it.
  if (GAMEPLAY_CLAIM_PATTERN.test(clip.title) && !GAMEPLAY_SAFE.has(clip.provenance)) {
    issue(
      "mislabeled-as-gameplay",
      "error",
      `Title claims gameplay but provenance is "${clip.provenance}". Retitle it or correct the provenance.`,
    );
  }

  if (requiresDisclosure(clip.provenance) && clip.status === "approved" && !clip.notes) {
    issue(
      "undocumented-synthetic",
      "warning",
      "Synthetic footage approved without notes explaining the call.",
    );
  }

  return issues;
}

/**
 * Audit every clip that is still in play.
 *
 * Rejected clips are skipped: rejecting one is a decision already made, and
 * the entry stays in the registry as the record of having looked at it. Their
 * issues are exactly why they were rejected, so re-reporting them forever
 * would make a well-kept registry noisier the longer you use it.
 */
export function auditRegistry(registry: Registry, releaseDate = GAME_RELEASE_DATE): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const seen = new Set<string>();

  for (const clip of registry.clips) {
    if (seen.has(clip.id)) {
      issues.push({
        clipId: clip.id,
        code: "duplicate-id",
        severity: "error",
        message: "Duplicate clip id in registry.",
      });
    }
    seen.add(clip.id);
    if (clip.status === "rejected") continue;
    issues.push(...auditClip(clip, releaseDate));
  }

  return issues;
}

export function hasBlockingIssues(issues: AuditIssue[]): boolean {
  return issues.some((i) => i.severity === "error");
}

/**
 * The subset of issues that should fail a build.
 *
 * A clip in `review` is work in progress — errors on it are the normal state
 * of tracing a clip down, not a broken repo. A clip marked `approved` is an
 * assertion that it is clean, so an error there is a real defect and the only
 * thing worth blocking a merge over.
 */
export function gatingIssues(registry: Registry, issues: readonly AuditIssue[]): AuditIssue[] {
  const approved = new Set(
    registry.clips.filter((c) => c.status === "approved").map((c) => c.id),
  );
  return issues.filter((i) => i.severity === "error" && approved.has(i.clipId));
}

/**
 * Reject a title that promises gameplay the plan cannot deliver. Used when a
 * compilation mixes provenances: if any clip is synthetic, the packaging copy
 * has to stop short of a flat gameplay claim.
 */
export function titleIsHonest(title: string, provenances: readonly Provenance[]): boolean {
  if (!GAMEPLAY_CLAIM_PATTERN.test(title)) return true;
  return provenances.every((p) => GAMEPLAY_SAFE.has(p));
}
