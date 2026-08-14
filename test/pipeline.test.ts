import assert from "node:assert/strict";
import { test } from "node:test";
import { Registry } from "../src/types.js";
import { planCompilation } from "../src/compile/planner.js";
import { buildEngineJob } from "../src/compile/job.js";
import { loadRegistry } from "../src/registry/registry.js";

const registry: Registry = {
  version: 1,
  updatedAt: "2026-08-14",
  clips: [
    {
      id: "ok-1",
      title: "Causeway pursuit",
      file: "clips/media/ok-1.mp4",
      durationSeconds: 20,
      provenance: "official-rockstar",
      sourceUrl: "https://www.rockstargames.com/VI",
      creator: "Rockstar Games",
      tags: ["police chases"],
      status: "approved",
    },
    {
      id: "ok-2",
      title: "Roadblock break",
      file: "clips/media/ok-2.mp4",
      durationSeconds: 15,
      provenance: "official-rockstar",
      sourceUrl: "https://www.rockstargames.com/VI",
      creator: "Rockstar Games",
      tags: ["police chases"],
      status: "approved",
    },
    {
      id: "unsourced",
      title: "Mystery chase",
      file: "clips/media/unsourced.mp4",
      durationSeconds: 10,
      provenance: "unknown",
      tags: ["police chases"],
      status: "approved",
    },
    {
      id: "not-approved",
      title: "Held clip",
      file: "clips/media/held.mp4",
      durationSeconds: 5,
      provenance: "official-rockstar",
      sourceUrl: "https://www.rockstargames.com/VI",
      creator: "Rockstar Games",
      tags: ["police chases"],
      status: "review",
    },
  ],
};

test("planner excludes unsourced and unapproved clips", () => {
  const plan = planCompilation(registry, { theme: "police chases", targetSeconds: 60 });
  const ids = plan.clips.map((c) => c.id);
  assert.deepEqual(ids, ["ok-1", "ok-2"]);
  assert.equal(plan.totalSeconds, 35);
});

test("planner respects the runtime budget", () => {
  const plan = planCompilation(registry, { theme: "police chases", targetSeconds: 20 });
  assert.deepEqual(plan.clips.map((c) => c.id), ["ok-1"]);
});

test("an all-official plan may claim gameplay and needs no disclosure", () => {
  const plan = planCompilation(registry, { theme: "police chases", targetSeconds: 60 });
  const job = buildEngineJob(plan, { now: new Date("2026-08-14T00:00:00Z") });
  assert.equal(plan.disclosures.length, 0);
  assert.equal(job.visibility, "unlisted");
  assert.match(job.description, /Sources:/);
});

test("a plan containing AI footage forces disclosure and stays private", () => {
  const mixed: Registry = {
    ...registry,
    clips: [
      ...registry.clips,
      {
        id: "ai-1",
        title: "Dock walk concept render",
        file: "clips/media/ai-1.mp4",
        durationSeconds: 8,
        provenance: "ai-generated",
        sourceUrl: "https://example.com/ai",
        creator: "unattributed",
        tags: ["police chases"],
        status: "approved",
        notes: "AI render.",
      },
    ],
  };

  const plan = planCompilation(mixed, { theme: "police chases", targetSeconds: 60 });
  const job = buildEngineJob(plan, { now: new Date("2026-08-14T00:00:00Z") });

  assert.ok(plan.clips.some((c) => c.id === "ai-1"));
  assert.ok(plan.disclosures.some((d) => /AI-generated/.test(d)));
  assert.equal(job.visibility, "private");
  assert.doesNotMatch(job.title, /gameplay/i);
  // The disclosure has to survive in the pixels, not only the description.
  assert.match(job.captions.text, /Not actual GTA VI gameplay/);
  assert.match(job.hookText, /Not actual GTA VI gameplay/);
  assert.match(job.description, /Not actual GTA VI gameplay/);
});

test("building a job from an empty plan throws", () => {
  const plan = planCompilation(registry, { theme: "nonexistent theme", targetSeconds: 60 });
  assert.throws(() => buildEngineJob(plan), /no clips/i);
});

test("the shipped registry loads and parses", async () => {
  const loaded = await loadRegistry();
  assert.ok(loaded.clips.length > 0);
});
