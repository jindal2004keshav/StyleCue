import { ArrowLeft } from "lucide-react";

interface Props {
  onSelect: (department: "men" | "women") => void;
  onBack: () => void;
}

export function GenderSelectPage({ onSelect, onBack }: Props) {
  return (
    <div className="flex h-screen w-screen overflow-hidden relative">
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="absolute top-5 left-5 z-20 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
        aria-label="Go back"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {/* Men half */}
      <button
        type="button"
        onClick={() => onSelect("men")}
        className="flex-1 h-full flex flex-col items-center justify-center gap-6 transition-all duration-300 hover:brightness-110 group focus:outline-none"
        style={{
          background: "linear-gradient(135deg, #0f0c1e 0%, #1a1232 100%)",
          border: "none",
          cursor: "pointer",
        }}
      >
        <div className="flex flex-col items-center gap-4 transition-transform duration-300 group-hover:-translate-y-1">
          <span style={{ fontSize: "4.5rem", lineHeight: 1 }}>👔</span>
          <div className="text-center">
            <p className="text-white/50 text-sm mb-2 tracking-widest uppercase" style={{ fontWeight: 500 }}>
              Styling for
            </p>
            <h2 className="text-white" style={{ fontWeight: 800, fontSize: "2.5rem", letterSpacing: "-0.02em" }}>
              For Men
            </h2>
          </div>
        </div>
        <div
          className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 px-6 py-2 rounded-full border border-violet-400/50 text-violet-300 text-sm"
          style={{ fontWeight: 500 }}
        >
          Select →
        </div>
        {/* Subtle glow on hover */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{ boxShadow: "inset 0 0 80px rgba(139, 92, 246, 0.08)" }}
        />
      </button>

      {/* Divider */}
      <div className="w-px bg-gradient-to-b from-transparent via-gray-300/30 to-transparent z-10 flex-shrink-0" />

      {/* Women half */}
      <button
        type="button"
        onClick={() => onSelect("women")}
        className="flex-1 h-full flex flex-col items-center justify-center gap-6 transition-all duration-300 hover:brightness-105 group focus:outline-none"
        style={{
          background: "linear-gradient(135deg, #fff1f7 0%, #fce7f3 100%)",
          border: "none",
          cursor: "pointer",
        }}
      >
        <div className="flex flex-col items-center gap-4 transition-transform duration-300 group-hover:-translate-y-1">
          <span style={{ fontSize: "4.5rem", lineHeight: 1 }}>👗</span>
          <div className="text-center">
            <p className="text-rose-300 text-sm mb-2 tracking-widest uppercase" style={{ fontWeight: 500 }}>
              Styling for
            </p>
            <h2 style={{ fontWeight: 800, fontSize: "2.5rem", letterSpacing: "-0.02em", color: "#9d174d" }}>
              For Women
            </h2>
          </div>
        </div>
        <div
          className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 px-6 py-2 rounded-full border text-sm"
          style={{ fontWeight: 500, borderColor: "#f9a8d4", color: "#be185d" }}
        >
          Select →
        </div>
        {/* Subtle glow on hover */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{ boxShadow: "inset 0 0 80px rgba(236, 72, 153, 0.06)" }}
        />
      </button>
    </div>
  );
}
