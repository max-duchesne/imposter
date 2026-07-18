import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";
import { CATEGORY_IDS, LEVELS, type Level } from "./constants";
import seedData from "../seed/players.json";

const CLEAR_BATCH = 64;
const INSERT_BATCH = 12; // players per mutation (each carries ~20 clues)

type SeedPlayer = (typeof seedData.players)[number];

export const clearBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const clues = await ctx.db.query("clues").take(CLEAR_BATCH);
    for (const c of clues) await ctx.db.delete(c._id);
    if (clues.length > 0) {
      return { done: false, clearedClues: clues.length, clearedPlayers: 0 };
    }
    const players = await ctx.db.query("nbaPlayers").take(CLEAR_BATCH);
    for (const p of players) await ctx.db.delete(p._id);
    return {
      done: players.length === 0,
      clearedClues: 0,
      clearedPlayers: players.length,
    };
  },
});

export const insertBatch = internalMutation({
  args: {
    players: v.array(
      v.object({
        name: v.string(),
        tags: v.array(v.string()),
        popularityTier: v.union(
          v.literal(1),
          v.literal(2),
          v.literal(3),
          v.literal(4),
        ),
        clues: v.object({
          easy: v.array(v.string()),
          medium: v.array(v.string()),
          hard: v.array(v.string()),
          impossible: v.array(v.string()),
        }),
      }),
    ),
  },
  handler: async (ctx, args) => {
    let playerCount = 0;
    let clueCount = 0;
    for (const player of args.players) {
      const tier = player.popularityTier;
      for (const tag of player.tags) {
        if (!CATEGORY_IDS.includes(tag)) {
          throw new Error(`${player.name}: unknown tag ${tag}`);
        }
      }
      const nbaPlayerId = await ctx.db.insert("nbaPlayers", {
        name: player.name,
        tags: player.tags,
        popularityTier: tier,
      });
      playerCount++;
      for (const difficulty of LEVELS) {
        const texts: string[] =
          (player.clues as Record<Level, string[]>)[difficulty] ?? [];
        for (const text of texts) {
          await ctx.db.insert("clues", {
            nbaPlayerId,
            text,
            difficulty,
            status: "approved",
          });
          clueCount++;
        }
      }
    }
    return { playerCount, clueCount };
  },
});

/**
 * Loads /seed/players.json into nbaPlayers + clues (idempotent: wipes and
 * reloads content tables in batches). Run with: npx convex run seed:load
 */
export const load = internalAction({
  args: {},
  handler: async (ctx) => {
    let clearedClues = 0;
    let clearedPlayers = 0;
    for (;;) {
      const result = await ctx.runMutation(internal.seed.clearBatch, {});
      clearedClues += result.clearedClues;
      clearedPlayers += result.clearedPlayers;
      if (result.done) break;
    }

    let playerCount = 0;
    let clueCount = 0;
    const players = seedData.players as SeedPlayer[];
    for (let i = 0; i < players.length; i += INSERT_BATCH) {
      const chunk = players.slice(i, i + INSERT_BATCH).map((p) => ({
        name: p.name,
        tags: p.tags,
        popularityTier: p.popularityTier as 1 | 2 | 3 | 4,
        clues: {
          easy: p.clues.easy ?? [],
          medium: p.clues.medium ?? [],
          hard: p.clues.hard ?? [],
          impossible: p.clues.impossible ?? [],
        },
      }));
      const result = await ctx.runMutation(internal.seed.insertBatch, {
        players: chunk,
      });
      playerCount += result.playerCount;
      clueCount += result.clueCount;
    }

    return {
      clearedClues,
      clearedPlayers,
      playerCount,
      clueCount,
    };
  },
});
