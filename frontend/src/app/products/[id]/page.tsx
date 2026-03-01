"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowLeft,
  Pencil,
  Archive,
  RefreshCw,
  Package,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Boxes,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";

import {
  useProduct,
  useDeleteProduct,
  useStockMovements,
} from "@/hooks/use-api";
import { formatCurrency } from "@/lib/utils";

// =============================================================================
// Helpers
// =============================================================================

function getStockStatus(qty: number) {
  if (qty <= 0)
    return {
      label: "Out of Stock",
      variant: "destructive" as const,
      className: "",
    };
  if (qty <= 10)
    return {
      label: "Low Stock",
      variant: "outline" as const,
      className:
        "border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-400",
    };
  return {
    label: "In Stock",
    variant: "outline" as const,
    className:
      "border-green-500 text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400",
  };
}

// =============================================================================
// Loading Skeleton
// =============================================================================

function ProductDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Back button */}
      <Skeleton className="h-9 w-40" />

      {/* Header */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Product info card */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="space-y-1">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-5 w-32" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Stock info card */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-lg" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions card */}
        <div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-20" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = Number(params.id);

  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);

  const {
    data: productResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useProduct(productId);

  const { data: movementsResponse } = useStockMovements(
    { product_id: productId, limit: 10 },
    { enabled: productId > 0 }
  );

  const deleteProduct = useDeleteProduct();
  const product = productResponse?.data;
  const movements = movementsResponse?.data ?? [];

  const handleArchive = async () => {
    if (!product) return;
    try {
      await deleteProduct.mutateAsync(product.id);
      toast.success(`"${product.name}" has been archived.`);
      setArchiveDialogOpen(false);
      router.push("/products");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to archive product";
      toast.error(message);
    }
  };

  // Loading
  if (isLoading) {
    return <ProductDetailSkeleton />;
  }

  // Error
  if (isError) {
    return (
      <div className="space-y-6">
        <Link href="/products">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Products
          </Button>
        </Link>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Failed to load product
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              {error instanceof Error
                ? error.message
                : "An unexpected error occurred."}
            </p>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not Found
  if (!product) {
    return (
      <div className="space-y-6">
        <Link href="/products">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Products
          </Button>
        </Link>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Product not found</h3>
            <p className="text-muted-foreground text-sm mb-4">
              The product you are looking for does not exist or has been removed.
            </p>
            <Link href="/products">
              <Button>Go to Products</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = getStockStatus(product.qty_available);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Back Button */}
      <Link href="/products">
        <Button variant="ghost" size="sm" className="min-h-[44px]">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Products
        </Button>
      </Link>

      {/* Product Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{product.name}</h1>
        <div className="flex items-center gap-2">
          {product.default_code && (
            <Badge variant="secondary">{product.default_code}</Badge>
          )}
          <Badge variant={status.variant} className={status.className}>
            {status.label}
          </Badge>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Product Information */}
          <Card>
            <CardHeader>
              <CardTitle>Product Information</CardTitle>
              <CardDescription>
                Details and specifications for this product
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                <InfoField label="Name" value={product.name} />
                <InfoField label="SKU" value={product.default_code} />
                <InfoField label="Barcode" value={product.barcode} />
                <InfoField
                  label="Type"
                  value={
                    product.type
                      ? product.type.charAt(0).toUpperCase() +
                        product.type.slice(1)
                      : null
                  }
                />
                <InfoField label="Category" value={product.categ_name} />
                <InfoField label="Unit of Measure" value={product.uom_name} />
                <InfoField
                  label="Sales Price"
                  value={formatCurrency(product.list_price)}
                />
                <InfoField
                  label="Cost Price"
                  value={formatCurrency(product.standard_price)}
                />
                <InfoField label="HS Code" value={product.hs_code} />
                <InfoField
                  label="Weight"
                  value={product.weight ? `${product.weight} kg` : null}
                />
                <InfoField
                  label="Volume"
                  value={product.volume ? `${product.volume} m³` : null}
                />
                <InfoField
                  label="Active"
                  value={product.active ? "Yes" : "No"}
                />
                {product.description && (
                  <div className="sm:col-span-2">
                    <InfoField label="Description" value={product.description} />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Stock Information */}
          <Card>
            <CardHeader>
              <CardTitle>Stock Information</CardTitle>
              <CardDescription>
                Current inventory levels and forecasts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StockStatBox
                  label="Available"
                  value={product.qty_available}
                  icon={<Boxes className="h-5 w-5" />}
                  color="blue"
                />
                <StockStatBox
                  label="Forecasted"
                  value={product.virtual_available}
                  icon={<BarChart3 className="h-5 w-5" />}
                  color="purple"
                />
                <StockStatBox
                  label="Incoming"
                  value={
                    product.virtual_available > product.qty_available
                      ? product.virtual_available - product.qty_available
                      : 0
                  }
                  icon={<TrendingUp className="h-5 w-5" />}
                  color="green"
                />
                <StockStatBox
                  label="Outgoing"
                  value={
                    product.qty_available > product.virtual_available
                      ? product.qty_available - product.virtual_available
                      : 0
                  }
                  icon={<TrendingDown className="h-5 w-5" />}
                  color="amber"
                />
              </div>
            </CardContent>
          </Card>

          {/* Stock Movement History */}
          {movements.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Stock Movements</CardTitle>
                <CardDescription>
                  Latest inventory changes for this product
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((move) => (
                      <TableRow key={move.id}>
                        <TableCell className="font-medium">
                          {move.reference || move.origin || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {move.location_name || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {move.location_dest_name || "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {move.quantity} {move.product_uom || ""}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {move.state || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {move.date
                            ? format(new Date(move.date), "MMM dd, yyyy")
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column (1/3) */}
        <div className="space-y-6">
          {/* Actions Card */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" variant="outline" asChild>
                <Link href={`/products/${product.id}`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Product
                </Link>
              </Button>
              <Button
                className="w-full"
                variant="destructive"
                onClick={() => setArchiveDialogOpen(true)}
              >
                <Archive className="mr-2 h-4 w-4" />
                Archive Product
              </Button>
            </CardContent>
          </Card>

          {/* Quick Stats Card */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Margin</span>
                <span className="font-medium">
                  {product.standard_price > 0
                    ? `${(
                        ((product.list_price - product.standard_price) /
                          product.standard_price) *
                        100
                      ).toFixed(1)}%`
                    : "—"}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Stock Value</span>
                <span className="font-medium">
                  {formatCurrency(
                    product.qty_available * product.standard_price
                  )}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Retail Value</span>
                <span className="font-medium">
                  {formatCurrency(
                    product.qty_available * product.list_price
                  )}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Archive Confirmation Dialog */}
      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive &ldquo;{product.name}&rdquo;?
              This will hide the product from the active catalog.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setArchiveDialogOpen(false)}
              disabled={deleteProduct.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleArchive}
              disabled={deleteProduct.isPending}
            >
              {deleteProduct.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Archiving…
                </>
              ) : (
                "Archive"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =============================================================================
// Sub-Components
// =============================================================================

function InfoField({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

function StockStatBox({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: "blue" | "green" | "amber" | "purple";
}) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    green: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    purple:
      "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  };

  return (
    <div className={`rounded-lg p-4 ${colorMap[color]}`}>
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs font-medium uppercase tracking-wider">{label}</span></div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
