import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { Registry } from "../src/types.js";
import { classifySourceUrl, trustedHosts } from "../src/ingest/trustedSources.js";
import { ingestClip } from "../src/ingest/ingest.js";
import { auditRegistry, gatingIssues } from "../src/provenance/rules.js";

async function tempRegistry(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "gta6-registry-"));
  const file = path.join(dir, "registry.json");
  const empty: Registry = { version: 1, updatedAt: "2026-08-15", clips: [] };
  await writeFile(file, JSON.stringify(empty, null, 2), "utf8");
  return file;
}

async function readRegistry(file: string): Promise<Registry> {
  return JSON.parse(await readFile(file, "utf8")) as Registry;
}

/* ------------------------------- trust ------------------------------- */

test("rockstargames.com is trusted", () => {
  const match = classifySourceUrl("https://www.rockstargames.com/VI");
  assert.equal(match?.provenance, "official-rockstar");
  assert.equal(match?.creator, "Rockstar Games");
});

test("the Rockstar YouTube channel is trusted, other channels are not", () => {
  assert.equal(classifySourceUrl("https://youtube.com/@rockstargames/videos")?.provenance, "official-rockstar");
  assert.equal(classifySourceUrl("https://youtube.com/@someoneelse/videos"), null);
});

test("an untrusted host returns null", () => {
  assert.equal(classifySourceUrl("https://example.com/clip"), null);
  assert.equal(classifySourceUrl("https://notrockstargames.com/VI"), null);
});

test("a lookalike subdomain does not slip through", () => {
  // Suffix matching must be on a dot boundary.
  assert.equal(classifySourceUrl("https://evil-rockstargames.com/VI"), null);
  assert.equal(classifySourceUrl("https://cdn.rockstargames.com/VI")?.provenance, "official-rockstar");
});

test("plain http proves nothing", () => {
  assert.equal(classifySourceUrl("http://www.rockstargames.com/VI"), null);
});

test("a malformed url returns null rather than throwing", () => {
  assert.equal(classifySourceUrl("not a url"), null);
});

test("trustedHosts lists the allowlist", () => {
  assert.ok(trustedHosts().some((h) => h.includes("rockstargames.com")));
});

/* ------------------------------ ingest ------------------------------- */

test("a trusted url auto-approves and fills in the creator", async () => {
  const file = await tempRegistry();
  const result = await ingestClip(file, {
    url: "https://www.rockstargames.com/VI",
    file: "clips/media/x.mp4",
    title: "Causeway pursuit",
    tags: ["police chases"],
    durationSeconds: 12,
  });

  assert.equal(result.trusted, true);
  assert.equal(result.clip.provenance, "official-rockstar");
  assert.equal(result.clip.creator, "Rockstar Games");
  assert.equal(result.clip.status, "approved");
  assert.equal((await readRegistry(file)).clips.length, 1);
});

test("--review holds a trusted clip back", async () => {
  const file = await tempRegistry();
  const result = await ingestClip(file, {
    url: "https://www.rockstargames.com/VI",
    file: "clips/media/x.mp4",
    title: "Causeway pursuit",
    tags: [],
    durationSeconds: 12,
    forceReview: true,
  });
  assert.equal(result.clip.status, "review");
});

test("an untrusted url without a provenance is refused", async () => {
  const file = await tempRegistry();
  await assert.rejects(
    ingestClip(file, {
      url: "https://example.com/clip",
      file: "clips/media/x.mp4",
      title: "Mystery clip",
      tags: [],
      durationSeconds: 10,
    }),
    /not a trusted source/,
  );
});

test("an untrusted url with an explicit provenance lands at review", async () => {
  const file = await tempRegistry();
  const result = await ingestClip(file, {
    url: "https://example.com/clip",
    file: "clips/media/x.mp4",
    title: "Fan concept render",
    tags: [],
    provenance: "fan-made",
    durationSeconds: 10,
  });
  assert.equal(result.trusted, false);
  assert.equal(result.clip.status, "review");
});

test("a trusted clip that fails its own audit is held at review, not approved", async () => {
  const file = await tempRegistry();
  // Title claims first-person, which no provenance on a pre-release clip can
  // honestly support alongside an ai-generated override.
  const result = await ingestClip(file, {
    url: "https://example.com/clip",
    file: "clips/media/x.mp4",
    title: "GTA VI first person gameplay",
    tags: [],
    provenance: "ai-generated",
    durationSeconds: 10,
  });
  assert.equal(result.clip.status, "review");
});

test("a duplicate id is refused", async () => {
  const file = await tempRegistry();
  const input = {
    url: "https://www.rockstargames.com/VI",
    file: "clips/media/x.mp4",
    title: "Causeway pursuit",
    tags: [],
    durationSeconds: 12,
  };
  await ingestClip(file, input);
  await assert.rejects(ingestClip(file, input), /already in the registry/);
});

test("a missing duration with no ffprobe gives an actionable error", async () => {
  const file = await tempRegistry();
  await assert.rejects(
    ingestClip(file, {
      url: "https://www.rockstargames.com/VI",
      file: "clips/media/does-not-exist.mp4",
      title: "Nothing here",
      tags: [],
    }),
    /Install ffprobe or pass --duration/,
  );
});

/* ------------------------------- gate -------------------------------- */

test("rejected clips are skipped by the audit", () => {
  const registry: Registry = {
    version: 1,
    updatedAt: "2026-08-15",
    clips: [
      {
        id: "settled",
        title: "Known bad clip",
        file: "clips/media/settled.mp4",
        durationSeconds: 10,
        provenance: "unknown",
        tags: [],
        status: "rejected",
        notes: "Traced to nothing, parked as a record.",
      },
    ],
  };
  assert.equal(auditRegistry(registry).length, 0);
});

test("the gate ignores review clips and catches approved ones", () => {
  const registry: Registry = {
    version: 1,
    updatedAt: "2026-08-15",
    clips: [
      {
        id: "in-progress",
        title: "Still tracing this",
        file: "clips/media/a.mp4",
        durationSeconds: 10,
        provenance: "unknown",
        tags: [],
        status: "review",
      },
      {
        id: "shipped-broken",
        title: "Approved but untraceable",
        file: "clips/media/b.mp4",
        durationSeconds: 10,
        provenance: "unknown",
        tags: [],
        status: "approved",
      },
    ],
  };

  const issues = auditRegistry(registry);
  const blocking = gatingIssues(registry, issues);

  assert.ok(issues.some((i) => i.clipId === "in-progress"));
  assert.ok(blocking.every((i) => i.clipId === "shipped-broken"));
  assert.ok(blocking.length > 0);
});
