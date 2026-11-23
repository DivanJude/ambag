"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, ShieldCheck, Layers, PiggyBank, Wallet } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === "signup") {
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName.trim() || email.split("@")[0] },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (signUpErr) throw signUpErr;
        if (data.session) {
          router.push("/");
          router.refresh();
        } else {
          setMessage("Account created! Check your email to confirm, then sign in.");
        }
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInErr) throw signInErr;
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleAuth() {
    setLoading(true);
    setError(null);
    const { error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (oauthErr) {
      setError(oauthErr.message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#09090b]">
      {/* Left Hero Panel */}
      <div className="lg:w-1/2 p-8 lg:p-16 flex flex-col justify-between bg-gradient-to-br from-emerald-950/40 via-[#0d0d11] to-[#09090b] border-b lg:border-b-0 lg:border-r border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <span className="text-emerald-400 font-bold text-lg">A</span>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Ambag</h1>
            <p className="text-xs text-zinc-400">Group Hardware, Payment & Budget Tracker</p>
          </div>
        </div>

        <div className="my-10 lg:my-0 space-y-6 max-w-md">
          <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-white leading-tight">
            Ditch messy spreadsheets for <span className="text-emerald-400">connected group budgets</span>.
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Track project components, bundle multi-item shop checkouts with exact cart totals, split bills across teammates, verify payment proofs, or save up for a future goal.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
              <Layers className="h-4 w-4 text-emerald-400 mb-2" />
              <p className="text-xs font-semibold text-zinc-100">Order Bundles</p>
              <p className="text-xs text-zinc-400 mt-0.5">Match real Shopee/cart checkouts without double-counting items.</p>
            </div>
            <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
              <Wallet className="h-4 w-4 text-sky-400 mb-2" />
              <p className="text-xs font-semibold text-zinc-100">Online & Cash Wallets</p>
              <p className="text-xs text-zinc-400 mt-0.5">Auto-reconcile pooled funds, expenses, and per-member balances.</p>
            </div>
            <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
              <ShieldCheck className="h-4 w-4 text-amber-400 mb-2" />
              <p className="text-xs font-semibold text-zinc-100">Leader & Editor Roles</p>
              <p className="text-xs text-zinc-400 mt-0.5">Delegate editing per group while members submit payment proofs.</p>
            </div>
            <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
              <PiggyBank className="h-4 w-4 text-violet-400 mb-2" />
              <p className="text-xs font-semibold text-zinc-100">Savings Goal Mode</p>
              <p className="text-xs text-zinc-400 mt-0.5">Standalone budget tracker for saving up toward future buys.</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-zinc-500">
          Built with Next.js & Supabase • Row-Level Security enabled
        </p>
      </div>

      {/* Right Auth Panel */}
      <div className="lg:w-1/2 p-8 lg:p-16 flex items-center justify-center">
        <div className="w-full max-w-md space-y-6">
          <div>
            <h3 className="text-2xl font-bold text-white">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h3>
            <p className="text-sm text-zinc-400 mt-1">
              {mode === "signin"
                ? "Sign in to view your groups, balances, and component trackers."
                : "Start tracking group projects or savings goals in seconds."}
            </p>
          </div>

          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-sm font-medium text-zinc-100 transition cursor-pointer disabled:opacity-50"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            </svg>
            Continue with Google
          </button>

          <div className="relative flex items-center">
            <div className="flex-grow border-t border-zinc-800" />
            <span className="px-3 text-xs text-zinc-500">or with email</span>
            <div className="flex-grow border-t border-zinc-800" />
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Divan"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                {error}
              </div>
            )}
            {message && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-sm transition cursor-pointer disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Sign In" : "Create Account"}
            </button>
          </form>

          <p className="text-center text-xs text-zinc-400">
            {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
                setMessage(null);
              }}
              className="text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer"
            >
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
