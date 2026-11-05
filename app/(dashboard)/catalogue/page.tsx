"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Package, Search, Unlink } from "lucide-react";
import { Button, Card, EmptyState, PageHeader, Skeleton, inputClass } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface NumberStatus {
  id: string;
  displayName: string | null;
  phoneNumber: string | null;
  catalogId: string | null;
  connected: boolean;
  isDefault: boolean;
}
interface Product {
  id: string;
  retailerId: string;
  name: string;
  description: string | null;
  price: string | null;
  currency: string | null;
  availability: string | null;
  imageUrl: string | null;
}

async function readJson<T>(res: Response, fallback: string): Promise<T> {
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? fallback);
  return (json?.data ?? json) as T;
}

/**
 * The WhatsApp product catalogue.
 *
 * Products are read from Meta's Commerce Manager rather than kept here, so this page
 * shows what customers would actually be shown. What it adds is the connection itself —
 * pointing a number at a catalogue, and seeing at a glance which numbers have one.
 */
export default function CataloguePage() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [catalogId, setCatalogId] = useState("");
  const [search, setSearch] = useState("");

  const { data: numbers = [], isLoading } = useQuery<NumberStatus[]>({
    queryKey: ["catalogue-status"],
    queryFn: async () => readJson<NumberStatus[]>(await fetch("/api/catalogue"), "Failed to load"),
  });

  const connected = numbers.find((n) => n.connected) ?? null;

  const { data: catalogue, isLoading: productsLoading } = useQuery<{ products: Product[] }>({
    queryKey: ["catalogue-products", connected?.id, search],
    enabled: Boolean(connected),
    queryFn: async () => {
      const q = new URLSearchParams({ integrationId: connected!.id });
      if (search.trim()) q.set("search", search.trim());
      return readJson<{ products: Product[] }>(
        await fetch(`/api/catalogue/products?${q}`),
        "Couldn't read the catalogue",
      );
    },
  });

  const connect = useMutation({
    mutationFn: async (integrationId: string) =>
      readJson(await fetch("/api/catalogue/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ catalogId: catalogId.trim(), integrationId }),
      }), "Couldn't connect the catalogue"),
    onSuccess: () => {
      setCatalogId("");
      queryClient.invalidateQueries({ queryKey: ["catalogue-status"] });
      showToast("Catalogue connected.", "success");
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  const disconnect = useMutation({
    mutationFn: async (integrationId: string) =>
      readJson(await fetch(`/api/catalogue/connect?integrationId=${integrationId}`, { method: "DELETE" }),
        "Couldn't disconnect"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalogue-status"] });
      showToast("Catalogue disconnected. The products themselves are untouched.", "success");
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  return (
    <div>
      <PageHeader
        title="Product catalogue"
        description="Products come from your Meta Commerce Manager, so what you see here is what customers see."
      />

      <Card className="mb-4 p-5">
        <h2 className="text-sm font-semibold text-slate-900">Connected numbers</h2>
        {isLoading ? (
          <Skeleton className="mt-3 h-20 rounded-lg" />
        ) : numbers.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No active WhatsApp number in this department.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {numbers.map((n) => (
              <div
                key={n.id}
                className={cn(
                  "flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5",
                  n.connected ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200",
                )}
              >
                <Package className={cn("h-4 w-4 shrink-0", n.connected ? "text-emerald-600" : "text-slate-400")} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {n.displayName || n.phoneNumber}
                  </p>
                  <p className="text-xs text-slate-500">
                    {n.connected ? `Catalogue ${n.catalogId}` : "No catalogue connected"}
                  </p>
                </div>
                {n.connected ? (
                  <Button variant="secondary" onClick={() => disconnect.mutate(n.id)} disabled={disconnect.isPending}>
                    <Unlink className="h-4 w-4" />
                    Disconnect
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <input
                      value={catalogId}
                      onChange={(e) => setCatalogId(e.target.value)}
                      placeholder="Catalogue ID from Commerce Manager"
                      className={cn(inputClass, "w-64")}
                    />
                    <Button
                      onClick={() => connect.mutate(n.id)}
                      disabled={!catalogId.trim() || connect.isPending}
                    >
                      <Link2 className="h-4 w-4" />
                      Connect
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">
          The catalogue is created and its products managed in Meta Commerce Manager. We
          check the ID with Meta before saving it, so a mistyped one is refused here
          rather than turning up later as an empty list.
        </p>
      </Card>

      {connected && (
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-900">Products</h2>
            <div className="relative w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products"
                className={`${inputClass} pl-9`}
              />
            </div>
          </div>

          {productsLoading ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
            </div>
          ) : (catalogue?.products ?? []).length === 0 ? (
            <EmptyState
              icon={Package}
              title="No products"
              description="Add products in Meta Commerce Manager and they appear here."
            />
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {catalogue!.products.map((p) => (
                <div key={p.id} className="flex gap-3 rounded-lg border border-slate-200 p-3">
                  {p.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded object-cover" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.price ?? "—"}</p>
                    <p className="mt-0.5 truncate text-[11px] text-slate-400">{p.retailerId}</p>
                    {p.availability && p.availability !== "in stock" && (
                      <p className="mt-0.5 text-[11px] text-amber-700">{p.availability}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
