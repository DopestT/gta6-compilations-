#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { AuditIssue, Provenance } from "../types.js";
import { auditRegistry, gatingIssues, hasBlockingIssues } from "../provenance/rules.js";
import { defaultRegistryPath, loadRegistry, repoRoot } from "../registry/registry.js";
import { planCompilation } from "../compile/planner.js";
import { buildEngineJob } from "../compile/job.js";
import { ingestClip } from "../ingest/ingest.js";
import { trustedHosts } from "../ingest/trustedSources.js";

interface Args {
  command: string;
  theme: string;
  seconds: number;
  maxClips?: number;
  registry: string;
  out?: string;
  flags: Map<string, string>;
}

function parseArgs(argv: string[]): Args {
  const [command = "help", ...rest] = argv;
  const flags = new Map<string, string>();

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token && token.startsWith("--")) {
      const key = token.slice(2);
      const next = rest[i + 1];
      if (next && !next.startsWith("--")) {
        flags.set(key, next);
        i += 1;
      } else {
        flags.set(key, "true");
      }
    }
  }

  const seconds = Number(flags.get("seconds") ?? 60);
  const maxClipsRaw = flags.get("max-clips");

  return {
    command,
    theme: flags.get("theme") ?? "police chases",
    seconds: Number.isFinite(seconds) ? seconds : 60,
    maxClips: maxClipsRaw ? Number(maxClipsRaw) : undefined,
    registry: flags.get("registry") ?? defaultRegistryPath,
    out: flags.get("out"),
    flags,
  };
}

function printIssues(issues: AuditIssue[]): void {
  if (issues.length === 0) {
    console.log("No issues. Every clip is traceable and honestly labeled.");
    return;
  }
  for (const issue of issues) {
    const marker = issue.severity === "error" ? "ERROR" : "warn ";
    console.log(`${marker}  ${issue.clipId}  [${issue.code}]  ${issue.message}`);
  }
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.length - errors;
  console.log(`\n${errors} error(s), ${warnings} warning(s).`);
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));

  if (args.command === "help") {
    console.log(
      [
        "gta6 — provenance-gated compilation builder",
        "",
        "  audit                          Check every clip's provenance and labeling",
        "  audit --gate                   Fail only on approved clips (used by CI)",
        "  ingest --url U --file F ...    Add a clip, resolving provenance from the URL",
        "  plan  --theme T --seconds N    Show which clips a compilation would use",
        "  job   --theme T --seconds N    Write a youtubeengine job to out/",
        "",
        "Flags: --registry PATH  --max-clips N  --out PATH",
        "",
        "ingest flags:",
        "  --url U         Source URL (required)",
        "  --file F        Path to the media (required)",
        "  --title T       Clip title (required)",
        "  --tags a,b      Comma-separated tags",
        "  --provenance P  Required unless the URL is a trusted source",
        "  --creator C     Overrides the creator inferred from a trusted source",
        "  --captured D    ISO capture date",
        "  --duration N    Seconds, skipping the ffprobe read",
        "  --id I          Explicit clip id",
        "  --review        Hold a trusted clip at review instead of approving",
        "",
        `Trusted sources: ${trustedHosts().join(", ")}`,
      ].join("\n"),
    );
    return 0;
  }

  const registry = await loadRegistry(args.registry);

  if (args.command === "audit") {
    const issues = auditRegistry(registry);
    printIssues(issues);

    // --gate is the CI posture: clips still in review are expected to have
    // open problems, so only a broken *approved* clip fails the build.
    if (args.flags.has("gate")) {
      const blocking = gatingIssues(registry, issues);
      if (blocking.length > 0) {
        console.log(`\nGate: ${blocking.length} error(s) on approved clips.`);
        return 1;
      }
      console.log("\nGate: no errors on approved clips.");
      return 0;
    }

    return hasBlockingIssues(issues) ? 1 : 0;
  }

  if (args.command === "ingest") {
    const url = args.flags.get("url");
    const file = args.flags.get("file");
    const title = args.flags.get("title");

    if (!url || !file || !title) {
      console.error("ingest requires --url, --file and --title.");
      return 1;
    }

    const tagsRaw = args.flags.get("tags");
    const durationRaw = args.flags.get("duration");
    const provenanceRaw = args.flags.get("provenance");

    const result = await ingestClip(args.registry, {
      url,
      file,
      title,
      tags: tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [],
      ...(provenanceRaw ? { provenance: provenanceRaw as Provenance } : {}),
      ...(args.flags.get("creator") ? { creator: args.flags.get("creator") as string } : {}),
      ...(args.flags.get("captured") ? { capturedAt: args.flags.get("captured") as string } : {}),
      ...(durationRaw ? { durationSeconds: Number(durationRaw) } : {}),
      ...(args.flags.get("id") ? { id: args.flags.get("id") as string } : {}),
      ...(args.flags.has("review") ? { forceReview: true } : {}),
    });

    const { clip } = result;
    console.log(`Added ${clip.id}`);
    console.log(`  provenance: ${clip.provenance}${result.trusted ? " (from trusted source)" : ""}`);
    console.log(`  duration:   ${clip.durationSeconds}s (${result.durationSource})`);
    console.log(`  status:     ${clip.status}`);
    if (clip.status === "review") {
      console.log("\nHolding at review. Clear it with \"audit\", then set status to approved.");
    }
    return 0;
  }

  if (args.command === "plan" || args.command === "job") {
    const plan = planCompilation(registry, {
      theme: args.theme,
      targetSeconds: args.seconds,
      ...(args.maxClips === undefined ? {} : { maxClips: args.maxClips }),
    });

    if (plan.clips.length === 0) {
      console.error(
        `No eligible clips for theme "${args.theme}". Run "audit" — clips with blocking issues are excluded on purpose.`,
      );
      return 1;
    }

    console.log(`Theme: ${plan.theme}`);
    console.log(`Clips: ${plan.clips.length}  Runtime: ${plan.totalSeconds}s\n`);
    for (const clip of plan.clips) {
      console.log(`  ${clip.durationSeconds}s  [${clip.provenance}]  ${clip.title}`);
    }
    if (plan.disclosures.length > 0) {
      console.log("\nRequired disclosures:");
      for (const line of plan.disclosures) console.log(`  ${line}`);
    }

    if (args.command === "plan") return 0;

    const job = buildEngineJob(plan);
    const outPath = args.out ?? path.join(repoRoot, "out", `${job.jobId}.json`);
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, `${JSON.stringify(job, null, 2)}\n`, "utf8");

    console.log(`\nWrote ${outPath}`);
    console.log(`Title: ${job.title}`);
    console.log(`Visibility: ${job.visibility}`);
    return 0;
  }

  console.error(`Unknown command "${args.command}". Run with "help".`);
  return 1;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
