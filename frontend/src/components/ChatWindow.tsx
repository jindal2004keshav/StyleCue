import { useRef, useState } from "react";
import MessageBubble from "./MessageBubble";
import Preferences from "./Preferences";
import WishlistPanel from "./WishlistPanel";
import type { Message } from "./MessageBubble";
import { sendChat } from "../utils/api";
import type { ConversationContext } from "../utils/api";
import { useWishlist } from "../hooks/useWishlist";

export default function ChatWindow() {
  const [department, setDepartment] = useState<"men" | "women">("women");
  const [preferences, setPreferences] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [conversationContext, setConversationContext] = useState<ConversationContext | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { wishlist, addOutfit, removeOutfit, isWishlisted } = useWishlist();

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);

    try {
      const res = await sendChat({
        department,
        message: text,
        preferences,
        images,
        conversationContext: conversationContext ?? undefined,
      });

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", outfits: res.outfits },
      ]);

      // Build/update conversation context for the next turn
      setConversationContext({
        initial_request: conversationContext?.initial_request ?? {
          department,
          prompt: text,
          preferences,
        },
        last_outfits: res.outfits,
      });

      setImages([]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err instanceof Error ? err.message : String(err)}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Top bar: department + preferences + wishlist button */}
      <div
        style={{
          display: "flex", alignItems: "flex-start", gap: 24,
          padding: "16px 24px", borderBottom: "1px solid #e5e7eb", flexShrink: 0,
        }}
      >
        {/* Department toggle */}
        <div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Department
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["women", "men"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDepartment(d)}
                style={{
                  padding: "5px 14px", borderRadius: 20, fontSize: 13, cursor: "pointer",
                  border: "1px solid",
                  borderColor: department === d ? "#1a1a1a" : "#e5e7eb",
                  background: department === d ? "#1a1a1a" : "#fff",
                  color: department === d ? "#fff" : "#374151",
                }}
              >
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Preferences panel */}
        <div style={{ flex: 1 }}>
          <Preferences onChange={setPreferences} />
        </div>

        {/* Wishlist button */}
        <button
          onClick={() => setWishlistOpen(true)}
          style={{
            background: "none", border: "1px solid #e5e7eb", borderRadius: 8,
            padding: "6px 12px", cursor: "pointer", fontSize: 13, display: "flex",
            alignItems: "center", gap: 4, alignSelf: "center", color: "#374151",
          }}
        >
          ♥ Wishlist{wishlist.length > 0 && ` (${wishlist.length})`}
        </button>
      </div>

      {/* Message list */}
      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        {messages.length === 0 && (
          <p style={{ color: "#9ca3af", textAlign: "center", marginTop: 60 }}>
            Describe what you're looking for and StyleCue will build your outfit…
          </p>
        )}
        {messages.map((m, i) => (
          <MessageBubble
            key={i}
            message={m}
            isWishlisted={isWishlisted}
            onAddWishlist={addOutfit}
            onRemoveWishlist={removeOutfit}
          />
        ))}
        {loading && (
          <div style={{ color: "#9ca3af", fontSize: 13, paddingLeft: 4 }}>Styling…</div>
        )}
      </div>

      {/* Input bar */}
      <div
        style={{
          display: "flex", gap: 8, padding: "12px 24px",
          borderTop: "1px solid #e5e7eb", alignItems: "flex-end",
        }}
      >
        <button
          onClick={() => fileRef.current?.click()}
          title="Attach images"
          style={{
            background: "none", border: "1px solid #e5e7eb", borderRadius: 8,
            padding: "8px 10px", cursor: "pointer", fontSize: 16,
          }}
        >
          📎{images.length > 0 && <span style={{ fontSize: 11, marginLeft: 2 }}>{images.length}</span>}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => setImages(Array.from(e.target.files ?? []))}
        />

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
          }}
          placeholder="Describe what you need…"
          rows={2}
          style={{
            flex: 1, resize: "none", border: "1px solid #e5e7eb", borderRadius: 10,
            padding: "10px 12px", fontSize: 14, fontFamily: "inherit", outline: "none",
          }}
        />

        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          style={{
            background: "#1a1a1a", color: "#fff", border: "none", borderRadius: 10,
            padding: "10px 20px", cursor: loading ? "not-allowed" : "pointer",
            opacity: loading || !input.trim() ? 0.5 : 1, fontSize: 14,
          }}
        >
          Send
        </button>
      </div>

      {/* Wishlist drawer */}
      <WishlistPanel
        isOpen={wishlistOpen}
        onClose={() => setWishlistOpen(false)}
        wishlist={wishlist}
        isWishlisted={isWishlisted}
        onRemoveWishlist={removeOutfit}
      />
    </div>
  );
}
