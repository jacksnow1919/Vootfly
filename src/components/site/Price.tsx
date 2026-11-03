import { useRegionSettings } from "@/lib/region-settings";
import { formatMoney } from "@/lib/hierarchy";

/**
 * Displays a real USD fare (everything PKFARE returns is USD -- confirmed
 * by testing, not assumed) converted to the visitor's chosen currency at
 * today's real rate. Shows a small "approx." marker whenever a conversion
 * actually happened, so it's never mistaken for a native quote in that
 * currency. Falls back to the real USD amount, unmarked, if rates haven't
 * loaded or the target currency isn't available.
 */
export function Price({ usdAmount, className }: { usdAmount: number; className?: string }) {
  const { convert } = useRegionSettings();
  const { amount, currency, converted } = convert(usdAmount);
  return (
    <span className={className}>
      {formatMoney(amount, currency)}
      {converted ? <sup className="ml-0.5 text-[9px] font-normal text-muted-foreground">approx.</sup> : null}
    </span>
  );
}
