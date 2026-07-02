import { cookies } from 'next/headers';
import { Fraunces, Inter } from 'next/font/google';
import { getSession } from '@/lib/auth';

// ──────────────────────────────────────────────────────────────────
// RescueLog marketing landing page (root). Fully self-contained:
// fonts load here, colors are inline Tailwind values, all art is
// inline SVG/CSS — no assets, no client JS. Signed-in admins get an
// "Open Dashboard" nav button instead of the login link.
// ──────────────────────────────────────────────────────────────────

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-fraunces',
});
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata = {
  title: 'RescueLog — Turn a photo into food rescue data',
  description:
    'Free AI-powered logging for food rescue nonprofits. Snap a photo of rescued food and get weights, category breakdowns, and retail value — grant-ready, automatically.',
};

// Palette
const PINE = '#1B4332';
const MOSS = '#2D6A4F';
const LEAF = '#52B788';
const CREAM = '#F5F7F0';

const DEMO_MAILTO =
  'mailto:sid@waste2taste.org' +
  '?subject=' +
  encodeURIComponent('RescueLog demo request') +
  '&body=' +
  encodeURIComponent(
    "Hi Sid,\n\nWe'd like to see RescueLog in action.\n\nOrganization:\nRole:\nRoughly how much food do you move?\n\nThanks!",
  );

const APP_STORE = 'https://apps.apple.com/us/app/rescuelog/id6770613024';
const GOOGLE_PLAY = 'https://play.google.com/store/apps/details?id=com.rescuelog.app';

