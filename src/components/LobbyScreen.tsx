"use client";

import type { CSSProperties } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { CATEGORIES, MIN_PLAYERS, SETTING_LEVELS } from "../../convex/constants";
import { errorMessage } from "@/lib/errors";
import { CONDENSED, labelStyle } from "./ui";

type Lobby = NonNullable<FunctionReturnType<typeof api.rooms.getLobby>>;
type Settings = Lobby["settings"];

const AVATAR_COLORS = [
  "#14315f",
  "#5c6575",
  "#7a5c2e",
  "#3e5c4a",
  "#5a3e5c",
  "#2e6b7a",
];

export function LobbyScreen({
  sessionId,
  roomId,
  lobby,
  showError,
}: {
  sessionId: string;
  roomId: Id<"rooms">;
  lobby: Lobby;
  showError: (message: string) => void;
}) {
  const leaveRoom = useMutation(api.rooms.leaveRoom);
  const startGame = useMutation(api.games.startGame);
  const updateSettings = useMutation(api.rooms.updateSettings).withOptimisticUpdate(
    (localStore, args) => {
      const current = localStore.getQuery(api.rooms.getLobby, {
        roomId,
        sessionId,
      });
      if (current) {
        localStore.setQuery(
          api.rooms.getLobby,
          { roomId, sessionId },
          { ...current, settings: args.settings },
        );
      }
    },
  );

  const isHost = lobby.isHost;
  const settings = lobby.settings;

  const applySettings = async (next: Settings) => {
    try {
      await updateSettings({ sessionId, roomId, settings: next });
    } catch (err) {
      showError(errorMessage(err));
    }
  };

  const enough = lobby.players.length >= MIN_PLAYERS;
  const anyCat = settings.categories.length > 0;
  const startDisabled = !anyCat || !enough;

  const segButton = (
    selected: boolean,
    label: string,
    onSelect: () => void,
  ) => (
    <button
      key={label}
      onClick={onSelect}
      disabled={!isHost}
      className="seg-btn"
      style={
        {
          flex: 1,
          minWidth: 60,
          "--seg-border": selected ? "#14315f" : "#dde2ea",
          background: selected ? "#14315f" : "#f6f7f9",
          color: selected ? "#f4f6fa" : "#5c6575",
          borderRadius: 10,
          padding: "9px 4px",
          fontSize: 13,
          fontWeight: 700,
        } as CSSProperties
      }
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 22,
        animation: "riseIn .4s ease both",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <button
          onClick={() => leaveRoom({ sessionId, roomId }).catch(() => {})}
          className="btn-ghost"
          style={{ padding: "6px 0", fontSize: 14, fontWeight: 600 }}
        >
          ← Leave
        </button>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#ffffff",
            border: "2px solid #c9d0dc",
            borderRadius: 10,
            padding: "6px 12px",
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              color: "#8a93a3",
            }}
          >
            Room
          </span>
          <span
            style={{
              fontFamily: CONDENSED,
              fontWeight: 800,
              fontSize: 22,
              letterSpacing: 4,
              color: "#14315f",
            }}
          >
            {lobby.code}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
          }}
        >
          <h3
            style={{
              margin: 0,
              fontFamily: CONDENSED,
              fontWeight: 800,
              fontSize: 24,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Players
          </h3>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: enough ? "#3e6b4a" : "#a04545",
            }}
          >
            {lobby.players.length} / {MIN_PLAYERS}+ needed
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {lobby.players.map((p, i) => (
            <div
              key={p.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: "#ffffff",
                borderRadius: 12,
                padding: "12px 14px",
                boxShadow: "0 1px 3px rgba(17,21,28,.06)",
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: AVATAR_COLORS[i % AVATAR_COLORS.length],
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: CONDENSED,
                  fontWeight: 700,
                  fontSize: 16,
                }}
              >
                {p.name.charAt(0).toUpperCase()}
              </div>
              <span style={{ flex: 1, fontSize: 16, fontWeight: 600 }}>
                {p.name}
              </span>
              {p.isHost && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 0.6,
                    textTransform: "uppercase",
                    color: "#14315f",
                    background: "#e3e9f4",
                    borderRadius: 6,
                    padding: "3px 8px",
                  }}
                >
                  Host
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          background: "#ffffff",
          borderRadius: 16,
          padding: "18px 16px",
          boxShadow: "0 1px 3px rgba(17,21,28,.06)",
          opacity: isHost ? 1 : 0.65,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontFamily: CONDENSED,
            fontWeight: 800,
            fontSize: 24,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Settings
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={labelStyle}>Player obscurity</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {SETTING_LEVELS.map((level) =>
              segButton(settings.obscurity === level.id, level.label, () =>
                applySettings({ ...settings, obscurity: level.id }),
              ),
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={labelStyle}>Clue difficulty</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {SETTING_LEVELS.map((level) =>
              segButton(settings.clueDifficulty === level.id, level.label, () =>
                applySettings({ ...settings, clueDifficulty: level.id }),
              ),
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={labelStyle}>Player pool · pick any</label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 6,
            }}
          >
            {CATEGORIES.map((cat) => {
              const on = settings.categories.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  onClick={() =>
                    applySettings({
                      ...settings,
                      categories: on
                        ? settings.categories.filter((c) => c !== cat.id)
                        : [...settings.categories, cat.id],
                    })
                  }
                  disabled={!isHost}
                  className="seg-btn"
                  style={
                    {
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      "--seg-border": on ? "#14315f" : "#dde2ea",
                      background: on ? "#e9eef7" : "#f6f7f9",
                      borderRadius: 10,
                      padding: "10px 10px",
                      textAlign: "left",
                    } as CSSProperties
                  }
                >
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      flexShrink: 0,
                      borderRadius: 5,
                      border: `2px solid ${on ? "#14315f" : "#b8c0cd"}`,
                      background: on ? "#14315f" : "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#ffffff",
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    {on ? "\u2713" : ""}
                  </div>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      lineHeight: 1.2,
                      color: on ? "#14315f" : "#5c6575",
                    }}
                  >
                    {cat.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {isHost && (
        <button
          onClick={() =>
            startGame({ sessionId, roomId }).catch((err) =>
              showError(errorMessage(err)),
            )
          }
          disabled={startDisabled}
          className="btn-primary"
          style={{
            borderRadius: 14,
            padding: 18,
            fontSize: 17,
            fontWeight: 700,
            boxShadow: "0 10px 24px rgba(20,49,95,.3)",
            opacity: startDisabled ? 0.45 : 1,
          }}
        >
          {anyCat ? "Start game" : "Pick at least one category"}
        </button>
      )}
    </div>
  );
}
