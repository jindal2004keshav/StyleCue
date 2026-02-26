import { Heart, ImageIcon, Info } from "lucide-react";
import { useMemo, useState } from "react";
import type { Outfit } from "../utils/api";

interface OutfitCardProps {
  outfit: Outfit;
  isWishlisted: boolean;
  onWishlist: () => void;
}

export function OutfitCard({ outfit, isWishlisted, onWishlist }: OutfitCardProps) {
  const [showInfo, setShowInfo] = useState(false);

  const imageTiles = useMemo(
    () =>
      [
        ...outfit.user_image_urls.map((url) => ({
          url,
          label: "Uploaded item",
          pdpUrl: undefined,
          priceLabel: undefined,
        })),
        ...outfit.products.flatMap((product) => {
          const priceLabel = `${(product.currency || "USD").toUpperCase()} ${Number(product.price ?? 0).toFixed(2)}`;
          const urls = product.image_urls?.length ? product.image_urls : [product.image_url];

          return urls.map((url) => ({
            url,
            label: product.name,
            pdpUrl: product.pdp_url,
            priceLabel,
          }));
        }),
      ].filter((tile) => Boolean(tile.url)),
    [outfit.products, outfit.user_image_urls]
  );

  const colCount = Math.max(1, Math.min(imageTiles.length, 5));
  const gridTemplateColumns = `repeat(${colCount}, minmax(0, 1fr))`;

  return (
    <article className="relative w-full rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowInfo((prev) => !prev)}
          className="w-9 h-9 rounded-full bg-white/90 border border-gray-200 text-gray-500 flex items-center justify-center shadow-sm hover:text-gray-700 hover:border-gray-300 transition-colors"
          aria-label={showInfo ? "Hide outfit explanation" : "Show outfit explanation"}
        >
          <Info className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onWishlist}
          className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all shadow-sm ${
            isWishlisted
              ? "bg-rose-50 border-rose-200 text-rose-500"
              : "bg-white/90 border-gray-200 text-gray-400 hover:border-rose-200 hover:text-rose-400"
          }`}
          aria-label={isWishlisted ? "Remove from wishlist" : "Save to wishlist"}
        >
          <Heart className={`w-4 h-4 ${isWishlisted ? "fill-current" : ""}`} />
        </button>
      </div>

      {imageTiles.length > 0 ? (
        <div
          className="grid gap-3 p-3"
          style={{ gridTemplateColumns }}
        >
          {imageTiles.map((tile, index) => {
            const TileWrapper = tile.pdpUrl ? "a" : "div";
            const wrapperProps = tile.pdpUrl
              ? { href: tile.pdpUrl, target: "_blank", rel: "noreferrer" }
              : {};

            return (
              <TileWrapper
                key={`${tile.url}-${index}`}
                {...wrapperProps}
                className="group relative block overflow-hidden rounded-xl border border-gray-100"
              >
                <div className="aspect-[2/3] w-full">
                  <img src={tile.url} alt={tile.label} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                </div>
                {(tile.label || tile.priceLabel) && (
                  <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-200">
                    <div className="bg-black/70 text-white text-xs px-3 py-2 flex items-center justify-between gap-2">
                      <span className="truncate" style={{ fontWeight: 600 }}>{tile.label}</span>
                      {tile.priceLabel && <span className="shrink-0" style={{ fontWeight: 700 }}>{tile.priceLabel}</span>}
                    </div>
                  </div>
                )}
              </TileWrapper>
            );
          })}
        </div>
      ) : (
        <div className="m-3 rounded-xl border border-dashed border-gray-200 p-4 text-center text-gray-400 text-xs">
          <ImageIcon className="w-4 h-4 mx-auto mb-1" />
          No images available for this outfit
        </div>
      )}

      {showInfo && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600 leading-relaxed">
          {outfit.explanation}
        </div>
      )}
    </article>
  );
}
