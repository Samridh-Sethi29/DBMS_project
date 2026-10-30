export default function QueryState({
  loading,
  error,
  empty,
  onRetry,
}: {
  loading: boolean;
  error?: unknown;
  empty?: boolean;
  onRetry?: () => void;
}) {
  if (loading) return <p className="py-8 text-center text-sm text-slate-400">Loading live data…</p>;
  if (error) {
    return (
      <div className="py-8 text-center" role="alert">
        <p className="text-sm text-rose-300">Unable to load data: {error instanceof Error ? error.message : 'Request failed.'}</p>
        {onRetry && <button className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white" onClick={onRetry}>Retry</button>}
      </div>
    );
  }
  if (empty) return <p className="py-8 text-center text-sm text-slate-400">No results found.</p>;
  return null;
}
