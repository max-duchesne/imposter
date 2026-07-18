import type { CSSProperties, ReactNode } from "react";

export const CONDENSED = "var(--font-barlow-condensed), sans-serif";

export const labelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  color: "#5c6575",
};

/** Page background + centered 430px column from the design reference. */
export function Shell({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        flex: 1,
        display: "flex",
        justifyContent: "center",
        fontFamily: "var(--font-barlow), sans-serif",
        color: "#11151c",
        background:
          "radial-gradient(1200px 600px at 50% -200px, #dfe4ec, #eef0f4)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 430,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          padding: "24px 20px 32px 20px",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function LoadingScreen() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "riseIn .4s ease both",
      }}
    >
      <div className="spinner" />
    </div>
  );
}

export function Toast({ message }: { message: string }) {
  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 28,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 50,
      }}
    >
      <div
        style={{
          background: "#a04545",
          color: "#ffffff",
          borderRadius: 10,
          padding: "10px 16px",
          fontSize: 14,
          fontWeight: 600,
          maxWidth: 360,
          textAlign: "center",
          boxShadow: "0 8px 20px rgba(17,21,28,.25)",
          animation: "popIn .3s ease both",
        }}
      >
        {message}
      </div>
    </div>
  );
}
