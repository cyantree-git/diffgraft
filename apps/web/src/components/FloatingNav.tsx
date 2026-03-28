import { useCallback, useEffect } from "react";

interface Props {
  currentChangeIndex: number;
  totalChanges: number;
  onNext: () => void;
  onPrev: () => void;
}

export function FloatingNav({ currentChangeIndex, totalChanges, onNext, onPrev }: Props) {
  const stableNext = useCallback(onNext, [onNext]);
  const stablePrev = useCallback(onPrev, [onPrev]);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.key === "F7" && !e.shiftKey) || (e.altKey && e.key === "ArrowDown")) {
        e.preventDefault();
        stableNext();
      } else if ((e.key === "F7" && e.shiftKey) || (e.altKey && e.key === "ArrowUp")) {
        e.preventDefault();
        stablePrev();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [stableNext, stablePrev]);

  if (totalChanges === 0) return null;

  const btnBase: React.CSSProperties = {
    width: 28, height: 28, padding: 0,
    background: "transparent", color: "#e2e8f0",
    border: "1px solid #334155", borderRadius: "4px",
    fontSize: "14px", lineHeight: 1,
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "background 0.1s",
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 16px",
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: 8,
        boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        zIndex: 100,
        userSelect: "none",
      }}
    >
      <button
        style={btnBase}
        onClick={onPrev}
        title="Previous change (Shift+F7 / Alt+↑)"
        aria-label="Previous change"
        onMouseEnter={(e) => { e.currentTarget.style.background = "#334155"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      >
        ↑
      </button>

      <span style={{ color: "#94a3b8", fontSize: 13, minWidth: 130, textAlign: "center" }}>
        {currentChangeIndex === -1
          ? `${totalChanges} change${totalChanges !== 1 ? "s" : ""}`
          : `Change ${currentChangeIndex + 1} of ${totalChanges}`}
      </span>

      <button
        style={btnBase}
        onClick={onNext}
        title="Next change (F7 / Alt+↓)"
        aria-label="Next change"
        onMouseEnter={(e) => { e.currentTarget.style.background = "#334155"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      >
        ↓
      </button>
    </div>
  );
}
