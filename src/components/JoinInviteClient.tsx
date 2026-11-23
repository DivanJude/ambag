"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { GroupMode, MemberRole } from "@/lib/types";
import SelectDropdown from "./SelectDropdown";
import { ArrowLeft, Layers, Loader2, UserCheck } from "lucide-react";

export interface InvitePreview {
  id: string;
  name: string;
  mode: GroupMode;
  currency: string;
  unclaimed_seats: { id: string; display_name: string; role: MemberRole }[];
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

  const isInvalid = !preview || preview.mode === "savings";

  async function handleJoin() {
    if (!preview) return;
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

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="fintech-card w-full max-w-md rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <Layers className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-white">Project Invitation</h1>
              <p className="text-[11px] text-slate-400">
                Code: <span className="num text-emerald-300">{code}</span>
              </p>
            </div>
          </div>
          <Link
            href="/"
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>

        {isInvalid ? (
          <div className="space-y-4">
            <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3.5">
              This invite link is invalid or belongs to a private personal savings goal.
            </p>
            <Link
              href="/"
              className="block w-full text-center px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition"
            >
              Back to Workspace
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <p className="text-[11px] uppercase tracking-wider text-slate-400">
                You&apos;re invited to join
              </p>
              <p className="text-lg font-semibold text-white mt-0.5">{preview.name}</p>
            </div>

            {preview.unclaimed_seats.length > 0 && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-300">
                  Is your name already listed? Claim your seat:
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

            {error && <p className="text-xs text-rose-400">{error}</p>}

            <button
              type="button"
              disabled={busy}
              onClick={handleJoin}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold cursor-pointer disabled:opacity-50 transition"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserCheck className="h-4 w-4" />
              )}
              Join Project Group
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
