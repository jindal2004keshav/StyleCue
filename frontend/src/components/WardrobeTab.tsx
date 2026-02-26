import { Image as ImageIcon } from "lucide-react";
import { useWishlist } from "../hooks/useWishlist";
import { OutfitCard } from "./OutfitCard";

export function WardrobeTab() {
  const { wishlist, removeOutfit, isWishlisted } = useWishlist();

  return (
    <div className="space-y-6">
      {wishlist.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No outfits saved yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {wishlist.map((outfit) => (
            <OutfitCard
              key={outfit.id}
              outfit={outfit}
              isWishlisted={isWishlisted(outfit.id)}
              onWishlist={() => removeOutfit(outfit.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
