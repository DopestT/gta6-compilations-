import { Provenance } from "../types.js";

/**
 * Domains whose ownership settles a clip's provenance on its own.
 *
 * The point of the allowlist is that no judgment is left: footage served from
 * Rockstar's own properties is official promotional material by definition.
 * Anything not on this list needs a human to say what it is, which is the one
 * step the pipeline deliberately does not automate.
 */
interface TrustedSource {
  /** Host, matched exactly or as a suffix after a dot. */
  host: string;
  /** Optional path prefix, for platforms where the host alone is not enough. */
  pathPrefix?: string;
  provenance: Provenance;
  label: string;
}

const TRUSTED: readonly TrustedSource[] = [
  { host: "rockstargames.com", provenance: "official-rockstar", label: "Rockstar Games" },
  { host: "rockstarnorth.com", provenance: "official-rockstar", label: "Rockstar North" },
  {
    host: "youtube.com",
    pathPrefix: "/@rockstargames",
    provenance: "official-rockstar",
    label: "Rockstar Games",
  },
  {
    host: "youtube.com",
    pathPrefix: "/rockstargames",
    provenance: "official-rockstar",
    label: "Rockstar Games",
  },
];

export interface TrustedMatch {
  provenance: Provenance;
  /** Creator name to record, so the credit line is filled in automatically. */
  creator: string;
}

function hostMatches(actual: string, expected: string): boolean {
  const host = actual.toLowerCase().replace(/^www\./, "");
  return host === expected || host.endsWith(`.${expected}`);
}

/**
 * Resolve a source URL to a provenance, or null when the URL proves nothing.
 *
 * A null result is not a failure — it means the clip needs an explicit call.
 */
export function classifySourceUrl(rawUrl: string): TrustedMatch | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  // Only https proves anything about who served the file.
  if (url.protocol !== "https:") return null;

  for (const source of TRUSTED) {
    if (!hostMatches(url.hostname, source.host)) continue;
    if (source.pathPrefix) {
      const path = url.pathname.toLowerCase();
      if (!path.startsWith(source.pathPrefix)) continue;
    }
    return { provenance: source.provenance, creator: source.label };
  }

  return null;
}

/** The hosts the allowlist covers, for help text and docs. */
export function trustedHosts(): string[] {
  return [...new Set(TRUSTED.map((s) => (s.pathPrefix ? `${s.host}${s.pathPrefix}` : s.host)))];
}
