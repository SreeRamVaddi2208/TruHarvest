"use client";

import {
  Settings,
  Server,
  Globe,
  Info,
  Warehouse,
  RefreshCw,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";

import { useHealthStatus, useSetupTruHarvestWarehouse } from "@/hooks/use-api";

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function SettingsPage() {
  const { data: health, isLoading } = useHealthStatus();
  const setupWarehouse = useSetupTruHarvestWarehouse();

  const handleSetupWarehouse = async () => {
    try {
      const res = await setupWarehouse.mutateAsync();
      const data = res?.data;
      const msg = data?.message ?? (data?.created ? "Warehouse created in Odoo." : "Warehouse already exists.");
      toast.success(msg);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to set up warehouse in Odoo.";
      toast.error(message);
    }
  };

  const apiUrl =
    typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      : "http://localhost:8000";

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Application configuration and system information
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
        {/* Connection Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Connection Configuration
            </CardTitle>
            <CardDescription>
              API endpoint and connection details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm font-medium">API Base URL</span>
              <code className="rounded-md bg-muted px-2 py-1 text-xs font-mono">
                {apiUrl}
              </code>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm font-medium">Environment</span>
              <Badge variant="secondary">
                {process.env.NODE_ENV ?? "development"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* System Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              System Information
            </CardTitle>
            <CardDescription>
              Backend API and integration details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <>
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </>
            ) : (
              <>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm font-medium">API Version</span>
                  <span className="text-sm text-muted-foreground">
                    {health?.version ?? "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm font-medium">API Status</span>
                  <Badge
                    className={
                      health?.status === "healthy"
                        ? "bg-green-100 text-green-700 hover:bg-green-100"
                        : "bg-red-100 text-red-700 hover:bg-red-100"
                    }
                  >
                    {health?.status ?? "unknown"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm font-medium">Odoo Connected</span>
                  <Badge
                    className={
                      health?.odoo_connected
                        ? "bg-green-100 text-green-700 hover:bg-green-100"
                        : "bg-red-100 text-red-700 hover:bg-red-100"
                    }
                  >
                    {health?.odoo_connected ? "Yes" : "No"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm font-medium">Odoo Version</span>
                  <span className="text-sm text-muted-foreground">
                    {health?.odoo_version ?? "—"}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Odoo warehouse setup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Warehouse className="h-5 w-5" />
            TruHarvest warehouse in Odoo
          </CardTitle>
          <CardDescription>
            If you see &quot;No stock locations found for company_id (TruHarvest)&quot;, create the
            warehouse and locations in Odoo from here. Requires controller or admin role.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleSetupWarehouse}
            disabled={setupWarehouse.isPending}
          >
            {setupWarehouse.isPending ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Warehouse className="mr-2 h-4 w-4" />
            )}
            {setupWarehouse.isPending ? "Setting up…" : "Set up TruHarvest warehouse in Odoo"}
          </Button>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            About TruHarvest
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">
            TruHarvest is an Odoo-integrated Inventory Management System
            designed to streamline your warehouse operations. It provides
            real-time stock tracking, automated synchronization with Odoo ERP,
            and comprehensive reporting tools to keep your business running
            smoothly.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
