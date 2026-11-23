"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/finance";
import { logGroupNotification } from "@/lib/notify";
import type { GroupMember, PaymentMethod } from "@/lib/types";
import SelectDropdown, { type DropdownOption } from "./SelectDropdown";
import DatePicker from "./DatePicker";
import { Loader2, Upload, X } from "lucide-react";

interface PaymentModalProps {
  groupId: string;
  currentUserId: string;
  actorName: string;
  currency: string;
  members: GroupMember[];
  myMember: GroupMember | null;
  canEdit: boolean;
  isSavings: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PaymentModal({
  groupId,
  currentUserId,
  actorName,
  currency,
  members,
  myMember,
  canEdit,
  isSavings,
  onClose,
  onSuccess,
}: PaymentModalProps) {
  const supabase = createClient();

  const [memberId, setMemberId] = useState(
    canEdit ? members[0]?.id ?? "" : myMember?.id ?? ""
  );
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("online");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const memberOptions: DropdownOption[] = members.map((m) => ({
    value: m.id,
    label: m.display_name,
    hint: m.role,
  }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const targetMemberId = canEdit ? memberId : myMember?.id;
      if (!targetMemberId) {
        throw new Error("No member profile linked to your account in this group.");
      }

      let receiptUrl: string | null = null;
      if (receiptFile) {
        const ext = receiptFile.name.split(".").pop() || "png";
        const filePath = `${currentUserId}/${groupId}-${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("receipts")
          .upload(filePath, receiptFile, { upsert: true });
        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage
          .from("receipts")
          .getPublicUrl(filePath);
        receiptUrl = urlData.publicUrl;
      }

      const status = canEdit ? "approved" : "pending";
      const numericAmount = Number(amount);

      const { error: insertErr } = await supabase.from("contributions").insert({
        group_id: groupId,
        member_id: targetMemberId,
        amount: numericAmount,
        method,
        status,
        paid_at: paidAt,
        notes: notes.trim() || null,
        receipt_url: receiptUrl,
        recorded_by: currentUserId,
        approved_by: canEdit ? currentUserId : null,
      });

      if (insertErr) throw insertErr;

      const targetMemberName =
        members.find((m) => m.id === targetMemberId)?.display_name ?? actorName;

      await logGroupNotification(supabase, {
        groupId,
        actorUserId: currentUserId,
        actorName,
        actionType: canEdit ? "payment_recorded" : "payment_submitted",
        message: canEdit
          ? `${actorName} recorded ${formatCurrency(numericAmount, currency)} (${method}) for ${targetMemberName}`
          : `${actorName} submitted a ${formatCurrency(numericAmount, currency)} (${method}) payment proof for review`,
      });

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save payment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-[#111115] p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {canEdit
                ? isSavings
                  ? "Record Deposit"
                  : "Record Payment"
                : "Submit Payment Proof"}
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              {canEdit
                ? "Immediately approved and reflected in group balances."
                : "Submitted as Pending until a Leader or Editor approves it."}
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isSavings &&
            (canEdit ? (
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Member</label>
                <SelectDropdown
                  value={memberId}
                  onChange={setMemberId}
                  options={memberOptions}
                  placeholder="Select member..."
                />
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800 text-xs text-zinc-300">
                Submitting as <strong className="text-white">{myMember?.display_name ?? "Member"}</strong>
              </div>
            ))}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Amount (₱)</label>
              <input
                type="number"
                step="0.01"
                min="1"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="500.00"
                className="num w-full px-3 py-2 rounded-xl bg-[#161a24] border border-slate-700/70 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Date</label>
              <DatePicker
                value={paidAt}
                onChange={setPaidAt}
                accent={isSavings ? "violet" : "emerald"}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Payment Method</label>
            <div className="grid grid-cols-2 gap-2">
              {(["online", "cash"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`py-2 rounded-xl border text-xs font-medium capitalize transition cursor-pointer ${
                    method === m
                      ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                      : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {m === "online" ? "Online (GCash / Bank)" : "Cash"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Receipt / Proof Screenshot {!canEdit ? "(Recommended)" : "(Optional)"}
            </label>
            <label className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/50 hover:border-emerald-500/60 text-xs text-zinc-400 cursor-pointer transition">
              <Upload className="h-4 w-4" />
              <span className="truncate">
                {receiptFile ? receiptFile.name : "Upload image (PNG, JPG, WebP)"}
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Notes (optional)</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. GCash ref #1234, partial payment"
              className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {error && <p className="text-xs text-rose-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-900 text-xs text-zinc-300 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {canEdit ? "Save Payment" : "Submit Proof"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
