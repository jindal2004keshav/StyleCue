import { Heart, ExternalLink, Shirt, ImageIcon } from "lucide-react";
import type { Outfit } from "../utils/api";

interface OutfitCardProps {
  outfit: Outfit;
  isWishlisted: boolean;
  onWishlist: () => void;
}

export function OutfitCard({ outfit, isWishlisted, onWishlist }: OutfitCardProps) {
  const stripImages = [...outfit.user_image_urls, ...outfit.products.map((product) => product.image_url)].filter(
    Boolean,
  );

  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-gray-900 text-sm" style={{ fontWeight: 700 }}>
            {outfit.name}
          </h3>
          <p className="text-xs text-gray-500 mt-1">{outfit.id}</p>
        </div>
        <button
          type="button"
          onClick={onWishlist}
          className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${
            isWishlisted
              ? "bg-rose-50 border-rose-200 text-rose-500"
              : "bg-gray-50 border-gray-200 text-gray-400 hover:border-rose-200 hover:text-rose-400"
          }`}
          aria-label={isWishlisted ? "Remove from wishlist" : "Save to wishlist"}
        >
          <Heart className={`w-4 h-4 ${isWishlisted ? "fill-current" : ""}`} />
        </button>
      </div>

      {stripImages.length > 0 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {stripImages.map((url, index) => (
            <div key={`${url}-${index}`} className="w-20 h-20 rounded-xl overflow-hidden border border-gray-100 flex-shrink-0">
              <img src={url} alt={outfit.name} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-gray-200 p-4 text-center text-gray-400 text-xs">
          <ImageIcon className="w-4 h-4 mx-auto mb-1" />
          No images available for this outfit
        </div>
      )}

      <p className="mt-3 text-sm text-gray-600 leading-relaxed">{outfit.explanation}</p>

      <div className="mt-3 space-y-2">
        {outfit.products.length === 0 ? (
          <div className="text-xs text-gray-400 bg-gray-50 rounded-xl p-2 border border-gray-100">
            No catalog products returned for this outfit.
          </div>
        ) : (
          outfit.products.map((product) => (
            <a
              key={product.id}
              href={product.pdp_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-3 py-2 hover:border-violet-200 hover:bg-violet-50/40 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm text-gray-800 truncate" style={{ fontWeight: 600 }}>
                  {product.name}
                </p>
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                  <Shirt className="w-3 h-3" />
                  {product.category}
                </p>
              </div>
              <div className="flex items-center gap-2 text-right">
                <span className="text-sm text-violet-600" style={{ fontWeight: 700 }}>
                  ${Number(product.price ?? 0).toFixed(2)}
                </span>
                <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
              </div>
            </a>
          ))
        )}
      </div>
    </article>
  );
}
