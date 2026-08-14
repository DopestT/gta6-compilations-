# gta6-compilations

A provenance-gated compilation pipeline for the GTA VI channel. It turns a vetted clip registry into
[youtubeengine](https://github.com/DopestT/youtubeengine)-ready jobs, and refuses to build anything it
cannot honestly label.

## Why the gate exists

GTA VI ships **2026-11-19**. Rockstar's first gameplay showing is the extended look on 2026-08-27.
Until then there is no player-captured GTA VI gameplay anywhere, which means the feeds are full of
AI-generated and fan-made footage wearing a GTA VI watermark.

Reposting that as "gameplay" is how compilation channels get demonetized, flagged, or struck. So the
labeling rules live in code and run on every build, rather than depending on someone eyeballing a clip
at 2am.

## Rules enforced

| Rule | Severity | What it catches |
| --- | --- | --- |
| `unknown-provenance` | error | A clip nobody can trace to a source |
| `missing-source-url` | error | Attribution-required footage with no link |
| `impossible-capture-date` | error | "Gameplay" captured before the game exists |
| `mislabeled-as-gameplay` | error | AI or fan footage titled as gameplay |
| `missing-creator` | warning | Credit line would read "unknown creator" |
| `undocumented-synthetic` | warning | Synthetic clip approved with no note explaining why |

A clip with any **error** is excluded from planning, so it can never reach a rendered video.

## Provenance values

- `official-rockstar` — trailers and official promo material. Creditable, may be called gameplay.
- `user-gameplay` — player capture. Only possible on or after release.
- `fan-made` — concept renders. Requires disclosure + credit.
- `ai-generated` — synthetic footage. Requires disclosure + credit, never called gameplay.
- `unknown` — blocked until traced.

## How disclosure works

When a plan contains fan-made or AI footage, the disclosure is written into **three** fields of the
job — `description`, `captions.text` (burned in), and `hookText` — and the job's visibility drops to
`private` so a human signs off before it publishes. Dropping any single field cannot silently strip
the label.

## Usage

```bash
npm install
npm run audit                              # check every clip
npm run dev -- plan --theme "police chases" --seconds 60
npm run dev -- job  --theme "vice city"    --seconds 60
npm test
```

Flags: `--registry PATH`, `--max-clips N`, `--out PATH`.

## Registry

`clips/registry.json` holds the metadata; the media itself lives in `clips/media/` and is gitignored.

```json
{
  "id": "t2-chase-causeway",
  "title": "Causeway pursuit at dusk",
  "file": "clips/media/t2-chase-causeway.mp4",
  "durationSeconds": 12,
  "provenance": "official-rockstar",
  "sourceUrl": "https://www.rockstargames.com/VI",
  "creator": "Rockstar Games",
  "capturedAt": "2025-05-06",
  "tags": ["police chases", "trailer"],
  "status": "approved"
}
```

`status` is the human gate (`approved` / `review` / `rejected`); the audit rules are the automated one.
A clip needs both to ship.

## Handing off to youtubeengine

`job` writes a job matching youtubeengine's `EngineJob` shape. Copy it across and process:

```bash
cp out/gta6-vice-city.json ../youtubeengine/jobs/
cd ../youtubeengine
node dist/cli/index.js process --job jobs/gta6-vice-city.json
```

The matching brand profile is committed to `youtubeengine/assets/brands/gta6-compilations.json`.
The generated jobs validate against that engine's validator with no errors or warnings.

## Layout

```text
brand/                  Brand profile, mirrored into youtubeengine
clips/registry.json     Clip metadata and provenance
clips/media/            Media files (gitignored)
out/                    Generated jobs (gitignored)
src/provenance/         The labeling rules
src/registry/           Registry loading
src/compile/            Planner and job builder
src/metadata/           Titles, descriptions, disclosures
test/                   Rule and pipeline tests
```

## Runbook

Step-by-step operating instructions — logging a clip, auditing, planning a cut, rendering and publishing — are in [`docs/RUNBOOK.md`](docs/RUNBOOK.md).
