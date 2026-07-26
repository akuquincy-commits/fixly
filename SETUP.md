# SETUP.md — Adding every credential, without leaking any of them

This is the one place that walks through **every** external service this
app talks to, where to get each credential, exactly where it goes, and how
to make sure it never ends up somewhere it shouldn't (a public repo, a
client-side bundle, a screenshot, a log line). Read the "Leak prevention"
section once, all the way through, before you add your first real key —
the habits there apply to every credential below, not just one of them.

Related docs: `README.md` (running/deploying the app), `PAYSTACK_SECURITY.md`
(deeper Paystack-specific account lockdown once you're live).

---

## 0. The one rule that matters most

**Every credential below is either PUBLIC or SECRET. Know which, every time.**

| | Can it appear in browser code? | Where it lives |
|---|---|---|
| **Public** (`NEXT_PUBLIC_*` prefix) | Yes — it's bundled into the JS the browser downloads | `.env.local`, Vercel env vars |
| **Secret** (no `NEXT_PUBLIC_` prefix) | Never. If it has this prefix by mistake, anyone can read it from "View Source" | `.env.local`, Vercel env vars, **scoped to Production only** where possible |

Everything named `*_SECRET_KEY`, `*_SERVICE_ROLE_KEY`, or similar in this
project is a secret. Never rename it to start with `NEXT_PUBLIC_`, never
pass it into a client component, never `console.log` it anywhere.

---

## 1. All credentials this app uses

| Variable | Secret or public? | Used in |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Every Supabase call, client and server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (RLS protects the data, not this key) | Every Supabase call, client and server |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** — bypasses all RLS | `lib/supabase/admin.ts`, used only by the Paystack webhook |
| `PAYSTACK_SECRET_KEY` | **Secret** | `lib/paystack/server.ts`, checkout + webhook routes |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Public | Reserved for any future client-side Paystack widget |
| `PAYSTACK_PLAN_CODE_PRO` / `_TEAM` | Not sensitive, but keep out of client code anyway | `lib/paystack/server.ts` |
| `NEXT_PUBLIC_SITE_URL` | Public | OAuth/callback URL building |

Copy `.env.local.example` to `.env.local` and fill in real values as you
complete each section below:

```bash
cp .env.local.example .env.local
```

`.env.local` is already in `.gitignore` — confirm that with:

```bash
git check-ignore .env.local
```

If that command prints nothing instead of `.env.local`, **stop** — it
means the file isn't actually ignored, and you're one `git add .` away
from committing every secret you own.

---

## 2. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor** → paste and run all of `supabase/schema.sql`.
3. **Settings → API** → copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` — **this one is
     secret**. It bypasses Row Level Security entirely. It is only ever
     read by `lib/supabase/admin.ts`, which is only ever imported from the
     Paystack webhook route (server-only code that never ships to the
     browser). Never import `admin.ts` into anything marked `"use client"`.
4. **Authentication → Providers** → enable Email, and optionally Google/Apple
   (each needs its own OAuth client — see section 4).
5. **Authentication → URL Configuration** → add
   `http://localhost:3000/auth/callback` for local dev, and your production
   URL's equivalent once deployed.
6. **Database → Roles / Team** (Supabase project **Settings → Team**) →
   give yourself Owner, give collaborators the least-privileged role that
   does their job. Anyone with write access to your Supabase project can
   read the `service_role` key from the dashboard, so this list should be
   as short as your GitHub/Vercel Owner lists.

---

## 3. Paystack

Full walkthrough, plus the account-level lockdown (2FA, roles, settlement
account alerts), is in **`PAYSTACK_SECURITY.md`** — do that before going
live. The short version for getting test mode running:

1. Create an account at [paystack.com](https://paystack.com).
2. **Settings → API Keys & Webhooks** → copy the **test** keys:
   - Public key → `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`
   - Secret key → `PAYSTACK_SECRET_KEY` — **secret**, server-only, read by
     `lib/paystack/server.ts` and the webhook route only.
3. Set the webhook URL on the same page (needs a live HTTPS URL — deploy
   first, or tunnel localhost with something like `ngrok` to test earlier).
4. Leave `PAYSTACK_PLAN_CODE_PRO` / `PAYSTACK_PLAN_CODE_TEAM` blank unless
   you've created recurring Plans under **Products → Plans** — without
   them, upgrades are charged as one-off payments instead.
5. Test a checkout from `/billing` using Paystack's documented test card
   numbers before touching a live key.

---

## 4. Google / Apple sign-in (optional)

Both are configured inside Supabase, not this app's code — the app just
calls `supabase.auth.signInWithOAuth({ provider: "google" | "apple" })`.

**Google:**
1. [Google Cloud Console](https://console.cloud.google.com) → create an
   OAuth 2.0 Client ID (type: Web application).
2. Authorized redirect URI: the callback URL Supabase shows you on its
   Google provider settings page (looks like
   `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`).
3. Copy the Client ID and Client Secret into Supabase's **Authentication →
   Providers → Google** page — not into this app's `.env.local`. Supabase
   stores and uses them server-side; this app never sees them directly.

**Apple:** same pattern, via [Apple's Developer portal](https://developer.apple.com/account) → Certificates, Identifiers & Profiles → Services ID, then Supabase's **Authentication → Providers → Apple** page.

Because these live in Supabase's dashboard rather than your codebase, the
same rule applies: keep your Supabase project's Owner/Admin list short.

---

## 5. Local development

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`. Every credential above should now be in
`.env.local` and nowhere else in the repo.

---

## 6. Deploying to Vercel without leaking anything

1. Push to a **private** GitHub repo (Part 8 below covers why).
2. Import the repo at [vercel.com/new](https://vercel.com/new).
3. **Settings → Environment Variables** → add every variable from
   `.env.local`. For each one, set which environments it applies to:
   - `NEXT_PUBLIC_*` variables → Production, Preview, and Development are
     all fine (they're public by design).
   - `SUPABASE_SERVICE_ROLE_KEY` and `PAYSTACK_SECRET_KEY` → **Production
     only**. A Preview deployment can be triggered by any pull request,
     including from an outside contributor on a public fork — you don't
     want your production secrets readable from that build.
4. Deploy. Update Supabase's redirect URLs and Paystack's webhook URL to
   point at the real domain (both docs above cover this).

---

## 7. Leak prevention checklist (do this before every push)

Run the built-in scanner first:

```bash
npm run check-secrets
```

It greps every git-tracked file for patterns that look like a real
Paystack/Stripe-style secret key, a Supabase JWT, or a private key block,
and fails loudly if it finds one. It's a safety net, not a guarantee — still
follow the habits below:

- **Never** paste a real key into a chat, ticket, README, or code comment
  "just to remember it." Use a password manager or your provider's
  dashboard as the source of truth.
- **Never** commit `.env.local`, even once, even if you plan to delete it
  in the next commit — it stays in git history until the whole repo does.
- **Enable GitHub's secret scanning**: repo **Settings → Security → Code
  security and analysis → Secret scanning** → On. GitHub will flag common
  key formats automatically and can even auto-notify some providers
  (including Stripe-style keys) if one leaks.
- **Turn on push protection** in that same settings panel — it blocks a
  `git push` outright if GitHub's scanner recognizes a secret in the diff,
  catching the mistake before it ever reaches the remote.
- Keep the repo **private** unless you have a specific reason not to —
  public repos are scraped for leaked keys within minutes of a push.
- After `npm run build`, you can spot-check that nothing secret ended up in
  client-side output:
  ```bash
  grep -r "PAYSTACK_SECRET_KEY\|SERVICE_ROLE" .next/static 2>/dev/null
  ```
  This should print nothing. If it prints anything, a secret got imported
  into client-side code somewhere — find the import and move that logic
  into a Route Handler or Server Component instead.
- **If a key ever does leak** (wrong repo, screenshot, pasted somewhere
  public): rotate it immediately in the provider's dashboard — Supabase's
  **Settings → API → Reset service_role key**, Paystack's **Settings → API
  Keys & Webhooks → Roll key**. Rotating invalidates the old key instantly;
  update it in `.env.local` and Vercel right after.

---

## 8. Access control checklist (the part that outlasts any single key)

Rotating a leaked key fixes that key. It doesn't fix an account someone
still has standing access to. Review this list once now, and again anytime
someone leaves the project:

- [ ] Supabase project: only trusted people have Owner/Admin
- [ ] Paystack dashboard: only you have Owner, 2FA is on (see `PAYSTACK_SECURITY.md`)
- [ ] GitHub repo: private, branch protection on `main`, `CODEOWNERS` covers
      `/app/api/paystack/**`, `/lib/paystack/**`, `/lib/supabase/admin.ts`,
      and every `.env*.example` file
- [ ] Vercel project: only trusted people have Owner/Admin, secrets scoped
      to Production
- [ ] GitHub secret scanning + push protection both enabled
- [ ] `npm run check-secrets` passes clean
- [ ] `git check-ignore .env.local` prints the filename
