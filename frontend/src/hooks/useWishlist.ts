import { useState, useCallback } from "react";
import type { Outfit } from "../utils/api";

const STORAGE_KEY = "stylecue_wishlist";

function load(): Outfit[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function save(outfits: Outfit[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(outfits));
}

export function useWishlist() {
  const [wishlist, setWishlist] = useState<Outfit[]>(load);

  const addOutfit = useCallback((outfit: Outfit) => {
    setWishlist((prev) => {
      if (prev.some((o) => o.id === outfit.id)) return prev;
      const next = [...prev, outfit];
      save(next);
      return next;
    });
  }, []);

  const removeOutfit = useCallback((outfitId: string) => {
    setWishlist((prev) => {
      const next = prev.filter((o) => o.id !== outfitId);
      save(next);
      return next;
    });
  }, []);

  const isWishlisted = useCallback(
    (outfitId: string) => wishlist.some((o) => o.id === outfitId),
    [wishlist],
  );

  return { wishlist, addOutfit, removeOutfit, isWishlisted };
}
