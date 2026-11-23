"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/finance";
import type { Group, GroupMode, MemberRole } from "@/lib/types";
import {
  Plus,
  Users,
  Layers,
  PiggyBank,
  LogOut,
  KeyRound,
  Sparkles,
  ArrowRight,
  Clock,
  AlertCircle,
  Loader2,
  X,
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

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create group state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<GroupMode>("project");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [extraMembers, setExtraMembers] = useState("");

  // Join group state
  const [inviteCode, setInviteCode] = useState("");
  const [preview, setPreview] = useState<GroupPreview | null>(null);
  const [selectedSeatId, setSelectedSeatId] = useState<string>("");

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

      // Add creator as Leader
      const { error: mErr } = await supabase.from("group_members").insert({
        group_id: group.id,
        user_id: user.id,
        display_name: user.name,
        email: user.email,
        role: "leader",
      });
      if (mErr) throw mErr;

      // Optional comma-separated teammate names as unclaimed viewer seats
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

      setShowCreate(false);
      router.push(`/groups/${group.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setBusy(false);
    }
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
      setError("No group found with that invite code.");
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
    leader: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    editor: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    viewer: "bg-zinc-800 text-zinc-300 border-zinc-700",
  };

  return (
    <div className="min-h-screen bg-[#09090b]">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-[#09090b]/85 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <span className="text-emerald-400 font-bold">A</span>
            </div>
            <div>
              <span className="font-bold text-white tracking-tight">Ambag</span>
              <span className="hidden sm:inline text-xs text-zinc-500 ml-2">
                Group Budget & Hardware Tracker
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-medium text-zinc-200">{user.name}</p>
              <p className="text-[11px] text-zinc-500">{user.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 transition cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Hero Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">My Groups</h1>
            <p className="text-sm text-zinc-400 mt-0.5">
              Select a group to view components, order bundles, wallets, or savings goals.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                setError(null);
                setPreview(null);
                setInviteCode("");
                setShowJoin(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-medium text-zinc-200 transition cursor-pointer"
            >
              <KeyRound className="h-3.5 w-3.5 text-zinc-400" />
              Join via Code
            </button>

            <button
              onClick={() => {
                setError(null);
                setShowCreate(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Create Group
            </button>
          </div>
        </div>

        {error && !showCreate && !showJoin && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* BROwsers Seed Callout if user has no groups yet (or wants to import it) */}
        {initialGroups.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 sm:p-10 text-center space-y-5">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-emerald-400" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h2 className="text-lg font-semibold text-white">No groups yet</h2>
              <p className="text-sm text-zinc-400">
                Create a new Project Tracker or Savings Goal, join a teammate’s group with an invite code, or load your real <strong>BROwsers Thesis Hardware & Payment Tracker</strong> sheet data right away.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <button
                onClick={handleSeedBrowsers}
                disabled={seeding}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-semibold transition cursor-pointer disabled:opacity-50"
              >
                {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Load BROwsers Thesis Data (₱26,802)
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-sm font-medium text-zinc-200 transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Start From Scratch
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {initialGroups.map((card) => (
                <Link
                  key={card.group.id}
                  href={`/groups/${card.group.id}`}
                  className="group rounded-2xl border border-zinc-800/90 bg-[#121216] hover:border-emerald-500/40 hover:bg-[#15151b] p-5 flex flex-col justify-between gap-4 transition"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {card.group.mode === "project" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 text-[11px] font-medium">
                            <Layers className="h-3 w-3" /> Project
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-300 text-[11px] font-medium">
                            <PiggyBank className="h-3 w-3" /> Savings Goal
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium capitalize ${roleBadgeStyle[card.role]}`}
                        >
                          {card.role}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                        <Users className="h-3.5 w-3.5" /> {card.memberCount}
                      </span>
                    </div>

                    <div>
                      <h2 className="text-base font-semibold text-white group-hover:text-emerald-300 transition">
                        {card.group.name}
                      </h2>
                      {card.group.description && (
                        <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                          {card.group.description}
                        </p>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="font-semibold text-zinc-100">
                          {formatCurrency(card.totalCollected, card.group.currency)}
                        </span>
                        <span className="text-zinc-500">
                          of {formatCurrency(card.totalCost, card.group.currency)} ({card.progressPercent}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            card.group.mode === "savings" ? "bg-violet-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${card.progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      {card.myBalanceDue > 0 ? (
                        <span className="text-amber-300 font-medium">
                          Due: {formatCurrency(card.myBalanceDue, card.group.currency)}
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-medium">Settled</span>
                      )}
                      {card.pendingCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px]">
                          <Clock className="h-2.5 w-2.5" /> {card.pendingCount} pending
                        </span>
                      )}
                      {card.unpaidCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 text-[10px]">
                          <AlertCircle className="h-2.5 w-2.5" /> {card.unpaidCount} unpaid
                        </span>
                      )}
                    </div>
                    <ArrowRight className="h-4 w-4 text-zinc-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition" />
                  </div>
                </Link>
              ))}
            </div>

            {/* Subtle option to load BROwsers demo if not already present */}
            {!initialGroups.some((g) => g.group.name.includes("BROwsers")) && (
              <div className="flex justify-end">
                <button
                  onClick={handleSeedBrowsers}
                  disabled={seeding}
                  className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-emerald-400 transition cursor-pointer"
                >
                  {seeding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Import BROwsers Thesis Hardware sample group
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Create Group Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-[#121216] p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Create a New Group</h2>
              <button onClick={() => setShowCreate(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              {/* Mode selector */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMode("project")}
                  className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                    mode === "project"
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                  }`}
                >
                  <Layers className="h-4 w-4 text-emerald-400 mb-1.5" />
                  <p className="text-xs font-semibold text-white">Project & Payment</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Components, Order Bundles, Wallets & Member Splits
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("savings")}
                  className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                    mode === "savings"
                      ? "border-violet-500 bg-violet-500/10"
                      : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                  }`}
                >
                  <PiggyBank className="h-4 w-4 text-violet-400 mb-1.5" />
                  <p className="text-xs font-semibold text-white">Savings Goal Only</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Save up for a future purchase (solo or group)
                  </p>
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Group / Goal Name</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={mode === "project" ? "e.g. Robotics Thesis Build" : "e.g. Bambu Lab A1 Fund"}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Description (optional)</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short note about this group or goal"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {mode === "savings" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">Target Amount (₱)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      value={targetAmount}
                      onChange={(e) => setTargetAmount(e.target.value)}
                      placeholder="15000"
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">Target Date (optional)</label>
                    <input
                      type="date"
                      value={targetDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white focus:outline-none focus:border-violet-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Teammates to Pre-Add (optional, comma-separated)
                </label>
                <input
                  value={extraMembers}
                  onChange={(e) => setExtraMembers(e.target.value)}
                  placeholder="e.g. Leonard, Michael (they can claim their seats later)"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {error && (
                <p className="text-xs text-rose-400">{error}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Group Modal */}
      {showJoin && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-[#121216] p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Join Group via Invite Code</h2>
              <button onClick={() => setShowJoin(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            {!preview ? (
              <form onSubmit={handleLookupCode} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">8-Character Invite Code</label>
                  <input
                    required
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="e.g. A1B2C3D4"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-sm font-mono tracking-widest text-white uppercase focus:outline-none focus:border-emerald-500"
                  />
                </div>
                {error && <p className="text-xs text-rose-400">{error}</p>}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowJoin(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-900 text-xs text-zinc-300 cursor-pointer"
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
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                  <p className="text-xs text-zinc-400 uppercase">{preview.mode} group</p>
                  <p className="text-base font-semibold text-white mt-0.5">{preview.name}</p>
                </div>

                {preview.unclaimed_seats.length > 0 && (
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-zinc-300">
                      Is your name already listed? Claim your seat:
                    </label>
                    <select
                      value={selectedSeatId}
                      onChange={(e) => setSelectedSeatId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white"
                    >
                      <option value="">Join as a new member ({user.name})</option>
                      {preview.unclaimed_seats.map((seat) => (
                        <option key={seat.id} value={seat.id}>
                          Claim seat: {seat.display_name} ({seat.role})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {error && <p className="text-xs text-rose-400">{error}</p>}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPreview(null)}
                    className="px-4 py-2 rounded-xl bg-zinc-900 text-xs text-zinc-300 cursor-pointer"
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
