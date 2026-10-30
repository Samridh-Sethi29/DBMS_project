export default function ImagePlaceholder({ label, className = '' }: { label: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center bg-slate-800 text-xs text-slate-400 ${className}`} role="img" aria-label={label}>
      Image unavailable
    </div>
  );
}
