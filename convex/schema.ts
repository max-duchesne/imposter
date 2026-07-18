import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const levelValidator = v.union(
  v.literal("easy"),
  v.literal("medium"),
  v.literal("hard"),
  v.literal("impossible"),
);

export const settingLevelValidator = v.union(
  v.literal("easy"),
  v.literal("medium"),
  v.literal("hard"),
  v.literal("impossible"),
  v.literal("random"),
);

export const settingsValidator = v.object({
  obscurity: settingLevelValidator,
  clueDifficulty: settingLevelValidator,
  categories: v.array(v.string()),
});

export default defineSchema({
  rooms: defineTable({
    code: v.string(),
    hostSessionId: v.string(),
    status: v.union(v.literal("lobby"), v.literal("in_game")),
    settings: settingsValidator,
  }).index("by_code", ["code"]),

  roomPlayers: defineTable({
    roomId: v.id("rooms"),
    sessionId: v.string(),
    name: v.string(),
  })
    .index("by_room", ["roomId"])
    .index("by_session", ["sessionId"]),

  games: defineTable({
    roomId: v.id("rooms"),
    roundNumber: v.number(),
    // Secret: never returned by any public query.
    nbaPlayerId: v.id("nbaPlayers"),
    clueId: v.id("clues"),
    resolvedObscurity: v.string(),
    resolvedDifficulty: v.string(),
  }).index("by_room", ["roomId"]),

  assignments: defineTable({
    gameId: v.id("games"),
    sessionId: v.string(),
    role: v.union(v.literal("crew"), v.literal("imposter")),
    // Crew payload
    playerName: v.optional(v.string()),
    // Imposter payload
    clueText: v.optional(v.string()),
    categories: v.optional(v.array(v.string())),
  }).index("by_game_session", ["gameId", "sessionId"]),

  nbaPlayers: defineTable({
    name: v.string(),
    tags: v.array(v.string()),
    popularityTier: v.union(v.literal(1), v.literal(2), v.literal(3), v.literal(4)),
  }),

  clues: defineTable({
    nbaPlayerId: v.id("nbaPlayers"),
    text: v.string(),
    difficulty: levelValidator,
    status: v.union(v.literal("approved"), v.literal("draft")),
  }).index("by_player_difficulty", ["nbaPlayerId", "difficulty"]),
});
