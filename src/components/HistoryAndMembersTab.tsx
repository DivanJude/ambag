"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/finance";
import type { Contribution, GroupMember, MemberRole } from "@/lib/types";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  UserPlus,
  ExternalLink,
  Copy,
  Check,
  Trash2,
} from "lucide-react";

interface HistoryAndMembersTabProps {
  groupId: string;
  inviteCode: string;
  currency: string;
  currentUserId: string;
  isLeader: boolean;
  canEdit: boolean;
  members: GroupMember[];
  contributions: Contribution[];
  onRefresh: () => void;
}

export default function HistoryAndMembersTab({
  groupId,
  inviteCode,
  currency,
  currentUserId,
  isLeader,
  canEdit,
  members,
  contributions,
  onRefresh,
}: HistoryAndMembersTabProps) {
  const supabase = createClient();

  const [filterMember, setFilterMember] = useState("all");
  const [filterMethod, setFilterMethod] = useState("all");
  const [newMemberName, setNewMemberName] = useState("");
  const [copied, setCopied] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const memberMap = new Map(members.map((m) => [m.id, m]));
  const pendingProofs = contributions.filter((c) => c.status === "pending");
  const approvedHistory = contributions.filter((c) => {
    if (c.status !== "approved") return false;
    if (filterMember !== "all" && c.member_id !== filterMember) return false;
    if (filterMethod !== "all" && c.method !== filterMethod) return false;
    return true;
  });

  async function handleApprove(id: string) {
    setBusyId(id);
    await supabase
      .from("contributions")
      .update({ status: "approved", approved_by: currentUserId })
      .eq("id", id);
    setBusyId(null);
    onRefresh();
  }

  async function handleReject(id: string) {
    setBusyId(id);
    await supabase
      .from("contributions")
      .update({ status: "rejected", approved_by: currentUserId })
      .eq("id", id);
    setBusyId(null);
    onRefresh();
  }

  async function handleDeleteContribution(id: string) {
    if (!confirm("Delete this payment entry?")) return;
    setBusyId(id);
    await supabase.from("contributions").delete().eq("id", id);
    setBusyId(null);
    onRefresh();
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    setBusyId("add-member");
    await supabase.from("group_members").insert({
      group_id: groupId,
      display_name: newMemberName.trim(),
      role: "viewer",
    });
    setNewMemberName("");
    setBusyId(null);
    onRefresh();
  }

  async function handleRoleChange(member: GroupMember, newRole: MemberRole) {
    if (!isLeader || member.role === "leader") return;
    setBusyId(member.id);
    await supabase.from("group_members").update({ role: newRole }).eq("id", member.id);
    setBusyId(null);
    onRefresh();
  }

  async function handleRemoveMember(member: GroupMember) {
    if (!isLeader || member.role === "leader") return;
    if (!confirm(`Remove ${member.display_name} from this group?`)) return;
    setBusyId(member.id);
    await supabase.from("group_members").delete().eq("id", member.id);
    setBusyId(null);
    onRefresh();
  }

  function copyCode() {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left 2 Columns: Pending Proofs + Payment History */}
      <div className="lg:col-span-2 space-y-6">
        {/* Pending Payment Proofs Queue */}
        {pendingProofs.length > 0 && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-amber-300 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Pending Payment Proofs ({pendingProofs.length})
              </h3>
              <span className="text-[11px] text-amber-200/70">
                {canEdit ? "Review & approve to count toward balances" : "Awaiting Leader/Editor approval"}
              </span>
            </div>

            <div className="space-y-2.5">
              {pendingProofs.map((p) => {
                const mem = memberMap.get(p.member_id);
                return (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-xl bg-[#121216] border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">
                          {mem?.display_name ?? "Member"}
                        </span>
                        <span className="num text-xs font-semibold text-amber-300">
                          {formatCurrency(p.amount, currency)}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-zinc-800 text-[11px] capitalize text-zinc-300">
                          {p.method}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400">
                        {p.paid_at} {p.notes ? `• ${p.notes}` : ""}
                      </p>
                      {p.receipt_url && (
                        <a
                          href={p.receipt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline pt-1"
                        >
                          View Receipt Proof <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>

                    {canEdit && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApprove(p.id)}
                          disabled={busyId === p.id}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold cursor-pointer"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => handleReject(p.id)}
                          disabled={busyId === p.id}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-rose-500/20 border border-zinc-700 hover:border-rose-500/40 text-xs text-zinc-300 hover:text-rose-300 cursor-pointer"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Approved Payment History Ledger */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">Payment History</h3>
            <div className="flex items-center gap-2">
              <select
                value={filterMember}
                onChange={(e) => setFilterMember(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200"
              >
                <option value="all">All Members</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name}
                  </option>
                ))}
              </select>
              <select
                value={filterMethod}
                onChange={(e) => setFilterMethod(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200"
              >
                <option value="all">All Methods</option>
                <option value="online">Online</option>
                <option value="cash">Cash</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800/90 bg-[#121216] overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500">
                  <th className="py-2.5 px-3.5">Date</th>
                  <th className="py-2.5 px-3.5">Member</th>
                  <th className="py-2.5 px-3.5">Method</th>
                  <th className="py-2.5 px-3.5 text-right">Amount</th>
                  <th className="py-2.5 px-3.5">Proof / Notes</th>
                  {canEdit && <th className="py-2.5 px-3.5 text-right" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {approvedHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-zinc-500">
                      No approved payments recorded yet.
                    </td>
                  </tr>
                ) : (
                  approvedHistory.map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-900/50">
                      <td className="num py-3 px-3.5 text-zinc-400 whitespace-nowrap">{p.paid_at}</td>
                      <td className="py-3 px-3.5 font-medium text-zinc-100">
                        {memberMap.get(p.member_id)?.display_name ?? "Member"}
                      </td>
                      <td className="py-3 px-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] capitalize ${
                            p.method === "online"
                              ? "bg-sky-500/15 text-sky-300"
                              : "bg-emerald-500/15 text-emerald-300"
                          }`}
                        >
                          {p.method}
                        </span>
                      </td>
                      <td className="num py-3 px-3.5 text-right font-semibold text-zinc-100 whitespace-nowrap">
                        {formatCurrency(p.amount, currency)}
                      </td>
                      <td className="py-3 px-3.5 text-zinc-400">
                        <div className="flex items-center gap-2">
                          {p.receipt_url && (
                            <a
                              href={p.receipt_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-400 hover:underline inline-flex items-center gap-0.5"
                            >
                              Receipt <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {p.notes && <span className="truncate max-w-[160px]">{p.notes}</span>}
                        </div>
                      </td>
                      {canEdit && (
                        <td className="py-3 px-3.5 text-right">
                          <button
                            onClick={() => handleDeleteContribution(p.id)}
                            disabled={busyId === p.id}
                            className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-rose-400 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Right Column: Invite Code + Members & Roles */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-zinc-800 bg-[#121216] p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white">Group Invite Code</h3>
          <p className="text-xs text-zinc-400">
            Share this code with teammates so they can join or claim their seat.
          </p>
          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800">
            <span className="num text-base font-semibold tracking-widest text-emerald-400">
              {inviteCode}
            </span>
            <button
              onClick={copyCode}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 cursor-pointer"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-[#121216] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-emerald-400" /> Members & Roles
            </h3>
            <span className="text-xs text-zinc-500">{members.length} total</span>
          </div>

          <div className="space-y-2.5">
            {members.map((m) => (
              <div
                key={m.id}
                className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800/80 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-white truncate">
                      {m.display_name}
                    </span>
                    {!m.user_id && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                        Unclaimed
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 truncate">
                    {m.email ?? "Waiting for teammate to join"}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {m.role === "leader" ? (
                    <span className="px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-medium text-emerald-300">
                      Leader
                    </span>
                  ) : isLeader ? (
                    <>
                      <select
                        value={m.role}
                        disabled={busyId === m.id}
                        onChange={(e) => handleRoleChange(m, e.target.value as MemberRole)}
                        className="px-2 py-1 rounded-lg bg-zinc-950 border border-zinc-700 text-[11px] text-zinc-200 cursor-pointer"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                      </select>
                      <button
                        onClick={() => handleRemoveMember(m)}
                        disabled={busyId === m.id}
                        title="Remove member"
                        className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-rose-400 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <span className="px-2 py-1 rounded-lg bg-zinc-800 text-[11px] capitalize text-zinc-300">
                      {m.role}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {isLeader && (
            <form onSubmit={handleAddMember} className="flex gap-2 pt-1">
              <input
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                placeholder="Pre-add member name..."
                className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={busyId === "add-member"}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white cursor-pointer"
              >
                <UserPlus className="h-3.5 w-3.5" /> Add
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
