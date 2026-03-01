"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  Plus,
  MoreHorizontal,
  Eye,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  FileText,
  AlertCircle,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/sonner";

import {
  useInvoices,
  usePartners,
  useProducts,
  useCreateInvoice,
} from "@/hooks/use-api";

import { getInvoicePdf } from "@/lib/api/invoices";
import type { InvoiceLineCreate } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

// =============================================================================
// Constants & Helpers
// =============================================================================

const PAGE_SIZE = 20;

function getStatusBadge(state: string | null) {
  switch (state) {
    case "draft":
      return { label: "Draft", variant: "secondary" as const, className: "" };
    case "posted":
      return {
        label: "Posted",
        variant: "outline" as const,
        className:
          "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400",
      };
    case "cancel":
      return { label: "Cancelled", variant: "destructive" as const, className: "" };
    default:
      return { label: state || "Unknown", variant: "secondary" as const, className: "" };
  }
}

function getPaymentBadge(paymentState: string | null) {
  switch (paymentState) {
    case "paid":
      return {
        label: "Paid",
        variant: "outline" as const,
        className:
          "border-green-500 text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400",
      };
    case "partial":
      return {
        label: "Partial",
        variant: "outline" as const,
        className:
          "border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-400",
      };
    case "not_paid":
      return {
        label: "Not Paid",
        variant: "outline" as const,
        className:
          "border-red-500 text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-400",
      };
    case "reversed":
      return { label: "Reversed", variant: "outline" as const, className: "" };
    default:
      return {
        label: paymentState || "—",
        variant: "secondary" as const,
        className: "",
      };
  }
}

// =============================================================================
// Create Invoice Sheet
// =============================================================================

interface InvoiceLine {
  product_id: string;
  quantity: string;
  price_unit: string;
  discount: string;
  name: string;
}

const emptyLine: InvoiceLine = {
  product_id: "",
  quantity: "1",
  price_unit: "0",
  discount: "0",
  name: "",
};

interface CreateInvoiceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CreateInvoiceSheet({ open, onOpenChange }: CreateInvoiceSheetProps) {
  const createInvoice = useCreateInvoice();
  const { data: partnersResponse } = usePartners({ limit: 200 });
  const { data: productsResponse } = useProducts({ limit: 200 });

  const partners = partnersResponse?.data ?? [];
  const products = productsResponse?.data ?? [];

