import { CompilationPlan, Provenance } from "../types.js";
import { titleIsHonest } from "../provenance/rules.js";

/**
 * Title patterns for compilation shorts.
 *
 * Two pools: one that may assert gameplay, one that stays accurate when the
 * cut contains fan-made or AI footage. The honest pool is the fallback, never
 * an afterthought — a mixed plan simply never sees the gameplay pool.
 */
const GAMEPLAY_PATTERNS = [
  "GTA VI {theme} — {count} Clips You Missed",
  "{count} {theme} Moments in GTA VI",
  "GTA VI {theme} Gameplay Compilation",
];

const NEUTRAL_PATTERNS = [
  "GTA VI {theme} — {count} Clips",
  "{count} {theme} Moments | GTA VI Concept Reel",
  "GTA VI {theme} Fan Compilation",
];

export function titleVariants(plan: CompilationPlan): string[] {
  const provenances: Provenance[] = plan.clips.map((c) => c.provenance);
  const pool = provenances.every((p) => p === "official-rockstar" || p === "user-gameplay")
    ? GAMEPLAY_PATTERNS
    : NEUTRAL_PATTERNS;

  return pool
    .map((pattern) =>
      pattern.replace("{theme}", titleCase(plan.theme)).replace("{count}", String(plan.clips.length)),
    )
    .filter((title) => titleIsHonest(title, provenances));
}

export function primaryTitle(plan: CompilationPlan): string {
  const variants = titleVariants(plan);
  const first = variants[0];
  if (first) return first;
  // Every pattern was rejected: fall back to a claim-free title.
  return `GTA VI ${titleCase(plan.theme)} — ${plan.clips.length} Clips`;
}

export function buildDescription(plan: CompilationPlan): string {
  const sections: string[] = [];

  sections.push(`${titleCase(plan.theme)} compilation — ${plan.clips.length} clips, ${plan.totalSeconds}s.`);

  if (plan.disclosures.length > 0) {
    sections.push(plan.disclosures.join("\n"));
  }

  if (plan.credits.length > 0) {
    sections.push(["Sources:", ...plan.credits.map((c) => `- ${c}`)].join("\n"));
  }

  sections.push(
    "Grand Theft Auto VI is a trademark of Take-Two Interactive. This is unofficial fan content.",
  );

  return sections.join("\n\n");
}

/**
 * Text burned into the video itself. Disclosures belong on the pixels, not
 * only in a description nobody expands.
 */
export function burnInDisclosure(plan: CompilationPlan): string | null {
  if (plan.disclosures.length === 0) return null;
  return plan.disclosures.join("  •  ");
}

export function hashtagsFor(plan: CompilationPlan): string[] {
  const base = ["#Shorts", "#GTA6", "#GTAVI", "#ViceCity"];
  const themed = `#${titleCase(plan.theme).replace(/[^A-Za-z0-9]/g, "")}`;
  if (!base.includes(themed) && themed.length > 1) base.push(themed);
  return base;
}

function titleCase(value: string): string {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((word) => (word[0] ?? "").toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
