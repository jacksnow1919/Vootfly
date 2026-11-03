import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MapPin, Phone, Mail } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Us | VootFly" },
      {
        name: "description",
        content:
          "Contact VootFly — call +1-800-773-6613, email info@vootfly.com or send us a message and our travel experts will respond within hours.",
      },
      { property: "og:title", content: "Contact Us — VootFly" },
      { property: "og:description", content: "Call or email the VootFly team about your booking." },
    ],
  }),
  component: ContactPage,
});

const items = [
  { icon: <MapPin className="size-4" />, text: "16007 Merrill Avenue, Apartment 52, Fontana, California 92335" },
  { icon: <Phone className="size-4" />, text: "+1-800-773-6613" },
  { icon: <Mail className="size-4" />, text: "info@vootfly.com" },
];

function ContactPage() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", message: "" });
  const set = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="min-h-[100dvh] bg-secondary/40 pb-24">
      <div className="bg-navy px-4 py-14 text-center text-navy-foreground sm:py-20">
        <h1 className="font-display text-3xl font-semibold sm:text-5xl">Contact Us!</h1>
        <p className="mt-2 font-display text-xl text-navy-foreground/80 sm:text-2xl">
          VootFly
        </p>
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-2">
        <div className="rounded-2xl bg-[#E0C17B] p-6 shadow-card sm:p-8">
          <h2 className="font-display text-2xl font-semibold text-white">Contact Information</h2>
          <div className="mt-3 h-px w-full bg-white/40" />
          <ul className="mt-6 space-y-4">
            {items.map((i) => (
              <li key={i.text} className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full border border-white text-white">
                  {i.icon}
                </span>
                <span className="min-w-0 rounded-full border border-white px-4 py-2.5 text-sm font-semibold text-white">
                  {i.text}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
          <h2 className="font-display text-2xl font-semibold text-navy">Send us a message</h2>
          <form
            className="mt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setSent(true);
            }}
          >
            <Input label="Full Name" value={form.name} onChange={set("name")} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Phone Number" type="tel" value={form.phone} onChange={set("phone")} />
              <Input label="E-mail" type="email" value={form.email} onChange={set("email")} />
            </div>
            <label className="relative z-20 block">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Message
              </span>
              <textarea
                rows={5}
                value={form.message}
                onChange={(e) => set("message")(e.target.value)}
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-gold"
              />
            </label>
            <div>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-navy px-6 py-3 text-sm font-bold text-navy-foreground transition hover:brightness-125"
              >
                Submit
              </button>
            </div>
            {sent ? (
              <p className="text-sm font-semibold text-navy">
                Thank you — our travel desk will be in touch shortly.
              </p>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="relative z-20 block">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-gold"
      />
    </label>
  );
}
