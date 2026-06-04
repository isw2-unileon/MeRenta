import { useEffect, useReducer, useState } from "react";
import { ExternalLink, ImageIcon, Search } from "lucide-react";

import type { ApiResponse } from "@/types/common";
import type { SearchItemResponse, SearchItemsResponse } from "@/types/item";
import { Badge, Card, SectionTitle } from "@/components/admin/adminUi";

const LIMIT = 20;

const EUR_FORMAT = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

const STATUS_LABELS: Record<string, string> = {
  available: "disponible",
  reserved: "reservado",
  rented: "alquilado",
  retired: "retirado",
  withdrawn: "retirado",
  sold: "vendido",
};

const STATUS_BADGE_COLORS: Record<string, "green" | "gray" | "amber" | "red" | "blue"> = {
  available: "green",
  reserved: "amber",
  rented: "blue",
  retired: "gray",
  withdrawn: "gray",
  sold: "red",
};

const CATEGORY_LABELS: Record<string, string> = {
  tools: "Herramientas",
  electronics: "Electronica",
  sports: "Deporte",
  vehicles: "Vehículos",
  home: "Hogar",
  gardening: "Jardinería",
  clothing: "Ropa",
  music: "Musica",
  photography: "Fotografía",
  camping: "Camping",
  leisure: "Ocio",
  other: "Otros",
};

interface ProductsState {
  products: SearchItemResponse[];
  total: number;
  loading: boolean;
  error: string | null;
}

type ProductsAction =
  | { type: "fetch_start" }
  | { type: "fetch_success"; products: SearchItemResponse[]; total: number }
  | { type: "fetch_error"; error: string };

const initialState: ProductsState = { products: [], total: 0, loading: true, error: null };

function productsReducer(state: ProductsState, action: ProductsAction): ProductsState {
  switch (action.type) {
    case "fetch_start":
      return { ...state, loading: true, error: null };
    case "fetch_success":
      return { products: action.products, total: action.total, loading: false, error: null };
    case "fetch_error":
      return { ...state, loading: false, error: action.error };
  }
}

async function fetchProducts(query: string, page: number): Promise<SearchItemsResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
  if (query) params.set("q", query);

  const res = await fetch(`/api/admin/items?${params.toString()}`, { credentials: "include" });
  const json = (await res.json()) as ApiResponse<SearchItemsResponse>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? "Error al cargar productos");
  }
  return json.data;
}

function fmtDate(iso: string): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtPrice(value: number): string {
  return EUR_FORMAT.format(value);
}

function ownerName(product: SearchItemResponse): string {
  const name = `${product.owner_first_name} ${product.owner_last_name}`.trim();
  return name || product.owner_id.slice(0, 8);
}

function productStatusColor(product: SearchItemResponse): "green" | "gray" | "amber" | "red" | "blue" {
  if (!product.is_available) return "gray";
  return STATUS_BADGE_COLORS[product.item_status] ?? "gray";
}

function productStatusLabel(product: SearchItemResponse): string {
  if (!product.is_available && product.item_status === "available") return "no visible";
  return STATUS_LABELS[product.item_status] ?? product.item_status;
}

function ProductThumb({ product }: { product: SearchItemResponse }) {
  if (!product.primary_image_url) {
    return (
      <div className="flex size-12 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400">
        <ImageIcon size={18} />
      </div>
    );
  }

  return (
    <img
      src={product.primary_image_url}
      alt=""
      className="size-12 rounded-lg object-cover"
      loading="lazy"
    />
  );
}

