import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Heart, X } from "lucide-react";

import type { ItemImageResponse } from "@/types/item";
import * as React from "react";

const PLACEHOLDER_THUMB_IDS = [
  "thumb-placeholder-1",
  "thumb-placeholder-2",
  "thumb-placeholder-3",
  "thumb-placeholder-4",
  "thumb-placeholder-5",
];

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

  // Keyboard navigation and close for the lightbox
  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
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
        <div className="h-main-img relative overflow-hidden rounded-lg">
          {hasImages && mainImage ? (
            <button
              type="button"
              className="absolute inset-0 p-0"
              aria-label={`Abrir ${title} en vista ampliada`}
              onClick={openLightbox}
            >
              <img
                className="h-full w-full cursor-zoom-in object-cover object-center"
                src={mainImage.image_url}
                alt={title}
              />
            </button>
          ) : (
            <div className="bg-primary-light h-full w-full" />
          )}

          {/* Availability badge */}
          <div className="absolute top-4 left-4">
            <span className={isAvailable ? "product-status-badge" : "product-status-badge bg-[#fff0c4] text-[#9b7411]"}>
              {isAvailable ? "Disponible" : "No disponible"}
            </span>
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
            {PLACEHOLDER_THUMB_IDS.map((id) => (
              <div
                key={id}
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
          className="fixed inset-0 z-50 m-0 flex h-screen w-screen max-w-none items-center justify-center border-0 bg-black/90 p-0"
          aria-label={`${title} - imagen ampliada`}
          onCancel={closeLightbox}
          onClose={closeLightbox}
        >
          {/* Backdrop: semantic button at z-0, all other content at z-10 above it */}
          <button
            type="button"
            className="absolute inset-0 z-0 cursor-default bg-transparent"
            aria-label="Cerrar imagen"
            tabIndex={-1}
            onClick={closeLightbox}
          />

          {/* Close */}
          <button
            type="button"
            className="absolute top-4 right-4 z-10 flex size-10 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/30"
            aria-label="Cerrar imagen"
            onClick={closeLightbox}
          >
            <X size={20} />
          </button>

          {/* Prev */}
          {images.length > 1 && (
            <button
              type="button"
              className="absolute top-1/2 left-6 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/30"
              aria-label="Imagen anterior"
              onClick={prevImage}
            >
              <ChevronLeft size={24} />
            </button>
          )}

          {/* Image at z-10 so it sits above the backdrop button */}
          {lightboxImage && (
            <img
              src={lightboxImage.image_url}
              alt={`${title} - imagen ${activeIndex + 1}`}
              className="relative z-10 max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            />
          )}

          {/* Next */}
          {images.length > 1 && (
            <button
              type="button"
              className="absolute top-1/2 right-6 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/30"
              aria-label="Imagen siguiente"
              onClick={nextImage}
            >
              <ChevronRight size={24} />
            </button>
          )}

          {/* Counter */}
          {images.length > 1 && (
            <p className="absolute bottom-5 z-10 text-sm text-white/70">
              {activeIndex + 1} / {images.length}
            </p>
          )}
        </dialog>
      )}
    </>
  );
}

export { ProductImageGallery };
