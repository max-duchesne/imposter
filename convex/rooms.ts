import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { settingsValidator } from "./schema";
import { CATEGORY_IDS, MAX_PLAYERS } from "./constants";
import {
  generateUniqueCode,
  getRoomPlayers,
  leaveAllRooms,
  removeMembership,
  requireHost,
  requireRoom,
  requireSessionId,
} from "./model";

function cleanName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) throw new ConvexError("Enter a name.");
  if (trimmed.length > 24) throw new ConvexError("That name is too long.");
  return trimmed;
}

export const createRoom = mutation({
  args: { sessionId: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    requireSessionId(args.sessionId);
    const name = cleanName(args.name);
    await leaveAllRooms(ctx, args.sessionId);
    const code = await generateUniqueCode(ctx);
    const roomId = await ctx.db.insert("rooms", {
      code,
      hostSessionId: args.sessionId,
      status: "lobby",
      settings: {
        obscurity: "medium",
        clueDifficulty: "medium",
        categories: ["ppg10"],
      },
    });
    await ctx.db.insert("roomPlayers", {
      roomId,
      sessionId: args.sessionId,
      name,
    });
    return { roomId, code };
  },
});

export const joinRoom = mutation({
  args: { sessionId: v.string(), code: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    requireSessionId(args.sessionId);
    const code = args.code.trim().toUpperCase();
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (!room) throw new ConvexError("Room not found.");

    const players = await getRoomPlayers(ctx, room._id);

    // Rejoin case: idempotent for a session already in the room.
    const existing = players.find((p) => p.sessionId === args.sessionId);
    if (existing) return { roomId: room._id };

    if (room.status === "in_game") {
      throw new ConvexError("That game is already in progress. Ask the host to go back to the lobby first.");
    }
    if (players.length >= MAX_PLAYERS) {
      throw new ConvexError("That room is full.");
    }
    const name = cleanName(args.name);
    if (players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      throw new ConvexError("That name is taken in this room.");
    }
    await leaveAllRooms(ctx, args.sessionId);
    await ctx.db.insert("roomPlayers", {
      roomId: room._id,
      sessionId: args.sessionId,
      name,
    });
    return { roomId: room._id };
  },
});

export const updateSettings = mutation({
  args: {
    sessionId: v.string(),
    roomId: v.id("rooms"),
    settings: settingsValidator,
  },
  handler: async (ctx, args) => {
    requireSessionId(args.sessionId);
    const room = await requireRoom(ctx, args.roomId);
    requireHost(room, args.sessionId);
    if (room.status !== "lobby") {
      throw new ConvexError("Settings can only be changed in the lobby.");
    }
    const categories = [...new Set(args.settings.categories)];
    if (categories.some((c) => !CATEGORY_IDS.includes(c))) {
      throw new ConvexError("Unknown category.");
    }
    await ctx.db.patch(room._id, {
      settings: { ...args.settings, categories },
    });
  },
});

export const leaveRoom = mutation({
  args: { sessionId: v.string(), roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    requireSessionId(args.sessionId);
    const memberships = await ctx.db
      .query("roomPlayers")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const membership = memberships.find((m) => m.roomId === args.roomId);
    if (!membership) return;
    await removeMembership(ctx, membership);
  },
});

/** Join-screen existence/status check. Returns no room contents. */
export const getRoomByCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const code = args.code.trim().toUpperCase();
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (!room) return null;
    return { status: room.status };
  },
});

/**
 * Session restore: which room (if any) this device belongs to.
 * Drives top-level screen routing on load and after leave/kick.
 */
export const getMyRoom = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("roomPlayers")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();
    if (!membership) return null;
    const room = await ctx.db.get(membership.roomId);
    if (!room) return null;
    return { roomId: room._id };
  },
});

/**
 * Lobby data for everyone in the room. Deliberately excludes other players'
 * sessionIds (they authenticate card reads) and anything game-secret.
 */
export const getLobby = query({
  args: { roomId: v.id("rooms"), sessionId: v.string() },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) return null;
    const players = await getRoomPlayers(ctx, room._id);
    return {
      code: room.code,
      status: room.status,
      settings: room.settings,
      isHost: room.hostSessionId === args.sessionId,
      players: players.map((p) => ({
        name: p.name,
        isHost: p.sessionId === room.hostSessionId,
        isMe: p.sessionId === args.sessionId,
      })),
    };
  },
});
