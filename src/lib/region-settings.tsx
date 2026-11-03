import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getExchangeRates, type ExchangeRates } from "@/lib/currency.functions";

/** Comprehensive world-language list (ISO 639-1 codes + native names).
 * Selecting a language here does not translate VootFly's page content
 * today (see RegionSettingsButton's doc comment) -- this is the full
 * real selector VootFly's future translations would key off, not a
 * cosmetic subset. */
export const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "pt", name: "Português" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "it", name: "Italiano" },
  { code: "nl", name: "Nederlands" },
  { code: "sv", name: "Svenska" },
  { code: "no", name: "Norsk" },
  { code: "da", name: "Dansk" },
  { code: "fi", name: "Suomi" },
  { code: "is", name: "Íslenska" },
  { code: "pl", name: "Polski" },
  { code: "cs", name: "Čeština" },
  { code: "sk", name: "Slovenčina" },
  { code: "hu", name: "Magyar" },
  { code: "ro", name: "Română" },
  { code: "bg", name: "Български" },
  { code: "el", name: "Ελληνικά" },
  { code: "ru", name: "Русский" },
  { code: "uk", name: "Українська" },
  { code: "tr", name: "Türkçe" },
  { code: "he", name: "עברית" },
  { code: "ar", name: "العربية" },
  { code: "fa", name: "فارسی" },
  { code: "ur", name: "اردو" },
  { code: "hi", name: "हिन्दी" },
  { code: "bn", name: "বাংলা" },
  { code: "pa", name: "ਪੰਜਾਬੀ" },
  { code: "gu", name: "ગુજરાતી" },
  { code: "ta", name: "தமிழ்" },
  { code: "te", name: "తెలుగు" },
  { code: "kn", name: "ಕನ್ನಡ" },
  { code: "ml", name: "മലയാളം" },
  { code: "mr", name: "मराठी" },
  { code: "si", name: "සිංහල" },
  { code: "ne", name: "नेपाली" },
  { code: "th", name: "ไทย" },
  { code: "vi", name: "Tiếng Việt" },
  { code: "id", name: "Bahasa Indonesia" },
  { code: "ms", name: "Bahasa Melayu" },
  { code: "tl", name: "Filipino" },
  { code: "km", name: "ខ្មែរ" },
  { code: "lo", name: "ລາວ" },
  { code: "my", name: "မြန်မာ" },
  { code: "zh", name: "中文" },
  { code: "zh-Hant", name: "繁體中文" },
  { code: "ja", name: "日本語" },
  { code: "ko", name: "한국어" },
  { code: "sw", name: "Kiswahili" },
  { code: "am", name: "አማርኛ" },
  { code: "ha", name: "Hausa" },
  { code: "yo", name: "Yorùbá" },
  { code: "zu", name: "isiZulu" },
  { code: "af", name: "Afrikaans" },
  { code: "hr", name: "Hrvatski" },
  { code: "sr", name: "Српски" },
  { code: "sl", name: "Slovenščina" },
  { code: "lt", name: "Lietuvių" },
  { code: "lv", name: "Latviešu" },
  { code: "et", name: "Eesti" },
] as const;
export type LanguageCode = (typeof LANGUAGES)[number]["code"];

/** Country/region list with a sensible default currency per country. Not
 * exhaustive (~45 major markets) -- covers the routes and destinations
 * VootFly actually serves today; easy to extend. */
