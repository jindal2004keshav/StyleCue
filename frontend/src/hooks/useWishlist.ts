import { useCallback, useState } from "react";
import type { Outfit } from "../utils/api";

const STORAGE_KEY = "stylecue_wishlist";

const readWishlist = (): Outfit[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Outfit[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeWishlist = (outfits: Outfit[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(outfits));
};

export function useWishlist() {
  const [wishlist, setWishlist] = useState<Outfit[]>(() => readWishlist());

  const addOutfit = useCallback((outfit: Outfit) => {
    setWishlist((prev) => {
      if (prev.some((item) => item.id === outfit.id)) return prev;
      const next = [...prev, outfit];
      writeWishlist(next);
      return next;
    });
  }, []);

  const removeOutfit = useCallback((outfitId: string) => {
    setWishlist((prev) => {
      const next = prev.filter((item) => item.id !== outfitId);
      writeWishlist(next);
      return next;
    });
  }, []);

  const isWishlisted = useCallback(
    (outfitId: string) => wishlist.some((item) => item.id === outfitId),
    [wishlist],
  );

  return {
    wishlist,
    addOutfit,
    removeOutfit,
    isWishlisted,
  };
}
