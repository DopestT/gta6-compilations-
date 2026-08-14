import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Clip, Registry } from "../types.js";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Repo root, resolved from this file so it works from src/ or dist/. */
export const repoRoot = path.resolve(here, "..", "..");

export const defaultRegistryPath = path.join(repoRoot, "clips", "registry.json");

export async function loadRegistry(file = defaultRegistryPath): Promise<Registry> {
  const raw = await readFile(file, "utf8");
  const parsed = JSON.parse(raw) as Registry;

  if (!Array.isArray(parsed.clips)) {
    throw new Error(`Registry at ${file} has no clips array.`);
  }

  for (const clip of parsed.clips) {
    assertClipShape(clip, file);
  }

  return parsed;
}

function assertClipShape(clip: Clip, file: string): void {
  const required: Array<keyof Clip> = ["id", "title", "file", "durationSeconds", "provenance", "status"];
  for (const key of required) {
    if (clip[key] === undefined || clip[key] === null) {
      throw new Error(`Clip ${clip.id ?? "<no id>"} in ${file} is missing "${key}".`);
    }
  }
  if (!Array.isArray(clip.tags)) {
    throw new Error(`Clip ${clip.id} in ${file} is missing a tags array.`);
  }
}

export function approvedClips(registry: Registry): Clip[] {
  return registry.clips.filter((c) => c.status === "approved");
}

export function clipsByTag(registry: Registry, tag: string): Clip[] {
  const needle = tag.toLowerCase();
  return registry.clips.filter((c) => c.tags.some((t) => t.toLowerCase() === needle));
}
