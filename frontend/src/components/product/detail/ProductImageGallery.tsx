import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Heart, X } from "lucide-react";

import type { ItemImageResponse } from "@/types/item";
import * as React from "react";

const PLACEHOLDER_IMAGE = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

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
 * Clicking the main image opens a fullscreen lightbox with arrow navigation.
 *
 * When there are no images, renders a green-tinted placeholder block.
 * @param images Ordered image list from the API.
 * @param title Item title for accessible alt text.
 * @param isAvailable Controls the availability badge label.
 * @param isFavorite Controls the active state of the heart button.
 * @param onToggleFavorite Called when the user clicks the heart button.
 * @returns Gallery JSX.
 */
function ProductImageGallery({ images, title, isAvailable, isFavorite, onToggleFavorite }: ProductImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const hasImages = images.length > 0;
  const mainImage = hasImages ? images[activeIndex] : undefined;
  const lightboxImage = hasImages ? (images[activeIndex] ?? images[0]) : undefined;

  const openLightbox = () => {
    if (hasImages) setLightboxOpen(true);
  };

  const closeLightbox = () => setLightboxOpen(false);

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveIndex((i) => (i - 1 + images.length) % images.length);
  };

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveIndex((i) => (i + 1) % images.length);
  };

  // Keyboard navigation for the lightbox
  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setActiveIndex((i) => (i - 1 + images.length) % images.length);
      if (e.key === "ArrowRight") setActiveIndex((i) => (i + 1) % images.length);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [lightboxOpen, images.length]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (lightboxOpen) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [lightboxOpen]);

  return (
    <>
      <div>
        {/* ── Main image ── */}
        <div className="relative">
          {hasImages && mainImage ? (
            <button
              type="button"
              className="block"
              aria-label={`Abrir ${title} en vista ampliada`}
              onClick={openLightbox}
            >
              <img
                className="product-main-img cursor-zoom-in"
                src={mainImage.image_url}
                alt={title}
              />
            </button>
          ) : (
            <img
              className="product-main-img bg-primary-light rounded-lg"
              src={PLACEHOLDER_IMAGE}
              alt={title}
            />
          )}

          {/* Availability badge */}
          <div className="absolute top-4 left-4">
            <span className="product-status-badge">{isAvailable ? "Disponible" : "No disponible"}</span>
          </div>

          {/* Favourite button */}
          <button
            type="button"
            className={`absolute top-4 right-4 flex size-8 items-center justify-center rounded-full bg-white p-0 shadow-sm transition-colors ${
              isFavorite ? "text-heart-active" : "text-subtle hover:text-heart-active"
            }`}
            aria-pressed={isFavorite}
            aria-label={isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
            onClick={onToggleFavorite}
          >
            <Heart
              size={17}
              fill={isFavorite ? "currentColor" : "none"}
            />
          </button>
        </div>

        {/* ── Thumbnails ── */}
        {hasImages && images.length > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {images.map((img, i) => (
              <button
                key={img.image_id}
                type="button"
                className="shrink-0 p-0"
                aria-pressed={i === activeIndex}
                aria-label={`${title} - imagen ${i + 1}`}
                onClick={() => setActiveIndex(i)}
              >
                <img
                  className={`product-thumb ${i === activeIndex ? "active" : ""}`}
                  src={img.image_url}
                  alt=""
                />
              </button>
            ))}
          </div>
        )}

        {/* Placeholder thumbnails when no images */}
        {!hasImages && (
          <div className="mt-3 flex gap-2">
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                className="product-thumb bg-primary-light shrink-0"
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Lightbox ── */}
      {lightboxOpen && (
        <dialog
          ref={dialogRef}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85"
          aria-label={`${title} - imagen ampliada`}
          onCancel={closeLightbox}
          onClose={closeLightbox}
        >
          {/* Close */}
          <button
            type="button"
            className="absolute top-4 right-4 flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25"
            aria-label="Cerrar imagen"
            onClick={closeLightbox}
          >
            <X size={20} />
          </button>

          {/* Prev */}
          {images.length > 1 && (
            <button
              type="button"
              className="absolute left-4 flex size-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25"
              aria-label="Imagen anterior"
              onClick={prevImage}
            >
              <ChevronLeft size={24} />
            </button>
          )}

          {/* Image */}
          {lightboxImage && (
            <img
              src={lightboxImage.image_url}
              alt={`${title} - imagen ${activeIndex + 1}`}
              className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            />
          )}

          {/* Next */}
          {images.length > 1 && (
            <button
              type="button"
              className="absolute right-4 flex size-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25"
              aria-label="Imagen siguiente"
              onClick={nextImage}
            >
              <ChevronRight size={24} />
            </button>
          )}

          {/* Counter */}
          {images.length > 1 && (
            <p className="absolute bottom-5 text-sm text-white/70">
              {activeIndex + 1} / {images.length}
            </p>
          )}
        </dialog>
      )}
    </>
  );
}

export { ProductImageGallery };
