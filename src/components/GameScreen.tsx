"use client";

import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { errorMessage } from "@/lib/errors";
import { CONDENSED } from "./ui";

type Assignment = NonNullable<
  FunctionReturnType<typeof api.games.getMyAssignment>
>;

export function GameScreen({
  sessionId,
  roomId,
  roomCode,
  roundNumber,
  assignment,
  isHost,
  showError,
}: {
  sessionId: string;
  roomId: Id<"rooms">;
  roomCode: string;
  roundNumber: number;
  assignment: Assignment;
  isHost: boolean;
  showError: (message: string) => void;
}) {
  const newRound = useMutation(api.games.newRound);
  const backToLobby = useMutation(api.games.backToLobby);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 24,
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
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            color: "#8a93a3",
          }}
        >
          Round {roundNumber}
        </span>
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
              fontFamily: CONDENSED,
              fontWeight: 800,
              fontSize: 18,
              letterSpacing: 4,
              color: "#14315f",
            }}
          >
            {roomCode}
          </span>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 16,
        }}
      >
        {assignment.role === "imposter" ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 20,
              background: "#2b1216",
              borderRadius: 22,
              padding: "48px 24px",
              textAlign: "center",
              boxShadow: "0 18px 44px rgba(43,18,22,.4)",
              animation: "popIn .45s ease both",
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: "#d99aa3",
              }}
            >
              You are the
            </span>
            <div
              style={{
                fontFamily: CONDENSED,
                fontWeight: 800,
                fontSize: 62,
                lineHeight: 1,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: "#f3dfe2",
              }}
            >
              Imposter
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                background: "rgba(255,255,255,.07)",
                borderRadius: 14,
                padding: "16px 20px",
                maxWidth: 300,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  color: "#d99aa3",
                }}
              >
                Your clue
              </span>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  lineHeight: 1.4,
                  color: "#f7edee",
                }}
              >
                {assignment.clueText}
              </span>
            </div>
            {assignment.categories.length > 0 && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  lineHeight: 1.4,
                  color: "#b98a91",
                  maxWidth: 280,
                }}
              >
                Pool: {assignment.categories.join(" \u00b7 ")}
              </span>
            )}
            <p
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 500,
                color: "#b98a91",
                maxWidth: 260,
              }}
            >
              Blend in. Don&apos;t let them figure out you don&apos;t know the
              player.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 20,
              background: "#14315f",
              borderRadius: 22,
              padding: "48px 24px",
              textAlign: "center",
              boxShadow: "0 18px 44px rgba(20,49,95,.4)",
              animation: "popIn .45s ease both",
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: "#9fb2d4",
              }}
            >
              The player is
            </span>
            <div
              style={{
                fontFamily: CONDENSED,
                fontWeight: 800,
                fontSize: 54,
                lineHeight: 1.05,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: "#f4f6fa",
              }}
            >
              {assignment.playerName}
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 500,
                color: "#9fb2d4",
                maxWidth: 260,
              }}
            >
              Everyone else sees this too — except one. Find the imposter.
            </p>
          </div>
        )}
      </div>

      {isHost && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={() =>
              newRound({ sessionId, roomId }).catch((err) =>
                showError(errorMessage(err)),
              )
            }
            className="btn-primary"
            style={{
              borderRadius: 14,
              padding: 17,
              fontSize: 17,
              fontWeight: 700,
            }}
          >
            New round
          </button>
          <button
            onClick={() =>
              backToLobby({ sessionId, roomId }).catch((err) =>
                showError(errorMessage(err)),
              )
            }
            className="btn-outline-muted"
            style={{
              borderRadius: 14,
              padding: 14,
              fontSize: 15,
              fontWeight: 700,
            }}
          >
            Back to lobby
          </button>
        </div>
      )}
    </div>
  );
}
