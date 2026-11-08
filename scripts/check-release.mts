// Checks release files and prints exactly what will be announced, then the full changelog.
//
//   One file:   node … scripts/check-release.mts < releases/1.15.0.md
//   A batch:    node … scripts/check-release.mts <releases dir> <version> [<last announced version>]
//
// The batch form is what scripts/promote.sh runs: every release after the last announced version up
// to <version> goes out as ONE post (lib/releaseNotes bundleReleases), so it shows that bundled post
// word for word, then each version's full changelog (which stays on /changelog only).
//   node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-release.mts …
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  VERSION_RE,
  announcementBriefLine,
  announcementText,
  bundleReleases,
  compareVersions,
  parseReleaseNote,
  releaseIsDue,
  splitMarker,
  type ReleaseNote,
} from "../src/lib/releaseNotes.ts";

const ORIGIN = "https://anvilosrs.com";

function changelog(r: ReleaseNote): string[] {
  const out = [
    `Anvil ${r.version}: ${r.title}${r.pluginVersion ? ` (plugin ${r.pluginVersion})` : ""}${r.silent ? " [silent]" : ""}`,
  ];
  if (r.news?.length) out.push("", "News", ...r.news.map((x) => `  ${x}`));
  for (const [label, xs] of [
    ["Highlights", r.highlights],
    ["New", r.added],
    ["Improved", r.improved],
    ["Fixed", r.fixed],
  ] as const) {
    if (xs.length) {
      out.push(
        "",
        label,
        ...xs.map((x) => {
          const { text, from } = splitMarker(x);
          return `  • ${text}${from ? `  (follow-up to ${from})` : ""}`;
        }),
      );
    }
  }
  return out;
}

function show(
  batch: ReleaseNote[],
  lastAnnounced: string | null,
  target: ReleaseNote,
): void {
  const out: string[] = [];
  if (target.silent) {
    out.push(
      "SILENT: ships without announcing; goes out with the next release, or Announce now on /staff/releases.",
      "",
    );
  }
  const bundle = bundleReleases(batch, lastAnnounced);
  out.push(
    `=== ${target.silent ? "ANNOUNCED LATER (if it went out on its own)" : "ANNOUNCED"} (#anvil-announcements, clans' Anvil updates) — covers ${bundle.versions.join(", ")} since ${lastAnnounced ?? "the first release"} ===`,
    "",
    announcementText(bundle, ORIGIN),
    "",
    "=== PLUGIN LOGIN LINE ===",
    "",
    announcementBriefLine(bundle, ORIGIN),
  );
  out.push("", "=== FULL CHANGELOG (/changelog only, never posted) ===");
  for (const r of [...batch].reverse()) out.push("", ...changelog(r));
  console.log(out.join("\n"));
}

try {
  const [dir, version, last] = process.argv.slice(2);
  if (dir) {
    if (!VERSION_RE.test(version ?? ""))
      throw new Error(
        "usage: check-release.mts <releases dir> <version> [<last announced>]",
      );
    const lastAnnounced = last && VERSION_RE.test(last) ? last : null;
    const notes: ReleaseNote[] = [];
    for (const n of readdirSync(dir).filter((f) =>
      /^\d+\.\d+\.\d+\.md$/.test(f),
    )) {
      try {
        notes.push(parseReleaseNote(readFileSync(path.join(dir, n), "utf8")));
      } catch (err) {
        throw new Error(`${n}: ${(err as Error).message}`);
      }
    }
    const upTo = notes.filter((n) => compareVersions(n.version, version) >= 0);
    const target = upTo.find((n) => n.version === version);
    if (!target) throw new Error(`no releases/${version}.md`);
    const batch = upTo
      .filter(
        (n) =>
          lastAnnounced == null ||
          compareVersions(n.version, lastAnnounced) < 0,
      )
      .filter((n) => releaseIsDue(n, upTo, new Set()));
    show(batch.length ? batch : [target], lastAnnounced, target);
  } else {
    let text = "";
    for await (const chunk of process.stdin) text += chunk;
    const r = parseReleaseNote(text);
    show([r], null, r);
  }
} catch (err) {
  console.error(`Release file is not valid: ${(err as Error).message}`);
  process.exit(1);
}
