"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Download,
  RefreshCw,
  FileText,
  AlertCircle,
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
  Table,
  TableBody,
  TableCell,
  TableFooter,
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
import { toast } from "@/components/ui/sonner";

import {
  useInvoice,
  useConfirmInvoice,
  useCancelInvoice,
  useMe,
} from "@/hooks/use-api";
import { getInvoicePdf } from "@/lib/api/invoices";
import { formatCurrency } from "@/lib/utils";

// =============================================================================
// Helpers
// =============================================================================

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
      return {
        label: "Cancelled",
        variant: "destructive" as const,
        className: "",
      };
    default:
      return {
        label: state || "Unknown",
        variant: "secondary" as const,
        className: "",
      };
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
// Loading Skeleton
// =============================================================================

function InvoiceDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-40" />
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-32" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function InvoiceDetailPage() {
  const params = useParams();
  const invoiceId = Number(params.id);

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const {
    data: invoiceResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useInvoice(invoiceId);

  const confirmInvoice = useConfirmInvoice();
  const cancelInvoice = useCancelInvoice();
  const { data: meResponse } = useMe();
  const role = meResponse?.data?.role ?? "viewer";
  const canControlState = role === "controller" || role === "admin";

  const invoice = invoiceResponse?.data;

  const handleConfirm = async () => {
    if (!invoice) return;
    try {
      await confirmInvoice.mutateAsync(invoice.id);
      toast.success("Invoice confirmed successfully.");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to confirm invoice";
      toast.error(message);
    }
  };

  const handleCancel = async () => {
    if (!invoice) return;
    try {
      await cancelInvoice.mutateAsync(invoice.id);
      toast.success("Invoice cancelled.");
      setCancelDialogOpen(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to cancel invoice";
      toast.error(message);
    }
  };

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    setDownloadingPdf(true);
    try {
      const blob = await getInvoicePdf(invoice.id);
      // Create an object URL and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${invoice.name || `INV-${invoice.id}`}.pdf`;
      document.body.appendChild(link);
      link.click();
      // Clean up
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("Invoice PDF downloaded successfully.");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to download PDF";
      toast.error(message);
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Loading
  if (isLoading) {
    return <InvoiceDetailSkeleton />;
  }

  // Error
  if (isError) {
    return (
      <div className="space-y-6">
        <Link href="/invoices">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Invoices
          </Button>
        </Link>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Failed to load invoice
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
  if (!invoice) {
    return (
      <div className="space-y-6">
        <Link href="/invoices">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Invoices
          </Button>
        </Link>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Invoice not found</h3>
            <p className="text-muted-foreground text-sm mb-4">
              The invoice you are looking for does not exist or has been removed.
            </p>
            <Link href="/invoices">
              <Button>Go to Invoices</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusBadge = getStatusBadge(invoice.state);
  const paymentBadge = getPaymentBadge(invoice.payment_state);
  const lines = invoice.invoice_lines ?? [];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Back Button */}
      <Link href="/invoices">
        <Button variant="ghost" size="sm" className="min-h-[44px]">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Invoices
        </Button>
      </Link>

      {/* Invoice Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {invoice.name || `INV-${invoice.id}`}
          </h1>
          <div className="flex items-center gap-2">
            <Badge
              variant={statusBadge.variant}
              className={statusBadge.className}
            >
              {statusBadge.label}
            </Badge>
            <Badge
              variant={paymentBadge.variant}
              className={paymentBadge.className}
            >
              {paymentBadge.label}
            </Badge>
          </div>
        </div>

        {/* Action Buttons (Confirm/Cancel require controller or admin role) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {canControlState && invoice.state === "draft" && (
            <Button
              onClick={handleConfirm}
              disabled={confirmInvoice.isPending}
            >
              {confirmInvoice.isPending ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Confirm Invoice
            </Button>
          )}
          {canControlState && invoice.state === "posted" && (
            <Button
              variant="destructive"
              onClick={() => setCancelDialogOpen(true)}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Cancel Invoice
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
          >
            {downloadingPdf ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {downloadingPdf ? "Downloading…" : "Download PDF"}
          </Button>
        </div>
      </div>

      {/* Invoice Info */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <InfoField label="Customer" value={invoice.partner_name} />
            <InfoField
              label="Invoice Date"
              value={
                invoice.invoice_date
                  ? format(new Date(invoice.invoice_date), "MMM dd, yyyy")
                  : null
              }
            />
            <InfoField
              label="Due Date"
              value={
                invoice.invoice_date_due
                  ? format(
                      new Date(invoice.invoice_date_due),
                      "MMM dd, yyyy"
                    )
                  : null
              }
            />
            <InfoField label="Reference" value={invoice.ref} />
          </div>
          {invoice.narration && (
            <div className="mt-4 pt-4 border-t">
              <InfoField label="Notes" value={invoice.narration} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
          <CardDescription>
            Products and services included in this invoice
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="hidden sm:table-cell">
                  Description
                </TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right hidden md:table-cell">
                  Discount
                </TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground py-8"
                  >
                    No line items
                  </TableCell>
                </TableRow>
              ) : (
                lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="font-medium">
                      {line.product_name || "—"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {line.name || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {line.quantity}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(line.price_unit)}
                    </TableCell>
                    <TableCell className="text-right hidden md:table-cell">
                      {line.discount > 0 ? `${line.discount}%` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(line.price_subtotal)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* Totals */}
      <div className="flex justify-end">
        <Card className="w-full sm:w-80">
          <CardContent className="p-6 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">
                {formatCurrency(invoice.amount_untaxed)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax</span>
              <span className="font-medium">
                {formatCurrency(invoice.amount_tax)}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="font-semibold text-lg">Total</span>
              <span className="font-bold text-xl">
                {formatCurrency(invoice.amount_total)}
              </span>
            </div>
            {invoice.amount_residual > 0 &&
              invoice.amount_residual < invoice.amount_total && (
                <>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amount Due</span>
                    <span className="font-medium text-destructive">
                      {formatCurrency(invoice.amount_residual)}
                    </span>
                  </div>
                </>
              )}
          </CardContent>
        </Card>
      </div>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Cancel Invoice</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel invoice &ldquo;
              {invoice.name || `INV-${invoice.id}`}&rdquo;? This action may
              reverse associated accounting entries.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
              disabled={cancelInvoice.isPending}
            >
              Keep Invoice
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelInvoice.isPending}
            >
              {cancelInvoice.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling…
                </>
              ) : (
                "Cancel Invoice"
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