function Products() {
  const [state, dispatch] = useReducer(productsReducer, initialState);
  const [rawQuery, setRawQuery] = useState("");
  const [filters, setFilters] = useState({ query: "", page: 1 });

  useEffect(() => {
    const id = setTimeout(() => {
      setFilters((f) => ({ ...f, query: rawQuery.trim(), page: 1 }));
    }, 300);
    return () => clearTimeout(id);
  }, [rawQuery]);

  useEffect(() => {
    dispatch({ type: "fetch_start" });
    fetchProducts(filters.query, filters.page)
      .then((data) => dispatch({ type: "fetch_success", products: data.items, total: data.total }))
      .catch((err: unknown) =>
        dispatch({
          type: "fetch_error",
          error: err instanceof Error ? err.message : "Error desconocido",
        })
      );
  }, [filters]);

  function handlePage(page: number) {
    setFilters((f) => ({ ...f, page }));
  }

  const { products, total, loading, error } = state;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="relative">
          <Search
            size={15}
            className="absolute top-2.5 left-3 text-neutral-400"
          />
          <input
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            placeholder="Buscar productos..."
            aria-label="Buscar productos"
            className="w-64 rounded-lg border border-neutral-200 py-2 pr-3 pl-9 text-sm outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-neutral-100 px-5 py-4">
          <SectionTitle
            title="Productos"
            sub={loading ? "Cargando..." : `${total.toLocaleString("es-ES")} productos en la base de datos`}
          />
        </div>

        {error && <p className="px-5 py-4 text-sm text-red-600">{error}</p>}

        {!error && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left text-xs text-neutral-400">
                <th className="px-5 py-3 font-medium">Producto</th>
                <th className="hidden px-5 py-3 font-medium md:table-cell">Propietario</th>
                <th className="hidden px-5 py-3 font-medium lg:table-cell">Categoria</th>
                <th className="px-5 py-3 font-medium">Precio</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="hidden px-5 py-3 font-medium xl:table-cell">Publicado</th>
                <th className="px-5 py-3">
                  <span className="sr-only">Ver</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr
                    key={i}
                    className="border-b border-neutral-50"
                  >
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td
                        key={j}
                        aria-label="Cargando"
                        className="px-5 py-4"
                      >
                        <div
                          aria-hidden="true"
                          className="h-4 w-24 animate-pulse rounded bg-neutral-100"
                        />
                      </td>
                    ))}
                  </tr>
                ))}

              {!loading &&
                products.map((product) => (
                  <tr
                    key={product.item_id}
                    className="border-b border-neutral-50 hover:bg-neutral-50"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <ProductThumb product={product} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-neutral-900">{product.title}</p>
                          <p className="truncate text-xs text-neutral-400">
                            {product.city}
                            {product.postal_code ? ` · ${product.postal_code}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-5 py-3.5 text-neutral-600 md:table-cell">{ownerName(product)}</td>
                    <td className="hidden px-5 py-3.5 text-neutral-500 lg:table-cell">
                      {CATEGORY_LABELS[product.category] ?? product.category}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-neutral-700">{fmtPrice(product.price_per_day)}</td>
                    <td className="px-5 py-3.5">
                      <Badge color={productStatusColor(product)}>{productStatusLabel(product)}</Badge>
                    </td>
                    <td className="hidden px-5 py-3.5 text-neutral-500 xl:table-cell">
                      {fmtDate(product.published_at)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <a
                        href={`/product/${product.item_id}`}
                        aria-label={`Ver ${product.title}`}
                        className="inline-flex rounded p-1 text-neutral-400 hover:text-neutral-700"
                      >
                        <ExternalLink size={16} />
                      </a>
                    </td>
                  </tr>
                ))}

              {!loading && products.length === 0 && !error && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-10 text-center text-sm text-neutral-400"
                  >
                    No se encontraron productos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {totalPages > 1 && !loading && (
          <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-3 text-sm text-neutral-500">
            <span>
              {(filters.page - 1) * LIMIT + 1}-{Math.min(filters.page * LIMIT, total)} de {total}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={filters.page <= 1}
                onClick={() => handlePage(filters.page - 1)}
                aria-label="Pagina anterior"
                className="rounded px-2 py-1 hover:bg-neutral-50 disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={filters.page >= totalPages}
                onClick={() => handlePage(filters.page + 1)}
                aria-label="Pagina siguiente"
                className="rounded px-2 py-1 hover:bg-neutral-50 disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export { Products };