export default function LandingPage() {
  const session = getSession(cookies());

  return (
    <div
      className={`${fraunces.variable} ${inter.variable} min-h-screen bg-[#F5F7F0] text-[#1E2A23]`}
      style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif' }}
    >
      <Nav signedIn={!!session} />
      <main>
        <Hero />
        <Problem />
        <HowItWorks />
        <Proof />
        <WhatYouGet />
        <WhyFree />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

// ─── Shared bits ───────────────────────────────────────────────────

function Leaf({ size = 36, bg = PINE }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-xl"
      style={{ width: size, height: size, backgroundColor: bg }}
    >
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="#fff"
          d="M6.05 8.05c-2.73 2.73-2.73 7.15-.02 9.88 1.47-3.4 4.09-6.24 7.36-7.93-2.77 2.34-4.71 5.61-5.39 9.32 2.6 1.23 5.8.78 7.95-1.37C19.43 14.47 20 4 20 4S9.53 4.57 6.05 8.05z"
        />
      </svg>
    </span>
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

// ─── Nav ───────────────────────────────────────────────────────────

function Nav({ signedIn }) {
  return (
    <header className="sticky top-0 z-40 border-b border-[#1B4332]/10 bg-[#F5F7F0]/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
        <a href="#top" className="flex items-center gap-2.5">
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
            href={signedIn ? '/dashboard' : '/login'}
            className="whitespace-nowrap rounded-lg px-2 py-2 text-sm font-semibold text-[#2D6A4F] transition hover:text-[#1B4332] sm:px-3"
          >
            {signedIn ? (
              'Open Dashboard'
            ) : (
              <>
                <span className="hidden sm:inline">Partner Login</span>
                <span className="sm:hidden">Log in</span>
              </>
            )}
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
    <section id="top" className="relative overflow-hidden">
      {/* oversized watermark leaf */}
      <svg
        className="pointer-events-none absolute -right-24 -top-24 h-[480px] w-[480px] opacity-[0.05]"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          fill={PINE}
          d="M6.05 8.05c-2.73 2.73-2.73 7.15-.02 9.88 1.47-3.4 4.09-6.24 7.36-7.93-2.77 2.34-4.71 5.61-5.39 9.32 2.6 1.23 5.8.78 7.95-1.37C19.43 14.47 20 4 20 4S9.53 4.57 6.05 8.05z"
        />
      </svg>

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-14 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8 lg:pb-24 lg:pt-20">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#2D6A4F]/25 bg-white/70 px-3.5 py-1.5 text-xs font-semibold text-[#2D6A4F]">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: LEAF }} />
            Free for food rescue nonprofits
          </p>
          <h1
            className="text-[2.6rem] font-semibold leading-[1.05] tracking-tight sm:text-6xl"
            style={{ fontFamily: 'var(--font-fraunces), Georgia, serif' }}
          >
            One photo.
            <br />
            Every pound, <span style={{ color: MOSS }}>counted.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#1E2A23]/75">
            Volunteers snap a photo of rescued food. RescueLog&apos;s AI logs the
            weight, breaks it down by category, and estimates retail value —
            grant-ready data, without a single clipboard.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href={DEMO_MAILTO}
              className="rounded-xl px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#1B4332]/20 transition hover:opacity-90"
              style={{ backgroundColor: PINE }}
            >
              Request a Demo
            </a>
            <a
              href="#proof"
              className="text-base font-semibold text-[#2D6A4F] underline-offset-4 transition hover:underline"
            >
              See real results ↓
            </a>
          </div>
          <p className="mt-6 text-sm text-[#1E2A23]/55">
            iOS &amp; Android · Web dashboard · Used by Second Servings Houston
          </p>
        </div>

        <HeroCard />
      </div>
    </section>
  );
}

// A stylized "just logged" card — the product's magic moment, drawn in CSS.
function HeroCard() {
  const thumbs = ['#74c69d', '#b7e4c7', '#95d5b2', '#d8f3dc', '#74c69d', '#b7e4c7'];
  return (
    <div className="relative mx-auto w-full max-w-md lg:justify-self-end">
      <div className="rotate-[1.2deg] rounded-3xl border border-[#1B4332]/10 bg-white p-6 shadow-2xl shadow-[#1B4332]/15">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold">St. Peter Claver · Pop-Up</p>
            <p className="mt-0.5 text-xs text-[#1E2A23]/55">Logged by a volunteer · 20 photos</p>
          </div>
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-bold text-white"
            style={{ backgroundColor: LEAF }}
          >
            ✓ Analyzed
          </span>
        </div>

        <div className="mt-4 grid grid-cols-6 gap-1.5" aria-hidden="true">
          {thumbs.map((c, i) => (
            <div
              key={i}
              className="aspect-square rounded-lg"
              style={{ background: `linear-gradient(135deg, ${c}, ${MOSS}44)` }}
            />
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl p-4" style={{ backgroundColor: CREAM }}>
            <p className="text-2xl font-extrabold tracking-tight" style={{ color: PINE }}>
              1,580 <span className="text-sm font-bold">lbs</span>
            </p>
            <p className="mt-0.5 text-xs font-medium text-[#1E2A23]/55">Total rescued</p>
          </div>
          <div className="rounded-2xl p-4" style={{ backgroundColor: CREAM }}>
            <p className="text-2xl font-extrabold tracking-tight" style={{ color: MOSS }}>
              $4,804
            </p>
            <p className="mt-0.5 text-xs font-medium text-[#1E2A23]/55">Est. retail value</p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <MiniBar label="Produce" pct={32} color="#4CAF50" />
          <MiniBar label="Bakery" pct={21} color="#C98A4B" />
          <MiniBar label="Shelf-Stable" pct={20} color="#9C8B6E" />
        </div>
      </div>

      {/* floating chip */}
      <div className="absolute -left-3 -top-4 -rotate-3 rounded-xl border border-[#1B4332]/10 bg-white px-3.5 py-2 text-xs font-bold shadow-lg sm:-left-6">
        📷 → ⚖️ 485 lbs produce
      </div>
    </div>
  );
}

function MiniBar({ label, pct, color }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-xs font-semibold text-[#1E2A23]/70">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#1B4332]/[0.08]">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="w-8 text-right text-xs font-bold tabular-nums">{pct}%</span>
    </div>
  );
}

// ─── Problem ───────────────────────────────────────────────────────

function Problem() {
  const pains = [
    {
      title: 'Paper logs and eyeball guesses',
      body: 'Weights scribbled on clipboards in a parking lot — or estimated on sight. Every pound your team can’t prove is impact you can’t report.',
    },
    {
      title: 'Hours lost to re-keying',
      body: 'Someone spends evenings typing handwritten sheets into a spreadsheet. That’s volunteer time your mission never gets back.',
    },
    {
      title: 'Grant reports built on estimates',
      body: 'Funders want category-level data — how much produce, how much protein, what it was worth. Most orgs simply can’t capture it.',
    },
  ];
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
        <div className="max-w-2xl">
          <Eyebrow>The problem</Eyebrow>
          <Display className="text-3xl sm:text-[2.6rem] sm:leading-[1.1]">
            You move thousands of pounds. Your data is still on a clipboard.
          </Display>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {pains.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-[#1B4332]/10 p-6"
              style={{ backgroundColor: CREAM }}
            >
              <h3 className="text-base font-bold">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#1E2A23]/70">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How it works ──────────────────────────────────────────────────

function StepIcon({ d, extra = null }) {
  return (
    <span
      className="inline-flex h-12 w-12 items-center justify-center rounded-2xl"
      style={{ backgroundColor: `${LEAF}26` }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d={d} stroke={MOSS} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        {extra}
      </svg>
    </span>
  );
}

function HowItWorks() {
  const steps = [
    {
      title: 'Snap a photo',
      body: 'A volunteer photographs the rescued food — tables at a pop-up, a loaded cart, whatever your flow looks like.',
      icon: (
        <StepIcon
          d="M4 8h3l2-2.5h6L17 8h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"
          extra={<circle cx="12" cy="13" r="3.2" stroke={MOSS} strokeWidth="1.8" fill="none" />}
        />
      ),
    },
    {
      title: 'AI analyzes it',
      body: 'AI vision identifies the food, estimates weight per category, and prices it at retail — in about a minute.',
      icon: (
        <StepIcon d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM19 16l.9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9L19 16z" />
      ),
    },
    {
      title: 'Logged automatically',
      body: 'Weight, category breakdown, dollar value, and the photos themselves land on your dashboard — no data entry.',
      icon: <StepIcon d="M4 5h16M4 12h16M4 19h10M18.5 17.5l1.5 1.5 3-3" />,
    },
    {
      title: 'Export grant-ready reports',
      body: 'One click turns your history into a CSV shaped for grant workbooks — by date, site, and category.',
      icon: (
        <StepIcon d="M6 3h9l4 4v14a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1zM14 3v5h5M12 11v6m0 0l-2.5-2.5M12 17l2.5-2.5" />
      ),
    },
  ];
  return (
    <section>
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
        <div className="max-w-2xl">
          <Eyebrow>How it works</Eyebrow>
          <Display className="text-3xl sm:text-[2.6rem] sm:leading-[1.1]">
            From table to spreadsheet in four steps. You only do the first one.
          </Display>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <div
              key={s.title}
              className="rounded-2xl border border-[#1B4332]/10 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center justify-between">
                {s.icon}
                <span
                  className="text-4xl font-semibold opacity-[0.15]"
                  style={{ fontFamily: 'var(--font-fraunces), Georgia, serif', color: PINE }}
                >
                  {i + 1}
                </span>
              </div>
              <h3 className="mt-4 text-base font-bold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#1E2A23]/70">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Proof ─────────────────────────────────────────────────────────

function Proof() {
  const categories = [
    { label: 'Produce', pct: 32, color: '#4CAF50' },
    { label: 'Bakery & Bread', pct: 21, color: '#C98A4B' },
    { label: 'Shelf-Stable', pct: 20, color: '#9C8B6E' },
    { label: 'Grab-n-Go', pct: 9, color: '#E8832A' },
    { label: 'Meat & Poultry', pct: 6, color: '#C5453B' },
    { label: 'Other', pct: 12, color: '#9AA0A6' },
  ];
  return (
    <section id="proof" className="scroll-mt-16" style={{ backgroundColor: PINE }}>
      <div className="mx-auto max-w-6xl px-5 py-16 text-white sm:px-8 lg:py-24">
        <div className="grid items-start gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <Eyebrow light>Real results</Eyebrow>
            <Display className="text-3xl text-white sm:text-[2.6rem] sm:leading-[1.1]">
              Already running at one of the largest food rescues in Texas.
            </Display>
            <p className="mt-5 max-w-md text-base leading-relaxed text-white/70">
              RescueLog is used by{' '}
              <span className="font-semibold text-white">Second Servings Houston</span> — a
              19-million-pound food rescue nonprofit — to log pop-up grocery
              distributions across the city.
            </p>
            <p className="mt-4 max-w-md text-base leading-relaxed text-white/70">
              The snapshot shown here is a real event from the live dashboard —
              twenty volunteer photos, analyzed by AI in minutes.
            </p>
          </div>

          {/* dashboard snapshot */}
          <div className="rounded-3xl bg-white p-6 text-[#1E2A23] shadow-2xl sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1B4332]/10 pb-4">
              <div>
                <p className="text-sm font-bold">Pop-Up Distribution — St. Peter Claver</p>
                <p className="mt-0.5 text-xs text-[#1E2A23]/55">
                  Logged by volunteers · 20 photos · AI analyzed
                </p>
              </div>
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-bold text-white"
                style={{ backgroundColor: LEAF }}
              >
                Complete
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <p
                  className="text-4xl font-semibold tracking-tight sm:text-5xl"
                  style={{ fontFamily: 'var(--font-fraunces), Georgia, serif', color: PINE }}
                >
                  1,580
                </p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#1E2A23]/55">
                  Pounds rescued
                </p>
              </div>
              <div>
                <p
                  className="text-4xl font-semibold tracking-tight sm:text-5xl"
                  style={{ fontFamily: 'var(--font-fraunces), Georgia, serif', color: MOSS }}
                >
                  $4,804
                </p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#1E2A23]/55">
                  Est. retail value
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-2.5">
              {categories.map((c) => (
                <div key={c.label} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-xs font-semibold text-[#1E2A23]/70">
                    {c.label}
                  </span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#1B4332]/[0.08]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${c.pct}%`, backgroundColor: c.color }}
                    />
                  </div>
                  <span className="w-9 text-right text-xs font-bold tabular-nums">{c.pct}%</span>
                </div>
              ))}
            </div>

            <p className="mt-5 border-t border-[#1B4332]/10 pt-4 text-xs text-[#1E2A23]/50">
              Category-level data most orgs have never been able to capture — now
              automatic on every rescue.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── What you get ──────────────────────────────────────────────────

function WhatYouGet() {
  const items = [
    {
      title: 'Live dashboard',
      body: 'Every rescue on one screen — totals, trends by site, and the story behind each event.',
      d: 'M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zM7 15l3-3 2.5 2.5L17 10',
    },
    {
      title: 'Category breakdowns',
      body: 'Produce, bakery, protein, dairy and more — per event and across your whole program.',
      d: 'M11 3a8 8 0 108 10h-8V3zM15 3.5A8 8 0 0120.5 9H15V3.5z',
    },
    {
      title: 'Dollar-value estimates',
      body: 'Retail value anchored to the donor store, so “we rescued $40,000 of food” is defensible.',
      d: 'M12 3v18M16.5 7.5c0-1.7-2-2.7-4.5-2.7S7.5 5.8 7.5 7.5 9.5 10 12 10s4.5 1 4.5 2.7-2 2.8-4.5 2.8-4.5-1-4.5-2.8',
    },
    {
      title: 'One-click CSV export',
      body: 'Filter by date, site, or driver and download a file shaped for grant workbooks.',
      d: 'M6 3h9l4 4v14a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1zM14 3v5h5M12 11v6m0 0l-2.5-2.5M12 17l2.5-2.5',
    },
    {
      title: 'Photo evidence',
      body: 'Every log keeps its photos — proof of what was rescued, attached to the numbers.',
      d: 'M4 8h3l2-2.5h6L17 8h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1zM12 16.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z',
    },
    {
      title: 'iOS & Android',
      body: 'Volunteers use the phone already in their pocket. No hardware, no training curve.',
      d: 'M8 3h8a1 1 0 011 1v16a1 1 0 01-1 1H8a1 1 0 01-1-1V4a1 1 0 011-1zM11 18h2',
    },
  ];
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
        <div className="max-w-2xl">
          <Eyebrow>What you get</Eyebrow>
          <Display className="text-3xl sm:text-[2.6rem] sm:leading-[1.1]">
            Everything a funder wants to see. Nothing your team has to type.
          </Display>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <div
              key={it.title}
              className="rounded-2xl border border-[#1B4332]/10 p-6 transition-shadow hover:shadow-md"
              style={{ backgroundColor: CREAM }}
            >
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${LEAF}26` }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d={it.d}
                    stroke={MOSS}
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <h3 className="mt-4 text-base font-bold">{it.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#1E2A23]/70">{it.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Why free ──────────────────────────────────────────────────────

function WhyFree() {
  const points = [
    'No contracts, no per-seat pricing, no “premium tier”',
    'Adapts to your workflow — pop-up distributions, cart-based pantries, warehouse intake',
    'Hands-on onboarding: we set your team up personally',
    'Your data stays yours — export everything, anytime',
  ];
  return (
    <section>
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-2 lg:py-24">
        <div>
          <Eyebrow>Why it&apos;s free</Eyebrow>
          <Display className="text-3xl sm:text-[2.6rem] sm:leading-[1.1]">
            Completely free for nonprofits. Really.
          </Display>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-[#1E2A23]/75">
            RescueLog isn&apos;t a SaaS company with a sales team. It&apos;s built and run
            by one person who cares about food rescue — and shaped side-by-side
            with the organizations using it. If it helps you rescue more food and
            win more funding, it&apos;s doing its job.
          </p>
        </div>
        <ul className="space-y-4">
          {points.map((p) => (
            <li
              key={p}
              className="flex items-start gap-3 rounded-2xl border border-[#1B4332]/10 bg-white px-5 py-4 shadow-sm"
            >
              <span
                className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: LEAF }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M5 13l4.5 4.5L19 7"
                    stroke="#fff"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="text-sm font-medium leading-relaxed text-[#1E2A23]/85">{p}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ─── Final CTA ─────────────────────────────────────────────────────

function FinalCta() {
  return (
    <section className="px-5 pb-20 sm:px-8">
      <div
        className="mx-auto max-w-6xl overflow-hidden rounded-3xl px-6 py-14 text-center text-white shadow-2xl shadow-[#1B4332]/25 sm:px-12 lg:py-20"
        style={{ background: `linear-gradient(135deg, ${PINE}, ${MOSS})` }}
      >
        <Display className="mx-auto max-w-2xl text-3xl text-white sm:text-[2.6rem] sm:leading-[1.12]">
          See it work on your own rescues.
        </Display>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/75">
          Email us and we&apos;ll set up a live demo — with your team, on your food.
          Onboarding is personal, and it costs your organization nothing.
        </p>
        <a
          href={DEMO_MAILTO}
          className="mt-8 inline-block rounded-xl bg-white px-8 py-4 text-base font-bold shadow-lg transition hover:opacity-90"
          style={{ color: PINE }}
        >
          Request a Demo
        </a>
        <p className="mt-5 text-sm text-white/60">
          or write to{' '}
          <a
            href="mailto:sid@waste2taste.org"
            className="font-semibold text-white underline underline-offset-4"
          >
            sid@waste2taste.org
          </a>
        </p>
      </div>
    </section>
  );
}

// ─── Footer ────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-[#1B4332]/10 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-10 sm:px-8 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <Leaf size={30} />
            <span
              className="text-base font-semibold"
              style={{ fontFamily: 'var(--font-fraunces), Georgia, serif' }}
            >
              RescueLog
            </span>
          </div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-[#1E2A23]/60">
            Free AI-powered logging for food rescue nonprofits. Built by Sid
            Sharma · Waste2Taste.
          </p>
          <a
            href="mailto:sid@waste2taste.org"
            className="mt-2 inline-block text-sm font-semibold text-[#2D6A4F] hover:underline"
          >
            sid@waste2taste.org
          </a>
        </div>

        <div className="flex flex-wrap gap-x-14 gap-y-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#1E2A23]/45">
              Get the app
            </p>
            <ul className="mt-3 space-y-2 text-sm font-semibold text-[#2D6A4F]">
              <li>
                <a href={APP_STORE} className="hover:underline" target="_blank" rel="noreferrer">
                  App Store (iOS)
                </a>
              </li>
              <li>
                <a href={GOOGLE_PLAY} className="hover:underline" target="_blank" rel="noreferrer">
                  Google Play (Android)
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#1E2A23]/45">Partners</p>
            <ul className="mt-3 space-y-2 text-sm font-semibold text-[#2D6A4F]">
              <li>
                <a href="/login" className="hover:underline">
                  Partner Login
                </a>
              </li>
              <li>
                <a href={DEMO_MAILTO} className="hover:underline">
                  Request a Demo
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#1E2A23]/45">Legal</p>
            <ul className="mt-3 space-y-2 text-sm font-semibold text-[#2D6A4F]">
              <li>
                <a href="/privacy" className="hover:underline">
                  Privacy
                </a>
              </li>
              <li>
                <a href="/support" className="hover:underline">
                  Support
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-[#1B4332]/10 py-4 text-center text-xs text-[#1E2A23]/45">
        © {new Date().getFullYear()} RescueLog · Built for food rescue organizations
      </div>
    </footer>
  );
}
