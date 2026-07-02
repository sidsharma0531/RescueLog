import { Fraunces, Inter } from 'next/font/google';

// ──────────────────────────────────────────────────────────────────
// RescueLog public impact page (/impact). Same visual language as the
// landing page: Fraunces + Inter, forest green + cream, real app icon.
// Fully self-contained, zero client JS.
//
// ⬇️⬇️  EDIT THE NUMBERS IN `IMPACT` BELOW — that's the whole update.  ⬇️⬇️
// While SAMPLE_NUMBERS is true, a "sample numbers" ribbon shows so
// placeholder stats can never be mistaken for real ones. Flip it to
// false once the real figures are in.
// ──────────────────────────────────────────────────────────────────

const SAMPLE_NUMBERS = true;

const IMPACT = {
  asOf: 'July 2026',        // shown as "Updated {asOf}"
  lbsRescued: 25000,        // total pounds logged through RescueLog
  estRetailValue: 76000,    // total estimated retail value (USD)
  eventsLogged: 150,        // rescue events (pop-ups, carts, pickups)
  photosAnalyzed: 2400,     // photos run through the AI
  sitesServed: 18,          // distinct distribution sites
  organizations: 2,         // partner organizations on the platform

  // Category mix (percent of rescued weight). Keep the total near 100.
  categoryMix: [
    { label: 'Produce', pct: 34, color: '#4CAF50' },
    { label: 'Bakery & Bread', pct: 19, color: '#C98A4B' },
    { label: 'Shelf-Stable', pct: 17, color: '#9C8B6E' },
    { label: 'Grab-n-Go', pct: 10, color: '#E8832A' },
    { label: 'Meat & Poultry', pct: 8, color: '#C5453B' },
    { label: 'Dairy & Eggs', pct: 7, color: '#5B9BD5' },
    { label: 'Other', pct: 5, color: '#9AA0A6' },
  ],
};

// Conversion factors for the derived stats. Adjust if you prefer other
// sources; the page cites these next to each number.
const LBS_PER_MEAL = 1.2;        // Feeding America: 1.2 lbs ≈ 1 meal
const CO2E_PER_LB = 3.8;         // ReFED estimate: lbs CO2e avoided per lb rescued
const CAR_YEAR_CO2E_LBS = 10141; // EPA: avg passenger car per year (4.6 metric tons)

// ──────────────────────────────────────────────────────────────────

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-fraunces',
});
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata = {
  title: 'Impact | RescueLog',
  description:
    'Food rescued, measured, and proven. Every number comes from photos volunteers snapped in the field, analyzed and logged by RescueLog.',
  // Unlisted while the numbers are placeholders: nothing links here and search
  // engines are told not to index. REMOVE robots (and flip SAMPLE_NUMBERS,
  // and add a nav link) when the real figures go in.
  robots: { index: false, follow: false },
};

const PINE = '#1B4332';
const MOSS = '#2D6A4F';
const LEAF = '#52B788';
const CREAM = '#F5F7F0';

const CONTACT_EMAIL = 'waste2taste.usa@gmail.com';
const DEMO_MAILTO =
  `mailto:${CONTACT_EMAIL}` +
  '?subject=' +
  encodeURIComponent('RescueLog demo request');

const fmt = (n) => Number(n).toLocaleString('en-US');
const meals = Math.round(IMPACT.lbsRescued / LBS_PER_MEAL);
const co2e = Math.round(IMPACT.lbsRescued * CO2E_PER_LB);
const carYears = Math.max(1, Math.round(co2e / CAR_YEAR_CO2E_LBS));

export default function ImpactPage() {
  return (
    <div
      className={`${fraunces.variable} ${inter.variable} min-h-screen bg-[#F5F7F0] text-[#1E2A23]`}
      style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif' }}
    >
      <Nav />
      {SAMPLE_NUMBERS && (
        <div className="bg-amber-100 px-4 py-2 text-center text-xs font-bold text-amber-900">
          Preview with sample numbers. Real figures coming soon.
        </div>
      )}
      <main>
        <Hero />
        <HeadlineStats />
        <CategoryMix />
        <Equivalents />
        <Methodology />
        <Cta />
      </main>
      <Footer />
    </div>
  );
}

