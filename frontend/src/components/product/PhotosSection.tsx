import { useCallback, useRef, type ChangeEvent, type DragEvent } from "react";
import { Plus, X } from "lucide-react";

import type { ProductFormData } from "@/types/item";

const MAX_PHOTOS = 10;
const MAX_SIZE_MB = 5;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MIN_VISIBLE_SLOTS = 5;

interface PhotosSectionProps {
  photos: ProductFormData["photos"];
  error?: string;
  onAddPhotos: (files: File[]) => void;
  onRemovePhoto: (index: number) => void;
}

/**
 * Form section for uploading product photos with drag-and-drop and thumbnail preview.
 * @param photos Currently uploaded files.
 * @param error Optional validation error to display.
 * @param onAddPhotos Callback invoked with valid new files.
 * @param onRemovePhoto Callback invoked with the index to remove.
 * @returns The photos upload section JSX.
 */
function PhotosSection({ photos, error, onAddPhotos, onRemovePhoto }: PhotosSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Filters files by type and size, then passes valid ones up.
   * @param files Raw FileList or array from input or drop.
   */
  const processFiles = useCallback(
    (files: FileList | File[]) => {
      const remaining = MAX_PHOTOS - photos.length;
      if (remaining <= 0) return;

      const valid = Array.from(files)
        .filter((f) => ALLOWED_TYPES.includes(f.type) && f.size <= MAX_SIZE_MB * 1024 * 1024)
        .slice(0, remaining);

      if (valid.length > 0) {
        onAddPhotos(valid);
      }
    },
    [photos.length, onAddPhotos]
  );

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    processFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
    // Reset so the same file can be re-selected if removed
    e.target.value = "";
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const isFull = photos.length >= MAX_PHOTOS;

  // Number of visible thumbnail slots: photos + at least 2 empty, minimum MIN_VISIBLE_SLOTS
  const visibleSlots = Math.min(MAX_PHOTOS, Math.max(MIN_VISIBLE_SLOTS, photos.length + 2));

  return (
    <section className="rounded-xl border border-border-main bg-white p-6">
      <h4 className="heading-content mb-1">Fotos del producto</h4>
      <p className="field-hint mb-6">Sube entre 1 y 10 fotos. La primera será la imagen principal.</p>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Área de carga de fotos"
        onClick={!isFull ? openFilePicker : undefined}
        onKeyDown={(e) => !isFull && e.key === "Enter" && openFilePicker()}
        onDrop={!isFull ? handleDrop : undefined}
        onDragOver={!isFull ? handleDragOver : undefined}
        className={[
          "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 transition-colors",
          error
            ? "border-heart-active bg-[#fff8f8]"
            : "border-border-input hover:border-primary hover:bg-primary-bg",
          isFull ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        ].join(" ")}
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-ghost">
          <Plus className="size-6 text-subtle" />
        </div>
        <div className="text-center">
          <p className="text-[14px] font-medium text-ink">Arrastra tus fotos aquí o haz clic para seleccionar</p>
          <p className="field-hint mt-1">JPG, PNG o WEBP · Máximo 5 MB por imagen · Hasta 10 fotos</p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {error && <p className="field-error mt-2">{error}</p>}

      {/* Thumbnail strip */}
      <div className="mt-4 flex flex-wrap gap-3">
        {Array.from({ length: visibleSlots }).map((_, idx) => {
          const file = photos[idx];

          if (file) {
            return (
              <div
                key={idx}
                className="group relative"
              >
                <img
                  src={URL.createObjectURL(file)}
                  alt={`Foto ${idx + 1}`}
                  className="h-24 w-28 rounded-lg border border-border-thumb object-cover"
                />
                {idx === 0 && (
                  <span className="absolute top-1.5 left-1.5 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">
                    Principal
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onRemovePhoto(idx)}
                  aria-label={`Eliminar foto ${idx + 1}`}
                  className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-ink text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="size-3" />
                </button>
              </div>
            );
          }

          return (
            <button
              key={`empty-${idx}`}
              type="button"
              onClick={openFilePicker}
              aria-label="Añadir foto"
              className="flex h-24 w-28 items-center justify-center rounded-lg border-2 border-dashed border-border-input transition-colors hover:border-primary hover:bg-primary-bg"
            >
              <Plus className="size-5 text-placeholder" />
            </button>
          );
        })}
      </div>

      <p className="field-hint mt-3">
        Consejo: la primera foto es la portada. Usa luz natural y fondo neutro para mejores resultados.
      </p>
    </section>
  );
}

export { PhotosSection };
