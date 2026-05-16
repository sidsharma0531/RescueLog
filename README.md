# RescueLog

**AI-powered food rescue tracking** — built for [Second Servings Houston](https://secondservings.org).

A driver or volunteer photographs rescued food laid out on tables at a Pop-Up
Grocery Store event. Claude Vision categorizes everything (produce, dairy, meat,
bakery, …), estimates weight per category, and a web dashboard turns it into the
category-level data that grant applications and donor reports need — data the
nonprofit has never had before.

---

## Repo layout

```
RescueLog/
├── web/        Next.js 14 app — serves both the API and the admin dashboard
├── mobile/     Expo (React Native) app — the driver/volunteer photo logger
├── scripts/    Node scripts to seed driver accounts and demo data
└── supabase/   Database schema (run once in the Supabase SQL editor)
```

`web/` and `mobile/` are independent npm packages — install and run each
separately.

---

## Prerequisites

- Node.js 18+ (tested on 22) and npm
- A free [Supabase](https://supabase.com) account
- An [Anthropic API key](https://console.anthropic.com) with credits
- The **Expo Go** app on your phone (App Store / Play Store) for mobile testing

---

## Setup

### 1. Supabase (database + photo storage)

1. Create a new project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql),
   and run it. This creates all tables, indexes, and the storage bucket.
3. Confirm a **Storage** bucket named `popup-photos` exists and is set to
   **public** (the schema script creates it; verify under Storage).
4. From **Settings → API**, copy the Project URL, the `anon` key, and the
   `service_role` key.

### 2. Web app (`web/`)

```bash
cd web
npm install
cp ../.env.example .env.local   # then fill in the WEB values
```

Edit `web/.env.local` with your Supabase keys, Anthropic key, and a random
`ADMIN_SESSION_SECRET`. See [`.env.example`](.env.example) for the full list.

Seed the login accounts (run from the repo root after `web/.env.local` exists):

```bash
cd scripts
npm install
node seed-drivers.js        # creates driver + admin login accounts
node seed-test-data.js      # OPTIONAL — fake popup logs for the demo
```

Run the dashboard locally:

```bash
cd web
npm run dev                 # http://localhost:3000
```

### 3. Mobile app (`mobile/`)

```bash
cd mobile
npm install
```

Open [`mobile/src/constants/config.js`](mobile/src/constants/config.js) and set
`API_BASE_URL`:

- **Local testing:** your computer's LAN IP, e.g. `http://192.168.1.20:3000`
  (`localhost` will not work from a phone).
- **Production:** your Vercel deployment URL.

Start Expo and scan the QR code with Expo Go:

```bash
npx expo start
```

---

## Deployment

**Web → Vercel:** push this repo to GitHub, import it in Vercel, set the
**Root Directory** to `web`, and add the same environment variables from
`web/.env.local` in the Vercel project settings. Vercel auto-deploys on push.

**Mobile → Expo Go:** for the demo, run `npx expo start` and share the QR code —
no App Store submission needed. For production, use
[EAS Build](https://docs.expo.dev/build/introduction/).

---

## Default seeded accounts

`scripts/seed-drivers.js` creates these (change PINs/passwords before any real use):

| Type   | Login                          | Secret      |
| ------ | ------------------------------ | ----------- |
| Driver | Greg                           | PIN `1234`  |
| Driver | Maria                          | PIN `2345`  |
| Driver | Devon                          | PIN `3456`  |
| Admin  | `max@secondservings.org`       | `rescue123` |
| Admin  | `lisa@secondservings.org`      | `rescue123` |
| Admin  | `barbara@secondservings.org`   | `rescue123` |

---

## How the AI pipeline works

1. The mobile app uploads photos + metadata to `POST /api/popups/[id]/photos`.
2. Each photo is stored in Supabase Storage and analyzed by Claude Vision in
   parallel — the model returns category breakdowns, weight estimates, and
   confidence scores as JSON.
3. Per-photo results are aggregated into a single category summary on the
   popup log, which the dashboard renders as charts and exports as CSV.

The vision prompt and client live in
[`web/src/lib/anthropic.js`](web/src/lib/anthropic.js).

---

Built for Second Servings Houston.
