import type { ReactNode } from "react";

export function PageShell({
  title,
  eyebrow,
  subtitle,
  children,
}: {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] bg-secondary/40 pb-20">
      <div className="bg-navy px-4 py-8 text-navy-foreground sm:py-12">
        <div className="mx-auto max-w-7xl">
          {eyebrow ? (
            <span className="inline-flex rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gold">
              {eyebrow}
            </span>
          ) : null}
          <h1 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">{title}</h1>
          {subtitle ? (
            <p className="mt-2 max-w-2xl text-sm text-navy-foreground/70">{subtitle}</p>
          ) : null}
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-6">{children}</div>
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-4 shadow-card sm:p-6 ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="font-display text-xl font-semibold text-navy">{children}</h2>;
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="font-display text-2xl font-semibold text-navy">{value}</p>
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}

export function Field({
  label,
  type = "text",
  placeholder,
  full,
  value,
  onChange,
}: {
  label: string;
  type?: string;
  placeholder?: string;
  full?: boolean;
  value?: string;
  onChange?: (v: string) => void;
}) {
  return (
    <label className={`relative z-20 block ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-gold"
      />
    </label>
  );
}

export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold text-navy">
      {children}
    </span>
  );
}

export function Steps({ current }: { current: number }) {
  const labels = ["Search", "Fare", "Traveller", "Upsell", "Payment", "Confirm"];
  return (
    <ol className="flex flex-wrap gap-2 text-[11px] font-semibold">
      {labels.map((l, i) => (
        <li
          key={l}
          className={`rounded-full px-3 py-1 ${
            i + 1 <= current ? "bg-gold text-gold-foreground" : "bg-secondary text-muted-foreground"
          }`}
        >
          {i + 1}. {l}
        </li>
      ))}
    </ol>
  );
}
