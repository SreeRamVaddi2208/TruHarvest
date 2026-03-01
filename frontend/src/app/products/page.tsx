"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  Archive,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Package,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";

import {
  useProducts,
  useCategories,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
} from "@/hooks/use-api";

import type { Product, ProductCreate, ProductUpdate } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

// =============================================================================
// Constants
// =============================================================================

const PAGE_SIZE = 20;

function getStockStatus(qty: number) {
  if (qty <= 0) return { label: "Out of Stock", variant: "destructive" as const, className: "" };
  if (qty <= 10) return { label: "Low Stock", variant: "outline" as const, className: "border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-400" };
  return { label: "In Stock", variant: "outline" as const, className: "border-green-500 text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400" };
}

// =============================================================================
// Product Form Dialog
// =============================================================================

interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  categories: { id: number; name: string }[];
}

function ProductFormDialog({ open, onOpenChange, product, categories }: ProductFormProps) {
  const isEdit = !!product;

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const isSubmitting = createProduct.isPending || updateProduct.isPending;

  const [formData, setFormData] = useState<{
    name: string;
    default_code: string;
    barcode: string;
    type: string;
    categ_id: string;
    list_price: string;
    standard_price: string;
    hs_code: string;
    description: string;
  }>({
    name: "",
    default_code: "",
    barcode: "",
    type: "product",
    categ_id: "",
    list_price: "0",
    standard_price: "0",
    hs_code: "",
    description: "",
  });

  // Reset form when dialog opens
  const handleOpenChange = useCallback(
    (value: boolean) => {
      if (value) {
        if (product) {
          setFormData({
            name: product.name || "",
            default_code: product.default_code || "",
            barcode: product.barcode || "",
            type: product.type || "product",
            categ_id: product.categ_id?.toString() || "",
            list_price: product.list_price?.toString() || "0",
            standard_price: product.standard_price?.toString() || "0",
            hs_code: product.hs_code || "",
            description: product.description || "",
          });
        } else {
          setFormData({
            name: "",
            default_code: "",
            barcode: "",
            type: "product",
            categ_id: "",
            list_price: "0",
            standard_price: "0",
            hs_code: "",
            description: "",
          });
        }
      }
      onOpenChange(value);
    },
    [product, onOpenChange]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Product name is required.");
      return;
    }

    try {
      if (isEdit && product) {
        const updateData: ProductUpdate = {
          name: formData.name,
          default_code: formData.default_code || undefined,
          barcode: formData.barcode || undefined,
          list_price: parseFloat(formData.list_price) || 0,
          standard_price: parseFloat(formData.standard_price) || 0,
          categ_id: formData.categ_id ? parseInt(formData.categ_id) : undefined,
          hs_code: formData.hs_code || undefined,
          description: formData.description || undefined,
        };
        await updateProduct.mutateAsync({ id: product.id, data: updateData });
        toast.success("Product updated successfully.");
      } else {
        const createData: ProductCreate = {
          name: formData.name,
          default_code: formData.default_code || undefined,
          barcode: formData.barcode || undefined,
          type: formData.type || undefined,
          list_price: parseFloat(formData.list_price) || 0,
          standard_price: parseFloat(formData.standard_price) || 0,
          categ_id: formData.categ_id ? parseInt(formData.categ_id) : undefined,
          hs_code: formData.hs_code || undefined,
          description: formData.description || undefined,
        };
        await createProduct.mutateAsync(createData);
        toast.success("Product created successfully.");
      }
      onOpenChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Product" : "Add Product"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the product details below."
              : "Fill in the details to create a new product."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                placeholder="Product name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="default_code">SKU</Label>
              <Input
                id="default_code"
                value={formData.default_code}
                onChange={(e) => setFormData((p) => ({ ...p, default_code: e.target.value }))}
                placeholder="e.g. SKU-001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="barcode">Barcode</Label>
              <Input
                id="barcode"
                value={formData.barcode}
                onChange={(e) => setFormData((p) => ({ ...p, barcode: e.target.value }))}
                placeholder="e.g. 1234567890123"
              />
            </div>

            {!isEdit && (
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => setFormData((p) => ({ ...p, type: v }))}
                >
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="product">Product</SelectItem>
                    <SelectItem value="consumable">Consumable</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="categ_id">Category</Label>
              <Select
                value={formData.categ_id}
                onValueChange={(v) => setFormData((p) => ({ ...p, categ_id: v }))}
              >
                <SelectTrigger id="categ_id">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="list_price">Sales Price</Label>
              <Input
                id="list_price"
                type="number"
                step="0.01"
                min="0"
                value={formData.list_price}
                onChange={(e) => setFormData((p) => ({ ...p, list_price: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="standard_price">Cost Price</Label>
              <Input
                id="standard_price"
                type="number"
                step="0.01"
                min="0"
                value={formData.standard_price}
                onChange={(e) => setFormData((p) => ({ ...p, standard_price: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hs_code">HS Code</Label>
              <Input
                id="hs_code"
                value={formData.hs_code}
                onChange={(e) => setFormData((p) => ({ ...p, hs_code: e.target.value }))}
                placeholder="e.g. 0804.30"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                placeholder="Optional product description"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  {isEdit ? "Updating…" : "Creating…"}
                </>
              ) : isEdit ? (
                "Update Product"
              ) : (
                "Create Product"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Skeleton Loading
// =============================================================================

function ProductsTableSkeleton() {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="hidden md:table-cell">Barcode</TableHead>
              <TableHead className="hidden lg:table-cell">Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead className="hidden md:table-cell">Cost</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-28" /></TableCell>
                <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-8 w-8 rounded" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [page, setPage] = useState(0);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const params = {
    search: search || undefined,
    category_id: categoryFilter ? parseInt(categoryFilter) : undefined,
    offset: page * PAGE_SIZE,
    limit: PAGE_SIZE,
    active_only: true,
  };

  const { data: productsResponse, isLoading, isError, error, refetch } = useProducts(params);
  const { data: categoriesResponse } = useCategories();
  const deleteProduct = useDeleteProduct();

  const products = productsResponse?.data ?? [];
  const total = productsResponse?.total ?? 0;
  const categories = categoriesResponse?.data ?? [];

  const rangeStart = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = Math.min((page + 1) * PAGE_SIZE, total);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleArchive = async (product: Product) => {
    try {
      await deleteProduct.mutateAsync(product.id);
      toast.success(`"${product.name}" has been archived.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to archive product";
      toast.error(message);
    }
  };

  const handleEdit = (product: Product) => {
    setEditProduct(product);
    setEditDialogOpen(true);
  };

  // Reset page when filters change
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(0);
  };

  const handleCategoryChange = (value: string) => {
    setCategoryFilter(value === "all" ? "" : value);
    setPage(0);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Products</h1>
        <p className="text-muted-foreground">Manage your product catalog</p>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products…"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 w-full sm:w-[280px]"
            />
          </div>

          <Select value={categoryFilter || "all"} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id.toString()}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Product
        </Button>
      </div>

      {/* Error State */}
      {isError && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-2">Failed to load products</h3>
            <p className="text-muted-foreground text-sm mb-4">
              {error instanceof Error ? error.message : "An unexpected error occurred."}
            </p>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && <ProductsTableSkeleton />}

      {/* Data Table */}
      {!isLoading && !isError && (
        <Card>
          <CardContent className="p-0">
            {products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-1">No products found</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {search || categoryFilter
                    ? "Try adjusting your search or filters."
                    : "Get started by adding your first product."}
                </p>
                {!search && !categoryFilter && (
                  <Button onClick={() => setAddDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Product
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="hidden md:table-cell">Barcode</TableHead>
                    <TableHead className="hidden lg:table-cell">Category</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="hidden md:table-cell text-right">Cost</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product, index) => {
                    const status = getStockStatus(product.qty_available);
                    return (
                      <TableRow
                        key={
                          product.id != null
                            ? `product-${product.id}-${index}`
                            : `product-${index}`
                        }
                      >
                        <TableCell className="font-medium">
                          <Link
                            href={`/products/${product.id}`}
                            className="hover:underline"
                          >
                            {product.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {product.default_code || "—"}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {product.barcode || "—"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {product.categ_name || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(product.list_price)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-right">
                          {formatCurrency(product.standard_price)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {product.qty_available}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant} className={status.className}>
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/products/${product.id}`}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEdit(product)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleArchive(product)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Archive className="mr-2 h-4 w-4" />
                                Archive
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>

          {/* Pagination */}
          {total > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t px-6 py-4">
              <p className="text-sm text-muted-foreground">
                Showing {rangeStart} to {rangeEnd} of {total} products
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  Page {page + 1} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page + 1 >= totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Add Product Dialog */}
      <ProductFormDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        categories={categories}
      />

      {/* Edit Product Dialog */}
      <ProductFormDialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setEditProduct(null);
        }}
        product={editProduct}
        categories={categories}
      />
    </div>
  );
}
