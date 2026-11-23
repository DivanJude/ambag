"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SelectDropdown from "./SelectDropdown";
import { ArrowLeft, Layers, Loader2, AlertCircle, UserCheck } from "lucide-react";

interface InvitePreview {
  id: string;
  name: string;
  mode: "project" | "savings";
  currency: string;
  unclaimed_seats: { id: string; display_name: string; role: string }[];
}

export default function JoinInviteClient({
  code,
  userName,
  preview,
}: {
  code: string;
  userName: string;
  preview: InvitePreview | null;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [selectedSeatId, setSelectedSeatId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    setBusy(true);
    setError(null);
    const { data, error: rpcErr } = await supabase.rpc("join_group_by_code", {
      p_code: code,
      p_claim_member_id: selectedSeatId || null,
    });
    if (rpcErr) {
      setError(rpcErr.message);
      setBusy(false);
      return;
    }
    router.push(`/groups/${data}`);
    router.refresh();
  }

  const isInvalid = !preview || preview.mode === "savings";

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="fintech-card w-full max-w-md rounded-2xl p-6 sm:p-7 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <span className="text-emerald-400 font-bold">A</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Ambag Invite</p>
              <p className="num text-[11px] text-slate-400 tracking-wider">{code}</p>
            </div>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
          </Link>
        </div>

        {isInvalid ? (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-rose-300">
              <AlertCircle className="h-4 w-4" />
              {preview?.mode === "savings"
                ? "Private Savings Goal"
                : "Invite Link Not Found"}
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {preview?.mode === "savings"
                ? "This link points to a personal savings goal, which is private and cannot be joined."
                : "This invite link is invalid or the project group has been deleted."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/12 text-emerald-300 text-[11px] font-medium">
                <Layers className="h-3 w-3" /> Project Group
              </span>
              <h1 className="text-lg font-semibold text-white">{preview.name}</h1>
              <p className="text-xs text-slate-400">
                You&apos;ve been invited to view components, order bundles, and shared balances.
              </p>
            </div>

            {preview.unclaimed_seats.length > 0 && (
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Is your name already on the roster? Claim your seat:
                </label>
                <SelectDropdown
                  value={selectedSeatId}
                  onChange={setSelectedSeatId}
                  options={[
                    { value: "", label: `Join as a new member (${userName})` },
                    ...preview.unclaimed_seats.map((seat) => ({
                      value: seat.id,
                      label: `Claim seat: ${seat.display_name}`,
                      hint: seat.role,
                    })),
                  ]}
                />
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                {error}
              </div>
            )}

            <button
              type="button"
              disabled={busy}
              onClick={handleJoin}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-semibold shadow-sm shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserCheck className="h-4 w-4" />
              )}
              Join {preview.name}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
