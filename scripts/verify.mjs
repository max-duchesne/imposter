// End-to-end verification against the Convex dev deployment.
// Run with: node scripts/verify.mjs
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const envFile = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = /NEXT_PUBLIC_CONVEX_URL=(\S+)/.exec(envFile)[1];
const client = new ConvexHttpClient(url);
const api = anyApi;

let passed = 0;
function ok(label, condition, detail = "") {
  if (!condition) {
    console.error(`  FAIL ${label} ${detail}`);
    process.exit(1);
  }
  passed++;
  console.log(`  ok ${label}${detail ? ` — ${detail}` : ""}`);
}

async function expectError(label, promise, fragment) {
  try {
    await promise;
    console.error(`  FAIL ${label}: expected rejection, got success`);
    process.exit(1);
  } catch (err) {
    const msg = err?.data ?? err?.message ?? String(err);
    ok(label, String(msg).toLowerCase().includes(fragment.toLowerCase()), `rejected: "${msg}"`);
  }
}

const host = randomUUID();
const p2 = randomUUID();
const p3 = randomUUID();
const p4 = randomUUID();

console.log("\n1. Room creation + joins");
const { roomId, code } = await client.mutation(api.rooms.createRoom, {
  sessionId: host,
  name: "Host",
});
ok("createRoom code format", /^[A-HJ-NP-Z]{4}$/.test(code), code);
const byCode = await client.query(api.rooms.getRoomByCode, { code });
ok("getRoomByCode", byCode?.status === "lobby");
ok("getRoomByCode payload keys", JSON.stringify(Object.keys(byCode)) === '["status"]', JSON.stringify(byCode));

await expectError(
  "invalid sessionId rejected",
  client.mutation(api.rooms.joinRoom, { sessionId: "not-a-uuid", code, name: "X" }),
  "invalid session",
);
await client.mutation(api.rooms.joinRoom, { sessionId: p2, code, name: "Sam" });
await client.mutation(api.rooms.joinRoom, { sessionId: p3, code, name: "Jack" });
await client.mutation(api.rooms.joinRoom, { sessionId: p4, code, name: "Maddie" });
await client.mutation(api.rooms.joinRoom, { sessionId: p4, code, name: "Maddie" });
ok("rejoin is idempotent", true);
await expectError(
  "duplicate name rejected",
  client.mutation(api.rooms.joinRoom, { sessionId: randomUUID(), code, name: "sam" }),
  "taken",
);
let lobby = await client.query(api.rooms.getLobby, { roomId, sessionId: host });
ok("lobby has 4 players", lobby.players.length === 4);
ok("caller is host", lobby.isHost === true);
ok(
  "getLobby payload keys",
  JSON.stringify(Object.keys(lobby).sort()) === '["code","isHost","players","settings","status"]' &&
    JSON.stringify(Object.keys(lobby.players[0]).sort()) === '["isHost","isMe","name"]',
  `lobby: ${Object.keys(lobby).sort()}; player: ${Object.keys(lobby.players[0]).sort()}`,
);

console.log("\n2. Settings + host gating");
await expectError(
  "non-host updateSettings rejected",
  client.mutation(api.rooms.updateSettings, {
    sessionId: p2,
    roomId,
    settings: { obscurity: "easy", clueDifficulty: "easy", categories: ["ppg10"] },
  }),
  "host",
);
await client.mutation(api.rooms.updateSettings, {
  sessionId: host,
  roomId,
  settings: { obscurity: "medium", clueDifficulty: "hard", categories: ["ppg10", "allstars"] },
});
lobby = await client.query(api.rooms.getLobby, { roomId, sessionId: p2 });
ok("settings updated + non-host sees them", lobby.settings.clueDifficulty === "hard" && lobby.isHost === false);
await expectError(
  "non-host startGame rejected",
  client.mutation(api.games.startGame, { sessionId: p2, roomId }),
  "host",
);
{
  const soloHost = randomUUID();
  const solo = await client.mutation(api.rooms.createRoom, { sessionId: soloHost, name: "Solo" });
  await expectError(
    "startGame with <3 players rejected",
    client.mutation(api.games.startGame, { sessionId: soloHost, roomId: solo.roomId }),
    "at least 3",
  );
  await client.mutation(api.rooms.leaveRoom, { sessionId: soloHost, roomId: solo.roomId });
}

