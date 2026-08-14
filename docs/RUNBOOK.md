# Runbook

The day-to-day loop: clip in hand → published video. Follow it in order.

## One-time setup

```bash
cd gta6-compilations-
npm install
```

Node 20+. No other dependencies. ffmpeg is only needed later, by youtubeengine.

---

## Step 1 — You found a clip. Log it.

Do **not** download it into the project yet. First answer one question: **where did this actually come from?**

Pick the provenance honestly:

| If it is... | Use |
| --- | --- |
| A Rockstar trailer, official screenshot, or the extended look | `official-rockstar` |
| Someone playing the actual game (only possible on/after 2026-11-19) | `user-gameplay` |
| A fan render, concept video, mod, or animation | `fan-made` |
| AI-generated video, however real it looks | `ai-generated` |
| You genuinely cannot tell | `unknown` |

`unknown` is a valid, useful answer. It parks the clip instead of guessing.

Add the entry to `clips/registry.json`:

```json
{
  "id": "short-kebab-id",
  "title": "What happens in the clip",
  "file": "clips/media/short-kebab-id.mp4",
  "durationSeconds": 12,
  "provenance": "official-rockstar",
  "sourceUrl": "https://where-you-found-it",
  "creator": "Who made it",
  "capturedAt": "2026-08-14",
  "tags": ["police chases"],
  "status": "review"
}
```

Start every clip at `"status": "review"`. Put the media at the `file` path.

### Sizing a clip

`durationSeconds` is what the planner budgets against, so it has to be the real length:

```bash
ffprobe -v error -show_entries format=duration -of csv=p=0 clips/media/short-kebab-id.mp4
```

---

## Step 2 — Audit

```bash
npm run audit
```

Fix every **ERROR** before going further. What they mean:

- **`unknown-provenance`** — trace it or drop it. Reverse image search a frame, check the uploader's history, look for the original post.
- **`missing-source-url`** — add the link you got it from.
- **`impossible-capture-date`** — you marked it `user-gameplay` but dated it before 2026-11-19. The game did not exist yet, so the clip is something else. Re-check what it really is.
- **`mislabeled-as-gameplay`** — the title claims gameplay but the provenance says otherwise. Either the title is wrong or the provenance is. Fix whichever is actually false.

**Warnings** are fine to ship with, but read them. `missing-creator` means the credit line will say "unknown creator" on a public video.

---

## Step 3 — Promote to approved

Once a clip audits clean and you're happy with it, change its `status` to `"approved"`. Only approved clips are eligible for a compilation.

Re-run `npm run audit` after editing. It should exit clean.

---

## Step 4 — Plan the cut

See what a compilation would pull, without writing anything:

```bash
npm run dev -- plan --theme "police chases" --seconds 60
```

`--theme` matches against clip `tags`. `--seconds` is the runtime budget — clips are added longest-first until the next one would overshoot. Add `--max-clips 8` to cap the count.

If it says no eligible clips, that is the gate doing its job: run `audit` and look at what got excluded.

Tune the theme and seconds until the lineup looks right.

---

## Step 5 — Build the job

```bash
npm run dev -- job --theme "police chases" --seconds 60
```

Writes `out/gta6-<theme>.json`. Read what it printed:

- **Title** — check it reads well and is honest.
- **Visibility** — `private` means the cut contains fan-made or AI footage and needs your sign-off. `unlisted` means it is all official/gameplay footage.
- **Required disclosures** — if any are listed, they are now burned into the video, in the description, and in the hook text. Do not strip them.

---

## Step 6 — Render in youtubeengine

```bash
cp out/gta6-police-chases.json ../youtubeengine/jobs/
cd ../youtubeengine
npm run build
node dist/cli/index.js validate jobs/gta6-police-chases.json
node dist/cli/index.js process --job jobs/gta6-police-chases.json
```

Output lands in `output/gta6-police-chases/<platform>/` — final MP4, thumbnail, metadata, and upload copy per platform.

The `gta6-compilations` brand profile must exist at `youtubeengine/assets/brands/gta6-compilations.json` or the brand lookup fails.

---

## Step 7 — Before you publish

Check the rendered video itself, not just the job file:

1. If a disclosure was required, **confirm it is visibly on the video.** The job puts it there; verify the render kept it.
2. Confirm the title does not promise gameplay the cut does not contain.
3. Confirm the description credits every source.

Then publish.

---

## Common situations

**"This clip is obviously real gameplay, the rule is wrong."**
Before 2026-11-19 it isn't, because no player build exists outside Rockstar. Official trailer footage is `official-rockstar`, not `user-gameplay` — that is the label you want.

**"I want to use an AI clip anyway."**
You can. Mark it `ai-generated`, give it an honest title, approve it. It ships with a disclosure and the job goes out `private` so you sign off first. What you cannot do is call it gameplay.

**"The audit blocks something I need right now."**
The block is a claim you can't back. Either fix the claim or find the source. Editing the rules to get past your own gate defeats the point of having one.

**"Where do rejected clips go?"**
Set `"status": "rejected"` and leave the entry in place with a note. The registry is the record of what you already looked at, so you don't re-litigate the same clip in three months.
