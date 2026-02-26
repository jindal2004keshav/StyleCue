import { ChevronDown, Heart, ImageIcon, Info } from "lucide-react";
import { useMemo, useState } from "react";
import type { Outfit } from "../utils/api";

interface OutfitCardProps {
  outfit: Outfit;
  isWishlisted: boolean;
  onWishlist: () => void;
}

export function OutfitCard({ outfit, isWishlisted, onWishlist }: OutfitCardProps) {
  const [showInfo, setShowInfo] = useState(false);

  // One tile per product — primary image only, keeps the strip clean
  const tiles = useMemo(() => {
    const userTiles = outfit.user_image_urls.map((url) => ({
      url,
      label: "Your item",
      brand: undefined as string | undefined,
      pdpUrl: undefined as string | undefined,
      priceLabel: undefined as string | undefined,
    }));

    const productTiles = outfit.products
      .map((product) => {
        const url = product.image_urls?.length ? product.image_urls[0] : product.image_url;
        const priceLabel = `${(product.currency || "USD").toUpperCase()} ${Number(product.price ?? 0).toFixed(2)}`;
        return { url, label: product.name, brand: product.brand, pdpUrl: product.pdp_url, priceLabel };
      })
      .filter((t) => Boolean(t.url));

    return [...userTiles, ...productTiles];
  }, [outfit.products, outfit.user_image_urls]);

  const totalLabel = outfit.total_cost
    ? `${(outfit.currency || "USD").toUpperCase()} ${Number(outfit.total_cost).toFixed(2)}`
    : null;

  return (
    <article className="w-full rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
        <h3 className="text-gray-900 text-sm truncate pr-4" style={{ fontWeight: 700 }}>
          {outfit.name}
        </h3>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => setShowInfo((p) => !p)}
            className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${
              showInfo
                ? "bg-violet-50 border-violet-200 text-violet-600"
                : "bg-gray-50 border-gray-200 text-gray-400 hover:text-gray-600"
            }`}
            aria-label={showInfo ? "Hide explanation" : "Show explanation"}
          >
            <Info className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onWishlist}
            className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${
              isWishlisted
                ? "bg-rose-50 border-rose-200 text-rose-500"
                : "bg-gray-50 border-gray-200 text-gray-400 hover:border-rose-200 hover:text-rose-400"
            }`}
            aria-label={isWishlisted ? "Remove from wishlist" : "Save to wishlist"}
          >
            <Heart className={`w-3.5 h-3.5 ${isWishlisted ? "fill-current" : ""}`} />
          </button>
        </div>
      </div>

      {/* Product strip — horizontal scroll, portrait cards */}
      {tiles.length > 0 ? (
        <div
          className="flex gap-3 px-4 py-4 overflow-x-auto"
          style={{ scrollbarWidth: "none" } as React.CSSProperties}
        >
          {tiles.map((tile, index) => {
            const TileWrapper = tile.pdpUrl ? "a" : "div";
            const wrapperProps = tile.pdpUrl
              ? { href: tile.pdpUrl, target: "_blank" as const, rel: "noreferrer" }
              : {};

            return (
              <TileWrapper
                key={`${tile.url}-${index}`}
                {...wrapperProps}
                className="flex-shrink-0 w-44 group cursor-pointer"
              >
                {/* Portrait image */}
                <div className="aspect-[3/4] w-full rounded-xl overflow-hidden bg-gray-50 border border-gray-100">
                  <img
                    src={tile.url}
                    alt={tile.label}
                    className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                {/* Product details always visible */}
                <div className="pt-2 px-0.5 space-y-0.5">
                  <p className="text-xs text-gray-800 leading-tight line-clamp-2" style={{ fontWeight: 600 }}>
                    {tile.label}
                  </p>
                  {tile.brand && (
                    <p className="text-xs text-gray-400 truncate">{tile.brand}</p>
                  )}
                  {tile.priceLabel && (
                    <p className="text-xs text-violet-600" style={{ fontWeight: 700 }}>
                      {tile.priceLabel}
                    </p>
                  )}
                </div>
              </TileWrapper>
            );
          })}
        </div>
      ) : (
        <div className="mx-4 my-4 rounded-xl border border-dashed border-gray-200 p-6 text-center text-gray-400 text-xs">
          <ImageIcon className="w-4 h-4 mx-auto mb-1.5" />
          No images available for this outfit
        </div>
      )}

      {/* Footer */}
      <div className="px-5 py-3 flex items-center justify-between border-t border-gray-50">
        {totalLabel ? (
          <span className="text-sm">
            <span className="text-gray-400 text-xs" style={{ fontWeight: 500 }}>Total </span>
            <span className="text-gray-900" style={{ fontWeight: 700 }}>{totalLabel}</span>
          </span>
        ) : (
          <span />
        )}
        {outfit.explanation && (
          <button
            type="button"
            onClick={() => setShowInfo((p) => !p)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-violet-600 transition-colors"
          >
            Why this outfit?
            <ChevronDown
              className={`w-3 h-3 transition-transform duration-200 ${showInfo ? "rotate-180" : ""}`}
            />
          </button>
        )}
      </div>

      {/* Expandable explanation */}
      {showInfo && outfit.explanation && (
        <div className="border-t border-gray-50 bg-violet-50/40 px-5 py-4 text-sm text-gray-600 leading-relaxed">
          {outfit.explanation}
        </div>
      )}
    </article>
  );
}
