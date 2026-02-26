import { useRef, useState } from "react";
import MessageBubble from "./MessageBubble";
import Preferences from "./Preferences";
import { WishlistPanel } from "./WishlistPanel";
import type { Message } from "./MessageBubble";
import { sendChat } from "../utils/api";
import type { ConversationContext } from "../utils/api";
import { useWishlist } from "../hooks/useWishlist";

const DEPARTMENT_OPTIONS = [
  { value: "women", label: "For Her" },
  { value: "men", label: "For Him" },
] as const;

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
        prompt: text,
        preferences,
        images,
        conversationContext: conversationContext ?? undefined,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.reasoning || "Here are curated outfit suggestions.",
          outfits: res.outfits,
        },
      ]);

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
        {
          role: "assistant",
          content: `Error: ${err instanceof Error ? err.message : String(err)}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 24,
          padding: "16px 24px",
          borderBottom: "1px solid #e5e7eb",
          flexShrink: 0,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              color: "#9ca3af",
              marginBottom: 8,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Department
          </div>

          <fieldset style={{ border: "none", margin: 0, padding: 0 }}>
            <legend style={{ display: "none" }}>Department selection</legend>
            <div style={{ display: "flex", gap: 8 }}>
              {DEPARTMENT_OPTIONS.map((option) => {
                const checked = department === option.value;

                return (
                  <label
                    key={option.value}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "7px 12px",
                      borderRadius: 999,
                      border: checked ? "1px solid #7c3aed" : "1px solid #d1d5db",
                      background: checked ? "#f5f3ff" : "#fff",
                      color: checked ? "#6d28d9" : "#374151",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="department"
                      value={option.value}
                      checked={checked}
                      onChange={() => setDepartment(option.value)}
                      style={{ margin: 0 }}
                    />
                    {option.label}
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>

        <div style={{ flex: 1 }}>
          <Preferences onChange={setPreferences} />
        </div>

        <button
          onClick={() => setWishlistOpen(true)}
          style={{
            background: "none",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: "6px 12px",
            cursor: "pointer",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 4,
            alignSelf: "center",
            color: "#374151",
          }}
        >
          Wishlist{wishlist.length > 0 && ` (${wishlist.length})`}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 24, background: "#fcfcfd" }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", marginTop: 60 }}>
            <p style={{ color: "#6b7280", marginBottom: 8, fontSize: 16, fontWeight: 600 }}>
              What are we wearing today?
            </p>
            <p style={{ color: "#9ca3af", margin: 0, fontSize: 13 }}>
              Describe your look, attach clothing images, and refine outfit cards in chat.
            </p>
          </div>
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
        {loading && <div style={{ color: "#9ca3af", fontSize: 13, paddingLeft: 4 }}>Styling...</div>}
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "12px 24px",
          borderTop: "1px solid #e5e7eb",
          alignItems: "flex-end",
          background: "#fff",
        }}
      >
        <button
          onClick={() => fileRef.current?.click()}
          title="Attach images"
          style={{
            background: "none",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: "8px 10px",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Attach{images.length > 0 && <span style={{ fontSize: 11, marginLeft: 4 }}>({images.length})</span>}
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
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Describe what you need..."
          rows={2}
          style={{
            flex: 1,
            resize: "none",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 14,
            fontFamily: "inherit",
            outline: "none",
          }}
        />

        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          style={{
            background: "linear-gradient(120deg, #7c3aed, #ec4899)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "10px 20px",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading || !input.trim() ? 0.5 : 1,
            fontSize: 14,
          }}
        >
          Send
        </button>
      </div>

      <WishlistPanel
        isOpen={wishlistOpen}
        onClose={() => setWishlistOpen(false)}
        outfits={wishlist}
        isWishlisted={isWishlisted}
        onToggleOutfit={(outfit) =>
          isWishlisted(outfit.id) ? removeOutfit(outfit.id) : addOutfit(outfit)
        }
      />
    </div>
  );
}