console.log("\n3. Start game + assignments");
await client.mutation(api.games.startGame, { sessionId: host, roomId });
lobby = await client.query(api.rooms.getLobby, { roomId, sessionId: host });
ok("room status flipped to in_game", lobby.status === "in_game");
let game = await client.query(api.games.getCurrentGame, { roomId });
ok("round 1", game.roundNumber === 1);
ok(
  "getCurrentGame payload keys",
  JSON.stringify(Object.keys(game).sort()) === '["gameId","roundNumber"]',
  JSON.stringify(Object.keys(game).sort()),
);
const sessions = { Host: host, Sam: p2, Jack: p3, Maddie: p4 };
async function fetchAssignments(gameId) {
  const out = {};
  for (const [name, sessionId] of Object.entries(sessions)) {
    out[name] = await client.query(api.games.getMyAssignment, { gameId, sessionId });
  }
  return out;
}
let cards = await fetchAssignments(game.gameId);
let imposters = Object.entries(cards).filter(([, c]) => c.role === "imposter");
let crew = Object.entries(cards).filter(([, c]) => c.role === "crew");
ok("exactly one imposter", imposters.length === 1 && crew.length === 3, `imposter: ${imposters[0][0]}`);
const round1Name = crew[0][1].playerName;
ok(
  "crew all see the same player",
  crew.every(([, c]) => c.playerName === round1Name && c.playerName.length > 0),
  round1Name,
);
const impCard = imposters[0][1];
ok("imposter card has clue + category labels", impCard.clueText.length > 0 &&
  JSON.stringify(impCard.categories) === '["Active, 10+ PPG","Active All-Stars"]',
  `clue: "${impCard.clueText}"; cats: ${JSON.stringify(impCard.categories)}`);
ok(
  "crew payload keys",
  JSON.stringify(Object.keys(crew[0][1]).sort()) === '["playerName","role"]',
  JSON.stringify(Object.keys(crew[0][1]).sort()),
);
ok(
  "imposter payload keys",
  JSON.stringify(Object.keys(impCard).sort()) === '["categories","clueText","role"]',
  JSON.stringify(Object.keys(impCard).sort()),
);
const stranger = await client.query(api.games.getMyAssignment, {
  gameId: game.gameId,
  sessionId: randomUUID(),
});
ok("unknown session gets no card", stranger === null);
await expectError(
  "join mid-game rejected",
  client.mutation(api.rooms.joinRoom, { sessionId: randomUUID(), code, name: "Late" }),
  "in progress",
);
await expectError(
  "double start rejected",
  client.mutation(api.games.startGame, { sessionId: host, roomId }),
  "already started",
);
await expectError(
  "in-game settings change rejected",
  client.mutation(api.rooms.updateSettings, {
    sessionId: host,
    roomId,
    settings: { obscurity: "easy", clueDifficulty: "easy", categories: ["ppg10"] },
  }),
  "lobby",
);

console.log("\n4. New round");
await expectError(
  "non-host newRound rejected",
  client.mutation(api.games.newRound, { sessionId: p2, roomId }),
  "host",
);
await client.mutation(api.games.newRound, { sessionId: host, roomId });
game = await client.query(api.games.getCurrentGame, { roomId });
ok("round number incremented", game.roundNumber === 2);
cards = await fetchAssignments(game.gameId);
imposters = Object.entries(cards).filter(([, c]) => c.role === "imposter");
crew = Object.entries(cards).filter(([, c]) => c.role === "crew");
ok("round 2 has exactly one imposter", imposters.length === 1, `imposter: ${imposters[0][0]}`);
const round2Name = crew[0][1].playerName;
ok("repeat avoidance: new NBA player", round2Name !== round1Name, `${round1Name} -> ${round2Name}`);

