"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";

interface DatePickerProps {
  value: string; // YYYY-MM-DD or ""
  onChange: (value: string) => void;
  placeholder?: string;
  allowClear?: boolean;
  accent?: "emerald" | "violet";
  size?: "sm" | "md";
  className?: string;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function parseIso(iso: string): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplay(iso: string): string {
  const d = parseIso(iso);
  if (!d) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  allowClear = false,
  accent = "emerald",
  size = "md",
  className = "",
}: DatePickerProps) {
  const today = useMemo(() => new Date(), []);
  const todayIso = toIso(today);
  const parsed = parseIso(value);

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState((parsed ?? today).getFullYear());
  const [viewMonth, setViewMonth] = useState((parsed ?? today).getMonth());
  const [coords, setCoords] = useState<{ top?: number; bottom?: number; left: number } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      const base = parseIso(value) ?? new Date();
      setViewYear(base.getFullYear());
      setViewMonth(base.getMonth());
    }
  }, [open, value]);

  const updatePosition = useCallback(() => {
    const btn = triggerRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const popoverHeight = 328;
    const popoverWidth = 284;
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const openUpward = spaceBelow < popoverHeight && spaceAbove > spaceBelow;

    const left = Math.max(8, Math.min(rect.left, window.innerWidth - popoverWidth - 8));
    if (openUpward) {
      setCoords({ bottom: window.innerHeight - rect.top + 6, left });
    } else {
      setCoords({ top: rect.bottom + 6, left });
    }
  }, []);

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
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEsc);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDayOfMonth; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [viewYear, viewMonth]);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  const activeBg =
    accent === "violet"
      ? "bg-violet-500 text-white font-semibold shadow-sm shadow-violet-500/30"
      : "bg-emerald-500 text-zinc-950 font-semibold shadow-sm shadow-emerald-500/30";
  const ringBorder =
    accent === "violet"
      ? "border-violet-500/70 ring-2 ring-violet-500/15"
      : "border-emerald-500/70 ring-2 ring-emerald-500/15";
  const sizeClasses =
    size === "sm" ? "px-2.5 py-1.5 text-xs rounded-lg" : "px-3 py-2 text-sm rounded-xl";

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 bg-[#161a24] hover:bg-[#1c212e] border transition text-left cursor-pointer ${sizeClasses} ${
          open ? ringBorder : "border-slate-700/70 hover:border-slate-600"
        }`}
      >
        <span className="flex items-center gap-2 min-w-0 truncate">
          <CalendarIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span className={`num truncate ${value ? "text-slate-100" : "text-slate-500"}`}>
            {value ? formatDisplay(value) : placeholder}
          </span>
        </span>
        {allowClear && value && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.stopPropagation();
                onChange("");
              }
            }}
            className="p-0.5 rounded hover:bg-slate-700/80 text-slate-400 hover:text-white"
          >
            <X className="h-3 w-3" />
          </span>
        )}
      </button>

      {open &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: "fixed",
              top: coords.top,
              bottom: coords.bottom,
              left: coords.left,
              width: 284,
            }}
            className="z-[100] rounded-2xl border border-slate-700/80 bg-[#131722]/98 backdrop-blur-xl shadow-2xl shadow-black/75 p-3.5 space-y-3"
          >
            {/* Month / Year Header */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer transition"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-semibold text-white tracking-tight">
                {MONTHS[viewMonth]} <span className="num text-slate-300">{viewYear}</span>
              </span>
              <button
                type="button"
                onClick={nextMonth}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer transition"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Weekday Header */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAYS.map((w) => (
                <span key={w} className="text-[10px] font-medium uppercase text-slate-500 py-1">
                  {w}
                </span>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, idx) => {
                if (day === null) return <div key={`empty-${idx}`} />;
                const cellIso = toIso(new Date(viewYear, viewMonth, day));
                const isSelected = value === cellIso;
                const isToday = cellIso === todayIso;
                return (
                  <button
                    key={cellIso}
                    type="button"
                    onClick={() => {
                      onChange(cellIso);
                      setOpen(false);
                    }}
                    className={`num h-8 w-8 mx-auto rounded-lg text-xs flex items-center justify-center transition cursor-pointer ${
                      isSelected
                        ? activeBg
                        : isToday
                        ? "border border-emerald-500/50 text-emerald-300 hover:bg-slate-800"
                        : "text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Quick Footer */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
              <button
                type="button"
                onClick={() => {
                  onChange(todayIso);
                  setOpen(false);
                }}
                className="text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer"
              >
                Today
              </button>
              {allowClear && (
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className="text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