// ─── Shared bits (matches the landing page) ────────────────────────

function Leaf({ size = 34 }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/rescuelog-icon.png"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className="shrink-0 rounded-xl"
      style={{ width: size, height: size }}
    />
  );
}

function Display({ children, className = '' }) {
  return (
    <h2
      className={`font-semibold tracking-tight ${className}`}
      style={{ fontFamily: 'var(--font-fraunces), Georgia, serif' }}
    >
      {children}
    </h2>
  );
}

function Eyebrow({ children, light = false }) {
  return (
    <p
      className="mb-3 text-xs font-bold uppercase tracking-[0.18em]"
      style={{ color: light ? LEAF : MOSS }}
    >
      {children}
    </p>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#1B4332]/10 bg-[#F5F7F0]/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
        <a href="/" className="flex items-center gap-2.5">
          <Leaf size={34} />
          <span
            className="text-lg font-semibold tracking-tight"
            style={{ fontFamily: 'var(--font-fraunces), Georgia, serif' }}
          >
            RescueLog
          </span>
        </a>
        <div className="flex items-center gap-2 sm:gap-4">
          <a
            href="/"
            className="whitespace-nowrap rounded-lg px-2 py-2 text-sm font-semibold text-[#2D6A4F] transition hover:text-[#1B4332] sm:px-3"
          >
            Home
          </a>
          <a
            href={DEMO_MAILTO}
            className="whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 sm:px-4"
            style={{ backgroundColor: PINE }}
          >
            Request a Demo
          </a>
        </div>
      </div>
    </header>
  );
}

// ─── Hero ──────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <svg
        className="pointer-events-none absolute -right-24 -top-24 h-[440px] w-[440px] opacity-[0.05]"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          fill={PINE}
          d="M6.05 8.05c-2.73 2.73-2.73 7.15-.02 9.88 1.47-3.4 4.09-6.24 7.36-7.93-2.77 2.34-4.71 5.61-5.39 9.32 2.6 1.23 5.8.78 7.95-1.37C19.43 14.47 20 4 20 4S9.53 4.57 6.05 8.05z"
        />
      </svg>
      <div className="mx-auto max-w-6xl px-5 pb-12 pt-14 sm:px-8 lg:pt-20">
        <Eyebrow>Our impact</Eyebrow>
        <h1
          className="max-w-3xl text-[2.4rem] font-semibold leading-[1.08] tracking-tight sm:text-5xl"
          style={{ fontFamily: 'var(--font-fraunces), Georgia, serif' }}
        >
          Food rescued, measured, and <span style={{ color: MOSS }}>proven.</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#1E2A23]/75">
          Every number on this page comes from photos volunteers snapped in the
          field, analyzed and logged by RescueLog. No estimates on a whiteboard,
          just receipts.
        </p>
        <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#2D6A4F]/25 bg-white/70 px-3.5 py-1.5 text-xs font-semibold text-[#2D6A4F]">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: LEAF }} />
          Updated {IMPACT.asOf}
        </p>
      </div>
    </section>
  );
}

// ─── Headline stats ────────────────────────────────────────────────

function BigStat({ value, label, sub }) {
  return (
    <div className="rounded-2xl bg-white/[0.06] p-6 text-center backdrop-blur-sm sm:p-8">
      <p
        className="text-4xl font-semibold tracking-tight text-white sm:text-5xl"
        style={{ fontFamily: 'var(--font-fraunces), Georgia, serif' }}
      >
        {value}
      </p>
      <p className="mt-2 text-xs font-bold uppercase tracking-wide" style={{ color: LEAF }}>
        {label}
      </p>
      {sub && <p className="mt-1 text-xs text-white/55">{sub}</p>}
    </div>
  );
}

