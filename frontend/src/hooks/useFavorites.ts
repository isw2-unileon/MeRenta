import { useCallback, useEffect, useState } from "react";

import type { FavoritesResponse } from "@/types/item";

async function loadFavoriteIds(): Promise<Set<string>> {
  try {
    const res = await fetch("/api/favorites", { credentials: "include" });
    const json = (await res.json()) as { success: boolean; data?: FavoritesResponse };
    if (!res.ok || !json.success || !json.data) return new Set();
    return new Set(json.data.items.map((i) => i.item_id));
  } catch {
    return new Set();
  }
}

/**
 * Manages the current user's set of favorite item IDs.
 *
 * - Fetches the full favorites list once on mount.
 * - `toggle(itemId, isFav)` updates state optimistically and syncs with the API,
 *   reverting on network error.
 * - `isFav(itemId)` returns whether the item is currently in the set.
 */
function useFavorites() {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    void loadFavoriteIds().then(setFavoriteIds);
  }, []);

  /** Adds or removes an item from favorites. Optimistic — reverts on API error. */
  const toggle = useCallback((itemId: string, currentlyFavorite: boolean, options?: { disabled?: boolean }) => {
    if (options?.disabled) return;

    // Optimistic update
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (currentlyFavorite) next.delete(itemId);
      else next.add(itemId);
      return next;
    });

    // Sync with backend
    fetch(`/api/favorites/${itemId}`, {
      method: currentlyFavorite ? "DELETE" : "POST",
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Favorite update failed");
      })
      .catch(() => {
        // Revert optimistic update on failure
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (currentlyFavorite) next.add(itemId);
          else next.delete(itemId);
          return next;
        });
      });
  }, []);

  const isFav = useCallback((itemId: string) => favoriteIds.has(itemId), [favoriteIds]);

  return { favoriteIds, toggle, isFav };
}

export { useFavorites };
