"use client";

import { useEffect } from "react";
import {
  RefreshCw,
  Activity,
  CheckCircle2,
  XCircle,
  Package,
  ArrowLeftRight,
  FileText,
  Clock,
  AlertCircle,
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
import { Separator } from "@/components/ui/separator";

import {
  useHealthStatus,
  useSyncStatus,
  useTriggerSync,
} from "@/hooks/use-api";
import { toast } from "@/components/ui/sonner";

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------
function SyncSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-56" />
        <Skeleton className="mt-1 h-5 w-80" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
        <Skeleton className="h-[250px] w-full rounded-xl" />
        <Skeleton className="h-[250px] w-full rounded-xl" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function SyncStatusPage() {
  const {
    data: healthData,
    isLoading: healthLoading,
    isError: healthError,
    refetch: refetchHealth,
  } = useHealthStatus({ refetchInterval: 30_000 });

  const {
    data: syncResponse,
    isLoading: syncLoading,
    isError: syncError,
    refetch: refetchSync,
  } = useSyncStatus({ refetchInterval: 30_000 });

  const triggerSync = useTriggerSync();

  const health = healthData;
  const sync = syncResponse?.data;

  const handleTriggerSync = () => {
    triggerSync.mutate(undefined, {
      onSuccess: () => {
        toast.success("Sync triggered successfully. Data is being refreshed.");
      },
      onError: () => {
        toast.error("Failed to trigger sync. Please try again.");
      },
    });
  };

  const isLoading = healthLoading || syncLoading;

  if (isLoading) return <SyncSkeleton />;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            System Sync Status
          </h1>
          <p className="text-muted-foreground">
            Monitor connection health and synchronization status
          </p>
        </div>
        <Button
          onClick={handleTriggerSync}
          disabled={triggerSync.isPending || sync?.is_syncing}
          size="lg"
        >
          {triggerSync.isPending || sync?.is_syncing ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Syncing…
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Trigger Sync
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
        {/* Health Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Connection Health
            </CardTitle>
            <CardDescription>
              API and Odoo connection status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {healthError ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <XCircle className="h-10 w-10 text-red-500" />
                <p className="text-sm text-muted-foreground">
                  Unable to reach the API server.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchHealth()}
                >
                  <RefreshCw className="mr-2 h-3 w-3" />
                  Retry
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm font-medium">API Status</span>
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                    {health?.status ?? "unknown"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm font-medium">API Version</span>
                  <span className="text-sm text-muted-foreground">
                    {health?.version ?? "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm font-medium">Odoo Connected</span>
                  {health?.odoo_connected ? (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                      <XCircle className="mr-1 h-3 w-3" />
                      Disconnected
                    </Badge>
                  )}
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

        {/* Sync Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5" />
              Sync Information
            </CardTitle>
            <CardDescription>
              Last synchronization details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {syncError ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <XCircle className="h-10 w-10 text-red-500" />
                <p className="text-sm text-muted-foreground">
                  Unable to fetch sync status.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchSync()}
                >
                  <RefreshCw className="mr-2 h-3 w-3" />
                  Retry
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Last Sync</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {sync?.last_sync
                      ? new Date(sync.last_sync).toLocaleString()
                      : "Never"}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm font-medium">Sync Status</span>
                  {sync?.is_syncing ? (
                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                      <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                      In Progress
                    </Badge>
                  ) : (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Idle
                    </Badge>
                  )}
                </div>

                <Separator />

                {/* Sync errors */}
                {sync?.sync_errors && sync.sync_errors.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-red-600">
                      <AlertCircle className="h-4 w-4" />
                      Sync Errors
                    </div>
                    <div className="space-y-1">
                      {sync.sync_errors.map((err, i) => (
                        <div
                          key={i}
                          className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700"
                        >
                          {err}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(!sync?.sync_errors || sync.sync_errors.length === 0) && (
                  <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                    <CheckCircle2 className="h-4 w-4" />
                    No sync errors
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Auto-refresh notice */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <RefreshCw className="h-3 w-3" />
        Auto-refreshes every 30 seconds
      </div>
    </div>
  );
}
