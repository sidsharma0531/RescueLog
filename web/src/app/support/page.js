import Logo from '@/components/Logo';

export const metadata = {
  title: 'Support — RescueLog',
  description: 'Help and contact for RescueLog.',
};

const SUPPORT_EMAIL = 'waste2taste.usa@gmail.com';

function Faq({ q, children }) {
  return (
    <div className="mt-5">
      <h3 className="text-[15px] font-semibold text-rescue-ink">{q}</h3>
      <div className="mt-1.5 text-[15px] leading-relaxed text-gray-700">
        {children}
      </div>
    </div>
  );
}

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-2xl px-5 py-12">
        <div className="mb-8 flex items-center gap-2.5">
          <Logo size={36} />
          <span className="text-lg font-bold text-rescue-ink">RescueLog</span>
        </div>

        <h1 className="text-2xl font-bold text-rescue-ink">Support</h1>

        <p className="mt-3 text-[15px] leading-relaxed text-gray-700">
          RescueLog is an AI-powered tool that helps food rescue
          organizations track and categorize rescued food at distribution
          events. A driver or volunteer photographs the food on the tables;
          the app categorizes it with Claude Vision and produces a summary
          for the operating organization&apos;s reporting and grant
          applications.
        </p>

        <h2 className="mt-8 text-base font-semibold text-rescue-ink">
          Contact
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-gray-700">
          If you need help, email{' '}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-semibold text-rescue-green hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>{' '}
          and we&apos;ll get back to you.
        </p>

        <h2 className="mt-8 text-base font-semibold text-rescue-ink">
          Frequently asked questions
        </h2>

        <Faq q="How do I log in?">
          Your organization gives you a name and a 4-digit PIN. On the login
          screen, tap the Driver dropdown, pick your name, and enter your
          PIN. The app signs you in automatically as soon as all four
          digits are entered.
        </Faq>

        <Faq q="How do I submit a pop-up log?">
          From the home screen, tap <strong>New Pop-Up Log</strong>. The app
          picks up your location, then you take photos of the food on the
          tables (or upload existing photos from your gallery), optionally
          add a weight estimate and any notes, and tap{' '}
          <strong>Submit Pop-Up Log</strong>. The AI categorizes the photos
          within about a minute and the summary appears on the
          organization&apos;s dashboard.
        </Faq>

        <Faq q="Why does the app need camera and location access?">
          Camera access lets you photograph the rescued food at each pop-up.
          Location is used to identify the pop-up site so each log is tied
          to the right place. We don&apos;t share or sell this data — see
          the{' '}
          <a
            href="/privacy"
            className="font-semibold text-rescue-green hover:underline"
          >
            Privacy Policy
          </a>{' '}
          for details.
        </Faq>

        <Faq q="Who do I contact for help?">
          Email{' '}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-semibold text-rescue-green hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>
          {' '}with any question — technical or otherwise — and we&apos;ll
          respond.
        </Faq>
      </div>
    </main>
  );
}
