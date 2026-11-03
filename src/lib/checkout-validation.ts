import { z } from "zod";

/* Strict client-side checkout validation. No card data is ever validated or
   stored here — card capture happens inside Stripe Elements. */

const NAME_RE = /^[A-Za-z][A-Za-z\s'-]*$/;
const PASSPORT_RE = /^[A-Za-z0-9]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const PHONE_RE = /^\+?[0-9\s]+$/;

const currentYear = new Date().getFullYear();

export const travellerSchema = z.object({
  title: z.string().min(1),
  gender: z.string().min(1),
  firstName: z
    .string()
    .trim()
    .min(2, "Minimum 2 alphabetic characters.")
    .max(80, "Too long.")
    .regex(NAME_RE, "Letters only — no numbers or symbols."),
  lastName: z
    .string()
    .trim()
    .min(2, "Minimum 2 alphabetic characters.")
    .max(80, "Too long.")
    .regex(NAME_RE, "Letters only — no numbers or symbols."),
  dobDay: z
    .string()
    .regex(/^\d{1,2}$/, "Numbers only.")
    .refine((v) => Number(v) >= 1 && Number(v) <= 31, "Day must be 01–31."),
  dobMonth: z
    .string()
    .regex(/^\d{1,2}$/, "Numbers only.")
    .refine((v) => Number(v) >= 1 && Number(v) <= 12, "Month must be 01–12."),
  dobYear: z
    .string()
    .regex(/^\d{4}$/, "Enter a 4-digit year.")
    .refine(
      (v) => Number(v) >= 1900 && Number(v) <= currentYear,
      `Year must be between 1900 and ${currentYear}.`,
    ),
  passportNo: z
    .string()
    .trim()
    .min(6, "Minimum 6 characters.")
    .max(40, "Too long.")
    .regex(PASSPORT_RE, "Letters and numbers only."),
  passportExpiry: z
    .string()
    .min(1, "Passport expiry is required.")
    .refine((v) => {
      const year = Number(v.slice(0, 4));
      return Number.isFinite(year) && year > currentYear;
    }, `Expiry year must be later than ${currentYear}.`),
  nationality: z.string().min(1),
  email: z
    .string()
    .trim()
    .max(160, "Too long.")
    .regex(EMAIL_RE, "Enter a valid email such as you@email.com."),
  phone: z
    .string()
    .trim()
    .regex(PHONE_RE, "Only +, numbers and spaces are allowed.")
    .refine((v) => v.replace(/\D/g, "").length >= 10, "Enter at least 10 digits."),
  address: z.string().trim().min(4, "Enter your street address.").max(240),
  country: z.string().min(1),
  city: z
    .string()
    .trim()
    .min(2, "Minimum 2 characters.")
    .max(120)
    .regex(NAME_RE, "Letters only."),
  postalCode: z
    .string()
    .trim()
    .min(3, "Minimum 3 characters.")
    .max(12)
    .regex(/^[A-Za-z0-9\s-]+$/, "Letters and numbers only."),
});

export type TravellerForm = z.infer<typeof travellerSchema>;
export type TravellerErrors = Partial<Record<keyof TravellerForm, string>>;

/** Field-level errors for the current values (used for real-time feedback). */
export function validateTraveller(values: TravellerForm): TravellerErrors {
  const result = travellerSchema.safeParse(values);
  if (result.success) return {};
  const errors: TravellerErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof TravellerForm;
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}

export const isTravellerValid = (values: TravellerForm) =>
  travellerSchema.safeParse(values).success;
