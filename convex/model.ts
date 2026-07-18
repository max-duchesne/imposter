// Shared server-side helpers. Not registered as public functions.
import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  LEVELS,
  OBSCURITY_TIER,
  UUID_V4_REGEX,
  categoryLabel,
  type Level,
} from "./constants";

export function requireSessionId(sessionId: string) {
  if (!UUID_V4_REGEX.test(sessionId)) {
    throw new ConvexError("Invalid session.");
  }
}

export async function requireRoom(ctx: QueryCtx, roomId: Id<"rooms">) {
  const room = await ctx.db.get(roomId);
  if (!room) throw new ConvexError("Room not found.");
  return room;
}

export function requireHost(room: Doc<"rooms">, sessionId: string) {
  if (room.hostSessionId !== sessionId) {
    throw new ConvexError("Only the host can do that.");
  }
}

export async function getRoomPlayers(ctx: QueryCtx, roomId: Id<"rooms">) {
  // Ordered by join time (ascending _creationTime).
  return await ctx.db
    .query("roomPlayers")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
    .collect();
}

export async function generateUniqueCode(ctx: QueryCtx): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = "";
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    const existing = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (!existing) return code;
  }
  throw new ConvexError("Could not generate a room code. Try again.");
}

async function deleteRoomWithHistory(ctx: MutationCtx, roomId: Id<"rooms">) {
  const games = await ctx.db
    .query("games")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
    .collect();
  for (const game of games) {
    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_game_session", (q) => q.eq("gameId", game._id))
      .collect();
    for (const a of assignments) await ctx.db.delete(a._id);
    await ctx.db.delete(game._id);
  }
  await ctx.db.delete(roomId);
}

/**
 * Remove a session's membership from a room. Promotes the earliest-joined
 * remaining player if the host left; deletes the room when it empties.
 */
export async function removeMembership(
  ctx: MutationCtx,
  membership: Doc<"roomPlayers">,
) {
  await ctx.db.delete(membership._id);
  const room = await ctx.db.get(membership.roomId);
  if (!room) return;
  const remaining = await getRoomPlayers(ctx, room._id);
  if (remaining.length === 0) {
    await deleteRoomWithHistory(ctx, room._id);
    return;
  }
  if (room.hostSessionId === membership.sessionId) {
    await ctx.db.patch(room._id, { hostSessionId: remaining[0].sessionId });
  }
}

/** A session belongs to at most one room; leaving any others keeps by_session unambiguous. */
export async function leaveAllRooms(ctx: MutationCtx, sessionId: string) {
  const memberships = await ctx.db
    .query("roomPlayers")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .collect();
  for (const m of memberships) {
    await removeMembership(ctx, m);
  }
}

function pickUniform<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Server-side selection: resolve "random" settings, pick an NBA player from
 * the category/obscurity pool (with repeat avoidance + tier widening), pick a
 * clue at the resolved difficulty (nearest fallback, prefer easier), and pick
 * the imposter uniformly among room players.
 */
export async function createRound(
  ctx: MutationCtx,
  room: Doc<"rooms">,
  roundNumber: number,
) {
  // 1. Resolve "random" settings.
  const resolvedObscurity: Level =
    room.settings.obscurity === "random"
      ? pickUniform([...LEVELS])
      : room.settings.obscurity;
  const resolvedDifficulty: Level =
    room.settings.clueDifficulty === "random"
      ? pickUniform([...LEVELS])
      : room.settings.clueDifficulty;

  // 2. Candidates: tag intersects selected categories. (~40 rows; full scan is fine.)
  const categories = room.settings.categories;
  const allPlayers = await ctx.db.query("nbaPlayers").collect();
  const inCategories = allPlayers.filter((p) =>
    p.tags.some((t) => categories.includes(t)),
  );
  if (inCategories.length === 0) {
    throw new ConvexError("No players match the selected categories.");
  }

  const previousGames = await ctx.db
    .query("games")
    .withIndex("by_room", (q) => q.eq("roomId", room._id))
    .collect();
  const usedPlayerIds = new Set(previousGames.map((g) => g.nbaPlayerId));

  // 3. Widen tiers outward from the resolved obscurity until candidates exist,
  //    applying repeat avoidance at each step (reset rather than fail).
  const targetTier = OBSCURITY_TIER[resolvedObscurity];
  let pool: Doc<"nbaPlayers">[] = [];
  for (let distance = 0; distance <= 3 && pool.length === 0; distance++) {
    const tiers = new Set(
      [targetTier - distance, targetTier + distance].filter(
        (t) => t >= 1 && t <= 4,
      ),
    );
    const atTiers = inCategories.filter((p) => tiers.has(p.popularityTier));
    if (atTiers.length === 0) continue;
    const fresh = atTiers.filter((p) => !usedPlayerIds.has(p._id));
    pool = fresh.length > 0 ? fresh : atTiers;
  }
  if (pool.length === 0) {
    // Unreachable while categories are validated against seeded content.
    throw new ConvexError("No players available for these settings.");
  }
  const nbaPlayer = pickUniform(pool);

  // Clue at resolved difficulty, else nearest difficulty preferring easier.
  const targetIndex = LEVELS.indexOf(resolvedDifficulty);
  const difficultyOrder = [...LEVELS].sort(
    (a, b) =>
      Math.abs(LEVELS.indexOf(a) - targetIndex) -
        Math.abs(LEVELS.indexOf(b) - targetIndex) ||
      LEVELS.indexOf(a) - LEVELS.indexOf(b),
  );
  let clue: Doc<"clues"> | undefined;
  for (const difficulty of difficultyOrder) {
    const clues = await ctx.db
      .query("clues")
      .withIndex("by_player_difficulty", (q) =>
        q.eq("nbaPlayerId", nbaPlayer._id).eq("difficulty", difficulty),
      )
      .collect();
    const approved = clues.filter((c) => c.status === "approved");
    if (approved.length > 0) {
      clue = pickUniform(approved);
      break;
    }
  }
  if (!clue) {
    throw new ConvexError("No clues available for these settings.");
  }

  // 4. Write the game and one assignment per player.
  const gameId = await ctx.db.insert("games", {
    roomId: room._id,
    roundNumber,
    nbaPlayerId: nbaPlayer._id,
    clueId: clue._id,
    resolvedObscurity,
    resolvedDifficulty,
  });

  const players = await getRoomPlayers(ctx, room._id);
  const imposter = pickUniform(players);
  const categoryLabels = categories.map(categoryLabel);
  for (const player of players) {
    if (player.sessionId === imposter.sessionId) {
      await ctx.db.insert("assignments", {
        gameId,
        sessionId: player.sessionId,
        role: "imposter",
        clueText: clue.text,
        categories: categoryLabels,
      });
    } else {
      await ctx.db.insert("assignments", {
        gameId,
        sessionId: player.sessionId,
        role: "crew",
        playerName: nbaPlayer.name,
      });
    }
  }
}
