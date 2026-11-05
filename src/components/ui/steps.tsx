export function ProgressSteps({ step, total = 3, label }: { step: number; total?: number; label?: string }) {
  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center justify-between font-mono text-xs uppercase tracking-widest text-subtle">
        <span>
          Paso {step} de {total}
        </span>
        {label && <span className="text-muted">{label}</span>}
      </div>
      <div className="flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i < step ? "bg-accent" : "bg-surface-2"}`} />
        ))}
      </div>
    </div>
  );
}
