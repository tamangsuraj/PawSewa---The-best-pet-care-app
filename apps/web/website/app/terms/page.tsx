import Link from 'next/link';
import { PageShell } from '@/components/layout/PageShell';
import { PageHero } from '@/components/layout/PageHero';
import { PageContent } from '@/components/layout/PageContent';

export const metadata = { title: 'Terms of Service — PawSewa' };

const SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    body: 'By accessing or using PawSewa ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, please discontinue use immediately.',
  },
  {
    title: '2. Description of Service',
    body: 'PawSewa provides a platform connecting pet owners with licensed veterinarians, pet-care professionals, and pet-supply retailers in Nepal. Services include home vet visits, grooming, boarding, and product deliveries.',
  },
  {
    title: '3. User Accounts',
    body: 'You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account. Notify us immediately of any unauthorized access at support@pawsewa.app.',
  },
  {
    title: '4. Bookings & Payments',
    body: 'All service bookings are subject to partner availability. Payments are processed via Khalti, Fonepay, or cash on delivery. Refunds follow our cancellation policy communicated at booking.',
  },
  {
    title: '5. Prohibited Conduct',
    body: 'You may not use PawSewa for unlawful purposes, to transmit harmful content, to impersonate others, or to interfere with the platform\'s operation.',
  },
  {
    title: '6. Limitation of Liability',
    body: 'PawSewa acts as an intermediary platform. To the fullest extent permitted by law, PawSewa shall not be liable for indirect, incidental, or consequential damages arising from use of the Service.',
  },
  {
    title: '7. Governing Law',
    body: 'These Terms are governed by the laws of Nepal. Disputes shall be subject to the exclusive jurisdiction of courts in Kathmandu.',
  },
  {
    title: '8. Changes to Terms',
    body: 'We may update these Terms at any time. Continued use of PawSewa after changes constitutes acceptance. We will notify registered users of material changes via email.',
  },
  {
    title: '9. Contact',
    body: 'For questions about these Terms, contact us at legal@pawsewa.app or through the in-app support chat.',
  },
];

export default function TermsPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Legal"
        title="Terms of Service"
        subtitle="Last updated: January 2025"
      />
      <PageContent compact className="max-w-3xl py-12">
        <div className="rounded-2xl border border-[#703418]/10 bg-white p-8 shadow-sm">
          <p className="mb-8 text-sm leading-relaxed text-[#2c241c]/70">
            Please read these Terms of Service carefully before using PawSewa. These terms govern
            your access to and use of our services, including our website, mobile applications, and
            any related services.
          </p>
          <div className="space-y-8">
            {SECTIONS.map(({ title, body }) => (
              <section key={title}>
                <h2 className="mb-2 font-display text-lg font-semibold text-[#2c241c]">{title}</h2>
                <p className="text-sm leading-relaxed text-[#2c241c]/75">{body}</p>
              </section>
            ))}
          </div>
          <div className="mt-10 border-t border-[#703418]/10 pt-6">
            <Link
              href="/privacy"
              className="text-sm font-semibold text-[#703418] underline-offset-2 hover:underline"
            >
              Read our Privacy Policy →
            </Link>
          </div>
        </div>
      </PageContent>
    </PageShell>
  );
}
