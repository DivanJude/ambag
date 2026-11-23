"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useLockBodyScroll } from "@/lib/useLockBodyScroll";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning";
  loading?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  variant = "danger",
  loading = false,
  error = null,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, loading, onCancel]);

  if (!open || typeof document === "undefined") return null;

  const isWarning = variant === "warning";

  return createPortal(
    <div
      onClick={() => !loading && onCancel()}
      className="fixed inset-0 z-[110] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overscroll-contain"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        className={`w-full max-w-md rounded-2xl border bg-[#121621] p-6 space-y-5 shadow-2xl shadow-black/80 ${
          isWarning ? "border-amber-500/30" : "border-rose-500/30"
        }`}
      >
        <div className="flex items-start gap-3.5">
          <div
            className={`h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 ${
              isWarning
                ? "bg-amber-500/12 border-amber-500/30 text-amber-400"
                : "bg-rose-500/12 border-rose-500/30 text-rose-400"
            }`}
          >
            {isWarning ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <Trash2 className="h-5 w-5" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-base font-semibold text-white leading-snug">
                {title}
              </h2>
              <button
                type="button"
                disabled={loading}
                onClick={onCancel}
                className="text-slate-400 hover:text-white cursor-pointer disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              {description}
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-xs font-medium text-slate-200 transition cursor-pointer disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50 ${
              isWarning
                ? "bg-amber-500 hover:bg-amber-400 text-zinc-950"
                : "bg-rose-500 hover:bg-rose-400 text-white shadow-sm shadow-rose-500/25"
            }`}
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
