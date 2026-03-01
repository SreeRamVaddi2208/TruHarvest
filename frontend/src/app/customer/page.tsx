"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Plus,
  Minus,
  X,
  User,
  CheckCircle,
  Leaf,
  ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";

import { useProducts, usePartners, usePlaceOrderInOdoo } from "@/hooks/use-api";
import type { Product } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

type CartItem = {
  product_id: number;
  name: string;
  list_price: number;
  quantity: number;
};

export default function CustomerOrderPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [partnerId, setPartnerId] = useState<string>("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [placed, setPlaced] = useState<{
    delivery_name?: string;
    invoice_name?: string;
  } | null>(null);
  const [search, setSearch] = useState("");

  const { data: productsData, isLoading: productsLoading } = useProducts({
    limit: 200,
  });
  const { data: partnersData, isLoading: partnersLoading } = usePartners({
    limit: 200,
  });
  const placeOrder = usePlaceOrderInOdoo();

  const products = (productsData?.data ?? []) as Product[];
  const partners = partnersData?.data ?? [];
  const filteredProducts = search.trim()
    ? products.filter(
        (p) =>
          p.name?.toLowerCase().includes(search.toLowerCase()) ||
          p.default_code?.toLowerCase().includes(search.toLowerCase())
      )
    : products;

  const addToCart = useCallback((p: Product) => {
    setCart((prev) => {
      const existing = prev.find((x) => x.product_id === p.id);
      const qty = (existing?.quantity ?? 0) + 1;
      const available = p.qty_available ?? 0;
      if (qty > available) {
        toast.error(`Only ${available} available`);
        return prev;
      }
      if (existing) {
        return prev.map((x) =>
          x.product_id === p.id ? { ...x, quantity: x.quantity + 1 } : x
        );
      }
      return [
        ...prev,
        {
          product_id: p.id,
          name: p.name,
          list_price: p.list_price ?? 0,
          quantity: 1,
        },
      ];
    });
    setSheetOpen(true);
  }, []);

  const updateQty = useCallback((product_id: number, delta: number) => {
    setCart((prev) => {
      const item = prev.find((x) => x.product_id === product_id);
      if (!item) return prev;
      const newQty = Math.max(0, item.quantity + delta);
      if (newQty === 0) {
        return prev.filter((x) => x.product_id !== product_id);
      }
      return prev.map((x) =>
        x.product_id === product_id ? { ...x, quantity: newQty } : x
      );
    });
  }, []);

  const removeFromCart = useCallback((product_id: number) => {
    setCart((prev) => prev.filter((x) => x.product_id !== product_id));
  }, []);

  const handlePlaceOrder = useCallback(() => {
    if (!partnerId || cart.length === 0) {
      toast.error("Select a customer and add items to the cart.");
      return;
    }
    setPlaced(null);
    placeOrder.mutate(
      {
        partner_id: Number(partnerId),
        lines: cart.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price_unit: item.list_price,
        })),
      },
      {
        onSuccess: (res) => {
          const data = res?.data as
            | { delivery_name?: string; invoice_name?: string }
            | undefined;
          setPlaced({
            delivery_name: data?.delivery_name,
            invoice_name: data?.invoice_name,
          });
          setCart([]);
          setPartnerId("");
          toast.success("Order placed. Stock updated and invoice created.");
        },
        onError: (err: Error) => {
          toast.error(err?.message ?? "Failed to place order.");
        },
      }
    );
  }, [partnerId, cart, placeOrder]);

  const cartTotal = cart.reduce(
    (sum, item) => sum + item.list_price * item.quantity,
    0
  );
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-[#f5f1eb] text-[#1c1917]">
      {/* Back to app link - subtle */}
      <div className="border-b border-amber-900/10 bg-white/60 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-amber-900/60 hover:text-amber-900 flex items-center gap-1"
          >
            <ChevronRight className="h-4 w-4 rotate-180" />
            Back to dashboard
          </Link>
        </div>
      </div>

      {/* Hero */}
      <header className="relative overflow-hidden border-b border-amber-900/10">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-orange-50/80 to-amber-100/60" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(251,191,36,0.25),transparent)]" />
        <div className="relative max-w-6xl mx-auto px-4 py-12 sm:py-16 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-700 mb-4">
            <Leaf className="w-8 h-8" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-amber-950">
            TruHarvest
          </h1>
          <p className="mt-2 text-lg text-amber-900/70 max-w-md mx-auto">
            Place your order. We’ll update stock and generate your invoice.
          </p>
        </div>
      </header>

      {/* Search */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="relative">
          <input
            type="search"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md mx-auto block rounded-xl border border-amber-200 bg-white/80 px-4 py-3 pl-10 text-amber-950 placeholder:text-amber-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400"
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-amber-600/60">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Product grid */}
      <main className="max-w-6xl mx-auto px-4 pb-32">
        {productsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton
                key={i}
                className="h-56 rounded-2xl bg-amber-100/50 border border-amber-200/50"
              />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-16 text-amber-900/60">
            {search.trim() ? "No products match your search." : "No products available."}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map((p) => {
              const available = p.qty_available ?? 0;
              const inStock = available > 0;
              return (
                <div
                  key={p.id}
                  className="group relative rounded-2xl bg-white/90 border border-amber-200/60 shadow-sm overflow-hidden hover:shadow-md hover:border-amber-300/60 transition-all duration-200"
                >
                  {/* Product image placeholder */}
                  <div className="aspect-square bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                    <Leaf className="w-12 h-12 text-amber-400/70 group-hover:text-amber-500/80 transition-colors" />
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-amber-950 truncate" title={p.name}>
                      {p.name}
                    </h3>
                    <p className="text-lg font-bold text-amber-700 mt-1">
                      {formatCurrency(p.list_price ?? 0)}
                    </p>
                    <p className="text-xs text-amber-700/60 mt-0.5">
                      {inStock ? `${available} in stock` : "Out of stock"}
                    </p>
                    <Button
                      size="sm"
                      className="w-full mt-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-amber-950 font-medium shadow-sm"
                      onClick={() => addToCart(p)}
                      disabled={!inStock}
                    >
                      <Plus className="h-4 w-4 mr-1.5" />
                      Add to cart
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating cart button */}
      <div className="fixed bottom-6 right-6 z-30">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button
              size="lg"
              className="h-14 w-14 rounded-2xl shadow-lg bg-amber-500 hover:bg-amber-600 text-amber-950 relative"
            >
              <ShoppingBag className="h-6 w-6" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-900 text-amber-100 text-xs font-bold">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="w-full sm:max-w-md border-l border-amber-200/60 bg-[#fdfcfa]"
          >
            <SheetHeader>
              <SheetTitle className="text-amber-950 flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
                Your cart
              </SheetTitle>
            </SheetHeader>
            <div className="flex flex-col h-[calc(100vh-5rem)] mt-4">
              {placed ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                    <CheckCircle className="w-10 h-10 text-green-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-amber-950">
                    Thank you!
                  </h3>
                  <p className="text-amber-700/80 mt-1">
                    Your order has been placed.
                  </p>
                  {placed.delivery_name && (
                    <p className="text-sm text-amber-700/70 mt-2">
                      Delivery: {placed.delivery_name}
                    </p>
                  )}
                  {placed.invoice_name && (
                    <p className="text-sm text-amber-700/70">
                      Invoice: {placed.invoice_name}
                    </p>
                  )}
                  <Button
                    className="mt-6 rounded-xl bg-amber-500 hover:bg-amber-600 text-amber-950"
                    onClick={() => {
                      setPlaced(null);
                      setSheetOpen(false);
                    }}
                  >
                    Continue shopping
                  </Button>
                </div>
              ) : cart.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center px-4 text-amber-700/60">
                  <ShoppingBag className="w-12 h-12 mb-3 opacity-50" />
                  <p>Your cart is empty.</p>
                  <p className="text-sm mt-1">
                    Add products from the store to get started.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4 rounded-xl border-amber-300 text-amber-800"
                    onClick={() => setSheetOpen(false)}
                  >
                    Close
                  </Button>
                </div>
              ) : (
                <>
                  <ul className="flex-1 overflow-y-auto space-y-3 pr-2 -mr-2">
                    {cart.map((item) => (
                      <li
                        key={item.product_id}
                        className="flex gap-3 p-3 rounded-xl bg-white/80 border border-amber-200/50"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-amber-950 truncate">
                            {item.name}
                          </p>
                          <p className="text-sm text-amber-700/70">
                            {formatCurrency(item.list_price)} × {item.quantity}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 rounded-lg border-amber-200 text-amber-800 hover:bg-amber-50"
                            onClick={() => updateQty(item.product_id, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-7 text-center text-sm font-medium">
                            {item.quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 rounded-lg border-amber-200 text-amber-800 hover:bg-amber-50"
                            onClick={() => updateQty(item.product_id, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg text-amber-700/70 hover:text-red-600 hover:bg-red-50"
                            onClick={() => removeFromCart(item.product_id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="border-t border-amber-200/60 pt-4 mt-4 space-y-4">
                    <div className="flex justify-between text-lg font-semibold text-amber-950">
                      <span>Total</span>
                      <span>{formatCurrency(cartTotal)}</span>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-amber-900 flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Customer
                      </label>
                      <Select
                        value={partnerId}
                        onValueChange={setPartnerId}
                        disabled={partnersLoading}
                      >
                        <SelectTrigger className="rounded-xl border-amber-200 bg-white">
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                        <SelectContent>
                          {partners.map((p: { id: number; name?: string }) => (
                            <SelectItem
                              key={p.id}
                              value={String(p.id)}
                              className="focus:bg-amber-50"
                            >
                              {p.name ?? `Partner ${p.id}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      className="w-full rounded-xl h-12 text-base font-semibold bg-amber-500 hover:bg-amber-600 text-amber-950 shadow-md"
                      onClick={handlePlaceOrder}
                      disabled={placeOrder.isPending || !partnerId}
                    >
                      {placeOrder.isPending
                        ? "Placing order…"
                        : "Place order"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
