import { useState } from "react";

interface Props {
  onChange: (prefs: Record<string, string>) => void;
}

const LOVS: Record<string, string[]> = {
  Occasion: ["casual", "party", "everyday", "workwear", "elevated"],
  Fit:      ["regular", "skinny", "oversized", "comfort", "slim"],
  Material: ["cotton", "silk", "polyester", "nylon", "linen"],
};

export default function Preferences({ onChange }: Props) {
  const [selected, setSelected] = useState<Record<string, Set<string>>>({
    Occasion: new Set(),
    Fit:      new Set(),
    Material: new Set(),
  });

  function toggle(category: string, value: string) {
    setSelected((prev) => {
      const next = { ...prev, [category]: new Set(prev[category]) };
      if (next[category].has(value)) {
        next[category].delete(value);
      } else {
        next[category].add(value);
      }
      emit(next);
      return next;
    });
  }

  function emit(state: Record<string, Set<string>>) {
    const prefs: Record<string, string> = {};
    for (const [cat, vals] of Object.entries(state)) {
      if (vals.size > 0) prefs[cat] = Array.from(vals).join(", ");
    }
    onChange(prefs);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {Object.entries(LOVS).map(([category, options]) => (
        <div key={category} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{
            fontSize: 10, fontWeight: 600, color: "#6b7280",
            textTransform: "uppercase", letterSpacing: "0.06em",
            minWidth: 58, flexShrink: 0,
          }}>
            {category}
          </span>
          {options.map((opt) => {
            const checked = selected[category].has(opt);
            return (
              <button
                key={opt}
                onClick={() => toggle(category, opt)}
                style={{
                  padding: "2px 9px",
                  borderRadius: 12,
                  fontSize: 11,
                  cursor: "pointer",
                  border: checked ? "1px solid #1a1a1a" : "1px solid #d1d5db",
                  background: checked ? "#1a1a1a" : "transparent",
                  color: checked ? "#ffffff" : "#6b7280",
                  fontFamily: "inherit",
                  transition: "all 0.1s",
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
