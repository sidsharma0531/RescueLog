import Logo from '@/components/Logo';

export const metadata = {
  title: 'Privacy Policy — RescueLog',
  description: 'How RescueLog handles information.',
};

function Section({ title, children }) {
  return (
    <section>
      <h2 className="mt-7 text-base font-semibold text-rescue-ink">{title}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-2xl px-5 py-12">
        <div className="mb-8 flex items-center gap-2.5">
          <Logo size={36} />
          <span className="text-lg font-bold text-rescue-ink">RescueLog</span>
        </div>

        <h1 className="text-2xl font-bold text-rescue-ink">Privacy Policy</h1>
        <p className="mt-1 text-sm text-gray-500">Last updated: May 18, 2026</p>

        <div className="mt-5 text-[15px] leading-relaxed text-gray-700">
          <p>
            RescueLog is an operational tool used by staff and volunteers of
            food rescue organizations to photograph and log rescued food at
            distribution events. This policy explains what information the app
            handles and why.
          </p>

          <Section title="Information we collect">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Photos of rescued food taken or selected by staff at pop-up
                distribution events.
              </li>
              <li>
                The GPS location and timestamp of an event, captured when a log
                is submitted.
              </li>
              <li>
                The name of the staff member or volunteer logging the event,
                from a preset account.
              </li>
              <li>Optional weight estimates and notes entered by staff.</li>
            </ul>
            <p>
              RescueLog does not collect information about members of the
              public who receive food, and it does not request or store
              contact details, payment information, or advertising identifiers.
            </p>
          </Section>

          <Section title="How we use information">
            <p>Collected information is used only to:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Categorize rescued food and estimate quantities using AI image
                analysis.
              </li>
              <li>
                Produce reports and summaries for the operating
                organization&apos;s internal use, grant applications, and donor
                reporting.
              </li>
            </ul>
          </Section>

          <Section title="How information is shared">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Food photos are sent to Anthropic&apos;s Claude API for
                automated categorization. They are processed to generate the
                analysis and are not used to train models.
              </li>
              <li>
                Logs, photos, and analysis are stored using Supabase (database
                and file storage) on behalf of the operating organization.
              </li>
              <li>
                We do not sell information, show advertising, or share
                information with third parties for marketing.
              </li>
            </ul>
          </Section>

          <Section title="Data storage and security">
            <p>
              Information is stored in access-controlled cloud infrastructure.
              Dashboard access is limited to authorized administrators of the
              operating organization.
            </p>
          </Section>

          <Section title="Data retention">
            <p>
              Logs and photos are retained for as long as they are useful to
              the operating organization for reporting and recordkeeping, and
              may be deleted on request.
            </p>
          </Section>

          <Section title="Children's privacy">
            <p>
              RescueLog is a workplace tool intended for organizational staff
              and volunteers. It is not directed to children and does not
              knowingly collect information from children.
            </p>
          </Section>

          <Section title="Changes to this policy">
            <p>
              We may update this policy from time to time; the &quot;last
              updated&quot; date above will reflect any change.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about this policy can be directed to the operating
              organization.
            </p>
          </Section>
        </div>
      </div>
    </main>
  );
}