  const [partnerId, setPartnerId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<InvoiceLine[]>([{ ...emptyLine }]);

  const updateLine = (index: number, field: keyof InvoiceLine, value: string) => {
    setLines((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      // Auto-fill price when product is selected
      if (field === "product_id" && value) {
        const prod = products.find((p) => p.id.toString() === value);
        if (prod) {
          updated[index].price_unit = prod.list_price.toString();
          updated[index].name = prod.name;
        }
      }

      return updated;
    });
  };

  const addLine = () => setLines((prev) => [...prev, { ...emptyLine }]);

  const removeLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const lineSubtotal = (line: InvoiceLine) => {
    const qty = parseFloat(line.quantity) || 0;
    const price = parseFloat(line.price_unit) || 0;
    const disc = parseFloat(line.discount) || 0;
    return qty * price * (1 - disc / 100);
  };

  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, l) => sum + lineSubtotal(l), 0);
    const tax = subtotal * 0; // Tax handled by backend
    return { subtotal, tax, total: subtotal + tax };
  }, [lines]);

  const resetForm = () => {
    setPartnerId("");
    setInvoiceDate(format(new Date(), "yyyy-MM-dd"));
    setReference("");
    setNotes("");
    setLines([{ ...emptyLine }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!partnerId) {
      toast.error("Please select a customer.");
      return;
    }

    const validLines = lines.filter((l) => l.product_id);
    if (validLines.length === 0) {
      toast.error("Please add at least one line item.");
      return;
    }

    try {
      const invoiceLines: InvoiceLineCreate[] = validLines.map((l) => ({
        product_id: parseInt(l.product_id),
        quantity: parseFloat(l.quantity) || 1,
        price_unit: parseFloat(l.price_unit) || 0,
        discount: parseFloat(l.discount) || 0,
        name: l.name || undefined,
      }));

      await createInvoice.mutateAsync({
        partner_id: parseInt(partnerId),
        invoice_date: invoiceDate || undefined,
        ref: reference || undefined,
        narration: notes || undefined,
        lines: invoiceLines,
      });

      toast.success("Invoice created successfully.");
      resetForm();
      onOpenChange(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create invoice";
      toast.error(message);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Create Invoice</SheetTitle>
          <SheetDescription>
            Fill in the details to create a new invoice.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6 px-4 pb-4">
          {/* Invoice Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="partner">
                Customer <span className="text-destructive">*</span>
              </Label>
              <Select value={partnerId} onValueChange={setPartnerId}>
                <SelectTrigger id="partner">
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {partners.map((p, i) => (
                    <SelectItem
                      key={p.id != null ? `partner-${p.id}-${i}` : `partner-${i}`}
                      value={p.id.toString()}
                    >
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice_date">Invoice Date</Label>
              <Input
                id="invoice_date"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reference">Reference</Label>
              <Input
                id="reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. PO-12345"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
                rows={2}
              />
            </div>
          </div>

          <Separator />

          {/* Line Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Line Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="mr-1 h-3 w-3" />
                Add Line
              </Button>
            </div>

            <div className="space-y-3">
              {lines.map((line, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 items-end rounded-lg border p-3"
                >
                  <div className="col-span-12 sm:col-span-4 space-y-1">
                    <Label className="text-xs">Product</Label>
                    <Select
                      value={line.product_id}
                      onValueChange={(v) => updateLine(idx, "product_id", v)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p, index) => (
                          <SelectItem
                            key={p.id != null ? `product-${p.id}-${index}` : `product-${index}`}
                            value={p.id.toString()}
                          >
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-3 sm:col-span-2 space-y-1">
                    <Label className="text-xs">Qty</Label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      className="h-8 text-xs"
                      value={line.quantity}
                      onChange={(e) =>
                        updateLine(idx, "quantity", e.target.value)
                      }
                    />
                  </div>

                  <div className="col-span-3 sm:col-span-2 space-y-1">
                    <Label className="text-xs">Unit Price</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="h-8 text-xs"
                      value={line.price_unit}
                      onChange={(e) =>
                        updateLine(idx, "price_unit", e.target.value)
                      }
                    />
                  </div>

                  <div className="col-span-3 sm:col-span-2 space-y-1">
                    <Label className="text-xs">Disc %</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      className="h-8 text-xs"
                      value={line.discount}
                      onChange={(e) =>
                        updateLine(idx, "discount", e.target.value)
                      }
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-1 space-y-1">
                    <Label className="text-xs">Subtotal</Label>
                    <p className="h-8 flex items-center text-xs font-medium">
                      {formatCurrency(lineSubtotal(line))}
                    </p>
                  </div>

                  <div className="col-span-1 flex items-end justify-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeLine(idx)}
                      disabled={lines.length <= 1}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Totals */}
          <div className="flex flex-col items-end gap-1 text-sm">
            <div className="flex gap-8">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium w-24 text-right">
                {formatCurrency(totals.subtotal)}
              </span>
            </div>
            <div className="flex gap-8">
              <span className="text-muted-foreground">Tax</span>
              <span className="font-medium w-24 text-right">
                {formatCurrency(totals.tax)}
              </span>
            </div>
            <Separator className="my-1 w-48" />
            <div className="flex gap-8">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-lg w-24 text-right">
                {formatCurrency(totals.total)}
              </span>
            </div>
          </div>

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createInvoice.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createInvoice.isPending}>
              {createInvoice.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                "Create Invoice"
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// =============================================================================
// Table Skeleton
// =============================================================================

function InvoicesTableSkeleton() {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="hidden md:table-cell">Date</TableHead>
              <TableHead className="hidden lg:table-cell">Due Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
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

export default function InvoicesPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const params = {
    state: statusFilter !== "all" ? statusFilter : undefined,
    offset: page * PAGE_SIZE,
    limit: PAGE_SIZE,
  };

  const {
    data: invoicesResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useInvoices(params);

  const handleDownloadPdf = async (invoiceId: number, invoiceName: string) => {
    setDownloadingId(invoiceId);
    try {
      const blob = await getInvoicePdf(invoiceId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${invoiceName || `INV-${invoiceId}`}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("Invoice PDF downloaded.");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to download PDF";
      toast.error(message);
    } finally {
      setDownloadingId(null);
    }
  };

  const invoices = invoicesResponse?.data ?? [];
  const total = invoicesResponse?.total ?? 0;

  const rangeStart = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = Math.min((page + 1) * PAGE_SIZE, total);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setPage(0);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Invoices</h1>
        <p className="text-muted-foreground">
          Manage invoices and billing
        </p>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <Tabs
          value={statusFilter}
          onValueChange={handleStatusChange}
          className="w-full sm:w-auto"
        >
          <TabsList className="w-full sm:w-auto overflow-x-auto">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="draft">Draft</TabsTrigger>
            <TabsTrigger value="posted">Posted</TabsTrigger>
            <TabsTrigger value="cancel">Cancelled</TabsTrigger>
          </TabsList>
        </Tabs>

        <Button onClick={() => setCreateSheetOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Invoice
        </Button>
      </div>

      {/* Error State */}
      {isError && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Failed to load invoices
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
      )}

      {/* Loading */}
      {isLoading && <InvoicesTableSkeleton />}

      {/* Data Table */}
      {!isLoading && !isError && (
        <Card>
          <CardContent className="p-0">
            {invoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-1">
                  No invoices found
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {statusFilter !== "all"
                    ? "No invoices match this filter."
                    : "Get started by creating your first invoice."}
                </p>
                {statusFilter === "all" && (
                  <Button onClick={() => setCreateSheetOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Invoice
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="hidden md:table-cell">Date</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Due Date
                    </TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => {
                    const statusBadge = getStatusBadge(invoice.state);
                    const paymentBadge = getPaymentBadge(
                      invoice.payment_state
                    );
                    return (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/invoices/${invoice.id}`}
                            className="hover:underline"
                          >
                            {invoice.name || `INV-${invoice.id}`}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {invoice.partner_name || "—"}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {invoice.invoice_date
                            ? format(
                                new Date(invoice.invoice_date),
                                "MMM dd, yyyy"
                              )
                            : "—"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">
                          {invoice.invoice_date_due
                            ? format(
                                new Date(invoice.invoice_date_due),
                                "MMM dd, yyyy"
                              )
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(invoice.amount_total)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={statusBadge.variant}
                            className={statusBadge.className}
                          >
                            {statusBadge.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={paymentBadge.variant}
                            className={paymentBadge.className}
                          >
                            {paymentBadge.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/invoices/${invoice.id}`}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleDownloadPdf(
                                    invoice.id,
                                    invoice.name || `INV-${invoice.id}`
                                  )
                                }
                                disabled={downloadingId === invoice.id}
                              >
                                {downloadingId === invoice.id ? (
                                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Download className="mr-2 h-4 w-4" />
                                )}
                                {downloadingId === invoice.id
                                  ? "Downloading…"
                                  : "Download PDF"}
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
                Showing {rangeStart} to {rangeEnd} of {total} invoices
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

      {/* Create Invoice Sheet */}
      <CreateInvoiceSheet
        open={createSheetOpen}
        onOpenChange={setCreateSheetOpen}
      />
    </div>
  );
}
