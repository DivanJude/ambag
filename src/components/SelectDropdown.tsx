"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

interface MenuCoords {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  minWidth: number;
  maxHeight: number;
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
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const updatePosition = useCallback(() => {
    const btn = triggerRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const estimatedHeight = Math.min(options.length * 36 + 12, 260);
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const openUpward = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

    const next: MenuCoords = {
      minWidth: Math.max(rect.width, 160),
      maxHeight: Math.max(120, Math.min(260, openUpward ? spaceAbove : spaceBelow)),
    };

    if (openUpward) {
      next.bottom = window.innerHeight - rect.top + 6;
    } else {
      next.top = rect.bottom + 6;
    }

    if (align === "right") {
      next.right = Math.max(8, window.innerWidth - rect.right);
    } else {
      next.left = Math.max(8, Math.min(rect.left, window.innerWidth - Math.max(rect.width, 200) - 8));
    }

    setCoords(next);
  }, [align, options.length]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function handleReposition() {
      updatePosition();
    }

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEsc);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [open, updatePosition]);

  const sizeClasses =
    size === "sm"
      ? "px-2.5 py-1.5 text-xs rounded-lg"
      : "px-3 py-2 text-sm rounded-xl";

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-2 bg-[#161a24] hover:bg-[#1c212e] border transition text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses} ${
          open
            ? "border-emerald-500/70 ring-2 ring-emerald-500/15"
            : "border-slate-700/70 hover:border-slate-600"
        }`}
      >
        <span className="flex items-center gap-2 min-w-0 truncate">
          {selected?.dotColor && (
            <span className={`h-2 w-2 rounded-full shrink-0 ${selected.dotColor}`} />
          )}
          <span className={`truncate ${selected ? "text-slate-100" : "text-slate-500"}`}>
            {selected ? selected.label : placeholder}
          </span>
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${
            open ? "rotate-180 text-emerald-400" : ""
          }`}
        />
      </button>

      {open &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            style={{
              position: "fixed",
              top: coords.top,
              bottom: coords.bottom,
              left: coords.left,
              right: coords.right,
              minWidth: coords.minWidth,
              maxHeight: coords.maxHeight,
            }}
            className="z-[100] w-max max-w-[300px] overflow-y-auto rounded-xl border border-slate-700/80 bg-[#141822]/98 backdrop-blur-xl shadow-2xl shadow-black/70 p-1"
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
                      : "text-slate-200 hover:bg-slate-800/80"
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
                      <span className="text-[10px] text-slate-500">{opt.hint}</span>
                    )}
                    {isSelected && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                  </span>
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}
