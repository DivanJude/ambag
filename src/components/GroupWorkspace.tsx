"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { computeGroupFinancials, formatCurrency, getComponentTotal } from "@/lib/finance";
import type {
  ComponentItem,
  Contribution,
  Group,
  GroupMember,
  OrderBundle,
} from "@/lib/types";
import ComponentsTab from "./ComponentsTab";
import HistoryAndMembersTab from "./HistoryAndMembersTab";
import PaymentModal from "./PaymentModal";
import {
  ArrowLeft,
  Wallet,
  Layers,
  History,
  Plus,
  Download,
  PiggyBank,
  Calendar,
  AlertCircle,
  Clock,
  CheckCircle2,
  Copy,
  Check,
} from "lucide-react";

interface GroupWorkspaceProps {
  currentUserId: string;
  myMember: GroupMember | null;
  initialGroup: Group;
  initialMembers: GroupMember[];
  initialComponents: ComponentItem[];
  initialBundles: OrderBundle[];
  initialContributions: Contribution[];
}

export default function GroupWorkspace({
  currentUserId,
  myMember,
  initialGroup,
  initialMembers,
  initialComponents,
  initialBundles,
  initialContributions,
}: GroupWorkspaceProps) {
  const router = useRouter();
  const supabase = createClient();

  const [tab, setTab] = useState<"overview" | "components" | "history">("overview");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalAmount, setGoalAmount] = useState(String(initialGroup.target_amount));
  const [goalDate, setGoalDate] = useState(initialGroup.target_date ?? "");

  const isSavings = initialGroup.mode === "savings";
  const isLeader = myMember?.role === "leader";
  const canEdit = myMember?.role === "leader" || myMember?.role === "editor";

  const financials = useMemo(
    () =>
      computeGroupFinancials(
        initialGroup,
        initialMembers,
        initialComponents,
        initialBundles,
        initialContributions
      ),
    [initialGroup, initialMembers, initialComponents, initialBundles, initialContributions]
  );

  // Suggested weekly pace for Savings Goal mode
  const weeklyPace = useMemo(() => {
    if (!isSavings || !initialGroup.target_date || financials.remainingToCollect <= 0) return null;
    const msLeft = new Date(initialGroup.target_date).getTime() - Date.now();
    const weeksLeft = Math.max(1, Math.ceil(msLeft / (1000 * 60 * 60 * 24 * 7)));
    return {
      weeksLeft,
      perWeek: Math.ceil(financials.remainingToCollect / weeksLeft),
    };
  }, [isSavings, initialGroup.target_date, financials.remainingToCollect]);

  function refresh() {
    router.refresh();
  }

  function copyInviteCode() {
    navigator.clipboard.writeText(initialGroup.invite_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  }

  async function handleUpdateGoal(e: React.FormEvent) {
    e.preventDefault();
    await supabase
      .from("groups")
      .update({
        target_amount: Number(goalAmount) || 0,
        target_date: goalDate || null,
      })
      .eq("id", initialGroup.id);
    setEditingGoal(false);
    refresh();
  }

  function handleExportCsv() {
    const rows: string[][] = [
      ["AMBAG LIQUIDATION SUMMARY", initialGroup.name],
      ["Total Project / Goal Cost", String(financials.totalProjectCost)],
      ["Total Contributions", String(financials.totalContributions)],
      ["Remaining to Collect", String(financials.remainingToCollect)],
      ["Online Available Balance", String(financials.onlineAvailableBalance)],
      ["Cash Available Balance", String(financials.cashAvailableBalance)],
      [],
      ["MEMBER BALANCES"],
      ["Name", "Role", "Individual Bill", "Online Paid", "Cash Paid", "Total Paid", "Balance Due"],
      ...financials.memberSummaries.map((s) => [
        s.member.display_name,
        s.member.role,
        String(s.individualBill),
        String(s.onlinePaid),
        String(s.cashPaid),
        String(s.totalPaid),
        String(s.balanceDue),
      ]),
    ];

    if (!isSavings) {
      rows.push(
        [],
        ["ORDER BUNDLES"],
        ["Title", "Shop", "Items Subtotal", "Actual Total", "Delivery", "Payment Status"],
        ...initialBundles.map((b) => [
          b.title,
          b.shop_name ?? "",
          String(b.items_subtotal),
          String(b.actual_total),
          b.delivery_status,
          b.payment_status,
        ]),
        [],
        ["STANDALONE SELECTED COMPONENTS"],
        ["Category", "Component", "Qty", "Unit Price", "Total", "Delivery", "Payment Status"],
        ...initialComponents
          .filter((c) => c.selected && !c.bundle_id)
          .map((c) => [
            c.category,
            c.name,
            String(c.quantity),
            String(c.unit_price),
            String(getComponentTotal(c)),
            c.delivery_status,
            c.payment_status,
          ])
      );
    }

    const csv = rows
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${initialGroup.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-liquidation.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-[#09090b] pb-16">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-[#09090b]/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition"
              title="Back to My Groups"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold text-white truncate">
                  {initialGroup.name}
                </h1>
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${
                    isSavings
                      ? "bg-violet-500/15 text-violet-300"
                      : "bg-emerald-500/15 text-emerald-300"
                  }`}
                >
                  {isSavings ? "Savings Goal" : "Project Tracker"}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 text-[11px] capitalize">
                  {myMember?.role ?? "viewer"}
                </span>
              </div>
              {initialGroup.description && (
                <p className="text-xs text-zinc-400 truncate mt-0.5">{initialGroup.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={copyInviteCode}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 cursor-pointer"
              title="Copy Invite Code"
            >
              {copiedCode ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-zinc-400" />
              )}
              <span className="font-mono">{initialGroup.invite_code}</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>

            <button
              onClick={() => setShowPaymentModal(true)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                isSavings
                  ? "bg-violet-500 hover:bg-violet-400 text-white"
                  : "bg-emerald-500 hover:bg-emerald-400 text-zinc-950"
              }`}
            >
              <Plus className="h-3.5 w-3.5" />
              {canEdit
                ? isSavings
                  ? "Add Deposit"
                  : "Record Payment"
                : "Submit Proof"}
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center gap-1 border-t border-zinc-800/60">
          <button
            onClick={() => setTab("overview")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition cursor-pointer ${
              tab === "overview"
                ? isSavings
                  ? "border-violet-400 text-violet-300"
                  : "border-emerald-400 text-emerald-300"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {isSavings ? <PiggyBank className="h-3.5 w-3.5" /> : <Wallet className="h-3.5 w-3.5" />}
            {isSavings ? "Savings Overview" : "Overview & Budget"}
          </button>

          {!isSavings && (
            <button
              onClick={() => setTab("components")}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition cursor-pointer ${
                tab === "components"
                  ? "border-emerald-400 text-emerald-300"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              Components & Bundles
              {financials.unpaidItemsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 text-[10px]">
                  {financials.unpaidItemsCount}
                </span>
              )}
            </button>
          )}

          <button
            onClick={() => setTab("history")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition cursor-pointer ${
              tab === "history"
                ? isSavings
                  ? "border-violet-400 text-violet-300"
                  : "border-emerald-400 text-emerald-300"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <History className="h-3.5 w-3.5" />
            History & Members
            {financials.pendingContributionsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[10px]">
                {financials.pendingContributionsCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        {tab === "overview" && (
          <div className="space-y-6">
            {/* Pending Approvals Banner */}
            {financials.pendingContributionsCount > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-amber-200">
                  <Clock className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>
                    <strong>{financials.pendingContributionsCount}</strong> pending payment proof
                    {financials.pendingContributionsCount > 1 ? "s" : ""} totaling{" "}
                    <strong>
                      {formatCurrency(financials.pendingContributionsTotal, initialGroup.currency)}
                    </strong>{" "}
                    awaiting verification.
                  </span>
                </div>
                <button
                  onClick={() => setTab("history")}
                  className="shrink-0 px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-xs font-medium text-amber-200 cursor-pointer"
                >
                  Review
                </button>
              </div>
            )}

            {/* Main Progress Card */}
            <div className="rounded-2xl border border-zinc-800 bg-[#121216] p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                  <p className="text-xs text-zinc-400 uppercase tracking-wider">
                    {isSavings ? "Savings Progress" : "Connected Project Budget"}
                  </p>
                  <div className="flex items-baseline gap-2.5 mt-1">
                    <span className="text-3xl font-bold text-white">
                      {formatCurrency(financials.totalContributions, initialGroup.currency)}
                    </span>
                    <span className="text-sm text-zinc-400">
                      / {formatCurrency(financials.totalProjectCost, initialGroup.currency)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {isSavings && canEdit && !editingGoal && (
                    <button
                      onClick={() => setEditingGoal(true)}
                      className="text-xs text-violet-400 hover:text-violet-300 cursor-pointer"
                    >
                      Edit Target
                    </button>
                  )}
                  <span
                    className={`text-2xl font-bold ${
                      isSavings ? "text-violet-400" : "text-emerald-400"
                    }`}
                  >
                    {financials.progressPercent}%
                  </span>
                </div>
              </div>

              <div className="h-3 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    isSavings ? "bg-violet-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${financials.progressPercent}%` }}
                />
              </div>

              {isSavings && editingGoal && (
                <form onSubmit={handleUpdateGoal} className="flex flex-wrap items-end gap-3 pt-2">
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Target Amount (₱)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={goalAmount}
                      onChange={(e) => setGoalAmount(e.target.value)}
                      className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Target Date</label>
                    <input
                      type="date"
                      value={goalDate}
                      onChange={(e) => setGoalDate(e.target.value)}
                      className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-white"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg bg-violet-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingGoal(false)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                </form>
              )}

              {weeklyPace && (
                <div className="flex items-center gap-2 text-xs text-violet-300 bg-violet-500/10 border border-violet-500/20 px-3.5 py-2.5 rounded-xl">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span>
                    Target date: <strong>{initialGroup.target_date}</strong> ({weeklyPace.weeksLeft}{" "}
                    weeks left) — save roughly{" "}
                    <strong>{formatCurrency(weeklyPace.perWeek, initialGroup.currency)}/week</strong>{" "}
                    to hit your goal on time.
                  </span>
                </div>
              )}
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="rounded-xl border border-zinc-800 bg-[#121216] p-4">
                <p className="text-[11px] text-zinc-400">
                  {isSavings ? "Target Goal" : "Total Project Cost"}
                </p>
                <p className="text-lg font-bold text-white mt-1">
                  {formatCurrency(financials.totalProjectCost, initialGroup.currency)}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-[#121216] p-4">
                <p className="text-[11px] text-zinc-400">Remaining to Collect</p>
                <p className="text-lg font-bold text-amber-300 mt-1">
                  {formatCurrency(financials.remainingToCollect, initialGroup.currency)}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-[#121216] p-4">
                <p className="text-[11px] text-zinc-400">Total Available Funds</p>
                <p className="text-lg font-bold text-emerald-400 mt-1">
                  {formatCurrency(financials.totalAvailableFunds, initialGroup.currency)}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-[#121216] p-4">
                <p className="text-[11px] text-zinc-400">
                  {isSavings ? "Total Deposits" : `Unpaid Items (${financials.unpaidItemsCount})`}
                </p>
                <p
                  className={`text-lg font-bold mt-1 ${
                    !isSavings && financials.unpaidItemsTotal > 0
                      ? "text-rose-400"
                      : "text-zinc-100"
                  }`}
                >
                  {isSavings
                    ? `${initialContributions.filter((c) => c.status === "approved").length}`
                    : formatCurrency(financials.unpaidItemsTotal, initialGroup.currency)}
                </p>
              </div>
            </div>

            {/* Online vs Cash Wallets (Project Mode) */}
            {!isSavings && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-zinc-800 bg-[#121216] p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-sky-300 uppercase tracking-wider">
                      Online Wallet (GCash / Bank)
                    </span>
                    <span className="text-base font-bold text-white">
                      {formatCurrency(financials.onlineAvailableBalance, initialGroup.currency)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-zinc-800/80">
                    <div>
                      <span className="text-zinc-500">Funds Received</span>
                      <p className="font-semibold text-zinc-200 mt-0.5">
                        {formatCurrency(financials.onlineFundsReceived, initialGroup.currency)}
                      </p>
                    </div>
                    <div>
                      <span className="text-zinc-500">Online Expenses</span>
                      <p className="font-semibold text-zinc-200 mt-0.5">
                        {formatCurrency(financials.onlineExpenses, initialGroup.currency)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-[#121216] p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">
                      Cash Wallet
                    </span>
                    <span className="text-base font-bold text-white">
                      {formatCurrency(financials.cashAvailableBalance, initialGroup.currency)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-zinc-800/80">
                    <div>
                      <span className="text-zinc-500">Cash Received</span>
                      <p className="font-semibold text-zinc-200 mt-0.5">
                        {formatCurrency(financials.cashFundsReceived, initialGroup.currency)}
                      </p>
                    </div>
                    <div>
                      <span className="text-zinc-500">Cash Expenses</span>
                      <p className="font-semibold text-zinc-200 mt-0.5">
                        {formatCurrency(financials.cashExpenses, initialGroup.currency)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Individual Member Balances Table */}
            <div className="rounded-2xl border border-zinc-800 bg-[#121216] overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Individual Payment Summary</h2>
                <span className="text-xs text-zinc-500">
                  Split across {initialMembers.length} member{initialMembers.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500">
                      <th className="py-2.5 px-5">Member</th>
                      <th className="py-2.5 px-4 text-right">Individual Bill</th>
                      <th className="py-2.5 px-4 text-right">Online Paid</th>
                      <th className="py-2.5 px-4 text-right">Cash Paid</th>
                      <th className="py-2.5 px-4 text-right">Total Paid</th>
                      <th className="py-2.5 px-5 text-right">Balance Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {financials.memberSummaries.map((row) => (
                      <tr key={row.member.id} className="hover:bg-zinc-900/40">
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-zinc-100">
                              {row.member.display_name}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] capitalize text-zinc-400">
                              {row.member.role}
                            </span>
                            {row.pendingAmount > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px]">
                                +{formatCurrency(row.pendingAmount, initialGroup.currency)} pending
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right text-zinc-300">
                          {formatCurrency(row.individualBill, initialGroup.currency)}
                        </td>
                        <td className="py-3.5 px-4 text-right text-sky-300">
                          {formatCurrency(row.onlinePaid, initialGroup.currency)}
                        </td>
                        <td className="py-3.5 px-4 text-right text-emerald-300">
                          {formatCurrency(row.cashPaid, initialGroup.currency)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-semibold text-white">
                          {formatCurrency(row.totalPaid, initialGroup.currency)}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          {row.balanceDue > 0.01 ? (
                            <span className="inline-flex items-center gap-1 font-bold text-amber-300">
                              <AlertCircle className="h-3.5 w-3.5" />
                              {formatCurrency(row.balanceDue, initialGroup.currency)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Settled
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === "components" && !isSavings && (
          <ComponentsTab
            groupId={initialGroup.id}
            currency={initialGroup.currency}
            canEdit={canEdit}
            components={initialComponents}
            bundles={initialBundles}
            onRefresh={refresh}
          />
        )}

        {tab === "history" && (
          <HistoryAndMembersTab
            groupId={initialGroup.id}
            inviteCode={initialGroup.invite_code}
            currency={initialGroup.currency}
            currentUserId={currentUserId}
            isLeader={isLeader}
            canEdit={canEdit}
            members={initialMembers}
            contributions={initialContributions}
            onRefresh={refresh}
          />
        )}
      </main>

      {showPaymentModal && (
        <PaymentModal
          groupId={initialGroup.id}
          currentUserId={currentUserId}
          members={initialMembers}
          myMember={myMember}
          canEdit={canEdit}
          isSavings={isSavings}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => {
            setShowPaymentModal(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}
