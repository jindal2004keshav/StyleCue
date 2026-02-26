import type { Outfit } from "../utils/api";

interface Props {
  outfit: Outfit;
  isWishlisted: boolean;
  onWishlist: () => void;
}

export default function OutfitCard({ outfit, isWishlisted, onWishlist }: Props) {
  const allImages = [
    ...outfit.user_image_urls,
    ...outfit.products.map((p) => p.image_url).filter(Boolean),
  ];

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        background: "#fff",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontWeight: 600, fontSize: 15, color: "#111" }}>{outfit.name}</span>
        <button
          onClick={onWishlist}
          title={isWishlisted ? "Remove from wishlist" : "Save to wishlist"}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 20,
            lineHeight: 1,
            padding: 2,
          }}
        >
          {isWishlisted ? "♥" : "♡"}
        </button>
      </div>

      {/* Image strip */}
      {allImages.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            marginBottom: 10,
            paddingBottom: 4,
          }}
        >
          {allImages.map((src, idx) => (
            <img
              key={idx}
              src={src}
              alt=""
              style={{
                height: 100,
                width: 80,
                objectFit: "cover",
                borderRadius: 6,
                flexShrink: 0,
                background: "#f3f4f6",
              }}
            />
          ))}
        </div>
      )}

      {/* Explanation */}
      <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.5, margin: "0 0 10px" }}>
        {outfit.explanation}
      </p>

      {/* Product list */}
      {outfit.products.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {outfit.products.map((p) => (
            <li
              key={p.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "5px 0",
                borderTop: "1px solid #f3f4f6",
                fontSize: 13,
              }}
            >
              <span>
                <a
                  href={p.pdp_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#1a1a1a", textDecoration: "underline" }}
                >
                  {p.name}
                </a>
                {p.category && (
                  <span style={{ color: "#9ca3af", marginLeft: 6 }}>{p.category}</span>
                )}
              </span>
              {p.price > 0 && (
                <span style={{ color: "#374151", fontWeight: 500 }}>
                  ${p.price.toFixed(2)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
