import { Wand2, Sparkles, Heart } from "lucide-react";
import { useState } from "react";
import { OutfitCard } from "../components/OutfitCard";
import { WishlistPanel } from "../components/WishlistPanel";
import { useWishlist } from "../hooks/useWishlist";

interface Props {
  onCreateOutfit: () => void;
}

export function LandingPage({ onCreateOutfit }: Props) {
  const { wishlist, addOutfit, removeOutfit, isWishlisted } = useWishlist();
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);

  const handleToggleWishlist = (outfit: Parameters<typeof addOutfit>[0]) => {
    if (isWishlisted(outfit.id)) {
      removeOutfit(outfit.id);
    } else {
      addOutfit(outfit);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50/40 via-white to-pink-50/30 flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-sm border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-gray-900" style={{ fontWeight: 700, fontSize: "1.1rem" }}>
              StyleCue
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsWishlistOpen(true)}
              className="flex items-center gap-1.5 text-sm text-rose-600 bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-lg hover:bg-rose-100 transition-colors"
            >
              <Heart className="w-4 h-4" />
              <span style={{ fontWeight: 500 }}>Saved ({wishlist.length})</span>
            </button>
            <button
              type="button"
              onClick={onCreateOutfit}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 text-white text-sm hover:opacity-90 transition-all active:scale-95 shadow-sm shadow-violet-200"
              style={{ fontWeight: 600 }}
            >
              <Wand2 className="w-4 h-4" />
              Create Outfit
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        {wishlist.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-100 to-pink-100 flex items-center justify-center">
              <Sparkles className="w-9 h-9 text-violet-400" />
            </div>
            <div>
              <h2 className="text-gray-800 mb-2" style={{ fontWeight: 700, fontSize: "1.3rem" }}>
                No saved outfits yet
              </h2>
              <p className="text-gray-500 text-sm max-w-xs leading-relaxed">
                Start styling and save looks you love — they'll appear here.
              </p>
            </div>
            <button
              type="button"
              onClick={onCreateOutfit}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 text-white hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-violet-200"
              style={{ fontWeight: 600 }}
            >
              <Wand2 className="w-4 h-4" />
              Start styling →
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h2 className="text-gray-900 mb-1" style={{ fontWeight: 700, fontSize: "1.2rem" }}>
                My Outfits
              </h2>
              <p className="text-gray-500 text-sm">{wishlist.length} saved look{wishlist.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="space-y-4">
              {wishlist.map((outfit) => (
                <OutfitCard
                  key={outfit.id}
                  outfit={outfit}
                  isWishlisted={isWishlisted(outfit.id)}
                  onWishlist={() => handleToggleWishlist(outfit)}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      <WishlistPanel
        isOpen={isWishlistOpen}
        outfits={wishlist}
        isWishlisted={isWishlisted}
        onToggleOutfit={handleToggleWishlist}
        onClose={() => setIsWishlistOpen(false)}
      />
    </div>
  );
}
