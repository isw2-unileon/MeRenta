import { useEffect, useReducer } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";

import { PaymentForm } from "@/components/checkout/PaymentForm";
import { RentalSummary } from "@/components/checkout/RentalSummary";
import type { ApiResponse } from "@/types/common";
import type { CustomerProfile } from "@/types/customer";
import type { ItemImageResponse, ItemResponse } from "@/types/item";

// ── Constants (mirror BookingCard & backend) ──────────────────────────────────
const SERVICE_FEE = 5;
const INSURANCE_DAILY_RATE = 2.3;
const CHECKOUT_FALLBACK_DATE = new Date(0);

// ── Stripe setup ──────────────────────────────────────────────────────────────
const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

// ── Helpers ───────────────────────────────────────────────────────────────────
/** Formats a "YYYY-MM-DD" string into a local midnight Date. */
function parseDate(value: string): Date {
  const [y, mo, d] = value.split("-").map(Number);
  const date = new Date(y ?? 0, (mo ?? 1) - 1, d ?? 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Server response for creating a PaymentIntent. */
interface PaymentIntentData {
  client_secret: string;
  payment_intent_id: string;
  amount_eur: number;
}

interface CheckoutState {
  item: ItemResponse | null;
  itemImageUrl: string;
  ownerName: string;
  clientSecret: string | null;
  paymentTotal: number;
  loadError: string;
}

interface CheckoutLoadParams {
  itemId: string;
  startStr: string;
  endStr: string;
}

interface LoadedCheckoutData {
  item: ItemResponse;
  itemImageUrl: string;
  ownerName: string;
  clientSecret: string;
  paymentTotal: number;
}

type CheckoutAction =
  | {
      type: "load:success";
      item: ItemResponse;
      itemImageUrl: string;
      ownerName: string;
      clientSecret: string;
      paymentTotal: number;
    }
  | { type: "load:error"; message: string };

const initialCheckoutState: CheckoutState = {
  item: null,
  itemImageUrl: "",
  ownerName: "",
  clientSecret: null,
  paymentTotal: 0,
  loadError: "",
};

function checkoutReducer(state: CheckoutState, action: CheckoutAction): CheckoutState {
  switch (action.type) {
    case "load:success":
      return {
        ...state,
        item: action.item,
        itemImageUrl: action.itemImageUrl,
        ownerName: action.ownerName,
        clientSecret: action.clientSecret,
        paymentTotal: action.paymentTotal,
        loadError: "",
      };
    case "load:error":
      return { ...initialCheckoutState, loadError: action.message };
    default:
      return state;
  }
}

async function fetchFirstItemImage(itemId: string): Promise<string> {
  const res = await fetch(`/api/items/${itemId}/images`, { credentials: "include" });
  const json = (await res.json()) as ApiResponse<ItemImageResponse[]>;
  return json.success ? (json.data?.[0]?.image_url ?? "") : "";
}

async function fetchOwnerName(ownerId: string): Promise<string> {
  const res = await fetch(`/api/customers/${ownerId}/profile`, { credentials: "include" });
  const json = (await res.json()) as ApiResponse<CustomerProfile>;
  return json.success && json.data ? `${json.data.first_name} ${json.data.last_name}` : "";
}

async function loadCheckoutData({ itemId, startStr, endStr }: CheckoutLoadParams): Promise<LoadedCheckoutData> {
  const itemRes = await fetch(`/api/items/${itemId}`, { credentials: "include" });
  const itemJson = (await itemRes.json()) as ApiResponse<ItemResponse>;
  if (!itemRes.ok || !itemJson.success || !itemJson.data) {
    throw new Error(itemJson.error ?? "No se pudo cargar el articulo.");
  }
  const fetchedItem = itemJson.data;

  const [imageResult, ownerResult] = await Promise.allSettled([
    fetchFirstItemImage(itemId),
    fetchOwnerName(fetchedItem.owner_id),
  ]);
  const itemImageUrl = imageResult.status === "fulfilled" ? imageResult.value : "";
  const ownerName = ownerResult.status === "fulfilled" ? ownerResult.value : "";

  const piRes = await fetch("/api/payment/intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      item_id: itemId,
      start_date: startStr,
      end_date: endStr,
      price_per_day: fetchedItem.price_per_day,
    }),
  });
  const piJson = (await piRes.json()) as ApiResponse<PaymentIntentData>;
  if (!piRes.ok || !piJson.success || !piJson.data) {
    throw new Error(piJson.error ?? "No se pudo inicializar el pago.");
  }

  return {
    item: fetchedItem,
    itemImageUrl,
    ownerName,
    clientSecret: piJson.data.client_secret,
    paymentTotal: piJson.data.amount_eur,
  };
}

/**
 * Full checkout page.
 * Reads the item id from the URL, start/end dates from query params,
 * fetches the item and creates a Stripe PaymentIntent, then renders
 * the payment form and the rental summary side by side.
 *
 * @returns Checkout page JSX.
 */
