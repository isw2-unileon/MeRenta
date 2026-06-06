import { useCallback, useRef, useMemo, type ChangeEvent, type DragEvent } from "react";
import { Plus, X } from "lucide-react";

import type { ProductFormData, ProductPhoto } from "@/types/item";
import * as React from "react";

const MAX_PHOTOS = 10;
const MAX_SIZE_MB = 5;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MIN_VISIBLE_SLOTS = 5;

/** Opens the hidden file input referenced by ref. */
function openFilePicker(ref: React.RefObject<HTMLInputElement | null>): void {
  ref.current?.click();
}

/** Prevents the browser's default behavior so a drop can be received. */
function handleDragOver(e: DragEvent<HTMLButtonElement>): void {
  e.preventDefault();
}

interface PhotosSectionProps {
  photos: ProductFormData["photos"];
  error?: string;
  onAddPhotos: (files: File[]) => void;
  onRemovePhoto: (index: number) => void;
}

/** True when a photo is a freshly selected File (not an already-stored image). */
function isFilePhoto(photo: ProductPhoto): photo is File {
  return photo instanceof File;
}

/**
 * Renders a single photo thumbnail with a remove button. Builds an object URL
 * for newly selected files and reuses the stored URL for existing images.
 */
function Thumbnail({ photo, index, onRemove }: { photo: ProductPhoto; index: number; onRemove: () => void }) {
  const previewUrl = useMemo(() => (isFilePhoto(photo) ? URL.createObjectURL(photo) : photo.image_url), [photo]);

  if (!previewUrl) return <div className="h-24 w-28 animate-pulse rounded-lg bg-gray-100" />;

  return (
    <div className="group relative h-24 w-28">
      <img
        src={previewUrl}
        alt={`Foto ${index + 1}`}
        className="border-border-thumb h-full w-full rounded-lg border object-cover"
      />
      {index === 0 && (
        <span className="bg-primary absolute top-1.5 left-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold text-white">
          Principal
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Eliminar foto ${index + 1}`}
        className="absolute -top-1.5 -right-1.5 z-10 flex size-5 cursor-pointer items-center justify-center rounded-full border border-gray-500 bg-white text-white opacity-0 transition-opacity group-hover:opacity-100"
      >
        <X
          className="text-heart-active size-3 shrink-0"
          strokeWidth={2.5}
        />
      </button>
    </div>
  );
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

  const handleDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    processFiles(e.dataTransfer.files);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
    e.target.value = "";
  };

  const handleOpenFilePicker = useCallback(() => openFilePicker(fileInputRef), [fileInputRef]);

  const isFull = photos.length >= MAX_PHOTOS;
  const visibleSlots = Math.min(MAX_PHOTOS, Math.max(MIN_VISIBLE_SLOTS, photos.length + 2));

  return (
    <section className="border-border-main rounded-xl border bg-white p-6">
      <h4 className="heading-content mb-1">Fotos del producto</h4>
      <p className="field-hint mb-6">Sube entre 1 y 10 fotos. La primera será la imagen principal.</p>

      <button
        type="button"
        aria-label="Área de carga de fotos"
        onClick={!isFull ? handleOpenFilePicker : undefined}
        onDrop={!isFull ? handleDrop : undefined}
        onDragOver={!isFull ? handleDragOver : undefined}
        disabled={isFull}
        className={[
          "flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 transition-colors",
          error ? "border-heart-active bg-[#fff8f8]" : "border-border-input hover:border-primary hover:bg-primary-bg",
          isFull ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        ].join(" ")}
      >
        <div className="bg-ghost flex size-12 items-center justify-center rounded-full">
          <Plus className="text-subtle size-6" />
        </div>
        <div className="text-center">
          <p className="text-ink text-[14px] font-medium">Arrastra tus fotos aquí o haz clic para seleccionar</p>
          <p className="field-hint mt-1">JPG, PNG o WEBP · Máximo 5 MB por imagen · Hasta 10 fotos</p>
        </div>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        multiple
        className="hidden"
        aria-label="Subir fotos del producto"
        onChange={handleFileChange}
      />

      {error && <p className="field-error mt-2">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-3">
        {Array.from({ length: visibleSlots }).map((_, idx) => {
          if (idx < photos.length) {
            const file = photos[idx];
            if (!file) return null;

            return (
              <Thumbnail
                key={idx}
                photo={file}
                index={idx}
                onRemove={() => onRemovePhoto(idx)}
              />
            );
          }

          return (
            <button
              key={`empty-${idx}`}
              type="button"
              onClick={handleOpenFilePicker}
              aria-label="Añadir foto"
              className="border-border-input hover:border-primary hover:bg-primary-bg flex h-24 w-28 items-center justify-center rounded-lg border-2 border-dashed transition-colors"
            >
              <Plus className="text-placeholder size-5" />
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