export const COUNTRIES = [
  { code: "US", name: "United States", currency: "USD" },
  { code: "CA", name: "Canada", currency: "CAD" },
  { code: "GB", name: "United Kingdom", currency: "GBP" },
  { code: "IE", name: "Ireland", currency: "EUR" },
  { code: "FR", name: "France", currency: "EUR" },
  { code: "DE", name: "Germany", currency: "EUR" },
  { code: "ES", name: "Spain", currency: "EUR" },
  { code: "IT", name: "Italy", currency: "EUR" },
  { code: "PT", name: "Portugal", currency: "EUR" },
  { code: "NL", name: "Netherlands", currency: "EUR" },
  { code: "CH", name: "Switzerland", currency: "CHF" },
  { code: "SE", name: "Sweden", currency: "SEK" },
  { code: "NO", name: "Norway", currency: "NOK" },
  { code: "DK", name: "Denmark", currency: "DKK" },
  { code: "PL", name: "Poland", currency: "PLN" },
  { code: "TR", name: "Turkey", currency: "TRY" },
  { code: "AE", name: "United Arab Emirates", currency: "AED" },
  { code: "SA", name: "Saudi Arabia", currency: "SAR" },
  { code: "QA", name: "Qatar", currency: "QAR" },
  { code: "IL", name: "Israel", currency: "ILS" },
  { code: "EG", name: "Egypt", currency: "EGP" },
  { code: "IN", name: "India", currency: "INR" },
  { code: "PK", name: "Pakistan", currency: "PKR" },
  { code: "BD", name: "Bangladesh", currency: "BDT" },
  { code: "LK", name: "Sri Lanka", currency: "LKR" },
  { code: "SG", name: "Singapore", currency: "SGD" },
  { code: "MY", name: "Malaysia", currency: "MYR" },
  { code: "TH", name: "Thailand", currency: "THB" },
  { code: "ID", name: "Indonesia", currency: "IDR" },
  { code: "PH", name: "Philippines", currency: "PHP" },
  { code: "VN", name: "Vietnam", currency: "VND" },
  { code: "JP", name: "Japan", currency: "JPY" },
  { code: "KR", name: "South Korea", currency: "KRW" },
  { code: "CN", name: "China", currency: "CNY" },
  { code: "HK", name: "Hong Kong", currency: "HKD" },
  { code: "TW", name: "Taiwan", currency: "TWD" },
  { code: "AU", name: "Australia", currency: "AUD" },
  { code: "NZ", name: "New Zealand", currency: "NZD" },
  { code: "ZA", name: "South Africa", currency: "ZAR" },
  { code: "NG", name: "Nigeria", currency: "NGN" },
  { code: "KE", name: "Kenya", currency: "KES" },
  { code: "BR", name: "Brazil", currency: "BRL" },
  { code: "MX", name: "Mexico", currency: "MXN" },
  { code: "AR", name: "Argentina", currency: "ARS" },
  { code: "CO", name: "Colombia", currency: "COP" },
] as const;
export type CountryCode = (typeof COUNTRIES)[number]["code"];

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", CAD: "CA$", GBP: "£", EUR: "€", CHF: "CHF", SEK: "kr", NOK: "kr", DKK: "kr",
  PLN: "zł", TRY: "₺", AED: "AED", SAR: "SAR", QAR: "QAR", ILS: "₪", EGP: "E£",
  INR: "₹", PKR: "Rs", BDT: "৳", LKR: "Rs", SGD: "S$", MYR: "RM", THB: "฿", IDR: "Rp",
  PHP: "₱", VND: "₫", JPY: "¥", KRW: "₩", CNY: "¥", HKD: "HK$", TWD: "NT$",
  AUD: "A$", NZD: "NZ$", ZAR: "R", NGN: "₦", KES: "KSh", BRL: "R$", MXN: "MX$",
  ARS: "AR$", COP: "COP$",
};

/** The full selectable currency list -- deliberately NOT derived from
 * whether the Frankfurter fetch has succeeded yet. If it were, opening
 * the settings panel before that async fetch resolves (very plausible --
 * it's a network call) would show only "USD" as a choice, which looks
 * exactly like the currency picker being broken. Picking a currency here
 * always works immediately; convert() falls back to plain USD display
 * only if a rate for it genuinely isn't available once rates do load. */
export const SELECTABLE_CURRENCIES = Object.keys(CURRENCY_SYMBOLS).sort();

const STORAGE_KEY = "vootfly.region_settings.v1";

type StoredSettings = { language: LanguageCode; country: CountryCode; currency: string };
const DEFAULT_SETTINGS: StoredSettings = { language: "en", country: "US", currency: "USD" };

function readStored(): StoredSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<StoredSettings>;
    return {
      language: LANGUAGES.some((l) => l.code === parsed.language) ? (parsed.language as LanguageCode) : "en",
      country: COUNTRIES.some((c) => c.code === parsed.country) ? (parsed.country as CountryCode) : "US",
      currency: parsed.currency && typeof parsed.currency === "string" ? parsed.currency : "USD",
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

type RegionSettingsValue = {
  language: LanguageCode;
  country: CountryCode;
  currency: string;
  setLanguage: (l: LanguageCode) => void;
  setCountry: (c: CountryCode) => void;
  setCurrency: (c: string) => void;
  rates: ExchangeRates | null;
  /** Converts a real USD amount to the selected display currency. Returns
   * the original USD amount (with a `converted: false` flag) if rates
   * haven't loaded yet or the selected currency isn't available --
   * never fabricates a rate. */
  convert: (usdAmount: number) => { amount: number; currency: string; symbol: string; converted: boolean };
};

const RegionSettingsContext = createContext<RegionSettingsValue | null>(null);

export function RegionSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<StoredSettings>(DEFAULT_SETTINGS);
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSettings(readStored());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings, hydrated]);

  useEffect(() => {
    getExchangeRates()
      .then(setRates)
      .catch(() => setRates(null));
  }, []);

  const value = useMemo<RegionSettingsValue>(
    () => ({
      language: settings.language,
      country: settings.country,
      currency: settings.currency,
      setLanguage: (language) => setSettings((p) => ({ ...p, language })),
      setCountry: (country) => setSettings((p) => ({ ...p, country })),
      setCurrency: (currency) => setSettings((p) => ({ ...p, currency })),
      rates,
      convert: (usdAmount) => {
        const target = settings.currency;
        const rate = target === "USD" ? 1 : rates?.rates[target];
        if (!rate) return { amount: usdAmount, currency: "USD", symbol: "$", converted: false };
        return {
          amount: Math.round(usdAmount * rate),
          currency: target,
          symbol: CURRENCY_SYMBOLS[target] ?? target,
          converted: target !== "USD",
        };
      },
    }),
    [settings, rates],
  );

  return <RegionSettingsContext.Provider value={value}>{children}</RegionSettingsContext.Provider>;
}

export function useRegionSettings(): RegionSettingsValue {
  const ctx = useContext(RegionSettingsContext);
  if (!ctx) throw new Error("useRegionSettings must be used within RegionSettingsProvider");
  return ctx;
}
