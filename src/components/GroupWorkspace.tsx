"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { computeGroupFinancials, formatCurrency, getComponentTotal } from "@/lib/finance";
import { logGroupNotification, type GroupNotification } from "@/lib/notify";
import type {
  ComponentItem,
  Contribution,
  Group,
  GroupInvitation,
  GroupMember,
  OrderBundle,
} from "@/lib/types";
import ComponentsTab from "./ComponentsTab";
import HistoryAndMembersTab from "./HistoryAndMembersTab";
import PaymentModal from "./PaymentModal";
import NotificationBell from "./NotificationBell";
import DatePicker from "./DatePicker";
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
  CreditCard,
  Banknote,
} from "lucide-react";

interface GroupWorkspaceProps {
  currentUserId: string;
  actorName: string;
  myMember: GroupMember | null;
  initialGroup: Group;
  initialMembers: GroupMember[];
  initialComponents: ComponentItem[];
  initialBundles: OrderBundle[];
  initialContributions: Contribution[];
  initialNotifications: GroupNotification[];
  initialLastReadAt: string | null;
  initialInvitations: GroupInvitation[];
}

export default function GroupWorkspace({
  currentUserId,
  actorName,
  myMember,
  initialGroup,
  initialMembers,
  initialComponents,
  initialBundles,
  initialContributions,
  initialNotifications,
  initialLastReadAt,
  initialInvitations,
}: GroupWorkspaceProps) {
  const router = useRouter();
  const supabase = createClient();

  const [tab, setTabState] = useState<"overview" | "components" | "history">("overview");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalAmount, setGoalAmount] = useState(String(initialGroup.target_amount));
  const [goalDate, setGoalDate] = useState(initialGroup.target_date ?? "");
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSavings = initialGroup.mode === "savings";
  const isLeader = myMember?.role === "leader";
  const canEdit = myMember?.role === "leader" || myMember?.role === "editor";

  // Restore last active tab from URL (?tab=...) on mount / refresh
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const saved = params.get("tab");
    if (saved === "history") {
      setTabState("history");
    } else if (saved === "components" && !isSavings) {
      setTabState("components");
    } else if (saved === "overview") {
      setTabState("overview");
    }
  }, [isSavings]);

  function setTab(nextTab: "overview" | "components" | "history") {
    setTabState(nextTab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", nextTab);
      if (nextTab !== "components") {
        url.searchParams.delete("filter");
      }
      window.history.replaceState({}, "", url.toString());
    }
  }

  // Real-time sync across all group tables (explicitly hydrate Realtime JWT before subscribing)
  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const scheduleRefresh = () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        router.refresh();
      }, 200);
    };

    async function connectRealtime() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }

      channel = supabase
        .channel(`group-live-${initialGroup.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "groups", filter: `id=eq.${initialGroup.id}` },
          scheduleRefresh
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "group_members", filter: `group_id=eq.${initialGroup.id}` },
          scheduleRefresh
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "components", filter: `group_id=eq.${initialGroup.id}` },
          scheduleRefresh
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "order_bundles", filter: `group_id=eq.${initialGroup.id}` },
          scheduleRefresh
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "contributions", filter: `group_id=eq.${initialGroup.id}` },
          scheduleRefresh
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "group_invitations", filter: `group_id=eq.${initialGroup.id}` },
          scheduleRefresh
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "group_notifications", filter: `group_id=eq.${initialGroup.id}` },
          scheduleRefresh
        )
        .subscribe();
    }

    connectRealtime();

    const onVisibility = () => {
      if (document.visibilityState === "visible") scheduleRefresh();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      if (channel) supabase.removeChannel(channel);
    };
  }, [initialGroup.id, router, supabase]);

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

  // Stacked budget bar segments for Project mode
  const paidExpensesTotal = financials.onlineExpenses + financials.cashExpenses;
  const spentPct =
    financials.totalProjectCost > 0
      ? Math.min(100, (paidExpensesTotal / financials.totalProjectCost) * 100)
      : 0;
  const availablePct =
    financials.totalProjectCost > 0
      ? Math.min(
        100 - spentPct,
        (Math.max(financials.totalAvailableFunds, 0) / financials.totalProjectCost) * 100
      )
      : 0;

  const onlineSpentPct =
    financials.onlineFundsReceived > 0
      ? Math.min(100, Math.round((financials.onlineExpenses / financials.onlineFundsReceived) * 100))
      : 0;
  const cashSpentPct =
    financials.cashFundsReceived > 0
      ? Math.min(100, Math.round((financials.cashExpenses / financials.cashFundsReceived) * 100))
      : 0;

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
    const nextTarget = Number(goalAmount) || 0;
    await supabase
      .from("groups")
      .update({
        target_amount: nextTarget,
        target_date: goalDate || null,
      })
      .eq("id", initialGroup.id);
    await logGroupNotification(supabase, {
      groupId: initialGroup.id,
      actorUserId: currentUserId,
      actorName,
      actionType: "goal_updated",
      message: `${actorName} updated the savings target to ${formatCurrency(nextTarget, initialGroup.currency)}${goalDate ? ` (due ${goalDate})` : ""}`,
    });
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
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-800/70 bg-[#0b0d12]/80 backdrop-blur-xl">
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
                <h1 className="text-base sm:text-lg font-semibold text-white tracking-tight truncate">
                  {initialGroup.name}
                </h1>
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${isSavings
                    ? "bg-violet-500/12 text-violet-300"
                    : "bg-emerald-500/12 text-emerald-300"
                    }`}
                >
                  {isSavings ? "Personal Savings" : "Project Group"}
                </span>
                {!isSavings && (
                  <span className="px-2 py-0.5 rounded-md bg-slate-800/90 text-slate-300 text-[11px] font-medium capitalize">
                    {myMember?.role ?? "viewer"}
                  </span>
                )}
              </div>
              {initialGroup.description && (
                <p className="text-xs text-slate-400 truncate mt-0.5">{initialGroup.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {!isSavings && (
              <>
                <NotificationBell
                  groupId={initialGroup.id}
                  currentUserId={currentUserId}
                  initialNotifications={initialNotifications}
                  initialLastReadAt={initialLastReadAt}
                />

                <button
                  onClick={copyInviteCode}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 cursor-pointer transition"
                  title="Copy Invite Code"
                >
                  {copiedCode ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  <span className="num tracking-wider">{initialGroup.invite_code}</span>
                </button>
              </>
            )}

            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-300 cursor-pointer transition"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>

            <button
              onClick={() => setShowPaymentModal(true)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer shadow-sm transition ${isSavings
                ? "bg-violet-500 hover:bg-violet-400 text-white shadow-violet-500/20"
                : "bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-emerald-500/20"
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
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition cursor-pointer ${tab === "overview"
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
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition cursor-pointer ${tab === "components"
                ? "border-emerald-400 text-emerald-300"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
            >
              <Layers className="h-3.5 w-3.5" />
              Components & Bundles
              {financials.unpaidItemsCount > 0 && (
                <span className="num px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 text-[10px]">
                  {financials.unpaidItemsCount}
                </span>
              )}
            </button>
          )}

          <button
            onClick={() => setTab("history")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition cursor-pointer ${tab === "history"
              ? isSavings
                ? "border-violet-400 text-violet-300"
                : "border-emerald-400 text-emerald-300"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
          >
            <History className="h-3.5 w-3.5" />
            {isSavings ? "Deposit History & Settings" : "History & Members"}
            {!isSavings && financials.pendingContributionsCount > 0 && (
              <span className="num px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[10px]">
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
                    <strong className="tnum">{financials.pendingContributionsCount}</strong> pending payment proof
                    {financials.pendingContributionsCount > 1 ? "s" : ""} totaling{" "}
                    <strong className="num">
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

            {/* Fintech Budget Hero Card */}
            <div className="fintech-card rounded-2xl p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    {isSavings ? "Savings Progress" : "Connected Project Budget"}
                  </p>
                  <div className="flex items-baseline gap-2.5 mt-1.5 flex-wrap">
                    <span className="num text-3xl sm:text-4xl font-semibold text-white">
                      {formatCurrency(financials.totalContributions, initialGroup.currency)}
                    </span>
                    <span className="num text-sm text-zinc-400">
                      of {formatCurrency(financials.totalProjectCost, initialGroup.currency)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {isSavings && canEdit && !editingGoal && (
                    <button
                      onClick={() => setEditingGoal(true)}
                      className="text-xs font-medium text-violet-400 hover:text-violet-300 cursor-pointer"
                    >
                      Edit Target
                    </button>
                  )}
                  <span
                    className={`num text-2xl sm:text-3xl font-semibold ${isSavings ? "text-violet-400" : "text-emerald-400"
                      }`}
                  >
                    {financials.progressPercent}%
                  </span>
                </div>
              </div>

              {/* Stacked Progress Bar */}
              {isSavings ? (
                <div className="h-3 rounded-full bg-zinc-800/90 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-violet-500 transition-all"
                    style={{ width: `${financials.progressPercent}%` }}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="h-3 rounded-full bg-zinc-800/90 overflow-hidden flex">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${spentPct}%` }}
                      title={`Expenses Paid: ${formatCurrency(paidExpensesTotal, initialGroup.currency)}`}
                    />
                    <div
                      className="h-full bg-sky-400 transition-all"
                      style={{ width: `${availablePct}%` }}
                      title={`Available Pool: ${formatCurrency(financials.totalAvailableFunds, initialGroup.currency)}`}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-zinc-400">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Spent on Items:{" "}
                      <strong className="num text-zinc-200">
                        {formatCurrency(paidExpensesTotal, initialGroup.currency)}
                      </strong>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-sky-400" />
                      Available Pool:{" "}
                      <strong className="num text-zinc-200">
                        {formatCurrency(financials.totalAvailableFunds, initialGroup.currency)}
                      </strong>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-zinc-700" />
                      To Collect:{" "}
                      <strong className="num text-amber-300">
                        {formatCurrency(financials.remainingToCollect, initialGroup.currency)}
                      </strong>
                    </span>
                  </div>
                </div>
              )}

              {isSavings && editingGoal && (
                <form onSubmit={handleUpdateGoal} className="flex flex-wrap items-end gap-3 pt-2">
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Target Amount (₱)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={goalAmount}
                      onChange={(e) => setGoalAmount(e.target.value)}
                      className="num px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-white"
                    />
                  </div>
                  <div className="w-44">
                    <label className="block text-[11px] text-slate-400 mb-1">Target Date</label>
                    <DatePicker
                      size="sm"
                      value={goalDate}
                      onChange={setGoalDate}
                      placeholder="Pick date"
                      allowClear
                      accent="violet"
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
                    Target date: <strong className="num">{initialGroup.target_date}</strong> (
                    <span className="tnum">{weeklyPace.weeksLeft}</span> weeks left) — save roughly{" "}
                    <strong className="num">
                      {formatCurrency(weeklyPace.perWeek, initialGroup.currency)}/wk
                    </strong>{" "}
                    to stay on track.
                  </span>
                </div>
              )}
            </div>

            {/* 4 Key Financial Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="fintech-card rounded-2xl p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                  {isSavings ? "Target Goal" : "Total Cost"}
                </p>
                <p className="num text-xl font-semibold text-white mt-1.5">
                  {formatCurrency(financials.totalProjectCost, initialGroup.currency)}
                </p>
              </div>
              <div className="fintech-card rounded-2xl p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                  Remaining to Collect
                </p>
                <p className="num text-xl font-semibold text-amber-300 mt-1.5">
                  {formatCurrency(financials.remainingToCollect, initialGroup.currency)}
                </p>
              </div>
              <div className="fintech-card rounded-2xl p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                  Available Pool
                </p>
                <p className="num text-xl font-semibold text-emerald-400 mt-1.5">
                  {formatCurrency(financials.totalAvailableFunds, initialGroup.currency)}
                </p>
              </div>
              <div className="fintech-card rounded-2xl p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                  {isSavings ? "Approved Deposits" : `Unpaid Items (${financials.unpaidItemsCount})`}
                </p>
                <p
                  className={`num text-xl font-semibold mt-1.5 ${!isSavings && financials.unpaidItemsTotal > 0
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
                <div className="fintech-card rounded-2xl p-5 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold text-sky-300 uppercase tracking-wider">
                      <CreditCard className="h-4 w-4" /> Online Wallet
                    </span>
                    <span className="num text-xl font-semibold text-white">
                      {formatCurrency(financials.onlineAvailableBalance, initialGroup.currency)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full bg-sky-400 rounded-full"
                      style={{ width: `${onlineSpentPct}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                    <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
                      <span className="text-[11px] text-zinc-500">Funds Received</span>
                      <p className="num font-semibold text-zinc-100 mt-0.5">
                        {formatCurrency(financials.onlineFundsReceived, initialGroup.currency)}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
                      <span className="text-[11px] text-zinc-500">Online Expenses</span>
                      <p className="num font-semibold text-zinc-100 mt-0.5">
                        {formatCurrency(financials.onlineExpenses, initialGroup.currency)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="fintech-card rounded-2xl p-5 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-300 uppercase tracking-wider">
                      <Banknote className="h-4 w-4" /> Cash Wallet
                    </span>
                    <span className="num text-xl font-semibold text-white">
                      {formatCurrency(financials.cashAvailableBalance, initialGroup.currency)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 rounded-full"
                      style={{ width: `${cashSpentPct}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                    <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
                      <span className="text-[11px] text-zinc-500">Cash Received</span>
                      <p className="num font-semibold text-zinc-100 mt-0.5">
                        {formatCurrency(financials.cashFundsReceived, initialGroup.currency)}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
                      <span className="text-[11px] text-zinc-500">Cash Expenses</span>
                      <p className="num font-semibold text-zinc-100 mt-0.5">
                        {formatCurrency(financials.cashExpenses, initialGroup.currency)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Individual Member Balances Ledger (Project Groups only — Savings is Personal) */}
            {!isSavings && (
              <div className="fintech-card rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-zinc-800/80 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-white">Member Balances Ledger</h2>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      Equal split across {initialMembers.length} member{initialMembers.length === 1 ? "" : "s"} • Tabular aligned
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800/80 text-[11px] uppercase tracking-wider text-zinc-500 bg-zinc-950/40">
                        <th className="py-3 px-5 font-medium">Member</th>
                        <th className="py-3 px-4 text-right font-medium">Share</th>
                        <th className="py-3 px-4 text-right font-medium">Online</th>
                        <th className="py-3 px-4 text-right font-medium">Cash</th>
                        <th className="py-3 px-4 text-right font-medium">Total Paid</th>
                        <th className="py-3 px-5 text-right font-medium">Balance Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {financials.memberSummaries.map((row) => {
                        const pct =
                          row.individualBill > 0
                            ? Math.min(100, Math.round((row.totalPaid / row.individualBill) * 100))
                            : 100;
                        return (
                          <tr key={row.member.id} className="hover:bg-zinc-900/40 transition">
                            <td className="py-3.5 px-5">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-zinc-800 border border-zinc-700/80 flex items-center justify-center text-xs font-semibold text-zinc-200 shrink-0">
                                  {row.member.display_name.slice(0, 1).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-semibold text-zinc-100">
                                      {row.member.display_name}
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] capitalize text-zinc-400">
                                      {row.member.role}
                                    </span>
                                    {row.pendingAmount > 0 && (
                                      <span className="num px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px]">
                                        +{formatCurrency(row.pendingAmount, initialGroup.currency)} pending
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <div className="w-20 h-1 rounded-full bg-zinc-800 overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-400" : "bg-sky-400"
                                          }`}
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                    <span className="num text-[10px] text-zinc-500">{pct}%</span>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="num py-3.5 px-4 text-right text-zinc-300 whitespace-nowrap">
                              {formatCurrency(row.individualBill, initialGroup.currency)}
                            </td>
                            <td className="num py-3.5 px-4 text-right text-sky-300 whitespace-nowrap">
                              {formatCurrency(row.onlinePaid, initialGroup.currency)}
                            </td>
                            <td className="num py-3.5 px-4 text-right text-emerald-300 whitespace-nowrap">
                              {formatCurrency(row.cashPaid, initialGroup.currency)}
                            </td>
                            <td className="num py-3.5 px-4 text-right font-semibold text-white whitespace-nowrap">
                              {formatCurrency(row.totalPaid, initialGroup.currency)}
                            </td>
                            <td className="py-3.5 px-5 text-right whitespace-nowrap">
                              {row.balanceDue > 0.01 ? (
                                <span className="num inline-flex items-center gap-1 font-semibold text-amber-300">
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
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "components" && !isSavings && (
          <ComponentsTab
            groupId={initialGroup.id}
            currentUserId={currentUserId}
            actorName={actorName}
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
            groupName={initialGroup.name}
            isSavings={isSavings}
            inviteCode={initialGroup.invite_code}
            currency={initialGroup.currency}
            currentUserId={currentUserId}
            actorName={actorName}
            isLeader={isLeader}
            canEdit={canEdit}
            members={initialMembers}
            contributions={initialContributions}
            invitations={initialInvitations}
            onRefresh={refresh}
          />
        )}
      </main>

      {showPaymentModal && (
        <PaymentModal
          groupId={initialGroup.id}
          currentUserId={currentUserId}
          actorName={actorName}
          currency={initialGroup.currency}
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
