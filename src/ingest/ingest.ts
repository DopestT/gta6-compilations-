import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { Clip, Provenance, Registry } from "../types.js";
import { auditClip, hasBlockingIssues } from "../provenance/rules.js";
import { repoRoot } from "../registry/registry.js";
import { slugify } from "../compile/planner.js";
import { classifySourceUrl } from "./trustedSources.js";

const run = promisify(execFile);

export interface IngestInput {
  url: string;
  file: string;
  title: string;
  tags: string[];
  /** Required when the URL is not on the trusted allowlist. */
  provenance?: Provenance;
  creator?: string;
  capturedAt?: string;
  /** Skips probing when supplied. Required if ffprobe is unavailable. */
  durationSeconds?: number;
  id?: string;
  /** Hold a trusted clip at review instead of auto-approving it. */
  forceReview?: boolean;
}

export interface IngestResult {
  clip: Clip;
  /** True when the URL settled the provenance on its own. */
  trusted: boolean;
  durationSource: "probed" | "supplied";
}

/**
 * Read a clip's duration with ffprobe.
 *
 * Returns null when ffprobe is not installed or cannot read the file, so the
 * caller can fall back to an explicit duration rather than dying on a missing
 * optional dependency.
 */
export async function probeDuration(file: string): Promise<number | null> {
  const target = path.isAbsolute(file) ? file : path.join(repoRoot, file);
  try {
    const { stdout } = await run("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "csv=p=0",
      target,
    ]);
    const seconds = Number.parseFloat(stdout.trim());
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    return Math.round(seconds);
  } catch {
    return null;
  }
}

/**
 * Add a clip to the registry, resolving provenance from the source URL where
 * the URL is proof on its own.
 *
 * A trusted URL lands the clip at `approved`, because the domain is the
 * evidence and there is nothing left for a person to decide. Everything else
 * requires an explicit provenance and lands at `review`.
 */
export async function ingestClip(registryPath: string, input: IngestInput): Promise<IngestResult> {
  const match = classifySourceUrl(input.url);

  const provenance = match?.provenance ?? input.provenance;
  if (!provenance) {
    throw new Error(
      `${input.url} is not a trusted source, so its provenance cannot be inferred. ` +
        `Pass --provenance with one of: official-rockstar, user-gameplay, fan-made, ai-generated, unknown.`,
    );
  }

  let durationSource: IngestResult["durationSource"] = "supplied";
  let duration = input.durationSeconds;
  if (duration === undefined) {
    const probed = await probeDuration(input.file);
    if (probed === null) {
      throw new Error(
        `Could not read the duration of ${input.file}. Install ffprobe or pass --duration <seconds>.`,
      );
    }
    duration = probed;
    durationSource = "probed";
  }

  const registry = JSON.parse(await readFile(registryPath, "utf8")) as Registry;
  const id = input.id ?? slugify(input.title);

  if (registry.clips.some((c) => c.id === id)) {
    throw new Error(`Clip id "${id}" is already in the registry. Pass --id to choose another.`);
  }

  const clip: Clip = {
    id,
    title: input.title,
    file: input.file,
    durationSeconds: duration,
    provenance,
    sourceUrl: input.url,
    tags: input.tags,
    // Trust settles the call, so the clip goes straight to approved unless
    // held back deliberately. Anything else waits for a person.
    status: match && !input.forceReview ? "approved" : "review",
    ...(input.creator ?? match?.creator ? { creator: input.creator ?? match?.creator } : {}),
    ...(input.capturedAt ? { capturedAt: input.capturedAt } : {}),
  };

  // Auto-approving a clip that fails its own audit would defeat the gate, so
  // check before writing and hold it at review instead.
  if (clip.status === "approved" && hasBlockingIssues(auditClip(clip))) {
    clip.status = "review";
  }

  registry.clips.push(clip);
  registry.updatedAt = new Date().toISOString().slice(0, 10);
  await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");

  return { clip, trusted: match !== null, durationSource };
}
