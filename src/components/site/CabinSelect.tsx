import { Check, ChevronDown, Armchair } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type Cabin = "Economy" | "PremiumEconomy" | "Business" | "First";

const options: { value: Cabin; label: string }[] = [
  { value: "Economy", label: "Economy" },
  { value: "PremiumEconomy", label: "Premium Economy" },
  { value: "Business", label: "Business" },
  { value: "First", label: "First" },
];

export function CabinSelect({
  value,
  onChange,
  bare = false,
}: {
  value: Cabin;
  onChange: (c: Cabin) => void;
  /** Plain text with no pill around it, for the homepage search card. */
  bare?: boolean;
}) {
  const current = options.find((o) => o.value === value)?.label ?? "Economy";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Cabin class"
          className={`inline-flex min-h-10 min-w-0 items-center gap-2 text-navy transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
            bare
              ? "-ml-1 rounded-lg px-1 py-1.5 text-sm font-semibold hover:text-primary"
              : "rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold shadow-sm hover:border-primary sm:text-sm"
          }`}
        >
          <Armchair className="size-4 shrink-0 text-primary" />
          <span className="truncate">{current}</span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52 rounded-2xl p-1.5">
        {options.map((o) => (
          <DropdownMenuItem
            key={o.value}
            onSelect={() => onChange(o.value)}
            className="cursor-pointer rounded-xl px-3 py-2 text-sm font-semibold text-navy transition focus:bg-primary/10 focus:text-primary"
          >
            <span className="flex-1">{o.label}</span>
            {value === o.value ? <Check className="size-4 text-primary" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
