export default function GroupLoading() {
  return (
    <div className="min-h-screen bg-[#0b0d12]">
      <div className="border-b border-slate-800/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-slate-800/80 animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-5 w-48 rounded bg-slate-800/80 animate-pulse" />
              <div className="h-3 w-64 rounded bg-slate-800/50 animate-pulse" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="h-8 w-24 rounded-xl bg-slate-800/80 animate-pulse" />
            <div className="h-8 w-28 rounded-xl bg-emerald-500/20 animate-pulse" />
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        <div className="h-44 rounded-2xl bg-slate-900/80 border border-slate-800/60 animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-slate-900/80 border border-slate-800/60 animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-2xl bg-slate-900/80 border border-slate-800/60 animate-pulse" />
      </div>
    </div>
  );
}
