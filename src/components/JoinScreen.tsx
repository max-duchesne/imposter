"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { errorMessage } from "@/lib/errors";
import { CONDENSED, labelStyle } from "./ui";

export function JoinScreen({
  mode,
  sessionId,
  onBack,
  showError,
}: {
  mode: "start" | "join";
  sessionId: string;
  onBack: () => void;
  showError: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const createRoom = useMutation(api.rooms.createRoom);
  const joinRoom = useMutation(api.rooms.joinRoom);

  const joining = mode === "join";
  // Reactive existence/status check while the user types a full code.
  const roomCheck = useQuery(
    api.rooms.getRoomByCode,
    joining && code.length === 4 ? { code } : "skip",
  );

  const disabled =
    !name.trim() || (joining && code.trim().length !== 4) || submitting;

  const submit = async () => {
    if (disabled) return;
    if (joining && roomCheck === null) {
      showError("Room not found.");
      return;
    }
    setSubmitting(true);
    try {
      if (joining) {
        await joinRoom({ sessionId, code, name });
      } else {
        await createRoom({ sessionId, name });
      }
      // The getMyRoom subscription flips the screen; no local navigation.
    } catch (err) {
      showError(errorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 28,
        animation: "riseIn .4s ease both",
      }}
    >
      <button
        onClick={onBack}
        className="btn-ghost"
        style={{
          alignSelf: "flex-start",
          padding: "6px 0",
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        ← Back
      </button>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h2
          style={{
            margin: 0,
            fontFamily: CONDENSED,
            fontWeight: 800,
            fontSize: 38,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          {joining ? "Join a game" : "Start a game"}
        </h2>
        <p style={{ margin: 0, fontSize: 15, color: "#5c6575" }}>
          {joining
            ? "Enter your name and the room code from your host."
            : "Enter your name to create a room."}
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={labelStyle}>Your name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ben"
            className="input-base"
            style={{
              borderRadius: 12,
              padding: "14px 16px",
              fontSize: 17,
              fontWeight: 600,
            }}
          />
        </div>
        {joining && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={labelStyle}>Room code</label>
            <input
              value={code}
              onChange={(e) =>
                setCode(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z]/g, "")
                    .slice(0, 4),
                )
              }
              placeholder="ABCD"
              maxLength={4}
              className="input-base"
              style={{
                borderRadius: 12,
                padding: "14px 16px",
                fontSize: 26,
                fontWeight: 800,
                fontFamily: CONDENSED,
                letterSpacing: 10,
                textTransform: "uppercase",
                textAlign: "center",
              }}
            />
          </div>
        )}
        <button
          onClick={submit}
          disabled={disabled}
          className="btn-primary"
          style={{
            borderRadius: 14,
            padding: 17,
            fontSize: 17,
            fontWeight: 700,
            opacity: disabled ? 0.45 : 1,
          }}
        >
          {joining ? "Join lobby" : "Create lobby"}
        </button>
      </div>
    </div>
  );
}
