"use client";

import { useState } from "react";
import {
  Package,
  Search,
  SlidersHorizontal,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useStockLevels, useProducts, useAdjustStock } from "@/hooks/use-api";
import { toast } from "@/components/ui/sonner";
import type { ProductStockInfo } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const PAGE_SIZE = 20;

function getStockStatusClass(qty: number) {
  if (qty <= 0) return "bg-red-50 text-red-600";
  if (qty < 10) return "bg-amber-50 text-amber-600";
  return "";
}

function getStockBadge(qty: number) {
  if (qty <= 0)
    return (
      <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
        Out of Stock
      </Badge>
    );
  if (qty < 10)
    return (
      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
        Low Stock
      </Badge>
    );
  return (
    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
      In Stock
    </Badge>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------
function StockSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-48" />
        <Skeleton className="mt-1 h-5 w-72" />
      </div>
      <Skeleton className="h-[500px] w-full rounded-xl" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Adjust Stock Dialog
// ---------------------------------------------------------------------------
function AdjustStockDialog({
  products,
}: {
  products: ProductStockInfo[];
}) {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState<string>("");
  const [newQuantity, setNewQuantity] = useState<string>("");
  const [reason, setReason] = useState("");

  const adjustStock = useAdjustStock();

  const handleSubmit = () => {
    if (!productId || newQuantity === "") {
      toast.error("Please select a product and enter a quantity.");
      return;
    }

    adjustStock.mutate(
      {
        product_id: parseInt(productId),
        new_quantity: parseFloat(newQuantity),
        reason: reason || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Stock adjusted successfully.");
          setOpen(false);
          setProductId("");
          setNewQuantity("");
          setReason("");
        },
        onError: () => {
          toast.error("Failed to adjust stock. Please try again.");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          Adjust Stock
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Stock Quantity</DialogTitle>
          <DialogDescription>
            Set the new stock quantity for a product. This will create an
            inventory adjustment.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="adjust-product">Product</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger id="adjust-product">
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.product_id} value={String(p.product_id)}>
                    {p.product_name}
                    {p.sku ? ` (${p.sku})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-qty">New Quantity</Label>
            <Input
              id="new-qty"
              type="number"
              min="0"
              step="1"
              placeholder="Enter new quantity"
              value={newQuantity}
              onChange={(e) => setNewQuantity(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              placeholder="Reason for adjustment..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={adjustStock.isPending}>
            {adjustStock.isPending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Adjusting…
              </>
            ) : (
              "Confirm Adjustment"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function StockLevelsPage() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");

  const {
    data: stockResponse,
    isLoading,
    isError,
    refetch,
  } = useStockLevels({
    offset: page * PAGE_SIZE,
    limit: PAGE_SIZE,
    search: search || undefined,
  });

  if (isLoading) return <StockSkeleton />;

  const stockItems = stockResponse?.data ?? [];
  const total = stockResponse?.total ?? 0;
  const hasMore = stockResponse?.has_more ?? false;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Stock Levels</h1>
          <p className="text-muted-foreground">
            Current inventory across all products
          </p>
        </div>
        <Card className="mx-auto max-w-lg text-center">
          <CardHeader>
            <CardTitle className="text-red-600">
              Failed to load stock data
            </CardTitle>
            <CardDescription>
              Something went wrong. Please try again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => refetch()} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Stock Levels</h1>
          <p className="text-muted-foreground">
            Current inventory across all products &middot;{" "}
            {formatNumber(total)} items
          </p>
        </div>
        <AdjustStockDialog products={stockItems} />
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products…"
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">Forecasted</TableHead>
                <TableHead className="text-right">Incoming</TableHead>
                <TableHead className="text-right">Outgoing</TableHead>
                <TableHead>UOM</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stockItems.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-32 text-center text-muted-foreground"
                  >
                    <Package className="mx-auto mb-2 h-8 w-8 opacity-40" />
                    No stock data found
                  </TableCell>
                </TableRow>
              ) : (
                stockItems.map((item, index) => (
                  <TableRow
                    key={
                      item.product_id != null
                        ? `stock-${item.product_id}-${index}`
                        : `stock-${index}`
                    }
                    className={getStockStatusClass(item.qty_available)}
                  >
                    <TableCell className="font-medium">
                      {item.product_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.sku || "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatNumber(item.qty_available)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(item.qty_forecasted)}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {item.incoming_qty > 0
                        ? `+${formatNumber(item.incoming_qty)}`
                        : "0"}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {item.outgoing_qty > 0
                        ? `-${formatNumber(item.outgoing_qty)}`
                        : "0"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.uom || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{getStockBadge(item.qty_available)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}–
            {Math.min((page + 1) * PAGE_SIZE, total)} of {formatNumber(total)}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Previous</span>
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
