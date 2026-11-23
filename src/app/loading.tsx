export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[#0b0d12]">
      <div className="border-b border-slate-800/70 h-16 px-4 sm:px-6 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-slate-800/80 animate-pulse" />
          <div className="h-4 w-28 rounded bg-slate-800/80 animate-pulse" />
        </div>
        <div className="h-8 w-24 rounded-lg bg-slate-800/80 animate-pulse" />
      </div>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <div className="h-7 w-48 rounded-lg bg-slate-800/80 animate-pulse" />
            <div className="h-4 w-72 rounded bg-slate-800/50 animate-pulse" />
          </div>
          <div className="h-9 w-32 rounded-xl bg-slate-800/80 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-900/80 border border-slate-800/60 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-52 rounded-2xl bg-slate-900/80 border border-slate-800/60 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
