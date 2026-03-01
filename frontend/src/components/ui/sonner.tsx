"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type ToastVariant = "default" | "success" | "error" | "warning" | "info"

interface Toast {
  id: string
  title?: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, "id">) => void
  removeToast: (id: string) => void
}

/* -------------------------------------------------------------------------- */
/*  Context                                                                   */
/* -------------------------------------------------------------------------- */

const ToastContext = React.createContext<ToastContextValue | null>(null)

function useToastContext() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) {
    throw new Error("useToastContext must be used within a <Toaster />")
  }
  return ctx
}

/* -------------------------------------------------------------------------- */
/*  Global imperative toast()                                                 */
/* -------------------------------------------------------------------------- */

let globalAddToast: ToastContextValue["addToast"] | null = null

function toast(opts: Omit<Toast, "id"> | string) {
  const payload: Omit<Toast, "id"> =
    typeof opts === "string" ? { description: opts } : opts
  if (globalAddToast) {
    globalAddToast(payload)
  } else {
    console.warn(
      "[toast] No <Toaster /> mounted. Make sure to render <Toaster /> in your layout."
    )
  }
}

toast.success = (msg: string) => toast({ description: msg, variant: "success" })
toast.error = (msg: string) => toast({ description: msg, variant: "error" })
toast.warning = (msg: string) => toast({ description: msg, variant: "warning" })
toast.info = (msg: string) => toast({ description: msg, variant: "info" })

/* -------------------------------------------------------------------------- */
/*  Variant styles                                                            */
/* -------------------------------------------------------------------------- */

const variantStyles: Record<ToastVariant, string> = {
  default:
    "border-border bg-background text-foreground",
  success:
    "border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100",
  error:
    "border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100",
  warning:
    "border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-100",
  info:
    "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100",
}

/* -------------------------------------------------------------------------- */
/*  ToastItem                                                                 */
/* -------------------------------------------------------------------------- */

function ToastItem({ toast: t, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    // Trigger enter animation
    const frame = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  React.useEffect(() => {
    const duration = t.duration ?? 4000
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 200) // wait for exit animation
    }, duration)
    return () => clearTimeout(timer)
  }, [t.duration, onDismiss])

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-auto w-full max-w-sm rounded-lg border p-4 shadow-lg transition-all duration-200",
        visible
          ? "translate-y-0 opacity-100"
          : "translate-y-2 opacity-0",
        variantStyles[t.variant ?? "default"]
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-1">
          {t.title && (
            <p className="text-sm font-semibold leading-none">{t.title}</p>
          )}
          {t.description && (
            <p className="text-sm opacity-90">{t.description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setVisible(false)
            setTimeout(onDismiss, 200)
          }}
          className="shrink-0 rounded-md p-1 opacity-50 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Dismiss"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Toaster                                                                   */
/* -------------------------------------------------------------------------- */

function Toaster({
  position = "bottom-right",
}: {
  position?:
    | "top-left"
    | "top-center"
    | "top-right"
    | "bottom-left"
    | "bottom-center"
    | "bottom-right"
}) {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const addToast = React.useCallback((t: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
    setToasts((prev) => [...prev, { ...t, id }])
  }, [])

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Register global imperative API
  React.useEffect(() => {
    globalAddToast = addToast
    return () => {
      globalAddToast = null
    }
  }, [addToast])

  const positionClasses: Record<string, string> = {
    "top-left": "top-4 left-4 items-start",
    "top-center": "top-4 left-1/2 -translate-x-1/2 items-center",
    "top-right": "top-4 right-4 items-end",
    "bottom-left": "bottom-4 left-4 items-start",
    "bottom-center": "bottom-4 left-1/2 -translate-x-1/2 items-center",
    "bottom-right": "bottom-4 right-4 items-end",
  }

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      <div
        aria-label="Notifications"
        className={cn(
          "pointer-events-none fixed z-[100] flex flex-col gap-2",
          positionClasses[position]
        )}
      >
        {toasts.map((t) => (
          <ToastItem
            key={t.id}
            toast={t}
            onDismiss={() => removeToast(t.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export { Toaster, toast, useToastContext }
export type { Toast, ToastVariant }
