"use client";

import { useState } from "react";
import {
  Plus,
  Trash2,
  RefreshCw,
  PackageMinus,
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  useProducts,
  usePartners,
  useCreateOutgoing,
  usePickings,
  useMe,
  useConfirmPicking,
  useValidatePicking,
} from "@/hooks/use-api";
import { toast } from "@/components/ui/sonner";
import type { StockMoveCreate } from "@/lib/types";

// ---------------------------------------------------------------------------
// Line item type
// ---------------------------------------------------------------------------
interface LineItem {
  key: string;
  product_id: string;
  quantity: string;
  reference: string;
}

function createEmptyLine(): LineItem {
  return {
    key: crypto.randomUUID(),
    product_id: "",
    quantity: "",
    reference: "",
  };
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function OutgoingDeliveriesPage() {
  const [partnerId, setPartnerId] = useState<string>("");
  const [origin, setOrigin] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [lines, setLines] = useState<LineItem[]>([createEmptyLine()]);

  const { data: productsResponse, isLoading: productsLoading } = useProducts({
    limit: 200,
  });
  const { data: partnersResponse, isLoading: partnersLoading } = usePartners({
    limit: 200,
  });
  const { data: pickingsResponse, isLoading: pickingsLoading } = usePickings({
    picking_type: "outgoing",
    limit: 10,
  });

  const createOutgoing = useCreateOutgoing();
  const confirmPicking = useConfirmPicking();
  const validatePicking = useValidatePicking();
  const { data: meResponse } = useMe();
  const role = meResponse?.data?.role ?? "viewer";
  const canControlState = role === "controller" || role === "admin";

  const products = productsResponse?.data ?? [];
  const partners = partnersResponse?.data ?? [];
  const recentPickings = pickingsResponse?.data ?? [];

  // Line management
  const addLine = () => setLines((prev) => [...prev, createEmptyLine()]);

  const removeLine = (key: string) =>
    setLines((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((l) => l.key !== key);
    });

  const updateLine = (key: string, field: keyof LineItem, value: string) =>
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, [field]: value } : l))
    );

  // Submit
  const handleSubmit = () => {
    const validLines = lines.filter(
      (l) => l.product_id && parseFloat(l.quantity) > 0
    );

    if (validLines.length === 0) {
      toast.error(
        "Please add at least one line item with a product and quantity."
      );
      return;
    }

    const moveLines: StockMoveCreate[] = validLines.map((l) => ({
      product_id: parseInt(l.product_id),
      quantity: parseFloat(l.quantity),
      move_type: "outgoing",
      reference: l.reference || undefined,
    }));

    createOutgoing.mutate(
      {
        partner_id: partnerId ? parseInt(partnerId) : undefined,
        picking_type: "outgoing",
        scheduled_date: scheduledDate || undefined,
        origin: origin || undefined,
        lines: moveLines,
      },
      {
        onSuccess: () => {
          toast.success("Outgoing delivery created successfully.");
          setPartnerId("");
          setOrigin("");
          setScheduledDate("");
          setLines([createEmptyLine()]);
        },
        onError: () => {
          toast.error("Failed to create outgoing delivery. Please try again.");
        },
      }
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Outgoing Deliveries
        </h1>
        <p className="text-muted-foreground">
          Ship stock from your warehouse to customers
        </p>
      </div>

      {/* Create Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackageMinus className="h-5 w-5" />
            New Outgoing Delivery
          </CardTitle>
          <CardDescription>
            Fill in the details below to create a new outgoing delivery.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Top fields */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="partner">Customer (optional)</Label>
              {partnersLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select value={partnerId} onValueChange={setPartnerId}>
                  <SelectTrigger id="partner">
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {partners.map((p, i) => (
                      <SelectItem
                        key={p.id != null ? `partner-${p.id}-${i}` : `partner-${i}`}
                        value={String(p.id)}
                      >
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="origin">Origin Reference</Label>
              <Input
                id="origin"
                placeholder="e.g. SO-2026-042"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduled-date">Scheduled Date</Label>
              <Input
                id="scheduled-date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>
          </div>

          <Separator />

          {/* Line items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Line Items</Label>
              <Button variant="outline" size="sm" onClick={addLine}>
                <Plus className="mr-1 h-4 w-4" />
                Add Line
              </Button>
            </div>

            <div className="space-y-3">
              {lines.map((line) => (
                <div
                  key={line.key}
                  className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-end"
                >
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Product
                    </Label>
                    {productsLoading ? (
                      <Skeleton className="h-9 w-full" />
                    ) : (
                      <Select
                        value={line.product_id}
                        onValueChange={(v) =>
                          updateLine(line.key, "product_id", v)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((p, index) => (
                            <SelectItem
                              key={p.id != null ? `product-${p.id}-${index}` : `product-${index}`}
                              value={String(p.id)}
                            >
                              {p.name}
                              {p.default_code ? ` [${p.default_code}]` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="w-full sm:w-28 space-y-1">
                    <Label className="text-xs text-muted-foreground">Qty</Label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={line.quantity}
                      onChange={(e) =>
                        updateLine(line.key, "quantity", e.target.value)
                      }
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Reference
                    </Label>
                    <Input
                      placeholder="Optional ref"
                      value={line.reference}
                      onChange={(e) =>
                        updateLine(line.key, "reference", e.target.value)
                      }
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLine(line.key)}
                    disabled={lines.length <= 1}
                    className="shrink-0 self-end text-muted-foreground hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div className="flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={createOutgoing.isPending}
              size="lg"
            >
              {createOutgoing.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <PackageMinus className="mr-2 h-4 w-4" />
                  Create Delivery
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Outgoing Pickings */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Outgoing Deliveries</CardTitle>
          <CardDescription>
            Previously created outgoing deliveries
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pickingsLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : recentPickings.length > 0 ? (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Origin</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  {canControlState && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentPickings.map((picking) => (
                  <TableRow key={picking.id}>
                    <TableCell className="font-medium">
                      {picking.name}
                    </TableCell>
                    <TableCell>{picking.partner_name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {picking.origin || "—"}
                    </TableCell>
                    <TableCell>
                      {picking.scheduled_date
                        ? new Date(picking.scheduled_date).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          picking.state === "done"
                            ? "default"
                            : picking.state === "cancel"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {picking.state || "draft"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {(picking.move_lines ?? []).reduce(
                        (sum, move) => sum + (move.quantity ?? 0),
                        0
                      ).toLocaleString()}
                    </TableCell>
                    {canControlState && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {picking.state === "draft" && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={confirmPicking.isPending}
                              onClick={() => {
                                confirmPicking.mutate(picking.id, {
                                  onSuccess: () => toast.success("Picking confirmed."),
                                  onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to confirm"),
                                });
                              }}
                            >
                              Confirm
                            </Button>
                          )}
                          {picking.state !== "draft" && picking.state !== "done" && picking.state !== "cancel" && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={validatePicking.isPending}
                              onClick={() => {
                                validatePicking.mutate(picking.id, {
                                  onSuccess: () => toast.success("Picking validated."),
                                  onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to validate"),
                                });
                              }}
                            >
                              Validate
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          ) : (
            <div className="flex h-[100px] items-center justify-center text-muted-foreground">
              No recent outgoing deliveries found
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
