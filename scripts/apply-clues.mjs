#!/usr/bin/env node
/**
 * Merges hand-authored clues from scripts/clue-data.mjs into seed/players.json,
 * preserving each player's name/tags/popularityTier. Validates that every
 * player is covered and every difficulty has clues before writing.
 *
 * Run: node scripts/apply-clues.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CLUES } from "./clue-data.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "seed", "players.json");
const LEVELS = ["easy", "medium", "hard", "impossible"];

const data = JSON.parse(readFileSync(OUT, "utf8"));
const errors = [];
const warnings = [];
const seedNames = new Set(data.players.map((p) => p.name));

for (const key of Object.keys(CLUES)) {
  if (!seedNames.has(key)) errors.push(`CLUES has unknown player "${key}"`);
}

let clueCount = 0;
for (const p of data.players) {
  const c = CLUES[p.name];
  if (!c) {
    errors.push(`No clues authored for "${p.name}"`);
    continue;
  }
  const next = {};
  for (const lvl of LEVELS) {
    const arr = c[lvl] ?? [];
    if (!Array.isArray(arr) || arr.length === 0) {
      errors.push(`"${p.name}" missing ${lvl} clues`);
    } else if (arr.length < 4 || arr.length > 8) {
      warnings.push(`"${p.name}" ${lvl} has ${arr.length} clues (target ~5)`);
    }
    const seen = new Set();
    for (const t of arr) {
      if (typeof t !== "string" || t.trim().length < 8) {
        errors.push(`"${p.name}" ${lvl} has a too-short/invalid clue`);
      }
      if (seen.has(t)) errors.push(`"${p.name}" ${lvl} duplicate: ${t}`);
      seen.add(t);
    }
    next[lvl] = arr;
    clueCount += arr.length;
  }
  p.clues = next;
}

if (warnings.length) {
  console.warn(`Warnings (${warnings.length}):`);
  for (const w of warnings.slice(0, 40)) console.warn(`  - ${w}`);
}
if (errors.length) {
  console.error(`\nFAILED with ${errors.length} error(s):`);
  for (const e of errors.slice(0, 60)) console.error(`  - ${e}`);
  process.exit(1);
}

data.generatedAt = new Date().toISOString();
writeFileSync(OUT, JSON.stringify(data, null, 2) + "\n");
console.log(
  `OK: wrote ${data.players.length} players, ${clueCount} clues to ${OUT}`,
);
