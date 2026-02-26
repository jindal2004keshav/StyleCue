import { OutfitCard } from "./OutfitCard";
import type { Outfit } from "../utils/api";

export interface Message {
  role: "user" | "assistant";
  content: string;
  outfits?: Outfit[];
}

interface Props {
  message: Message;
  isWishlisted: (outfitId: string) => boolean;
  onAddWishlist: (outfit: Outfit) => void;
  onRemoveWishlist: (outfitId: string) => void;
}

export default function MessageBubble({
  message,
  isWishlisted,
  onAddWishlist,
  onRemoveWishlist,
}: Props) {
  const isUser = message.role === "user";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: 12,
      }}
    >
      <div style={{ maxWidth: "80%", display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Text bubble — only shown when there is content */}
        {message.content && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              background: isUser ? "#1a1a1a" : "#f3f4f6",
              color: isUser ? "#fff" : "#111",
              whiteSpace: "pre-wrap",
              lineHeight: 1.5,
              fontSize: 14,
            }}
          >
            {message.content}
          </div>
        )}

        {/* Outfit cards rendered inline for assistant messages */}
        {!isUser && message.outfits && message.outfits.length > 0 && (
          <div>
            {message.outfits.map((outfit) => (
              <OutfitCard
                key={outfit.id}
                outfit={outfit}
                isWishlisted={isWishlisted(outfit.id)}
                onWishlist={() =>
                  isWishlisted(outfit.id) ? onRemoveWishlist(outfit.id) : onAddWishlist(outfit)
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
