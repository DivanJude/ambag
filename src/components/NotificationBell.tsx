"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { GroupNotification } from "@/lib/notify";
import { Bell, CheckCheck } from "lucide-react";

interface NotificationBellProps {
  groupId: string;
  currentUserId: string;
  initialNotifications: GroupNotification[];
  initialLastReadAt: string | null;
}

function formatRelative(iso: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return "just now";
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return iso.slice(0, 10);
}

export default function NotificationBell({
  groupId,
  currentUserId,
  initialNotifications,
  initialLastReadAt,
}: NotificationBellProps) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<GroupNotification[]>(initialNotifications);
  const [lastReadAt, setLastReadAt] = useState<string | null>(initialLastReadAt);
  const [liveToast, setLiveToast] = useState<GroupNotification | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNotifications(initialNotifications);
  }, [initialNotifications]);

  // Real-time subscription for group edits
  useEffect(() => {
    const channel = supabase
      .channel(`group-notifications-${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "group_notifications",
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          const incoming = payload.new as GroupNotification;
          setNotifications((prev) => {
            if (prev.some((n) => n.id === incoming.id)) return prev;
            return [incoming, ...prev].slice(0, 40);
          });
          if (incoming.actor_user_id !== currentUserId) {
            setLiveToast(incoming);
            setTimeout(() => {
              setLiveToast((curr) => (curr?.id === incoming.id ? null : curr));
            }, 5000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, currentUserId, supabase]);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  const lastReadMs = lastReadAt ? new Date(lastReadAt).getTime() : 0;
  const unreadCount = notifications.filter(
    (n) => new Date(n.created_at).getTime() > lastReadMs
  ).length;

  async function markAllRead() {
    const nowIso = new Date().toISOString();
    setLastReadAt(nowIso);
    await supabase.from("notification_reads").upsert(
      {
        group_id: groupId,
        user_id: currentUserId,
        last_read_at: nowIso,
      },
      { onConflict: "group_id,user_id" }
    );
  }

  return (
    <>
      <div ref={rootRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          title={
            unreadCount > 0
              ? `${unreadCount} unread group notification${unreadCount === 1 ? "" : "s"}`
              : "Group Activity & Notifications"
          }
          className="relative p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="num absolute -top-2 -right-2 min-w-[20px] h-[20px] px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-none flex items-center justify-center shadow-md shadow-rose-500/40 ring-2 ring-[#0b0d12]">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-zinc-700/80 bg-[#131318]/98 backdrop-blur-xl shadow-2xl shadow-black/70 overflow-hidden z-50">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-white">Group Activity</h3>
                <p className="text-[11px] text-zinc-500">Live edits & payment updates</p>
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 cursor-pointer"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-zinc-800/60">
              {notifications.length === 0 ? (
                <div className="py-10 px-4 text-center text-xs text-zinc-500">
                  No edits recorded yet. Any component, bundle, payment, or role change will notify the group here.
                </div>
              ) : (
                notifications.map((n) => {
                  const isUnread = new Date(n.created_at).getTime() > lastReadMs;
                  return (
                    <div
                      key={n.id}
                      className={`px-4 py-3 text-xs flex items-start gap-2.5 ${
                        isUnread ? "bg-rose-500/5" : ""
                      }`}
                    >
                      <span
                        className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                          isUnread ? "bg-rose-400" : "bg-slate-700"
                        }`}
                      />
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="text-zinc-200 leading-relaxed">{n.message}</p>
                        <p className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                          <span className="font-medium text-zinc-400">{n.actor_name}</span>
                          <span>•</span>
                          <span className="num">{formatRelative(n.created_at)}</span>
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Live Toast when another teammate makes an edit */}
      {liveToast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-2xl border border-emerald-500/35 bg-[#131318]/95 backdrop-blur-xl px-4 py-3 shadow-2xl shadow-black/70 flex items-start gap-3">
          <div className="h-8 w-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Bell className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-emerald-300">Group Update</p>
            <p className="text-xs text-zinc-200 mt-0.5 leading-snug">{liveToast.message}</p>
          </div>
        </div>
      )}
    </>
  );
}
