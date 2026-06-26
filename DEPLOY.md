# OD2MK Knowledge Base Portal — Deployment Guide

A production-ready, multi-tenant client dashboard. Magic-link auth, 24-hour
trial gate, live agent training, FAQ/product management, and a real-time
conversations feed — all wired to Supabase with Row Level Security.

This build was verified to compile cleanly with `vite build` before delivery.

---

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in your real values from **Supabase Dashboard → Settings → API**:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

Use the **anon public** key here — never the `service_role` key. The anon key
is safe to expose in client-side code because Row Level Security policies
(already set up via `od2mk_final_rls_setup.sql` and `od2mk_trial_payment_gate.sql`)
enforce who can see what at the database level.

## 3. Run locally to verify

```bash
npm run dev
```

Visit the local URL it prints (typically `http://localhost:5173`). Confirm:
- The login screen loads
- Signing up with a test email creates a `client_config` row with a 24h trial
- Logging in with an existing client's email sends a real magic link

## 4. Build for production

```bash
npm run build
```

This outputs a static site into the `dist/` folder — that folder is everything
your host needs to serve.

## 5. Deploy

### Option A — Vercel (recommended, simplest)
```bash
npm install -g vercel
vercel
```
Follow the prompts. When asked, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
as environment variables in the Vercel project settings (Settings → Environment Variables).

### Option B — Netlify
- Drag and drop the `dist/` folder into Netlify's deploy UI, **or**
- Connect your git repo and set build command to `npm run build`, publish directory to `dist`
- Add the two env vars under Site settings → Environment variables

### Option C — Cloudflare Pages
- Connect your git repo
- Build command: `npm run build`
- Build output directory: `dist`
- Add the two env vars under Settings → Environment variables

### Option D — Your own server / cPanel / shared hosting
- Run `npm run build` locally
- Upload the entire contents of `dist/` to your host's public web root
- Since this is a single-page app, configure your server to redirect all
  unmatched routes to `index.html` (needed for the magic-link redirect to work)

---

## 6. Configure the magic-link redirect URL in Supabase

Once deployed, go to **Supabase Dashboard → Authentication → URL Configuration**
and set:

- **Site URL**: your live domain (e.g. `https://portal.od2mk.com`)
- **Redirect URLs**: add your live domain here too (and `http://localhost:5173`
  if you want local dev to keep working)

Without this step, clicking the magic link in a real client's email will
redirect to the wrong place or get blocked by Supabase.

---

## 7. Connect a custom domain (optional)

All four hosting options above support adding a custom domain
(e.g. `portal.od2mk.com`) directly from their dashboard — follow your chosen
host's domain settings, then update the Supabase redirect URL to match.

---

## What's already wired and working

- ✅ Magic-link sign-in (`sendSignInLink`) and self-signup with 24h trial (`signUpNewClient`)
- ✅ Session restore on page load (`getCurrentClientSession`) — catches the user after they click their email link
- ✅ Live FAQ and product CRUD against `client_faqs` / `client_products`
- ✅ Agent identity & business info form writing to `client_config` (`updateAgentSettings`)
- ✅ Real-time conversation feed via Supabase Realtime (`subscribeToConversations`)
- ✅ Leads list from `leads`
- ✅ Trial/payment access gate (`hasAccess`) matching the SQL-side `client_has_access()` function

## What still needs your input before going fully live

- ⬜ Wire `PaymentLockScreen`'s "Subscribe to reactivate" button to your real
  payment gateway checkout (Paystack/Flutterwave/Stripe), passing `client_id`
  as metadata — see `od2mk_payment_gate_n8n.js` for the webhook handler that
  calls `mark_client_paid()` on a successful payment
- ⬜ Generate and display each client's real widget embed snippet in the
  "Widget setup" tab, using their actual `widget_key` from `getWidgetKey()`
  and your live n8n webhook URL
- ⬜ Decide whether self-signup should stay open to anyone, or whether you'd
  rather disable the trigger and onboard each client manually — both paths
  are documented in `od2mk_trial_payment_gate.sql`

## Troubleshooting

| Symptom | Fix |
|---|---|
| Blank screen, console error about missing env vars | Confirm `.env` exists and both variables are set; restart `npm run dev` after editing `.env` |
| Magic link redirects to localhost in production | Update Site URL and Redirect URLs in Supabase Auth settings to your live domain |
| Client can sign up but sees no data | Confirm `od2mk_final_rls_setup.sql` and `od2mk_trial_payment_gate.sql` have both been run in Supabase SQL Editor |
| "Missing Supabase environment variables" error on deploy | Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your host's environment variable settings, not just locally |
