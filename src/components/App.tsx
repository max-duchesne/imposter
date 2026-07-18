"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useSessionId } from "@/lib/session";
import { HomeScreen } from "./HomeScreen";
import { JoinScreen } from "./JoinScreen";
import { LobbyScreen } from "./LobbyScreen";
import { GameScreen } from "./GameScreen";
import { LoadingScreen, Shell, Toast } from "./ui";

type LocalScreen = { screen: "home" } | { screen: "join"; mode: "start" | "join" };

export function App() {
  const sessionId = useSessionId();
  const [local, setLocal] = useState<LocalScreen>({ screen: "home" });

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showError = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  // Session restore: the by_session lookup decides which screen we're on.
  const myRoom = useQuery(
    api.rooms.getMyRoom,
    sessionId ? { sessionId } : "skip",
  );
  const roomId = myRoom?.roomId;
  const lobby = useQuery(
    api.rooms.getLobby,
    sessionId && roomId ? { roomId, sessionId } : "skip",
  );
  const game = useQuery(
    api.games.getCurrentGame,
    roomId && lobby?.status === "in_game" ? { roomId } : "skip",
  );
  const assignment = useQuery(
    api.games.getMyAssignment,
    sessionId && game ? { gameId: game.gameId, sessionId } : "skip",
  );

  // After leaving (or being promoted out of) a room, land back on Home.
  const wasInRoom = useRef(false);
  useEffect(() => {
    if (roomId) {
      wasInRoom.current = true;
    } else if (myRoom === null && wasInRoom.current) {
      wasInRoom.current = false;
      setLocal({ screen: "home" });
    }
  }, [roomId, myRoom]);

  let content: React.ReactNode;
  if (!sessionId || myRoom === undefined) {
    content = <LoadingScreen />;
  } else if (myRoom === null) {
    content =
      local.screen === "join" ? (
        <JoinScreen
          mode={local.mode}
          sessionId={sessionId}
          onBack={() => setLocal({ screen: "home" })}
          showError={showError}
        />
      ) : (
        <HomeScreen
          onStart={() => setLocal({ screen: "join", mode: "start" })}
          onJoin={() => setLocal({ screen: "join", mode: "join" })}
        />
      );
  } else if (!lobby) {
    content = <LoadingScreen />;
  } else if (lobby.status === "lobby") {
    content = (
      <LobbyScreen
        sessionId={sessionId}
        roomId={roomId!}
        lobby={lobby}
        showError={showError}
      />
    );
  } else if (!game || !assignment) {
    // in_game, but the round/card subscription hasn't arrived yet.
    content = <LoadingScreen />;
  } else {
    content = (
      <GameScreen
        key={game.gameId}
        sessionId={sessionId}
        roomId={roomId!}
        roomCode={lobby.code}
        roundNumber={game.roundNumber}
        assignment={assignment}
        isHost={lobby.isHost}
        showError={showError}
      />
    );
  }

  return (
    <Shell>
      {content}
      {toast && <Toast message={toast} />}
    </Shell>
  );
}
