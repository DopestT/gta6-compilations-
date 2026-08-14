import assert from "node:assert/strict";
import { test } from "node:test";
import { Clip } from "../src/types.js";
import { auditClip, hasBlockingIssues, titleIsHonest } from "../src/provenance/rules.js";

function clip(overrides: Partial<Clip> = {}): Clip {
  return {
    id: "c1",
    title: "A moment",
    file: "clips/media/c1.mp4",
    durationSeconds: 10,
    provenance: "official-rockstar",
    sourceUrl: "https://www.rockstargames.com/VI",
    creator: "Rockstar Games",
    capturedAt: "2025-05-06",
    tags: ["trailer"],
    status: "approved",
    notes: "ok",
    ...overrides,
  };
}

test("a sourced official clip passes clean", () => {
  assert.equal(auditClip(clip()).length, 0);
});

test("unknown provenance blocks the clip", () => {
  const issues = auditClip(clip({ provenance: "unknown", sourceUrl: undefined, creator: undefined }));
  assert.ok(issues.some((i) => i.code === "unknown-provenance" && i.severity === "error"));
  assert.ok(hasBlockingIssues(issues));
});

test("missing source url blocks attribution-required footage", () => {
  const issues = auditClip(clip({ sourceUrl: undefined }));
  assert.ok(issues.some((i) => i.code === "missing-source-url" && i.severity === "error"));
});

test("gameplay claimed before release is impossible and blocks", () => {
  const issues = auditClip(clip({ provenance: "user-gameplay", capturedAt: "2026-07-20" }));
  assert.ok(issues.some((i) => i.code === "impossible-capture-date" && i.severity === "error"));
});

test("gameplay after release is allowed", () => {
  const issues = auditClip(clip({ provenance: "user-gameplay", capturedAt: "2026-12-01" }));
  assert.equal(hasBlockingIssues(issues), false);
});

test("AI footage titled as gameplay is blocked", () => {
  const issues = auditClip(
    clip({ provenance: "ai-generated", title: "GTA VI first person gameplay" }),
  );
  assert.ok(issues.some((i) => i.code === "mislabeled-as-gameplay" && i.severity === "error"));
});

test("AI footage titled honestly is not blocked", () => {
  const issues = auditClip(clip({ provenance: "ai-generated", title: "Dock walk concept render" }));
  assert.equal(hasBlockingIssues(issues), false);
});

test("titleIsHonest rejects a gameplay claim over a mixed cut", () => {
  assert.equal(titleIsHonest("GTA VI Gameplay Compilation", ["official-rockstar", "ai-generated"]), false);
  assert.equal(titleIsHonest("GTA VI Gameplay Compilation", ["official-rockstar"]), true);
  assert.equal(titleIsHonest("GTA VI Best Moments", ["ai-generated"]), true);
});
