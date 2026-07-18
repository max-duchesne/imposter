import { CONDENSED } from "./ui";

export function HomeScreen({
  onStart,
  onJoin,
}: {
  onStart: () => void;
  onJoin: () => void;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 40,
        animation: "riseIn .5s ease both",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            background: "#14315f",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 12px 28px rgba(20,49,95,.35)",
          }}
        >
          <div
            style={{
              fontFamily: CONDENSED,
              fontWeight: 800,
              fontSize: 34,
              color: "#f4f6fa",
              letterSpacing: 1,
            }}
          >
            MI
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h1
            style={{
              margin: 0,
              fontFamily: CONDENSED,
              fontWeight: 800,
              fontSize: 52,
              lineHeight: 1,
              letterSpacing: 0.5,
              textTransform: "uppercase",
            }}
          >
            Mule <span style={{ color: "#14315f" }}>Imposter</span>
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 500,
              color: "#5c6575",
            }}
          >
            One of you doesn&apos;t know the player.
          </p>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <button
          onClick={onStart}
          className="btn-primary"
          style={{
            borderRadius: 14,
            padding: 18,
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: 0.3,
            boxShadow: "0 10px 24px rgba(20,49,95,.3)",
          }}
        >
          Start game
        </button>
        <button
          onClick={onJoin}
          className="btn-outline-navy"
          style={{
            borderRadius: 14,
            padding: 16,
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: 0.3,
          }}
        >
          Join game
        </button>
      </div>
    </div>
  );
}
