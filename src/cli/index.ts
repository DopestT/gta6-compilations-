#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { AuditIssue } from "../types.js";
import { auditRegistry, hasBlockingIssues } from "../provenance/rules.js";
import { defaultRegistryPath, loadRegistry, repoRoot } from "../registry/registry.js";
import { planCompilation } from "../compile/planner.js";
import { buildEngineJob } from "../compile/job.js";

interface Args {
  command: string;
  theme: string;
  seconds: number;
  maxClips?: number;
  registry: string;
  out?: string;
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
        "  plan  --theme T --seconds N    Show which clips a compilation would use",
        "  job   --theme T --seconds N    Write a youtubeengine job to out/",
        "",
        "Flags: --registry PATH  --max-clips N  --out PATH",
      ].join("\n"),
    );
    return 0;
  }

  const registry = await loadRegistry(args.registry);

  if (args.command === "audit") {
    const issues = auditRegistry(registry);
    printIssues(issues);
    return hasBlockingIssues(issues) ? 1 : 0;
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
