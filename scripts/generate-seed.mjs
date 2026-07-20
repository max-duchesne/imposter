#!/usr/bin/env node
/**
 * Generates seed/players.json from BBRef 2025-26 stats + All-Star /
 * All-Defensive honor lists + curated HOF data.
 *
 * Run: node scripts/generate-seed.mjs
 *
 * ⚠️  DEPRECATED FOR CLUE TEXT. Clues in seed/players.json are now
 * hand-authored in scripts/clue-data.mjs and applied via
 * scripts/apply-clues.mjs. Re-running THIS script regenerates template
 * clues and will overwrite that work. If you regenerate the player pool
 * here, re-run `node scripts/apply-clues.mjs` afterward to restore the
 * hand-written clues.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { activeCandidates, hofCandidates } from "./lib/clue-candidates.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "seed", "source");
const OUT = join(ROOT, "seed", "players.json");

const LEVELS = ["easy", "medium", "hard", "impossible"];
const FLOOR = 3; // min matches in every context
const CEILING_FRAC = 0.4;
const CLUES_PER_LEVEL = 5;

const TEAMS = {
  ATL: { conf: "Eastern", div: "Southeast", state: "Georgia", region: "Southeast" },
  BOS: { conf: "Eastern", div: "Atlantic", state: "Massachusetts", region: "Northeast" },
  BKN: { conf: "Eastern", div: "Atlantic", state: "New York", region: "Northeast" },
  BRK: { conf: "Eastern", div: "Atlantic", state: "New York", region: "Northeast" },
  CHA: { conf: "Eastern", div: "Southeast", state: "North Carolina", region: "Southeast" },
  CHO: { conf: "Eastern", div: "Southeast", state: "North Carolina", region: "Southeast" },
  CHI: { conf: "Eastern", div: "Central", state: "Illinois", region: "Midwest" },
  CLE: { conf: "Eastern", div: "Central", state: "Ohio", region: "Midwest" },
  DAL: { conf: "Western", div: "Southwest", state: "Texas", region: "Southwest" },
  DEN: { conf: "Western", div: "Northwest", state: "Colorado", region: "West" },
  DET: { conf: "Eastern", div: "Central", state: "Michigan", region: "Midwest" },
  GSW: { conf: "Western", div: "Pacific", state: "California", region: "West" },
  HOU: { conf: "Western", div: "Southwest", state: "Texas", region: "Southwest" },
  IND: { conf: "Eastern", div: "Central", state: "Indiana", region: "Midwest" },
  LAC: { conf: "Western", div: "Pacific", state: "California", region: "West" },
  LAL: { conf: "Western", div: "Pacific", state: "California", region: "West" },
  MEM: { conf: "Western", div: "Southwest", state: "Tennessee", region: "South" },
  MIA: { conf: "Eastern", div: "Southeast", state: "Florida", region: "Southeast" },
  MIL: { conf: "Eastern", div: "Central", state: "Wisconsin", region: "Midwest" },
  MIN: { conf: "Western", div: "Northwest", state: "Minnesota", region: "Midwest" },
  NOP: { conf: "Western", div: "Southwest", state: "Louisiana", region: "South" },
  NOH: { conf: "Western", div: "Southwest", state: "Louisiana", region: "South" },
  NYK: { conf: "Eastern", div: "Atlantic", state: "New York", region: "Northeast" },
  OKC: { conf: "Western", div: "Northwest", state: "Oklahoma", region: "Southwest" },
  ORL: { conf: "Eastern", div: "Southeast", state: "Florida", region: "Southeast" },
  PHI: { conf: "Eastern", div: "Atlantic", state: "Pennsylvania", region: "Northeast" },
  PHO: { conf: "Western", div: "Pacific", state: "Arizona", region: "West" },
  PHX: { conf: "Western", div: "Pacific", state: "Arizona", region: "West" },
  POR: { conf: "Western", div: "Northwest", state: "Oregon", region: "West" },
  SAC: { conf: "Western", div: "Pacific", state: "California", region: "West" },
  SAS: { conf: "Western", div: "Southwest", state: "Texas", region: "Southwest" },
  TOR: { conf: "Eastern", div: "Atlantic", state: "Ontario", region: "Canada" },
  UTA: { conf: "Western", div: "Northwest", state: "Utah", region: "West" },
  WAS: { conf: "Eastern", div: "Southeast", state: "District of Columbia", region: "Southeast" },
  BUF: { conf: "Eastern", div: "Atlantic", state: "New York", region: "Northeast" },
};

const curated = JSON.parse(readFileSync(join(SRC, "curated.json"), "utf8"));

// ---------- Name normalization ----------

function stripDiacritics(s) {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

function bareNormalize(name) {
  let s = stripDiacritics(String(name)).toLowerCase().trim();
  s = s.replace(/[''`′]/g, "");
  s = s.replace(/\./g, " ");
  s = s.replace(/-/g, " ");
  s = s.replace(/\b(jr|sr|ii|iii|iv|v)\b/g, "");
  s = s.replace(/[^a-z0-9 ]+/g, " ");
  return s.replace(/\s+/g, " ").trim();
}

function normalizeKey(name) {
  const raw = bareNormalize(name);
  // Alias map applied at most once (canonical forms also bareNormalize cleanly).
  const alias =
    curated.aliases[raw] ??
    curated.aliases[stripDiacritics(String(name)).toLowerCase().trim()];
  return alias ? bareNormalize(alias) : raw;
}

function lastFirstInitial(key) {
  const parts = key.split(" ");
  if (parts.length < 2) return null;
  return `${parts[parts.length - 1]}|${parts[0][0]}`;
}

// ---------- Parsers ----------

function parsePerGame(text) {
  const players = new Map(); // normalizeKey -> player
  const lines = text.split("\n");
  for (const line of lines) {
    if (!line.startsWith("|")) continue;
    const cols = line.split("|").map((c) => c.trim());
    // Fixed layout: Rk Player Age Team Pos G GS MP FG FGA FG% 3P 3PA 3P% 2P 2PA 2P%
    // eFG% FT FTA FT% ORB DRB TRB AST STL BLK TOV PF PTS Awards
    // Indices 1..31 (trailing empty cell from markdown pipe makes length 33).
    if (cols.length < 32) continue;
    const rk = cols[1];
    if (!/^\d+$/.test(rk)) continue;
    const name = cols[2];
    const age = Number(cols[3]);
    const team = cols[4];
    const pos = cols[5];
    const g = Number(cols[6]);
    const fg3 = Number(cols[12]);
    const trb = Number(cols[24]);
    const ast = Number(cols[25]);
    const stl = Number(cols[26]);
    const blk = Number(cols[27]);
    const pts = Number(cols[30]);
    const awards = cols[31] || "";
    if (!name || Number.isNaN(pts) || Number.isNaN(g)) continue;

    const key = normalizeKey(name);
    const row = {
      name,
      age,
      team,
      pos,
      g,
      pts,
      trb,
      ast,
      stl,
      blk,
      fg3,
      awards,
      isAggregate: team === "2TM" || team === "3TM" || team === "TOT",
    };

    const existing = players.get(key);
    if (!existing) {
      players.set(key, row);
    } else if (row.isAggregate && !existing.isAggregate) {
      // Prefer season aggregate over split.
      players.set(key, { ...row, name: existing.name });
    } else if (!row.isAggregate && existing.isAggregate) {
      // Keep aggregate; but remember a primary team.
      existing.primaryTeam = team;
    } else if (!row.isAggregate && !existing.isAggregate) {
      // Prefer the row with more games.
      if (g > existing.g) players.set(key, row);
    } else if (row.isAggregate && existing.isAggregate && g > existing.g) {
      players.set(key, row);
    }
  }
  return players;
}

function parseHonorTable(text, nameCol = 2, totCol = 3) {
  const out = new Map(); // normalizeKey -> { name, tot }
  for (const line of text.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cols = line.split("|").map((c) => c.trim());
    if (cols.length < totCol + 1) continue;
    if (!/^\d+$/.test(cols[1])) continue;
    const name = cols[nameCol];
    const tot = Number(cols[totCol]);
    if (!name || Number.isNaN(tot)) continue;
    out.set(normalizeKey(name), { name, tot });
  }
  return out;
}

// ---------- Team helpers ----------

function teamMeta(code) {
  return TEAMS[code] ?? null;
}

function resolveTeam(player) {
  if (player.primaryTeam) return player.primaryTeam;
  if (player.team && !player.isAggregate) return player.team;
  return player.team;
}

// ---------- Pool construction ----------

function buildPool(actives, allStars, allDefense) {
  const pool = [];
  const unmatchedStars = [];
  const unmatchedDefense = [];
  const fuzzyMisses = [];

  // Index actives by last|initial for fuzzy pass
  const byLastInit = new Map();
  for (const [key, p] of actives) {
    const li = lastFirstInitial(key);
    if (li) {
      if (!byLastInit.has(li)) byLastInit.set(li, []);
      byLastInit.get(li).push({ key, p });
    }
  }

  function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] =
          a[i - 1] === b[j - 1]
            ? dp[i - 1][j - 1]
            : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  }

  function isNormalizationNearMiss(honorKey, activeKey) {
    // Same last name + first initial already filtered. Require near-identical
    // first names (edit distance ≤ 1, each length ≥ 4) so "Dwyane"≠"Dean",
    // "Brad"≠"Brandon", "A.C."≠"A.J.", while still catching true bugs.
    const fa = honorKey.split(" ")[0] ?? "";
    const fb = activeKey.split(" ")[0] ?? "";
    if (fa.length < 4 || fb.length < 4) return false;
    return levenshtein(fa, fb) <= 1;
  }

  function matchHonor(honorMap, unmatched, tag) {
    const matched = new Map(); // activeKey -> tot
    for (const [hKey, info] of honorMap) {
      if (actives.has(hKey)) {
        matched.set(hKey, info.tot);
        continue;
      }
      const li = lastFirstInitial(hKey);
      const candidates = (li ? byLastInit.get(li) ?? [] : []).filter((c) =>
        isNormalizationNearMiss(hKey, c.key),
      );
      if (candidates.length === 1) {
        matched.set(candidates[0].key, info.tot);
        fuzzyMisses.push({
          honor: info.name,
          matchedTo: candidates[0].p.name,
          tag,
          reason: "fuzzy near-miss — FAIL (suspected normalization bug)",
        });
      } else if (candidates.length > 1) {
        fuzzyMisses.push({
          honor: info.name,
          matchedTo: candidates.map((c) => c.p.name).join(", "),
          tag,
          reason: "ambiguous fuzzy match — FAIL",
        });
      } else {
        unmatched.push(info.name);
      }
    }
    return matched;
  }

  const starMatched = matchHonor(allStars, unmatchedStars, "allstars");
  const defMatched = matchHonor(allDefense, unmatchedDefense, "defense");

  // Canary check: every tricky active name must resolve into the stats table.
  const canaryFails = [];
  for (const name of curated.canaries) {
    const key = normalizeKey(name);
    if (!actives.has(key)) canaryFails.push(name);
  }

  // Build active pool members
  const seen = new Set();
  function addActive(key, tags) {
    if (seen.has(key)) {
      const existing = pool.find((p) => p.key === key);
      for (const t of tags) {
        if (!existing.tags.includes(t)) existing.tags.push(t);
      }
      return existing;
    }
    const row = actives.get(key);
    if (!row) return null;
    const team = resolveTeam(row);
    const meta = teamMeta(team);
    const player = {
      key,
      name: row.name,
      active: true,
      tags,
      age: row.age,
      team,
      pos: row.pos,
      g: row.g,
      pts: row.pts,
      trb: row.trb,
      ast: row.ast,
      stl: row.stl,
      blk: row.blk,
      fg3: row.fg3,
      awards: row.awards || "",
      conf: meta?.conf ?? null,
      div: meta?.div ?? null,
      state: meta?.state ?? null,
      region: meta?.region ?? null,
      allStarCount: starMatched.get(key) ?? 0,
      allDefenseCount: defMatched.get(key) ?? 0,
      mvp: curated.mvpWinners.some((n) => normalizeKey(n) === key),
      scoringTitle: curated.scoringTitleWinners.some((n) => normalizeKey(n) === key),
      champion: false, // incomplete for actives — never use for clues
      asThisSeason: /\bAS\b/.test(row.awards || ""),
      allNba: /NBA[123]/.test(row.awards || ""),
      defThisSeason: /DEF[12]/.test(row.awards || ""),
      era: "2020s",
      guard: ["PG", "SG"].includes(row.pos),
      forward: ["SF", "PF"].includes(row.pos),
      big: ["C", "PF"].includes(row.pos),
    };
    player.popularityTier = assignTier(player);
    pool.push(player);
    seen.add(key);
    return player;
  }

  // ppg10: 10+ PPG, 50+ games
  for (const [key, row] of actives) {
    if (row.pts >= 10 && row.g >= 50) {
      addActive(key, ["ppg10"]);
    }
  }
  // allstars among actives (even if under games/ppg cutoffs)
  for (const key of starMatched.keys()) {
    addActive(key, ["allstars"]);
  }
  // defense among actives
  for (const key of defMatched.keys()) {
    addActive(key, ["defense"]);
  }

  // HOFers
  for (const h of curated.hofers) {
    const key = normalizeKey(h.name);
    if (seen.has(key)) {
      // Active player who is also HOF? Unlikely for current list, but tag hof.
      const existing = pool.find((p) => p.key === key);
      if (!existing.tags.includes("hof")) existing.tags.push("hof");
      continue;
    }
    const primary = h.primaryTeams[0];
    const meta = teamMeta(primary);
    pool.push({
      key,
      name: h.name,
      active: false,
      tags: ["hof"],
      age: null,
      team: primary,
      pos: h.position,
      g: null,
      pts: null,
      trb: null,
      ast: null,
      stl: null,
      blk: null,
      fg3: null,
      awards: "",
      conf: h.conferences[0] ?? meta?.conf ?? null,
      div: meta?.div ?? null,
      state: h.states[0] ?? meta?.state ?? null,
      region: meta?.region ?? null,
      allStarCount: 5, // all are multi-time
      allDefenseCount: h.allDefense ? 1 : 0,
      mvp: h.mvp,
      scoringTitle: h.scoringTitle,
      champion: h.champion,
      asThisSeason: false,
      allNba: false,
      defThisSeason: false,
      era: h.era,
      guard: h.facts.guard,
      forward: h.facts.forward,
      big: h.facts.big,
      titles: h.facts.titles,
      decades: h.facts.decades,
      conferences: h.conferences,
      states: h.states,
      popularityTier: h.popularityTier,
      draftTop3: h.draftTop3,
    });
    seen.add(key);
  }

  return {
    pool,
    unmatchedStars,
    unmatchedDefense,
    fuzzyMisses,
    canaryFails,
  };
}

function assignTier(p) {
  if (curated.tierOverrides[p.name] != null) return curated.tierOverrides[p.name];
  const key = normalizeKey(p.name);
  for (const [name, tier] of Object.entries(curated.tierOverrides)) {
    if (normalizeKey(name) === key) return tier;
  }
  // Merit heuristic
  if (p.mvp || p.allStarCount >= 8 || (p.pts != null && p.pts >= 27)) return 1;
  if (p.allStarCount >= 3 || p.allNba || (p.pts != null && p.pts >= 20)) return 2;
  if (p.allStarCount >= 1 || p.allDefenseCount >= 1 || (p.pts != null && p.pts >= 14)) return 3;
  return 4;
}

// Clue candidates: see scripts/lib/clue-candidates.mjs (imported at top)

// ---------- Selectivity + bucketing ----------

function contextsFor(player, pool) {
  const contexts = [{ id: "full", players: pool }];
  for (const tag of player.tags) {
    contexts.push({
      id: tag,
      players: pool.filter((x) => x.tags.includes(tag)),
    });
  }
  return contexts;
}

function scoreClue(clue, player, pool) {
  const contexts = contextsFor(player, pool);
  const counts = {};
  let minCount = Infinity;
  let minContextSize = Infinity;
  for (const ctx of contexts) {
    const n = ctx.players.filter((x) => clue.predicate(x)).length;
    counts[ctx.id] = n;
    if (n < minCount) minCount = n;
    if (ctx.players.length < minContextSize) minContextSize = ctx.players.length;
  }
  // Floor / ceiling against EVERY context
  let reject = null;
  for (const ctx of contexts) {
    const n = counts[ctx.id];
    const ceiling = Math.max(FLOOR, Math.floor(CEILING_FRAC * ctx.players.length));
    if (n < FLOOR) reject = "floor";
    else if (n > ceiling) reject = reject ?? "ceiling";
  }
  return { counts, minCount, minContextSize, reject };
}

function bucketFor(minCount, minContextSize) {
  // Scale bands geometrically between FLOOR and ceiling of smallest context.
  const ceiling = Math.max(FLOOR, Math.floor(CEILING_FRAC * minContextSize));
  if (minCount < FLOOR || minCount > ceiling) return null;
  // Reference bands at N≈150: easy 3-6, medium 7-14, hard 15-30, impossible 31-60
  // Map via relative position in [FLOOR, ceiling].
  const span = ceiling - FLOOR;
  if (span <= 0) return minCount === FLOOR ? "easy" : null;
  const t = (minCount - FLOOR) / span; // 0..1
  // Tuned cuts: give impossible enough room in small categories (defense≈44,
  // hof≈20) while still approximating easy 3–6 / medium 7–14 / hard 15–30
  // / impossible 31+ on the ~150-player ppg10 context.
  if (t <= 0.15) return "easy";
  if (t <= 0.38) return "medium";
  if (t <= 0.62) return "hard";
  return "impossible";
}

function selectDiverse(candidates, count) {
  // candidates: { clue, minCount, difficulty, type, statKey? }
  // Greedy: prefer lower minCount within bucket, enforce diversity.
  const sorted = [...candidates].sort(
    (a, b) => a.minCount - b.minCount || a.clue.text.localeCompare(b.clue.text),
  );
  const picked = [];
  const usedStatKeys = new Set();
  const usedTexts = new Set();

  function tryPick(preferNewType) {
    for (const c of sorted) {
      if (picked.length >= count) break;
      if (usedTexts.has(c.clue.text)) continue;
      if (c.clue.statKey && usedStatKeys.has(c.clue.statKey)) continue;
      if (preferNewType) {
        const types = new Set(picked.map((p) => p.clue.type));
        if (types.has(c.clue.type) && types.size < 3) {
          // Prefer filling new types first when we have fewer than 3.
          const hasUnusedType = sorted.some(
            (x) =>
              !usedTexts.has(x.clue.text) &&
              !(x.clue.statKey && usedStatKeys.has(x.clue.statKey)) &&
              !types.has(x.clue.type),
          );
          if (hasUnusedType) continue;
        }
      }
      picked.push(c);
      usedTexts.add(c.clue.text);
      if (c.clue.statKey) usedStatKeys.add(c.clue.statKey);
    }
  }

  tryPick(true);
  tryPick(false);

  // Diversity check: need ≥3 types if we have 5; if fewer candidates, best effort.
  const types = new Set(picked.map((p) => p.clue.type));
  if (picked.length === count && types.size < 3) {
    // Try to swap later picks for unused types
    const unusedTypeCandidates = sorted.filter(
      (c) =>
        !usedTexts.has(c.clue.text) &&
        !types.has(c.clue.type) &&
        !(c.clue.statKey && usedStatKeys.has(c.clue.statKey)),
    );
    for (const replacement of unusedTypeCandidates) {
      if (types.size >= 3) break;
      // Replace the last pick that shares a duplicated type
      const typeCounts = {};
      for (const p of picked) typeCounts[p.clue.type] = (typeCounts[p.clue.type] ?? 0) + 1;
      const dupIdx = [...picked]
        .map((p, i) => ({ p, i }))
        .reverse()
        .find(({ p }) => typeCounts[p.clue.type] > 1);
      if (!dupIdx) break;
      const removed = picked.splice(dupIdx.i, 1)[0];
      usedTexts.delete(removed.clue.text);
      if (removed.clue.statKey) usedStatKeys.delete(removed.clue.statKey);
      typeCounts[removed.clue.type]--;
      picked.push(replacement);
      usedTexts.add(replacement.clue.text);
      if (replacement.clue.statKey) usedStatKeys.add(replacement.clue.statKey);
      types.add(replacement.clue.type);
    }
  }

  return {
    picked,
    diversityFail: picked.length === count && new Set(picked.map((p) => p.clue.type)).size < 3,
  };
}

// ---------- Main ----------

function main() {
  console.log("Parsing sources…");
  const perGame = parsePerGame(
    readFileSync(join(SRC, "bbref-2026-per-game.txt"), "utf8"),
  );
  const allStars = parseHonorTable(
    readFileSync(join(SRC, "allstar-selections.txt"), "utf8"),
  );
  const allDefense = parseHonorTable(
    readFileSync(join(SRC, "all-defense-selections.txt"), "utf8"),
  );
  console.log(
    `  actives in stats table: ${perGame.size}; all-stars listed: ${allStars.size}; all-defense listed: ${allDefense.size}`,
  );

  const {
    pool,
    unmatchedStars,
    unmatchedDefense,
    fuzzyMisses,
    canaryFails,
  } = buildPool(perGame, allStars, allDefense);

  console.log("\n=== Unmatched-names report ===");
  console.log(`All-Star names not in 2025-26 stats (likely retired): ${unmatchedStars.length}`);
  console.log(`All-Defensive names not in 2025-26 stats (likely retired): ${unmatchedDefense.length}`);
  if (fuzzyMisses.length) {
    console.error("\nFUZZY NEAR-MISSES (run fails):");
    for (const m of fuzzyMisses) {
      console.error(`  [${m.tag}] "${m.honor}" → ${m.matchedTo} (${m.reason})`);
    }
  }
  if (canaryFails.length) {
    console.error("\nCANARY FAILURES (run fails):");
    for (const n of canaryFails) console.error(`  ${n}`);
  }
  if (fuzzyMisses.length || canaryFails.length) {
    process.exit(1);
  }

  const byTag = {};
  for (const p of pool) {
    for (const t of p.tags) byTag[t] = (byTag[t] ?? 0) + 1;
  }
  console.log("\n=== Pool sizes ===");
  console.log(`  total: ${pool.length}`);
  for (const [t, n] of Object.entries(byTag).sort()) console.log(`  ${t}: ${n}`);

  const rejectCounts = { floor: 0, ceiling: 0, diversity: 0, duplicate: 0 };
  const shortfalls = [];
  const narrowestByCat = { ppg10: [], allstars: [], defense: [], hof: [], full: [] };
  const coverage = [];

  const outputPlayers = [];

  for (const player of pool) {
    const raw = player.active ? activeCandidates(player) : hofCandidates(player);
    const byDiff = { easy: [], medium: [], hard: [], impossible: [] };
    const seenText = new Set();

    for (const clue of raw) {
      if (seenText.has(clue.text)) {
        rejectCounts.duplicate++;
        continue;
      }
      seenText.add(clue.text);
      const scored = scoreClue(clue, player, pool);
      if (scored.reject) {
        rejectCounts[scored.reject]++;
        continue;
      }
      const difficulty = bucketFor(scored.minCount, scored.minContextSize);
      if (!difficulty) {
        rejectCounts.ceiling++;
        continue;
      }
      byDiff[difficulty].push({
        clue,
        minCount: scored.minCount,
        difficulty,
        counts: scored.counts,
      });

      // Track narrowest for report
      for (const cat of [...player.tags, "full"]) {
        if (!narrowestByCat[cat]) continue;
        narrowestByCat[cat].push({
          text: clue.text,
          player: player.name,
          minCount: scored.minCount,
          difficulty,
        });
      }
    }

    const clues = { easy: [], medium: [], hard: [], impossible: [] };
    const usedGlobal = new Set();
    for (const level of LEVELS) {
      const { picked, diversityFail: df } = selectDiverse(
        byDiff[level].filter((c) => !usedGlobal.has(c.clue.text)),
        CLUES_PER_LEVEL,
      );
      if (df) rejectCounts.diversity++;
      clues[level] = picked.map((p) => p.clue.text);
      for (const t of clues[level]) usedGlobal.add(t);
      if (clues[level].length < CLUES_PER_LEVEL) {
        const usedStats = new Set(
          picked.filter((p) => p.clue.statKey).map((p) => p.clue.statKey),
        );
        for (const c of byDiff[level]) {
          if (clues[level].length >= CLUES_PER_LEVEL) break;
          if (usedGlobal.has(c.clue.text)) continue;
          if (c.clue.statKey && usedStats.has(c.clue.statKey)) continue;
          clues[level].push(c.clue.text);
          usedGlobal.add(c.clue.text);
          if (c.clue.statKey) usedStats.add(c.clue.statKey);
        }
      }
    }
    // Borrow from adjacent bands when a level is still short (hard→impossible,
    // medium→hard, etc.), keeping floor/ceiling-valid candidates only.
    const adjacent = {
      easy: ["medium"],
      medium: ["easy", "hard"],
      hard: ["medium", "impossible"],
      impossible: ["hard"],
    };
    for (const level of LEVELS) {
      if (clues[level].length >= CLUES_PER_LEVEL) continue;
      const donors = adjacent[level].flatMap((d) => byDiff[d]);
      const ordered =
        level === "impossible" || level === "hard"
          ? [...donors].sort((a, b) => b.minCount - a.minCount)
          : [...donors].sort((a, b) => a.minCount - b.minCount);
      const usedStats = new Set();
      // Approximate stat keys already used from selected texts (best-effort).
      for (const c of ordered) {
        if (clues[level].length >= CLUES_PER_LEVEL) break;
        if (usedGlobal.has(c.clue.text)) continue;
        if (c.clue.statKey && usedStats.has(c.clue.statKey)) continue;
        clues[level].push(c.clue.text);
        usedGlobal.add(c.clue.text);
        if (c.clue.statKey) usedStats.add(c.clue.statKey);
      }
    }

    const counts = Object.fromEntries(LEVELS.map((l) => [l, clues[l].length]));
    coverage.push({ name: player.name, tags: player.tags, counts });
    if (LEVELS.some((l) => clues[l].length < CLUES_PER_LEVEL)) {
      shortfalls.push({ name: player.name, counts });
    }

    outputPlayers.push({
      name: player.name,
      tags: player.tags,
      popularityTier: player.popularityTier,
      clues,
    });
  }

  // Sort narrowest lists
  for (const cat of Object.keys(narrowestByCat)) {
    narrowestByCat[cat] = narrowestByCat[cat]
      .sort((a, b) => a.minCount - b.minCount)
      .slice(0, 10);
  }

  // Write output
  mkdirSync(dirname(OUT), { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    playerCount: outputPlayers.length,
    players: outputPlayers.sort((a, b) => a.name.localeCompare(b.name)),
  };
  writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n");

  // Report
  console.log("\n=== Coverage ===");
  const shortOf = shortfalls.length;
  console.log(`Players: ${outputPlayers.length}; short of 5×4: ${shortOf}`);
  if (shortOf) {
    for (const s of shortfalls.slice(0, 30)) {
      console.log(`  ${s.name}: ${JSON.stringify(s.counts)}`);
    }
    if (shortfalls.length > 30) console.log(`  …and ${shortfalls.length - 30} more`);
  }
  console.log("\n=== Rejected clue counts ===");
  for (const [k, v] of Object.entries(rejectCounts)) console.log(`  ${k}: ${v}`);

  console.log("\n=== 10 narrowest surviving clues per category ===");
  for (const [cat, list] of Object.entries(narrowestByCat)) {
    console.log(`\n[${cat}]`);
    for (const c of list) {
      console.log(
        `  (${c.minCount}, ${c.difficulty}) ${c.player}: "${c.text}"`,
      );
    }
  }

  // Write report sidecar
  const reportPath = join(ROOT, "seed", "generation-report.json");
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        poolSizes: { total: pool.length, ...byTag },
        rejectCounts,
        shortfalls,
        unmatchedStars: unmatchedStars.slice(0, 50),
        unmatchedDefense: unmatchedDefense.slice(0, 50),
        unmatchedStarsCount: unmatchedStars.length,
        unmatchedDefenseCount: unmatchedDefense.length,
        narrowestByCat,
        coverageSummary: {
          players: coverage.length,
          fullyCovered: coverage.filter((c) =>
            LEVELS.every((l) => c.counts[l] >= CLUES_PER_LEVEL),
          ).length,
        },
      },
      null,
      2,
    ) + "\n",
  );

  console.log(`\nWrote ${OUT}`);
  console.log(`Wrote ${reportPath}`);

  // Soft warning if many shortfalls — don't fail the run; runtime fallback covers gaps.
  if (shortfalls.length > pool.length * 0.25) {
    console.warn(
      `\nWARNING: ${shortfalls.length}/${pool.length} players short of full coverage.`,
    );
  }
}

main();
