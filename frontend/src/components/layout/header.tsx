"use client";

import { Bell, Search, Sun, Moon, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { useHealthStatus } from "@/hooks/use-api";
import { Badge } from "@/components/ui/badge";
import { useSidebar } from "@/components/layout/sidebar";

export function Header() {
  const { theme, setTheme } = useTheme();
  const { data: health } = useHealthStatus();
  const { setMobileOpen } = useSidebar();

  return (
    <header className="sticky top-0 z-30 flex h-14 sm:h-16 items-center gap-2 sm:gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-3 sm:px-6">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setMobileOpen(true)}
        className="h-9 w-9 lg:hidden shrink-0"
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Open menu</span>
      </Button>

      {/* Search - hidden on very small screens, compact on mobile */}
      <div className="relative flex-1 max-w-md hidden sm:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search products, invoices..."
          className="pl-9 bg-muted/50 border-0 focus-visible:ring-1"
        />
      </div>

      {/* Mobile: just show a search icon button */}
      <div className="flex-1 sm:hidden" />

      <div className="flex items-center gap-1.5 sm:gap-3 ml-auto">
        {/* Connection Status - icon only on mobile */}
        {health && (
          <>
            <Badge
              variant={health.odoo_connected ? "default" : "destructive"}
              className="text-xs hidden sm:inline-flex"
            >
              {health.odoo_connected ? "Odoo Connected" : "Odoo Disconnected"}
            </Badge>
            <div
              className={cn(
                "h-2.5 w-2.5 rounded-full sm:hidden shrink-0",
                health.odoo_connected ? "bg-green-500" : "bg-red-500"
              )}
              title={health.odoo_connected ? "Odoo Connected" : "Odoo Disconnected"}
            />
          </>
        )}

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="h-8 w-8 sm:h-9 sm:w-9"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 relative">
          <Bell className="h-4 w-4" />
          <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground flex items-center justify-center">
            3
          </span>
        </Button>
      </div>
    </header>
  );
}
