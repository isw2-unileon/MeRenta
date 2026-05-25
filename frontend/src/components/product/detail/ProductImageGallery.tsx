import { useState } from "react";

import type { ItemImageResponse } from "@/types/item";

interface ProductImageGalleryProps {
  /** Ordered list of images returned by the API. */
  images: ItemImageResponse[];
  /** Item title used as alt text. */
  title: string;
  /** Whether the item is currently available for rental. */
  isAvailable: boolean;
  /** Whether the current user has this item saved as a favourite. */
  isFavorite: boolean;
  /** Callback fired when the user toggles the favourite button. */
  onToggleFavorite: () => void;
}

/**
 * Hero image section for the product detail page.
 * Shows a large main image with a status badge and favourite toggle overlay,
 * plus a horizontal strip of clickable thumbnails below.
 *
 * When there are no images, renders a green-tinted placeholder block.
 * @param images Ordered image list from the API.
 * @param title Item title for accessible alt text.
 * @param isAvailable Controls the availability badge label.
 * @param isFavorite Controls the active state of the heart button.
 * @param onToggleFavorite Called when the user clicks the heart button.
 * @returns Gallery JSX.
 */
function ProductImageGallery({
  images,
  title,
  isAvailable,
  isFavorite,
  onToggleFavorite,
}: ProductImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const mainImage = images[activeIndex];

  return (
    <div>
      {/* ── Main image ── */}
      <div className="relative">
        {mainImage ? (
          <img
            className="product-main-img"
            src={mainImage.image_url}
            alt={title}
          />
        ) : (
          <div
            className="product-main-img bg-primary-light rounded-lg"
            role="img"
            aria-label={title}
          />
        )}

        {/* Availability badge */}
        <div className="absolute left-4 top-4">
          <span className="product-status-badge">
            {isAvailable ? "Disponible" : "No disponible"}
          </span>
        </div>

        {/* Favourite button */}
        <button
          type="button"
          className={`btn-fav btn-fav--lg absolute right-4 top-4 shadow-sm ${isFavorite ? "active" : ""}`}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
          onClick={onToggleFavorite}
        >
          ♥
        </button>
      </div>

      {/* ── Thumbnails ── */}
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <img
              key={img.image_id}
              className={`product-thumb flex-shrink-0 ${i === activeIndex ? "active" : ""}`}
              src={img.image_url}
              alt={`${title} — imagen ${i + 1}`}
              aria-selected={i === activeIndex}
              onClick={() => setActiveIndex(i)}
            />
          ))}
        </div>
      )}

      {/* Placeholder thumbnails when no images */}
      {images.length === 0 && (
        <div className="mt-3 flex gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className="product-thumb bg-primary-light flex-shrink-0"
            />
          ))}
        </div>
      )}
    </div>
  );
}

export { ProductImageGallery };
