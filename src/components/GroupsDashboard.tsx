"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/finance";
import { useLockBodyScroll } from "@/lib/useLockBodyScroll";
import type { Group, GroupMode, MemberRole } from "@/lib/types";
import SelectDropdown from "./SelectDropdown";
import DatePicker from "./DatePicker";
import {
  Plus,
  Users,
  Layers,
  PiggyBank,
  LogOut,
  KeyRound,
  Sparkles,
  ArrowUpRight,
  Clock,
  AlertCircle,
  Loader2,
  X,
  Wallet,
  TrendingUp,
  Trash2,
  Target,
  User as UserIcon,
} from "lucide-react";

export interface DashboardGroupCard {
  group: Group;
  role: MemberRole;
  memberCount: number;
  totalCost: number;
  totalCollected: number;
  progressPercent: number;
  myBalanceDue: number;
  pendingCount: number;
  unpaidCount: number;
}

interface UnclaimedSeat {
  id: string;
  display_name: string;
  role: MemberRole;
}

interface GroupPreview {
  id: string;
  name: string;
  mode: GroupMode;
  currency: string;
  unclaimed_seats: UnclaimedSeat[];
}

export default function GroupsDashboard({
  user,
  initialGroups,
}: {
  user: { id: string; email: string; name: string };
  initialGroups: DashboardGroupCard[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<GroupMode>("project");
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [deletingCard, setDeletingCard] = useState<DashboardGroupCard | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<GroupMode>("project");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [extraMembers, setExtraMembers] = useState("");

  const [inviteCode, setInviteCode] = useState("");
  const [preview, setPreview] = useState<GroupPreview | null>(null);
  const [selectedSeatId, setSelectedSeatId] = useState<string>("");

  useLockBodyScroll(showCreate || showJoin || !!deletingCard);

  const projectGroups = useMemo(
    () => initialGroups.filter((g) => g.group.mode === "project"),
    [initialGroups]
  );
  const savingsGoals = useMemo(
    () => initialGroups.filter((g) => g.group.mode === "savings"),
    [initialGroups]
  );

  // Separate summary calculations for Projects vs Personal Savings
  const projectSummary = useMemo(() => {
    const totalBudget = projectGroups.reduce((s, g) => s + g.totalCost, 0);
    const totalCollected = projectGroups.reduce((s, g) => s + g.totalCollected, 0);
    const totalMyDue = projectGroups.reduce((s, g) => s + Math.max(g.myBalanceDue, 0), 0);
    const pendingTotal = projectGroups.reduce((s, g) => s + g.pendingCount, 0);
    return { totalBudget, totalCollected, totalMyDue, pendingTotal };
  }, [projectGroups]);

  const savingsSummary = useMemo(() => {
    const totalTarget = savingsGoals.reduce((s, g) => s + g.totalCost, 0);
    const totalSaved = savingsGoals.reduce((s, g) => s + g.totalCollected, 0);
    const totalRemaining = Math.max(totalTarget - totalSaved, 0);
    const pct = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;
    return { totalTarget, totalSaved, totalRemaining, pct };
  }, [savingsGoals]);

  function openCreateModal(initialMode: GroupMode) {
    setError(null);
    setMode(initialMode);
    setName("");
    setDescription("");
    setTargetAmount("");
    setTargetDate("");
    setExtraMembers("");
    setShowCreate(true);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function handleSeedBrowsers() {
    setSeeding(true);
    setError(null);
    const { data, error: rpcErr } = await supabase.rpc("seed_browsers_group");
    if (rpcErr) {
      setError(rpcErr.message);
      setSeeding(false);
      return;
    }
    router.push(`/groups/${data}`);
    router.refresh();
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { data: group, error: gErr } = await supabase
        .from("groups")
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          mode,
          currency: "PHP",
          target_amount: mode === "savings" ? Number(targetAmount) || 0 : 0,
          target_date: mode === "savings" && targetDate ? targetDate : null,
          created_by: user.id,
        })
        .select()
        .single();

      if (gErr || !group) throw gErr ?? new Error("Could not create group");

      const { error: mErr } = await supabase.from("group_members").insert({
        group_id: group.id,
        user_id: user.id,
        display_name: user.name,
        email: user.email,
        role: "leader",
      });
      if (mErr) throw mErr;

      // Only Project groups support teammates; Savings is strictly personal
      if (mode === "project") {
        const parsedNames = extraMembers
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (parsedNames.length > 0) {
          await supabase.from("group_members").insert(
            parsedNames.map((display_name) => ({
              group_id: group.id,
              display_name,
              role: "viewer",
            }))
          );
        }
      }

      setShowCreate(false);
      router.push(`/groups/${group.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingCard) return;
    setBusy(true);
    setError(null);
    const { error: delErr } = await supabase
      .from("groups")
      .delete()
      .eq("id", deletingCard.group.id);
    if (delErr) {
      setError(delErr.message);
      setBusy(false);
      return;
    }
    setDeletingCard(null);
    setBusy(false);
    router.refresh();
  }

  async function handleLookupCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setPreview(null);
    setSelectedSeatId("");
    const { data, error: rpcErr } = await supabase.rpc("get_group_preview_by_code", {
      p_code: inviteCode,
    });
    if (rpcErr) {
      setError(rpcErr.message);
    } else if (!data) {
      setError("No project group found with that invite code.");
    } else if ((data as GroupPreview).mode === "savings") {
      setError("That code belongs to a personal savings goal and cannot be joined.");
    } else {
      setPreview(data as GroupPreview);
    }
    setBusy(false);
  }

  async function handleJoinConfirm() {
    setBusy(true);
    setError(null);
    const { data, error: rpcErr } = await supabase.rpc("join_group_by_code", {
      p_code: inviteCode,
      p_claim_member_id: selectedSeatId || null,
    });
    if (rpcErr) {
      setError(rpcErr.message);
      setBusy(false);
      return;
    }
    setShowJoin(false);
    router.push(`/groups/${data}`);
    router.refresh();
  }

  const roleBadgeStyle: Record<MemberRole, string> = {
    leader: "bg-emerald-500/12 text-emerald-300 border-emerald-500/25",
    editor: "bg-sky-500/12 text-sky-300 border-sky-500/25",
    viewer: "bg-slate-800/80 text-slate-300 border-slate-700/80",
  };

  const visibleCards = activeTab === "project" ? projectGroups : savingsGoals;

  return (
    <div className="min-h-screen">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/70 bg-[#0b0d12]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shadow-sm shadow-emerald-500/10">
              <span className="text-emerald-400 font-bold text-base">A</span>
            </div>
            <div>
              <span className="font-semibold text-white tracking-tight text-base">Ambag</span>
              <span className="hidden sm:inline text-xs text-slate-500 ml-2.5 pl-2.5 border-l border-slate-800">
                Budget & Payment Ledger
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-semibold text-slate-200">
                {user.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-medium text-slate-100 leading-tight">{user.name}</p>
                <p className="text-[11px] text-slate-500 leading-tight">{user.email}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 transition cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-7">
        {/* Header & Category Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-3">
            <div>
              <h1 className="text-2xl font-semibold text-white tracking-tight">Workspace</h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Group project trackers and personal savings goals—kept cleanly separated.
              </p>
            </div>

            {/* Segmented Category Switcher */}
            <div className="inline-flex p-1 rounded-xl bg-slate-900/90 border border-slate-800/80">
              <button
                type="button"
                onClick={() => setActiveTab("project")}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === "project"
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 border border-transparent"
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                Project Groups
                <span className="num px-1.5 py-0.2 rounded-md bg-slate-800/90 text-[10px] text-slate-300">
                  {projectGroups.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("savings")}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === "savings"
                    ? "bg-violet-500/15 text-violet-300 border border-violet-500/30 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 border border-transparent"
                }`}
              >
                <PiggyBank className="h-3.5 w-3.5" />
                Personal Savings
                <span className="num px-1.5 py-0.2 rounded-md bg-slate-800/90 text-[10px] text-slate-300">
                  {savingsGoals.length}
                </span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-center">
            {activeTab === "project" && (
              <button
                onClick={() => {
                  setError(null);
                  setPreview(null);
                  setInviteCode("");
                  setShowJoin(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200 transition cursor-pointer"
              >
                <KeyRound className="h-3.5 w-3.5 text-slate-400" />
                Join Project
              </button>
            )}

            <button
              onClick={() => openCreateModal(activeTab)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer ${
                activeTab === "savings"
                  ? "bg-violet-500 hover:bg-violet-400 text-white shadow-violet-500/20"
                  : "bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-emerald-500/20"
              }`}
            >
              <Plus className="h-4 w-4" />
              {activeTab === "savings" ? "New Savings Goal" : "New Project Group"}
            </button>
          </div>
        </div>

        {/* Dedicated Summary Strip — Projects ONLY or Personal Savings ONLY */}
        {activeTab === "project" && projectGroups.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="fintech-card rounded-2xl p-4.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  Total Project Budgets
                </span>
                <Wallet className="h-4 w-4 text-slate-500" />
              </div>
              <p className="num text-2xl font-semibold text-white mt-2">
                {formatCurrency(projectSummary.totalBudget)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Across {projectGroups.length} active project{projectGroups.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className="fintech-card rounded-2xl p-4.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  Total Pooled Funds
                </span>
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="num text-2xl font-semibold text-emerald-400 mt-2">
                {formatCurrency(projectSummary.totalCollected)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {projectSummary.totalBudget > 0
                  ? `${Math.round((projectSummary.totalCollected / projectSummary.totalBudget) * 100)}% of combined project costs`
                  : "No components selected yet"}
              </p>
            </div>

            <div className="fintech-card rounded-2xl p-4.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  Your Project Balance Due
                </span>
                <AlertCircle
                  className={`h-4 w-4 ${
                    projectSummary.totalMyDue > 0 ? "text-amber-400" : "text-emerald-400"
                  }`}
                />
              </div>
              <p
                className={`num text-2xl font-semibold mt-2 ${
                  projectSummary.totalMyDue > 0 ? "text-amber-300" : "text-emerald-400"
                }`}
              >
                {formatCurrency(projectSummary.totalMyDue)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {projectSummary.pendingTotal > 0
                  ? `${projectSummary.pendingTotal} pending proof${projectSummary.pendingTotal === 1 ? "" : "s"} awaiting review`
                  : projectSummary.totalMyDue > 0
                  ? "Remaining across your project groups"
                  : "All project balances settled"}
              </p>
            </div>
          </div>
        )}

        {activeTab === "savings" && savingsGoals.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="fintech-card rounded-2xl p-4.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  Personal Savings Targets
                </span>
                <Target className="h-4 w-4 text-violet-400" />
              </div>
              <p className="num text-2xl font-semibold text-white mt-2">
                {formatCurrency(savingsSummary.totalTarget)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Across {savingsGoals.length} personal goal{savingsGoals.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className="fintech-card rounded-2xl p-4.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  Total Saved So Far
                </span>
                <PiggyBank className="h-4 w-4 text-violet-400" />
              </div>
              <p className="num text-2xl font-semibold text-violet-300 mt-2">
                {formatCurrency(savingsSummary.totalSaved)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                <span className="num">{savingsSummary.pct}%</span> of your personal targets
              </p>
            </div>

            <div className="fintech-card rounded-2xl p-4.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  Remaining to Save
                </span>
                <TrendingUp className="h-4 w-4 text-slate-400" />
              </div>
              <p className="num text-2xl font-semibold text-slate-100 mt-2">
                {formatCurrency(savingsSummary.totalRemaining)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {savingsSummary.totalRemaining > 0
                  ? "Keep depositing toward your future buys"
                  : "All savings targets reached!"}
              </p>
            </div>
          </div>
        )}

        {error && !showCreate && !showJoin && !deletingCard && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Cards Grid or Empty State */}
        {visibleCards.length === 0 ? (
          <div className="fintech-card rounded-2xl p-8 sm:p-12 text-center space-y-5">
            <div
              className={`mx-auto h-12 w-12 rounded-2xl flex items-center justify-center border ${
                activeTab === "savings"
                  ? "bg-violet-500/12 border-violet-500/25"
                  : "bg-emerald-500/12 border-emerald-500/25"
              }`}
            >
              {activeTab === "savings" ? (
                <PiggyBank className="h-6 w-6 text-violet-400" />
              ) : (
                <Sparkles className="h-6 w-6 text-emerald-400" />
              )}
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h2 className="text-lg font-semibold text-white">
                {activeTab === "savings"
                  ? "No personal savings goals yet"
                  : "No project groups yet"}
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                {activeTab === "savings"
                  ? "Create a private savings tracker to plan and save up for something you want to buy in the future."
                  : "Create a group project tracker, join a teammate's group via invite code, or load your BROwsers Thesis Hardware sample."}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              {activeTab === "project" && (
                <button
                  onClick={handleSeedBrowsers}
                  disabled={seeding}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Load BROwsers Thesis Data (<span className="num">₱26,802</span>)
                </button>
              )}
              <button
                onClick={() => openCreateModal(activeTab)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                  activeTab === "savings"
                    ? "bg-violet-500 hover:bg-violet-400 text-white"
                    : "bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200"
                }`}
              >
                <Plus className="h-4 w-4" />
                {activeTab === "savings" ? "Create Savings Goal" : "Start From Scratch"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {activeTab === "savings" ? "Your Personal Savings Goals" : "Your Project Groups"}
              </h2>
              {activeTab === "project" &&
                !projectGroups.some((g) => g.group.name.includes("BROwsers")) && (
                  <button
                    onClick={handleSeedBrowsers}
                    disabled={seeding}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 transition cursor-pointer"
                  >
                    {seeding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    Import BROwsers Thesis sample
                  </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleCards.map((card) => {
                const isSavings = card.group.mode === "savings";
                return (
                  <Link
                    key={card.group.id}
                    href={`/groups/${card.group.id}`}
                    className={`fintech-card group rounded-2xl p-5 flex flex-col justify-between gap-4 transition ${
                      isSavings
                        ? "hover:border-violet-500/45"
                        : "hover:border-emerald-500/45"
                    }`}
                  >
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          {isSavings ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-500/12 text-violet-300 text-[11px] font-medium">
                              <UserIcon className="h-3 w-3" /> Personal
                            </span>
                          ) : (
                            <>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/12 text-emerald-300 text-[11px] font-medium">
                                <Layers className="h-3 w-3" /> Project
                              </span>
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium capitalize ${roleBadgeStyle[card.role]}`}
                              >
                                {card.role}
                              </span>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {!isSavings && (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500 tnum">
                              <Users className="h-3.5 w-3.5" /> {card.memberCount}
                            </span>
                          )}
                          {card.role === "leader" && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setError(null);
                                setDeletingCard(card);
                              }}
                              title={isSavings ? "Delete savings goal" : "Delete group"}
                              className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <h3
                          className={`text-base font-semibold text-white transition flex items-center justify-between gap-2 ${
                            isSavings
                              ? "group-hover:text-violet-300"
                              : "group-hover:text-emerald-300"
                          }`}
                        >
                          <span className="truncate">{card.group.name}</span>
                          <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-600 group-hover:text-slate-300 transition" />
                        </h3>
                        {card.group.description && (
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                            {card.group.description}
                          </p>
                        )}
                      </div>

                      {/* Progress block */}
                      <div className="space-y-2 pt-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="num text-lg font-semibold text-white">
                            {formatCurrency(card.totalCollected, card.group.currency)}
                          </span>
                          <span className="num text-xs text-slate-400">
                            {card.progressPercent}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-800/90 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isSavings ? "bg-violet-500" : "bg-emerald-500"
                            }`}
                            style={{ width: `${card.progressPercent}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-slate-500 flex items-center justify-between">
                          <span>{isSavings ? "Goal Target" : "Project Total"}</span>
                          <span className="num text-slate-400">
                            {formatCurrency(card.totalCost, card.group.currency)}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isSavings ? (
                          card.totalCost - card.totalCollected > 0 ? (
                            <span className="text-violet-300 font-medium">
                              Left{" "}
                              <span className="num">
                                {formatCurrency(
                                  Math.max(card.totalCost - card.totalCollected, 0),
                                  card.group.currency
                                )}
                              </span>
                            </span>
                          ) : (
                            <span className="text-emerald-400 font-medium">Goal Reached!</span>
                          )
                        ) : card.myBalanceDue > 0 ? (
                          <span className="text-amber-300 font-medium">
                            Due{" "}
                            <span className="num">
                              {formatCurrency(card.myBalanceDue, card.group.currency)}
                            </span>
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-medium">Settled</span>
                        )}

                        {!isSavings && card.pendingCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px] tnum">
                            <Clock className="h-2.5 w-2.5" /> {card.pendingCount} pending
                          </span>
                        )}
                        {!isSavings && card.unpaidCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 text-[10px] tnum">
                            <AlertCircle className="h-2.5 w-2.5" /> {card.unpaidCount} unpaid
                          </span>
                        )}
                      </div>
                      {isSavings && card.group.target_date && (
                        <span className="num text-[11px] text-slate-500">
                          {card.group.target_date}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Create Project / Savings Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#121621] p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                {mode === "savings" ? "New Personal Savings Goal" : "New Project Group"}
              </h2>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMode("project")}
                  className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                    mode === "project"
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
                  }`}
                >
                  <Layers className="h-4 w-4 text-emerald-400 mb-1.5" />
                  <p className="text-xs font-semibold text-white">Project Group</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Multi-member components, bundles & split wallets
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("savings")}
                  className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                    mode === "savings"
                      ? "border-violet-500 bg-violet-500/10"
                      : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
                  }`}
                >
                  <PiggyBank className="h-4 w-4 text-violet-400 mb-1.5" />
                  <p className="text-xs font-semibold text-white">Personal Savings</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Private solo goal to save up for a future buy
                  </p>
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {mode === "savings" ? "Savings Goal Name" : "Project Group Name"}
                </label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={mode === "project" ? "e.g. Robotics Thesis Build" : "e.g. Bambu Lab A1 Fund"}
                  className="w-full px-3 py-2 rounded-xl bg-[#161a24] border border-slate-700/70 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Description (optional)</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short note about this project or savings goal"
                  className="w-full px-3 py-2 rounded-xl bg-[#161a24] border border-slate-700/70 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {mode === "savings" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Target Amount (₱)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      value={targetAmount}
                      onChange={(e) => setTargetAmount(e.target.value)}
                      placeholder="15000"
                      className="num w-full px-3 py-2 rounded-xl bg-[#161a24] border border-slate-700/70 text-sm text-white focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Target Date (optional)</label>
                    <DatePicker
                      value={targetDate}
                      onChange={setTargetDate}
                      placeholder="Pick target date"
                      allowClear
                      accent="violet"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Teammates to Pre-Add (optional, comma-separated)
                  </label>
                  <input
                    value={extraMembers}
                    onChange={(e) => setExtraMembers(e.target.value)}
                    placeholder="e.g. Leonard, Michael (they can claim their seats later)"
                    className="w-full px-3 py-2 rounded-xl bg-[#161a24] border border-slate-700/70 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              {error && <p className="text-xs text-rose-400">{error}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50 ${
                    mode === "savings"
                      ? "bg-violet-500 hover:bg-violet-400 text-white"
                      : "bg-emerald-500 hover:bg-emerald-400 text-zinc-950"
                  }`}
                >
                  {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {mode === "savings" ? "Create Savings Goal" : "Create Project Group"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingCard && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-[#121621] p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-white">
                  Delete {deletingCard.group.mode === "savings" ? "Savings Goal" : "Project Group"}?
                </h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  This will permanently delete <strong className="text-white">{deletingCard.group.name}</strong> along with all its components, order bundles, and payment history. This action cannot be undone.
                </p>
              </div>
              <button onClick={() => setDeletingCard(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            {error && <p className="text-xs text-rose-400">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingCard(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleConfirmDelete}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Project Modal */}
      {showJoin && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#121621] p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Join Project Group</h2>
              <button onClick={() => setShowJoin(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            {!preview ? (
              <form onSubmit={handleLookupCode} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">8-Character Invite Code</label>
                  <input
                    required
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="e.g. A1B2C3D4"
                    className="num w-full px-3.5 py-2.5 rounded-xl bg-[#161a24] border border-slate-700/70 text-sm tracking-widest text-white uppercase focus:outline-none focus:border-emerald-500"
                  />
                </div>
                {error && <p className="text-xs text-rose-400">{error}</p>}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowJoin(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold cursor-pointer"
                  >
                    {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Find Group
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <p className="text-[11px] text-slate-400 uppercase tracking-wider">Project Group</p>
                  <p className="text-base font-semibold text-white mt-0.5">{preview.name}</p>
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
                        { value: "", label: `Join as a new member (${user.name})` },
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

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPreview(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-300 cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleJoinConfirm}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold cursor-pointer"
                  >
                    {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Join Group
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