function HeadlineStats() {
  return (
    <section style={{ backgroundColor: PINE }}>
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 lg:py-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <BigStat value={fmt(IMPACT.lbsRescued)} label="Pounds rescued" sub="Logged photo by photo" />
          <BigStat
            value={`$${fmt(IMPACT.estRetailValue)}`}
            label="Est. retail value"
            sub="Priced at the source store"
          />
          <BigStat value={fmt(meals)} label="Meals equivalent" sub={`${LBS_PER_MEAL} lbs per meal`} />
          <BigStat value={fmt(IMPACT.eventsLogged)} label="Rescue events" sub="Pop-ups, carts, pickups" />
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-white/60">
          <span>
            <span className="font-bold text-white">{fmt(IMPACT.photosAnalyzed)}</span> photos analyzed
          </span>
          <span>
            <span className="font-bold text-white">{fmt(IMPACT.sitesServed)}</span> sites served
          </span>
          <span>
            <span className="font-bold text-white">{fmt(IMPACT.organizations)}</span> partner organizations
          </span>
        </div>
      </div>
    </section>
  );
}

// ─── Category mix ──────────────────────────────────────────────────

function CategoryMix() {
  const total = IMPACT.categoryMix.reduce((s, c) => s + c.pct, 0);
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
        <div className="max-w-2xl">
          <Eyebrow>What gets rescued</Eyebrow>
          <Display className="text-3xl sm:text-[2.4rem] sm:leading-[1.1]">
            Not just pounds. The full picture, by category.
          </Display>
          <p className="mt-4 text-base leading-relaxed text-[#1E2A23]/70">
            RescueLog breaks every rescue into food categories, the data funders
            ask for and orgs rarely have.
          </p>
        </div>

        {/* stacked bar */}
        <div className="mt-10 flex h-10 w-full overflow-hidden rounded-full">
          {IMPACT.categoryMix.map((c) => (
            <div
              key={c.label}
              title={`${c.label} ${c.pct}%`}
              style={{ width: `${(c.pct / total) * 100}%`, backgroundColor: c.color }}
            />
          ))}
        </div>
        <div className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          {IMPACT.categoryMix.map((c) => (
            <div key={c.label} className="flex items-center gap-2.5 text-sm">
              <span
                className="h-3 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: c.color }}
              />
              <span className="flex-1 font-medium text-[#1E2A23]/75">{c.label}</span>
              <span className="font-bold tabular-nums">{c.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Equivalents ───────────────────────────────────────────────────

function EqCard({ icon, value, label, foot }) {
  return (
    <div
      className="rounded-2xl border border-[#1B4332]/10 p-7 text-center"
      style={{ backgroundColor: CREAM }}
    >
      <span
        className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl"
        style={{ backgroundColor: `${LEAF}26` }}
      >
        {icon}
      </span>
      <p
        className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl"
        style={{ fontFamily: 'var(--font-fraunces), Georgia, serif', color: PINE }}
      >
        {value}
      </p>
      <p className="mt-1.5 text-sm font-bold">{label}</p>
      <p className="mt-2 text-xs leading-relaxed text-[#1E2A23]/55">{foot}</p>
    </div>
  );
}

function Icon({ d }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={d} stroke={MOSS} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Equivalents() {
  return (
    <section>
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
        <div className="max-w-2xl">
          <Eyebrow>Beyond the pounds</Eyebrow>
          <Display className="text-3xl sm:text-[2.4rem] sm:leading-[1.1]">
            What that food means in the real world.
          </Display>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <EqCard
            icon={<Icon d="M4 12h16M12 4c-2.5 2.4-3.8 5.1-3.8 8s1.3 5.6 3.8 8c2.5-2.4 3.8-5.1 3.8-8S14.5 6.4 12 4zM12 4a8 8 0 100 16 8 8 0 000-16z" />}
            value={fmt(meals)}
            label="Meals put on tables"
            foot={`Estimated at ${LBS_PER_MEAL} lbs per meal, the Feeding America standard.`}
          />
          <EqCard
            icon={<Icon d="M6.05 8.05c-2.73 2.73-2.73 7.15-.02 9.88 1.47-3.4 4.09-6.24 7.36-7.93-2.77 2.34-4.71 5.61-5.39 9.32 2.6 1.23 5.8.78 7.95-1.37C19.43 14.47 20 4 20 4S9.53 4.57 6.05 8.05z" />}
            value={`${fmt(co2e)} lbs`}
            label="CO2e kept out of landfills"
            foot={`Estimated at ${CO2E_PER_LB} lbs CO2e per pound rescued (ReFED).`}
          />
          <EqCard
            icon={<Icon d="M5 16l1.5-5.5A2 2 0 018.4 9h7.2a2 2 0 011.9 1.5L19 16M5 16h14M5 16v3m14-3v3M7.5 13h.01M16.5 13h.01" />}
            value={fmt(carYears)}
            label="Cars off the road for a year"
            foot="Based on the EPA average of 10,141 lbs CO2e per passenger car per year."
          />
        </div>
      </div>
    </section>
  );
}

// ─── Methodology ───────────────────────────────────────────────────

function Methodology() {
  const steps = [
    {
      title: 'Captured in the field',
      body: 'Volunteers photograph rescued food during real distributions, including partners like Second Servings Houston.',
    },
    {
      title: 'Analyzed by AI',
      body: 'Each photo is broken into categories, weighed, and priced at retail by AI vision, with every estimate labeled as an estimate.',
    },
    {
      title: 'Kept honest',
      body: 'Photos stay attached to every log, and scale weights override AI numbers wherever partners weigh their food.',
    },
  ];
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
        <div className="max-w-2xl">
          <Eyebrow>How the numbers are made</Eyebrow>
          <Display className="text-3xl sm:text-[2.4rem] sm:leading-[1.1]">
            Impact you can hand to a funder.
          </Display>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <div
              key={s.title}
              className="rounded-2xl border border-[#1B4332]/10 p-6"
              style={{ backgroundColor: CREAM }}
            >
              <span
                className="text-3xl font-semibold opacity-[0.18]"
                style={{ fontFamily: 'var(--font-fraunces), Georgia, serif', color: PINE }}
              >
                {i + 1}
              </span>
              <h3 className="mt-2 text-base font-bold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#1E2A23]/70">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA + footer ──────────────────────────────────────────────────

function Cta() {
  return (
    <section className="px-5 py-16 sm:px-8 lg:py-20">
      <div
        className="mx-auto max-w-6xl rounded-3xl px-6 py-12 text-center text-white shadow-2xl shadow-[#1B4332]/25 sm:px-12 lg:py-16"
        style={{ background: `linear-gradient(135deg, ${PINE}, ${MOSS})` }}
      >
        <Display className="mx-auto max-w-2xl text-3xl text-white sm:text-[2.4rem] sm:leading-[1.12]">
          Add your organization&apos;s numbers to this page.
        </Display>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/75">
          RescueLog is free for food rescue nonprofits, and onboarding is
          personal. Reach out and start measuring what you move.
        </p>
        <a
          href={DEMO_MAILTO}
          className="mt-7 inline-block rounded-xl bg-white px-8 py-4 text-base font-bold shadow-lg transition hover:opacity-90"
          style={{ color: PINE }}
        >
          Request a Demo
        </a>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[#1B4332]/10 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-5 py-8 sm:flex-row sm:items-center sm:px-8">
        <a href="/" className="flex items-center gap-2.5">
          <Leaf size={28} />
          <span
            className="text-base font-semibold"
            style={{ fontFamily: 'var(--font-fraunces), Georgia, serif' }}
          >
            RescueLog
          </span>
        </a>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-[#2D6A4F]">
          <a href="/" className="hover:underline">
            Home
          </a>
          <a href="/login" className="hover:underline">
            Partner Login
          </a>
          <a href={`mailto:${CONTACT_EMAIL}`} className="hover:underline">
            {CONTACT_EMAIL}
          </a>
        </div>
      </div>
      <div className="border-t border-[#1B4332]/10 py-4 text-center text-xs text-[#1E2A23]/45">
        © {new Date().getFullYear()} RescueLog · Built for food rescue organizations
      </div>
    </footer>
  );
}
