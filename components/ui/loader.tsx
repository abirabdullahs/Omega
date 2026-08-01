export function Loader({ label, className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
        <span className="w-2.5 h-2.5 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-bounce" />
      </div>
      {label && <p className="text-xs font-medium opacity-60">{label}</p>}
    </div>
  );
}

export function FullScreenLoader({ label }: { label?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 text-neutral-900">
      <Loader label={label} />
    </div>
  );
}
