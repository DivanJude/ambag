"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/finance";
import { logGroupNotification } from "@/lib/notify";
import type { Contribution, GroupMember, MemberRole } from "@/lib/types";
import SelectDropdown, { type DropdownOption } from "./SelectDropdown";
import ConfirmModal from "./ConfirmModal";
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
  AlertTriangle,
} from "lucide-react";

interface HistoryAndMembersTabProps {
  groupId: string;
  groupName: string;
  isSavings: boolean;
  inviteCode: string;
  currency: string;
  currentUserId: string;
  actorName: string;
  isLeader: boolean;
  canEdit: boolean;
  members: GroupMember[];
  contributions: Contribution[];
  onRefresh: () => void;
}

const METHOD_FILTER_OPTIONS: DropdownOption[] = [
  { value: "all", label: "All Methods" },
  { value: "online", label: "Online", dotColor: "bg-sky-400" },
  { value: "cash", label: "Cash", dotColor: "bg-emerald-400" },
];

const ROLE_OPTIONS: DropdownOption[] = [
  { value: "viewer", label: "Viewer", dotColor: "bg-zinc-500" },
  { value: "editor", label: "Editor", dotColor: "bg-sky-400" },
];

export default function HistoryAndMembersTab({
  groupId,
  groupName,
  isSavings,
  inviteCode,
  currency,
  currentUserId,
  actorName,
  isLeader,
  canEdit,
  members,
  contributions,
  onRefresh,
}: HistoryAndMembersTabProps) {
  const router = useRouter();
  const supabase = createClient();

  const [filterMember, setFilterMember] = useState("all");
  const [filterMethod, setFilterMethod] = useState("all");
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<MemberRole>("viewer");
  const [addMemberFeedback, setAddMemberFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [deleteGroupError, setDeleteGroupError] = useState<string | null>(null);
  const [confirmDeletePayment, setConfirmDeletePayment] = useState<Contribution | null>(null);
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<GroupMember | null>(null);

  async function handleDeleteGroup() {
    setDeletingGroup(true);
    setDeleteGroupError(null);
    const { error } = await supabase.from("groups").delete().eq("id", groupId);
    if (!error) {
      router.push("/");
      router.refresh();
    } else {
      setDeletingGroup(false);
      setDeleteGroupError(error.message);
    }
  }

  const memberMap = new Map(members.map((m) => [m.id, m]));
  const memberFilterOptions: DropdownOption[] = [
    { value: "all", label: "All Members" },
    ...members.map((m) => ({ value: m.id, label: m.display_name })),
  ];

  const pendingProofs = contributions.filter((c) => c.status === "pending");
  const approvedHistory = contributions.filter((c) => {
    if (c.status !== "approved") return false;
    if (filterMember !== "all" && c.member_id !== filterMember) return false;
    if (filterMethod !== "all" && c.method !== filterMethod) return false;
    return true;
  });

  async function handleApprove(p: Contribution) {
    setBusyId(p.id);
    const memName = memberMap.get(p.member_id)?.display_name ?? "Member";
    await supabase
      .from("contributions")
      .update({ status: "approved", approved_by: currentUserId })
      .eq("id", p.id);
    await logGroupNotification(supabase, {
      groupId,
      actorUserId: currentUserId,
      actorName,
      actionType: "payment_approved",
      message: `${actorName} approved ${memName}'s ${formatCurrency(p.amount, currency)} (${p.method}) payment`,
    });
    setBusyId(null);
    onRefresh();
  }

  async function handleReject(p: Contribution) {
    setBusyId(p.id);
    const memName = memberMap.get(p.member_id)?.display_name ?? "Member";
    await supabase
      .from("contributions")
      .update({ status: "rejected", approved_by: currentUserId })
      .eq("id", p.id);
    await logGroupNotification(supabase, {
      groupId,
      actorUserId: currentUserId,
      actorName,
      actionType: "payment_rejected",
      message: `${actorName} rejected ${memName}'s ${formatCurrency(p.amount, currency)} payment proof`,
    });
    setBusyId(null);
    onRefresh();
  }

  async function executeDeleteContribution() {
    if (!confirmDeletePayment) return;
    const p = confirmDeletePayment;
    setBusyId(p.id);
    const memName = memberMap.get(p.member_id)?.display_name ?? "Member";
    await supabase.from("contributions").delete().eq("id", p.id);
    await logGroupNotification(supabase, {
      groupId,
      actorUserId: currentUserId,
      actorName,
      actionType: "payment_deleted",
      message: `${actorName} deleted a ${formatCurrency(p.amount, currency)} payment entry for ${memName}`,
    });
    setBusyId(null);
    setConfirmDeletePayment(null);
    onRefresh();
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    const cleanName = newMemberName.trim();
    const cleanEmail = newMemberEmail.trim();
    if (!cleanName && !cleanEmail) return;

    setBusyId("add-member");
    setAddMemberFeedback(null);

    const { data, error: rpcErr } = await supabase.rpc("add_group_member", {
      p_group_id: groupId,
      p_display_name: cleanName || null,
      p_email: cleanEmail || null,
      p_role: newMemberRole === "editor" ? "editor" : "viewer",
    });

    if (rpcErr) {
      setAddMemberFeedback({ type: "error", text: rpcErr.message });
      setBusyId(null);
      return;
    }

    const res = data as { display_name: string; email: string | null; linked: boolean };
    await logGroupNotification(supabase, {
      groupId,
      actorUserId: currentUserId,
      actorName,
      actionType: "member_added",
      message: `${actorName} added ${res.display_name}${res.email ? ` (${res.email})` : ""} as ${newMemberRole}`,
    });

    setAddMemberFeedback({
      type: "success",
      text: res.linked
        ? `Added ${res.display_name} — automatically linked to their existing Ambag account!`
        : res.email
          ? `Added ${res.display_name} — will auto-link when ${res.email} signs in.`
          : `Added ${res.display_name} as an unclaimed seat.`,
    });

    setNewMemberName("");
    setNewMemberEmail("");
    setNewMemberRole("viewer");
    setBusyId(null);
    onRefresh();
  }

  async function handleRoleChange(member: GroupMember, newRole: MemberRole) {
    if (!isLeader || member.role === "leader" || member.role === newRole) return;
    setBusyId(member.id);
    await supabase.from("group_members").update({ role: newRole }).eq("id", member.id);
    await logGroupNotification(supabase, {
      groupId,
      actorUserId: currentUserId,
      actorName,
      actionType: "role_updated",
      message: `${actorName} changed ${member.display_name}'s role to ${newRole}`,
    });
    setBusyId(null);
    onRefresh();
  }

  async function executeRemoveMember() {
    if (!isLeader || !confirmRemoveMember || confirmRemoveMember.role === "leader") return;
    const member = confirmRemoveMember;
    setBusyId(member.id);
    await supabase.from("group_members").delete().eq("id", member.id);
    await logGroupNotification(supabase, {
      groupId,
      actorUserId: currentUserId,
      actorName,
      actionType: "member_removed",
      message: `${actorName} removed ${member.display_name} from the group`,
    });
    setBusyId(null);
    setConfirmRemoveMember(null);
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
                        <span className="num">{p.paid_at}</span> {p.notes ? `• ${p.notes}` : ""}
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
                          onClick={() => handleApprove(p)}
                          disabled={busyId === p.id}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold cursor-pointer"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => handleReject(p)}
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
            <h3 className="text-sm font-semibold text-white">
              {isSavings ? "Deposit History" : "Payment History"}
            </h3>
            <div className="flex items-center gap-2">
              {!isSavings && (
                <SelectDropdown
                  size="sm"
                  align="right"
                  value={filterMember}
                  onChange={setFilterMember}
                  options={memberFilterOptions}
                  className="w-36"
                />
              )}
              <SelectDropdown
                size="sm"
                align="right"
                value={filterMethod}
                onChange={setFilterMethod}
                options={METHOD_FILTER_OPTIONS}
                className="w-32"
              />
            </div>
          </div>

          <div className="fintech-card rounded-2xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800/80 bg-zinc-950/40 text-[11px] uppercase tracking-wider text-zinc-500">
                  <th className="py-3 px-4 font-medium">Date</th>
                  <th className="py-3 px-4 font-medium">Member</th>
                  <th className="py-3 px-4 font-medium">Method</th>
                  <th className="py-3 px-4 font-medium text-right">Amount</th>
                  <th className="py-3 px-4 font-medium">Proof / Notes</th>
                  {canEdit && <th className="py-3 px-4 text-right" />}
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
                      <td className="num py-3 px-4 text-zinc-400 whitespace-nowrap">{p.paid_at}</td>
                      <td className="py-3 px-4 font-medium text-zinc-100">
                        {memberMap.get(p.member_id)?.display_name ?? "Member"}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] capitalize ${p.method === "online"
                            ? "bg-sky-500/15 text-sky-300"
                            : "bg-emerald-500/15 text-emerald-300"
                            }`}
                        >
                          {p.method}
                        </span>
                      </td>
                      <td className="num py-3 px-4 text-right font-semibold text-zinc-100 whitespace-nowrap">
                        {formatCurrency(p.amount, currency)}
                      </td>
                      <td className="py-3 px-4 text-zinc-400">
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
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setConfirmDeletePayment(p)}
                            disabled={busyId === p.id}
                            title="Delete payment entry"
                            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-rose-400 cursor-pointer"
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

      {/* Right Column: Invite Code + Members & Roles (Project only) + Danger Zone */}
      <div className="space-y-4">
        {!isSavings && (
          <>
            <div className="fintech-card rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white">Group Invite Code</h3>
              <p className="text-xs text-slate-400">
                Share this code with teammates so they can join or claim their seat.
              </p>
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="num text-base font-semibold tracking-widest text-emerald-400">
                  {inviteCode}
                </span>
                <button
                  onClick={copyCode}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <div className="fintech-card rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <Shield className="h-4 w-4 text-emerald-400" /> Members & Roles
                </h3>
                <span className="text-xs text-slate-500 tnum">{members.length} total</span>
              </div>

              <div className="space-y-2.5">
                {members.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-white truncate">
                          {m.display_name}
                        </span>
                        {!m.user_id && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                            Unclaimed
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        {m.email ?? "Waiting for teammate to join"}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {m.role === "leader" ? (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-medium text-emerald-300">
                          Leader
                        </span>
                      ) : isLeader ? (
                        <>
                          <SelectDropdown
                            size="sm"
                            align="right"
                            value={m.role}
                            disabled={busyId === m.id}
                            onChange={(v) => handleRoleChange(m, v as MemberRole)}
                            options={ROLE_OPTIONS}
                            className="w-24"
                          />
                          <button
                            onClick={() => setConfirmRemoveMember(m)}
                            disabled={busyId === m.id}
                            title="Remove member"
                            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-rose-400 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <span className="px-2 py-1 rounded-lg bg-slate-800 text-[11px] capitalize text-slate-300">
                          {m.role}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {isLeader && (
                <form onSubmit={handleAddMember} className="space-y-2.5 pt-2 border-t border-slate-800/80">
                  <p className="text-[11px] font-medium text-slate-400">
                    Add Member (by name, email, or both)
                  </p>
                  <div className="space-y-2">
                    <input
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      placeholder="Display name (e.g. Leonard)"
                      className="w-full px-3 py-1.5 rounded-lg bg-[#161a24] border border-slate-700/70 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                    <input
                      type="email"
                      value={newMemberEmail}
                      onChange={(e) => setNewMemberEmail(e.target.value)}
                      placeholder="Email (auto-links account, e.g. leonard@gmail.com)"
                      className="w-full px-3 py-1.5 rounded-lg bg-[#161a24] border border-slate-700/70 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                    <div className="flex items-center gap-2">
                      <SelectDropdown
                        size="sm"
                        value={newMemberRole}
                        onChange={(v) => setNewMemberRole(v as MemberRole)}
                        options={ROLE_OPTIONS}
                        className="w-28"
                      />
                      <button
                        type="submit"
                        disabled={busyId === "add-member" || (!newMemberName.trim() && !newMemberEmail.trim())}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold cursor-pointer disabled:opacity-50 transition"
                      >
                        <UserPlus className="h-3.5 w-3.5" /> Add Member
                      </button>
                    </div>
                  </div>
                  {addMemberFeedback && (
                    <p
                      className={`text-[11px] leading-snug ${addMemberFeedback.type === "error"
                        ? "text-rose-400"
                        : "text-emerald-300"
                        }`}
                    >
                      {addMemberFeedback.text}
                    </p>
                  )}
                </form>
              )}
            </div>
          </>
        )}

        {/* Danger Zone — Leader / Owner can permanently delete */}
        {isLeader && (
          <div className="rounded-2xl border border-rose-500/25 bg-rose-500/5 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-rose-300 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" /> Danger Zone
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Permanently delete <strong className="text-slate-200">{groupName}</strong> and all associated{" "}
              {isSavings ? "deposit records" : "components, bundles, and payment records"}.
            </p>
            <button
              type="button"
              onClick={() => {
                setDeleteGroupError(null);
                setShowDeleteConfirm(true);
              }}
              className="w-full flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-xs font-semibold text-rose-300 transition cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete {isSavings ? "Savings Goal" : "Project Group"}
            </button>
          </div>
        )}
      </div>

      {/* Custom Remove Payment Modal */}
      <ConfirmModal
        open={!!confirmDeletePayment}
        title={isSavings ? "Delete Deposit?" : "Delete Payment Entry?"}
        description={
          <>
            Remove{" "}
            <strong className="num text-white">
              {confirmDeletePayment ? formatCurrency(confirmDeletePayment.amount, currency) : ""}
            </strong>{" "}
            ({confirmDeletePayment?.method}) for{" "}
            <strong className="text-white">
              {confirmDeletePayment
                ? memberMap.get(confirmDeletePayment.member_id)?.display_name ?? "Member"
                : ""}
            </strong>
            ? Balances will recalculate immediately.
          </>
        }
        confirmLabel="Delete Entry"
        loading={!!confirmDeletePayment && busyId === confirmDeletePayment.id}
        onCancel={() => setConfirmDeletePayment(null)}
        onConfirm={executeDeleteContribution}
      />

      {/* Custom Remove Member Modal */}
      <ConfirmModal
        open={!!confirmRemoveMember}
        title="Remove Member?"
        description={
          <>
            Remove <strong className="text-white">{confirmRemoveMember?.display_name}</strong> from{" "}
            <strong className="text-white">{groupName}</strong>? Their access and associated payment entries in this group will be removed.
          </>
        }
        confirmLabel="Remove Member"
        loading={!!confirmRemoveMember && busyId === confirmRemoveMember.id}
        onCancel={() => setConfirmRemoveMember(null)}
        onConfirm={executeRemoveMember}
      />

      {/* Custom Delete Group / Savings Goal Modal */}
      <ConfirmModal
        open={showDeleteConfirm}
        title={`Delete ${isSavings ? "Savings Goal" : "Project Group"}?`}
        description={
          <>
            This will permanently delete <strong className="text-white">{groupName}</strong> along with all{" "}
            {isSavings ? "deposits" : "components, order bundles, and payment history"}. This action cannot be undone.
          </>
        }
        confirmLabel="Delete Permanently"
        loading={deletingGroup}
        error={deleteGroupError}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteGroup}
      />
    </div>
  );
}