function Checkout() {
  const { id: itemId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const startStr = searchParams.get("start") ?? "";
  const endStr = searchParams.get("end") ?? "";

  const [state, dispatch] = useReducer(checkoutReducer, initialCheckoutState);
  const { item, itemImageUrl, ownerName, clientSecret, paymentTotal, loadError } = state;

  // Derived date objects (safe even when strings are invalid)
  const startDate = startStr ? parseDate(startStr) : null;
  const endDate = endStr ? parseDate(endStr) : null;
  const days = startDate && endDate ? Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

  // Computed pricing
  const pricePerDay = item?.price_per_day ?? 0;
  const insurance = Math.round(INSURANCE_DAILY_RATE * days * 100) / 100;
  const total = pricePerDay * days + SERVICE_FEE + insurance;

  // Fetch item + create PaymentIntent together
  useEffect(() => {
    if (!itemId || !startStr || !endStr) {
      dispatch({ type: "load:error", message: "Faltan parámetros en la URL (item, fechas)." });
      return;
    }

    // Using a mutable object so the async closure sees the latest value
    // after awaits — a plain `let` boolean would be narrowed to `false` by
    // the type checker since the cleanup setter lives in a separate function.
    const guard: { cancelled: boolean } = { cancelled: false };
    const isCancelled = () => guard.cancelled;

    const init = async () => {
      try {
        if (isCancelled()) return;
        const data = await loadCheckoutData({ itemId, startStr, endStr });
        if (!isCancelled()) {
          dispatch({
            type: "load:success",
            item: data.item,
            itemImageUrl: data.itemImageUrl,
            ownerName: data.ownerName,
            clientSecret: data.clientSecret,
            paymentTotal: data.paymentTotal,
          });
        }
      } catch (err) {
        if (!guard.cancelled) {
          dispatch({
            type: "load:error",
            message: err instanceof Error ? err.message : "Error al cargar el checkout.",
          });
        }
      }
    };

    void init();
    return () => {
      guard.cancelled = true;
    };
  }, [itemId, startStr, endStr]);

  // ── Callbacks ──────────────────────────────────────────────────────────────
  const handleSuccess = (paymentIntentId: string, amountEUR: number) => {
    // Fire-and-forget: create the booking record. The payment has already succeeded,
    // so we navigate regardless of whether the booking write succeeds.
    void fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        item_id: itemId,
        start_date: startStr,
        end_date: endStr,
        estimated_total: amountEUR,
        payment_intent_id: paymentIntentId,
      }),
    });

    void navigate("/payment/success", {
      state: {
        paymentIntentId,
        amountEUR,
        itemTitle: item?.title ?? "",
        itemImageUrl,
        startDate: startStr,
        endDate: endStr,
        days,
      },
    });
  };

  const handleError = (code: string, message: string) => {
    void navigate("/payment/error", {
      state: {
        errorCode: code,
        errorMessage: message,
        returnPath: `/checkout/${itemId}?start=${startStr}&end=${endStr}`,
      },
    });
  };

  // ── Early-exit states ─────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <p className="field-error text-center">{loadError}</p>
      </div>
    );
  }

  if (!item || !clientSecret) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-subtle">Cargando checkout…</p>
      </div>
    );
  }

  if (!stripePromise) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <p className="field-error text-center">
          Stripe no está configurado. Añade <code>VITE_STRIPE_PUBLISHABLE_KEY</code> al archivo <code>.env</code>.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Two-column layout */}
      <div
        className="mx-auto flex gap-8 px-(--spacing-layout-margin) py-10"
        style={{ maxWidth: 1300 }}
      >
        {/* ── Left: payment form ── */}
        <div
          className="rounded-(--radius-panel) border border-(--color-border-main) bg-white p-8"
          style={{ width: "var(--spacing-panel-payment)", flexShrink: 0 }}
        >
          <Elements
            stripe={stripePromise}
            options={{ clientSecret, locale: "es" }}
          >
            <PaymentForm
              totalEUR={paymentTotal > 0 ? paymentTotal : total}
              clientSecret={clientSecret}
              onSuccess={handleSuccess}
              onError={handleError}
            />
          </Elements>
        </div>

        {/* ── Right: summary ── */}
        <div
          className="rounded-(--radius-panel) border border-(--color-border-main) bg-white p-8"
          style={{ width: "var(--spacing-panel-summary)", flexShrink: 0 }}
        >
          <RentalSummary
            itemTitle={item.title}
            imageUrl={itemImageUrl || undefined}
            ownerName={ownerName || "Propietario"}
            ownerRating={4.9}
            startDate={startDate ?? CHECKOUT_FALLBACK_DATE}
            endDate={endDate ?? CHECKOUT_FALLBACK_DATE}
            pricePerDay={pricePerDay}
            serviceFee={SERVICE_FEE}
            insurance={insurance}
            total={paymentTotal > 0 ? paymentTotal : total}
          />
        </div>
      </div>
    </div>
  );
}

export { Checkout };
