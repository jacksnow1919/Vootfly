import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type SearchOption = { value: string; label: string };

/** A dropdown with a search box, for long lists such as countries. */
export function SearchSelect({
  ariaLabel,
  value,
  shown,
  options,
  onChange,
  placeholder = "Search",
  className = "",
}: {
  ariaLabel: string;
  value: string;
  /** What the closed control shows, when it differs from the option's label. */
  shown?: string;
  options: SearchOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          className={`flex items-center justify-between gap-2 rounded-xl border border-input bg-background px-3 py-2.5 text-left text-sm outline-none focus:border-gold ${className}`}
        >
          <span className="truncate">{shown ?? selected?.label ?? "Select"}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(20rem,calc(100vw-2rem))] p-0">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>No match found.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.label}
                  onSelect={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <Check className={`mr-2 size-4 ${o.value === value ? "opacity-100" : "opacity-0"}`} aria-hidden="true" />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
