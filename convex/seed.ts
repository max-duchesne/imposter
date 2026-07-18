import { internalMutation } from "./_generated/server";
import { CATEGORY_IDS, LEVELS, type Level } from "./constants";
import seedData from "../seed/players.json";

/**
 * Loads /seed/players.json into nbaPlayers + clues (idempotent: wipes and
 * reloads content tables). Run with: npx convex run seed:load
 */
export const load = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const clue of await ctx.db.query("clues").collect()) {
      await ctx.db.delete(clue._id);
    }
    for (const player of await ctx.db.query("nbaPlayers").collect()) {
      await ctx.db.delete(player._id);
    }

    let playerCount = 0;
    let clueCount = 0;
    for (const player of seedData.players) {
      const tier = player.popularityTier;
      if (tier !== 1 && tier !== 2 && tier !== 3 && tier !== 4) {
        throw new Error(`${player.name}: bad popularityTier ${tier}`);
      }
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
