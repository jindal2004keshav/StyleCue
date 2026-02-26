import { X } from "lucide-react";
import type { Outfit } from "../utils/api";
import { OutfitCard } from "./OutfitCard";

interface WishlistPanelProps {
  isOpen: boolean;
  outfits: Outfit[];
  isWishlisted: (outfitId: string) => boolean;
  onToggleOutfit: (outfit: Outfit) => void;
  onClose: () => void;
}

export function WishlistPanel({
  isOpen,
  outfits,
  isWishlisted,
  onToggleOutfit,
  onClose,
}: WishlistPanelProps) {
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-50 border-l border-gray-100 shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-gray-900" style={{ fontWeight: 700 }}>
              Wishlist
            </h2>
            <p className="text-xs text-gray-500">Saved outfits ({outfits.length})</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 flex items-center justify-center"
            aria-label="Close wishlist"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {outfits.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 p-5 text-center text-sm text-gray-500">
              No outfits saved yet.
            </div>
          ) : (
            outfits.map((outfit) => (
              <OutfitCard
                key={outfit.id}
                outfit={outfit}
                isWishlisted={isWishlisted(outfit.id)}
                onWishlist={() => onToggleOutfit(outfit)}
              />
            ))
          )}
        </div>
      </aside>
    </>
  );
}
