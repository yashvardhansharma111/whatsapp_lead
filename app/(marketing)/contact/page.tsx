import type { Metadata } from "next";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import ContactForm from "@/components/marketing/ContactForm";

export const metadata: Metadata = {
  title: "Contact Us — Waboxa",
  description:
    "Talk to the Waboxa team. Book a demo, ask a question, or get help connecting your WhatsApp Business number.",
};

const CONTACT_DETAILS = [
  {
    Icon: Mail,
    label: "Email us",
    value: "info@waboxa.com",
    href: "mailto:info@waboxa.com",
  },
  {
    Icon: Phone,
    label: "Call us",
    value: "+91 7079000777",
    href: "tel:+917079000777",
  },
  {
    Icon: Clock,
    label: "Support hours",
    value: "Monday to Saturday, 9 AM – 8 PM IST",
    href: null,
  },
];

const OFFICES = [
  {
    label: "Registered Office",
    value: "MNR Complex, 17th Cross, Sampige Road, Malleshwaram, Bangalore, Karnataka 560003",
  },
  {
    label: "Patna HQ",
    value: "House No. 8, Kasturba Path, Axis Bank ATM Compound, Boring Road, Near Jamuna Apartment, Patna, Bihar 800001",
  },
  {
    label: "Delhi Office",
    value: "8, Vaishali Enclave, Pitampura, New Delhi, Delhi 110034",
  },
  {
    label: "Mumbai Office",
    value: "Office No. G-139, Haware Fantasia Business Park, Behind Inorbit Mall, Near Vashi Railway Station, Plot No. 47, Sector 30 A, Mumbai, Maharashtra 400705",
  },
];

export default function ContactPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-gradient-to-b from-white via-emerald-50/60 to-white py-16 sm:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-[30rem] w-[52rem] -translate-x-1/2 -translate-y-1/3 rounded-full bg-[radial-gradient(closest-side,rgba(16,185,129,0.16),transparent_100%)]"
        />
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
            Let&apos;s talk
          </h1>
          <p className="mt-6 text-base text-gray-600 sm:text-lg">
            Book a demo, ask a pricing question, or get help connecting your WhatsApp number. A real
            person replies within one business day.
          </p>
        </div>
      </section>

      {/* Info + form */}
      <section className="pb-16 sm:pb-20 lg:pb-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-5 lg:gap-16 lg:px-8">
          {/* Company info */}
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">Get in touch</h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              Prefer to reach out directly? Here is where to find us.
            </p>

            <ul className="mt-8 space-y-6">
              {CONTACT_DETAILS.map(({ Icon, label, value, href }) => (
                <li key={label} className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 ring-1 ring-inset ring-emerald-600/15">
                    <Icon className="h-5 w-5 text-emerald-600" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-gray-900">{label}</span>
                    {href ? (
                      <a
                        href={href}
                        className="mt-0.5 block text-sm text-gray-600 transition-colors hover:text-emerald-700"
                      >
                        {value}
                      </a>
                    ) : (
                      <span className="mt-0.5 block text-sm leading-relaxed text-gray-600">
                        {value}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>

            {/* Offices */}
            <div className="mt-8">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <MapPin className="h-4 w-4 text-emerald-600" />
                Our Offices
              </h3>
              <ul className="mt-4 space-y-4">
                {OFFICES.map(({ label, value }) => (
                  <li key={label} className="rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{label}</p>
                    <p className="mt-1 text-sm leading-relaxed text-gray-600">{value}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 rounded-2xl border border-gray-200 bg-gray-50 p-6">
              <p className="text-sm font-semibold text-gray-900">Already a customer?</p>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                Raise a ticket from inside your dashboard and our support team will pick it up right
                away — it is the fastest route to an answer.
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-3">
            <ContactForm />
          </div>
        </div>
      </section>
    </div>
  );
}
