import Link from 'next/link';
import { PageShell } from '@/components/layout/PageShell';
import { PageHero } from '@/components/layout/PageHero';
import { PageContent } from '@/components/layout/PageContent';

export const metadata = { title: 'Privacy Policy — PawSewa' };

const SECTIONS = [
  {
    title: '1. Information We Collect',
    body: 'We collect information you provide directly (name, email, phone, pet details), information collected automatically (device data, usage logs, GPS location when you use map features), and information from third parties (e.g., Khalti payment status).',
  },
  {
    title: '2. How We Use Your Information',
    body: 'We use your information to: provide and improve our services; match you with appropriate veterinarians or care providers; process payments; send service notifications and booking updates; comply with legal obligations.',
  },
  {
    title: '3. Location Data',
    body: 'PawSewa collects your GPS location to facilitate home vet visits and deliveries. Location data is only collected with your explicit consent and is not shared with third parties for advertising purposes.',
  },
  {
    title: '4. Sharing Your Information',
    body: 'We share your information with: service providers (vets, groomers, riders) only as necessary to fulfill your booking; payment processors (Khalti, Fonepay) for transaction processing; law enforcement when required by law. We do not sell your personal data.',
  },
  {
    title: '5. Data Retention',
    body: 'We retain your personal data for as long as your account is active or as needed to provide services. You may request deletion of your account and associated data by contacting support@pawsewa.app.',
  },
  {
    title: '6. Security',
    body: 'We implement industry-standard security measures including encrypted data transmission (TLS), hashed passwords, and access controls. No system is completely secure; please use a strong password and report any suspected breach.',
  },
  {
    title: '7. Cookies & Analytics',
    body: 'Our website uses cookies for session management and basic analytics. You can disable cookies in your browser settings, but some features may not function properly.',
  },
  {
    title: '8. Children\'s Privacy',
    body: 'PawSewa is not directed to children under 13. We do not knowingly collect personal information from children. If you believe a child has provided us data, contact us to have it removed.',
  },
  {
    title: '9. Your Rights',
    body: 'You have the right to access, correct, or delete your personal data. To exercise these rights, contact us at privacy@pawsewa.app. We will respond within 30 days.',
  },
  {
    title: '10. Changes to This Policy',
    body: 'We may update this Privacy Policy periodically. We will notify you of significant changes via email or in-app notification. Continued use of PawSewa after changes constitutes acceptance.',
  },
  {
    title: '11. Contact Us',
    body: 'For privacy-related questions or concerns, contact us at privacy@pawsewa.app or through the in-app support chat.',
  },
];

export default function PrivacyPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Legal"
        title="Privacy Policy"
        subtitle="Last updated: January 2025"
      />
      <PageContent compact className="max-w-3xl py-12">
        <div className="rounded-2xl border border-[#703418]/10 bg-white p-8 shadow-sm">
          <p className="mb-8 text-sm leading-relaxed text-[#2c241c]/70">
            At PawSewa, we take your privacy seriously. This Privacy Policy explains how we collect,
            use, and protect your personal information when you use our platform.
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
              href="/terms"
              className="text-sm font-semibold text-[#703418] underline-offset-2 hover:underline"
            >
              Read our Terms of Service →
            </Link>
          </div>
        </div>
      </PageContent>
    </PageShell>
  );
}
