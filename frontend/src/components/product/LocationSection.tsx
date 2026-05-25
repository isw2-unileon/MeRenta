import { useState, type ChangeEvent } from "react";
import { MapPin, Plus, X } from "lucide-react";

import type { AddressResponse, CreateAddressRequest } from "@/types/address";
import type { ProductFormData } from "@/types/item";

const RADIUS_OPTIONS = [
  { value: "2", label: "Hasta 2 km del centro" },
  { value: "5", label: "Hasta 5 km del centro" },
  { value: "10", label: "Hasta 10 km del centro" },
  { value: "city", label: "Toda la ciudad" },
];

const EMPTY_NEW_ADDRESS: CreateAddressRequest = {
  street: "",
  number: "",
  floor: "",
  city: "",
  province: "",
  postal_code: "",
  country: "Spain",
};

interface AddressSelectProps {
  value: string;
  error?: string;
  addresses: AddressResponse[];
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
}

function AddressSelect({ value, error, addresses, onChange }: AddressSelectProps) {
  return (
    <div>
      <label htmlFor="address">
        <span className="flex items-center gap-1.5">
          <MapPin className="text-subtle size-3.5" />
          Dirección de recogida
        </span>
      </label>

      <select
        id="address"
        name="address"
        value={value}
        onChange={onChange}
        aria-label="Dirección de recogida"
        className={error ? "border-red-400" : ""}
      >
        <option value="">Selecciona una dirección</option>
        {addresses.map((a) => (
          <option
            key={a.address_id}
            value={a.address_id}
          >
            {a.street} {a.number}
            {a.floor ? `, ${a.floor}` : ""} - {a.city}
          </option>
        ))}
      </select>

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}

      <p className="field-hint mt-1">
        Solo se mostrará la ciudad. La dirección exacta se comparte al confirmar el alquiler.
      </p>
    </div>
  );
}

interface NewAddressFormProps {
  value: CreateAddressRequest;
  errors: Partial<CreateAddressRequest>;
  saving: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onCancel: () => void;
  onSave: () => void;
}

function NewAddressForm({ value, errors, saving, onChange, onCancel, onSave }: NewAddressFormProps) {
  return (
    <div className="border-border-main bg-surface rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-ink text-[13px] font-semibold">Añadir dirección</p>
        <button
          type="button"
          onClick={onCancel}
          className="text-subtle hover:text-ink"
          aria-label="Cerrar formulario"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div className="col-span-2 grid grid-cols-[1fr_100px] gap-3">
          <div>
            <label
              htmlFor="new-street"
              className="text-[12px]"
            >
              Calle / Avenida
            </label>
            <input
              id="new-street"
              name="street"
              type="text"
              placeholder="Calle Gran Vía"
              value={value.street}
              aria-label="Calle o avenida"
              onChange={onChange}
              className={errors.street ? "border-red-400" : ""}
            />
            {errors.street && <p className="mt-0.5 text-xs text-red-500">{errors.street}</p>}
          </div>
          <div>
            <label
              htmlFor="new-number"
              className="text-[12px]"
            >
              Número
            </label>
            <input
              id="new-number"
              name="number"
              type="text"
              placeholder="12"
              value={value.number}
              aria-label="Número"
              onChange={onChange}
              className={errors.number ? "border-red-400" : ""}
            />
            {errors.number && <p className="mt-0.5 text-xs text-red-500">{errors.number}</p>}
          </div>
        </div>

        <div>
          <label
            htmlFor="new-floor"
            className="text-[12px]"
          >
            Piso / Puerta <span className="text-subtle">(opcional)</span>
          </label>
          <input
            id="new-floor"
            name="floor"
            type="text"
            placeholder="3ºA"
            value={value.floor ?? ""}
            aria-label="Piso o puerta"
            onChange={onChange}
          />
        </div>

        <div>
          <label
            htmlFor="new-postal"
            className="text-[12px]"
          >
            Código postal
          </label>
          <input
            id="new-postal"
            name="postal_code"
            type="text"
            placeholder="28013"
            value={value.postal_code}
            aria-label="Código postal"
            onChange={onChange}
            className={errors.postal_code ? "border-red-400" : ""}
          />
          {errors.postal_code && <p className="mt-0.5 text-xs text-red-500">{errors.postal_code}</p>}
        </div>

        <div>
          <label
            htmlFor="new-city"
            className="text-[12px]"
          >
            Ciudad
          </label>
          <input
            id="new-city"
            name="city"
            type="text"
            placeholder="Madrid"
            value={value.city}
            aria-label="Ciudad"
            onChange={onChange}
            className={errors.city ? "border-red-400" : ""}
          />
          {errors.city && <p className="mt-0.5 text-xs text-red-500">{errors.city}</p>}
        </div>

        <div>
          <label
            htmlFor="new-province"
            className="text-[12px]"
          >
            Provincia
          </label>
          <input
            id="new-province"
            name="province"
            type="text"
            placeholder="Madrid"
            value={value.province}
            aria-label="Provincia"
            onChange={onChange}
            className={errors.province ? "border-red-400" : ""}
          />
          {errors.province && <p className="mt-0.5 text-xs text-red-500">{errors.province}</p>}
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          className="btn-primary btn--sm"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? "Guardando..." : "Guardar dirección"}
        </button>
      </div>
    </div>
  );
}

interface DeliveryRadiusSelectProps {
  value: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
}

