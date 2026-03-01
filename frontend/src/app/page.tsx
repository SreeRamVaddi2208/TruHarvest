"use client";

import Link from "next/link";
import {
  Package,
  DollarSign,
  AlertTriangle,
  Truck,
  RefreshCw,
  PackageCheck,
  PackageX,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

import { useDashboardStats } from "@/hooks/use-api";
import type { DashboardStats } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Chart color palette
// ---------------------------------------------------------------------------
const CHART_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#a78bfa",
  "#c084fc",
  "#7c3aed",
  "#4f46e5",
  "#818cf8",
  "#a5b4fc",
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------
function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  bgColor,
  iconColor,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  bgColor: string;
  iconColor: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <div className={`rounded-xl p-3 ${bgColor}`}>
          <Icon className={`h-6 w-6 ${iconColor}`} />
        </div>
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-48" />
        <Skeleton className="mt-1 h-5 w-72" />
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[120px] w-full rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-[350px] w-full rounded-xl" />
        <Skeleton className="h-[350px] w-full rounded-xl" />
      </div>
      <Skeleton className="h-[300px] w-full rounded-xl" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------
function DashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="mx-auto max-w-lg text-center">
      <CardHeader>
        <CardTitle className="text-red-600">
          Failed to load dashboard
        </CardTitle>
        <CardDescription>
          Something went wrong while fetching dashboard data. Please try again.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={onRetry} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------
export default function DashboardPage() {
  const {
    data: statsResponse,
    isLoading: statsLoading,
    isError: statsError,
    refetch: refetchStats,
  } = useDashboardStats();



  if (statsLoading) return <DashboardSkeleton />;
  if (statsError) return <DashboardError onRetry={() => refetchStats()} />;

  const stats: DashboardStats | undefined = statsResponse?.data;
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your inventory and operations
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            refetchStats();
          }}
          className="shrink-0"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Products"
          value={formatNumber(stats?.total_products ?? 0)}
          subtitle="Active products in catalog"
          icon={Package}
          bgColor="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatCard
          title="Stock Value"
          value={formatCurrency(stats?.total_stock_value ?? 0)}
          subtitle="Total inventory valuation"
          icon={DollarSign}
          bgColor="bg-green-50"
          iconColor="text-green-600"
        />
        <StatCard
          title="Low Stock Alerts"
          value={formatNumber(
            (stats?.low_stock_count ?? 0) + (stats?.out_of_stock_count ?? 0)
          )}
          subtitle={`${stats?.out_of_stock_count ?? 0} out of stock`}
          icon={AlertTriangle}
          bgColor="bg-amber-50"
          iconColor="text-amber-600"
        />
        <StatCard
          title="Pending Shipments"
          value={formatNumber(
            (stats?.pending_incoming ?? 0) + (stats?.pending_outgoing ?? 0)
          )}
          subtitle={`${stats?.pending_incoming ?? 0} in · ${stats?.pending_outgoing ?? 0} out`}
          icon={Truck}
          bgColor="bg-purple-50"
          iconColor="text-purple-600"
        />
      </div>

      {/* Pending Incoming / Outgoing – responsive to new transfers */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <PackageCheck className="h-5 w-5 text-emerald-600" />
                Pending Incoming
              </CardTitle>
              <CardDescription>Transfers waiting to be received</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/stock/incoming">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {stats?.pending_incoming_list && stats.pending_incoming_list.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Scheduled</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.pending_incoming_list.map((p) => (
                      <TableRow key={`in-${p.id}`}>
                        <TableCell className="font-medium">{p.name || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{p.state || "—"}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.scheduled_date ? new Date(p.scheduled_date).toLocaleDateString() : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No pending incoming transfers</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <PackageX className="h-5 w-5 text-amber-600" />
                Pending Outgoing
              </CardTitle>
              <CardDescription>Transfers waiting to be delivered</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/stock/outgoing">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {stats?.pending_outgoing_list && stats.pending_outgoing_list.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Scheduled</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.pending_outgoing_list.map((p) => (
                      <TableRow key={`out-${p.id}`}>
                        <TableCell className="font-medium">{p.name || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{p.state || "—"}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.scheduled_date ? new Date(p.scheduled_date).toLocaleDateString() : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No pending outgoing transfers</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Stock by Category chart */}
        <Card>
          <CardHeader>
            <CardTitle>Stock by Category</CardTitle>
            <CardDescription>
              Quantity distribution across product categories
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.stock_by_category && stats.stock_by_category.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={stats.stock_by_category}
                  margin={{ top: 5, right: 20, left: 0, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis
                    dataKey="category"
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <RechartsTooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 4px 6px -1px rgba(0,0,0,.1)",
                    }}
                    formatter={(value: number | undefined) => [
                      formatNumber(value || 0),
                      "Quantity",
                    ]}
                  />
                  <Bar dataKey="quantity" radius={[6, 6, 0, 0]}>
                    {stats.stock_by_category.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                No category data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
            <CardDescription>Highest value products in stock</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.top_products && stats.top_products.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.top_products.map((product, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">
                          {product.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {product.sku || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(product.qty)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(product.value)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                No product data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
