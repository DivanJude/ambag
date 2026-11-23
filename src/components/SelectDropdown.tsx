"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export interface DropdownOption {
  value: string;
  label: string;
  hint?: string;
  dotColor?: string;
}

interface SelectDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
  align?: "left" | "right";
}

export default function SelectDropdown({
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled = false,
  size = "md",
  className = "",
  align = "left",
}: SelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open]);

  const sizeClasses =
    size === "sm"
      ? "px-2.5 py-1.5 text-xs rounded-lg"
      : "px-3 py-2 text-sm rounded-xl";

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-2 bg-zinc-900/90 hover:bg-zinc-800/90 border transition text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses} ${
          open
            ? "border-emerald-500/70 ring-2 ring-emerald-500/15"
            : "border-zinc-800 hover:border-zinc-700"
        }`}
      >
        <span className="flex items-center gap-2 min-w-0 truncate">
          {selected?.dotColor && (
            <span className={`h-2 w-2 rounded-full shrink-0 ${selected.dotColor}`} />
          )}
          <span className={`truncate ${selected ? "text-zinc-100" : "text-zinc-500"}`}>
            {selected ? selected.label : placeholder}
          </span>
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-zinc-400 shrink-0 transition-transform duration-150 ${
            open ? "rotate-180 text-emerald-400" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className={`absolute z-50 mt-1.5 min-w-full w-max max-w-[280px] max-h-64 overflow-y-auto rounded-xl border border-zinc-700/80 bg-[#14141a]/98 backdrop-blur-xl shadow-2xl shadow-black/60 p-1 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg text-xs transition text-left cursor-pointer ${
                  isSelected
                    ? "bg-emerald-500/15 text-emerald-200 font-medium"
                    : "text-zinc-200 hover:bg-zinc-800/80"
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  {opt.dotColor && (
                    <span className={`h-2 w-2 rounded-full shrink-0 ${opt.dotColor}`} />
                  )}
                  <span className="truncate">{opt.label}</span>
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  {opt.hint && (
                    <span className="text-[10px] text-zinc-500">{opt.hint}</span>
                  )}
                  {isSelected && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