function DeliveryRadiusSelect({ value, onChange }: DeliveryRadiusSelectProps) {
  return (
    <div>
      <label htmlFor="deliveryRadius">Radio de entrega</label>
      <select
        id="deliveryRadius"
        name="deliveryRadius"
        value={value}
        onChange={onChange}
        aria-label="Radio de entrega"
      >
        {RADIUS_OPTIONS.map((opt) => (
          <option
            key={opt.value}
            value={opt.value}
          >
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface AvailabilityTogglesProps {
  availableNow: boolean;
  blockDates: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

function AvailabilityToggles({ availableNow, blockDates, onChange }: AvailabilityTogglesProps) {
  return (
    <div className="border-border-main rounded-lg border p-4">
      <p className="text-ink mb-3 text-[13px] font-medium">Disponibilidad</p>
      <div className="grid grid-cols-2 gap-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="availableNow"
            checked={availableNow}
            onChange={onChange}
            aria-label="Disponible ahora"
            className="mt-0.5"
          />
          <div>
            <p className="text-ink text-[13px] font-medium">Disponible ahora</p>
            <p className="field-hint mt-0.5">El anuncio se publica activo inmediatamente</p>
          </div>
        </label>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="blockDates"
            checked={blockDates}
            onChange={onChange}
            aria-label="Bloquear fechas"
            className="mt-0.5"
          />
          <div>
            <p className="text-ink text-[13px] font-medium">Bloquear fechas</p>
            <p className="field-hint mt-0.5">Añadir períodos en los que no está disponible</p>
          </div>
        </label>
      </div>
    </div>
  );
}

interface LocationSectionProps {
  data: Pick<ProductFormData, "address" | "deliveryRadius" | "availableNow" | "blockDates">;
  errors: Partial<Record<keyof ProductFormData, string>>;
  addresses: AddressResponse[];
  onChange: (field: keyof ProductFormData, value: string | boolean) => void;
  onAddressCreated: (req: CreateAddressRequest) => Promise<void>;
}

/**
 * Form section for pick-up address, delivery radius and availability toggles.
 *
 * The address dropdown lists the customer's saved home addresses.
 * A collapsible inline form lets the user add a new address without leaving
 * the page.
 */
function LocationSection({ data, errors, addresses, onChange, onAddressCreated }: LocationSectionProps) {
  const [showNewForm, setShowNewForm] = useState(false);
  const [newAddr, setNewAddr] = useState<CreateAddressRequest>(EMPTY_NEW_ADDRESS);
  const [newAddrErrors, setNewAddrErrors] = useState<Partial<CreateAddressRequest>>({});
  const [savingAddr, setSavingAddr] = useState(false);

  const updateSelectField = (e: ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.name as keyof ProductFormData, e.target.value);
  };

  const updateToggleField = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.name as keyof ProductFormData, e.target.checked);
  };

  const updateNewAddressField = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewAddr((prev) => ({ ...prev, [name]: value }));
    setNewAddrErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validateNewAddr = (): boolean => {
    const errs: Partial<CreateAddressRequest> = {};
    if (!newAddr.street.trim()) errs.street = "Obligatorio";
    if (!newAddr.number.trim()) errs.number = "Obligatorio";
    if (!newAddr.city.trim()) errs.city = "Obligatorio";
    if (!newAddr.province.trim()) errs.province = "Obligatorio";
    if (!newAddr.postal_code.trim()) errs.postal_code = "Obligatorio";
    setNewAddrErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const saveNewAddress = () => {
    if (!validateNewAddr()) return;

    setSavingAddr(true);
    void onAddressCreated(newAddr)
      .then(() => {
        setNewAddr(EMPTY_NEW_ADDRESS);
        setNewAddrErrors({});
        setShowNewForm(false);
        setSavingAddr(false);
      })
      .catch(() => {
        setSavingAddr(false);
      });
  };

  const addressError = errors.address;

  return (
    <section className="border-border-main rounded-xl border bg-white p-6">
      <h4 className="heading-content mb-1">Ubicación y disponibilidad</h4>
      <p className="field-hint mb-6">Dónde se recoge el producto y cuándo está disponible.</p>

      <div className="flex flex-col gap-5">
        <AddressSelect
          value={data.address}
          error={addressError}
          addresses={addresses}
          onChange={updateSelectField}
        />

        {/* Add new address toggle */}
        {!showNewForm ? (
          <button
            type="button"
            className="text-brand-primary flex w-fit items-center gap-1.5 text-[13px] font-medium hover:underline"
            onClick={() => setShowNewForm(true)}
          >
            <Plus className="size-3.5" />
            Nueva dirección
          </button>
        ) : (
          <NewAddressForm
            value={newAddr}
            errors={newAddrErrors}
            saving={savingAddr}
            onChange={updateNewAddressField}
            onSave={saveNewAddress}
            onCancel={() => {
              setShowNewForm(false);
              setNewAddrErrors({});
            }}
          />
        )}

        {/* Delivery radius */}
        <DeliveryRadiusSelect
          value={data.deliveryRadius}
          onChange={updateSelectField}
        />

        {/* Availability toggles */}
        <AvailabilityToggles
          availableNow={data.availableNow}
          blockDates={data.blockDates}
          onChange={updateToggleField}
        />
      </div>
    </section>
  );
}

export { LocationSection };