console.log("\n5. Back to lobby + restart");
await expectError(
  "non-host backToLobby rejected",
  client.mutation(api.games.backToLobby, { sessionId: p2, roomId }),
  "host",
);
await client.mutation(api.games.backToLobby, { sessionId: host, roomId });
lobby = await client.query(api.rooms.getLobby, { roomId, sessionId: host });
ok("back in lobby, players preserved", lobby.status === "lobby" && lobby.players.length === 4);
await client.mutation(api.rooms.updateSettings, {
  sessionId: host,
  roomId,
  settings: { obscurity: "medium", clueDifficulty: "medium", categories: [] },
});
await expectError(
  "startGame with 0 categories rejected",
  client.mutation(api.games.startGame, { sessionId: host, roomId }),
  "category",
);

console.log("\n6. Fallback audit (settings matching zero players)");
// Discover an actually-empty category×tier combo from the generated seed so
// the widening path is exercised without depending on warped tier caps.
const seedPlayers = JSON.parse(
  readFileSync(new URL("../seed/players.json", import.meta.url), "utf8"),
).players;
const OBSCURITY = { easy: 1, medium: 2, hard: 3, impossible: 4 };
const CATEGORY_IDS = ["ppg10", "allstars", "defense", "hof"];
let emptyCombo = null;
for (const cat of CATEGORY_IDS) {
  for (const [level, tier] of Object.entries(OBSCURITY)) {
    const hit = seedPlayers.some(
      (p) => p.tags.includes(cat) && p.popularityTier === tier,
    );
    if (!hit) {
      emptyCombo = { cat, level, tier };
      break;
    }
  }
  if (emptyCombo) break;
}
if (!emptyCombo) {
  console.log("  skip fallback audit — no empty category×tier combo in seed");
} else {
  console.log(
    `  using empty combo: category=${emptyCombo.cat} obscurity=${emptyCombo.level} (tier ${emptyCombo.tier})`,
  );
  await client.mutation(api.rooms.updateSettings, {
    sessionId: host,
    roomId,
    settings: {
      obscurity: emptyCombo.level,
      clueDifficulty: "impossible",
      categories: [emptyCombo.cat],
    },
  });
  await client.mutation(api.games.startGame, { sessionId: host, roomId });
  game = await client.query(api.games.getCurrentGame, { roomId });
  cards = await fetchAssignments(game.gameId);
  imposters = Object.entries(cards).filter(([, c]) => c.role === "imposter");
  crew = Object.entries(cards).filter(([, c]) => c.role === "crew");
  ok(
    "widening produced a round instead of an error",
    game.roundNumber === 1 && imposters.length === 1 && crew[0][1].playerName.length > 0,
    `player: ${crew[0][1].playerName}`,
  );
  await client.mutation(api.games.backToLobby, { sessionId: host, roomId });
}

console.log("\n7. Leave / host promotion / cleanup");
await client.mutation(api.rooms.leaveRoom, { sessionId: host, roomId });
const hostRoom = await client.query(api.rooms.getMyRoom, { sessionId: host });
ok("host no longer in a room", hostRoom === null);
lobby = await client.query(api.rooms.getLobby, { roomId, sessionId: p2 });
ok(
  "earliest-joined player promoted to host",
  lobby.players.length === 3 && lobby.isHost === true && lobby.players[0].name === "Sam" && lobby.players[0].isHost,
);
for (const sessionId of [p2, p3, p4]) {
  await client.mutation(api.rooms.leaveRoom, { sessionId, roomId });
}
const gone = await client.query(api.rooms.getRoomByCode, { code });
ok("empty room deleted", gone === null);

console.log(`\nAll ${passed} checks passed.`);
