import OutfitCard from "./OutfitCard";
import type { Outfit } from "../utils/api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  wishlist: Outfit[];
  isWishlisted: (outfitId: string) => boolean;
  onRemoveWishlist: (outfitId: string) => void;
}

export default function WishlistPanel({
  isOpen,
  onClose,
  wishlist,
  isWishlisted,
  onRemoveWishlist,
}: Props) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.2)",
          zIndex: 10,
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 360,
          background: "#fff",
          boxShadow: "-4px 0 20px rgba(0,0,0,0.1)",
          zIndex: 11,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Panel header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid #e5e7eb",
            flexShrink: 0,
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 16 }}>
            Wishlist {wishlist.length > 0 && `(${wishlist.length})`}
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 20,
              lineHeight: 1,
              color: "#6b7280",
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {wishlist.length === 0 ? (
            <p style={{ color: "#9ca3af", textAlign: "center", marginTop: 40, fontSize: 14 }}>
              No outfits saved yet.
            </p>
          ) : (
            wishlist.map((outfit) => (
              <OutfitCard
                key={outfit.id}
                outfit={outfit}
                isWishlisted={isWishlisted(outfit.id)}
                onWishlist={() => onRemoveWishlist(outfit.id)}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}
