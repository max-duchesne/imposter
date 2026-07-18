import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { MIN_PLAYERS } from "./constants";
import {
  createRound,
  getRoomPlayers,
  requireHost,
  requireRoom,
  requireSessionId,
} from "./model";

export const startGame = mutation({
  args: { sessionId: v.string(), roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    requireSessionId(args.sessionId);
    const room = await requireRoom(ctx, args.roomId);
    requireHost(room, args.sessionId);
    if (room.status !== "lobby") {
      throw new ConvexError("The game has already started.");
    }
    const players = await getRoomPlayers(ctx, room._id);
    if (players.length < MIN_PLAYERS) {
      throw new ConvexError(`You need at least ${MIN_PLAYERS} players.`);
    }
    if (room.settings.categories.length === 0) {
      throw new ConvexError("Pick at least one category.");
    }
    await createRound(ctx, room, 1);
    await ctx.db.patch(room._id, { status: "in_game" });
  },
});

export const newRound = mutation({
  args: { sessionId: v.string(), roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    requireSessionId(args.sessionId);
    const room = await requireRoom(ctx, args.roomId);
    requireHost(room, args.sessionId);
    if (room.status !== "in_game") {
      throw new ConvexError("The game hasn't started.");
    }
    const players = await getRoomPlayers(ctx, room._id);
    if (players.length < MIN_PLAYERS) {
      throw new ConvexError(`You need at least ${MIN_PLAYERS} players.`);
    }
    const current = await ctx.db
      .query("games")
      .withIndex("by_room", (q) => q.eq("roomId", room._id))
      .order("desc")
      .first();
    await createRound(ctx, room, (current?.roundNumber ?? 0) + 1);
  },
});

export const backToLobby = mutation({
  args: { sessionId: v.string(), roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    requireSessionId(args.sessionId);
    const room = await requireRoom(ctx, args.roomId);
    requireHost(room, args.sessionId);
    if (room.status !== "in_game") return;
    await ctx.db.patch(room._id, { status: "lobby" });
  },
});

/**
 * Public game info only. The games document contains the secret nbaPlayerId
 * and clueId, so it is never returned raw — just the round number and the
 * game id needed to fetch the caller's own card.
 */
export const getCurrentGame = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room || room.status !== "in_game") return null;
    const game = await ctx.db
      .query("games")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .order("desc")
      .first();
    if (!game) return null;
    return { gameId: game._id, roundNumber: game.roundNumber };
  },
});

/** The caller's own card, and nothing else. */
export const getMyAssignment = query({
  args: { gameId: v.id("games"), sessionId: v.string() },
  handler: async (ctx, args) => {
    const assignment = await ctx.db
      .query("assignments")
      .withIndex("by_game_session", (q) =>
        q.eq("gameId", args.gameId).eq("sessionId", args.sessionId),
      )
      .unique();
    if (!assignment) return null;
    if (assignment.role === "imposter") {
      return {
        role: "imposter" as const,
        clueText: assignment.clueText ?? "",
        categories: assignment.categories ?? [],
      };
    }
    return { role: "crew" as const, playerName: assignment.playerName ?? "" };
  },
});
