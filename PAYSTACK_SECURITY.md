# Adding Paystack — and locking it down

This covers two separate things: **connecting your Paystack account to the
app**, and **making sure nobody else can quietly repoint where the money
goes**. The checkout and webhook routes are already built and wired to
**test-mode keys**. This doc is what to do before you flip on live keys.

---

## Part 1 — Connect your Paystack account

1. Create the account at [paystack.com](https://paystack.com) using an
   email and password **you alone control**.
2. Turn on two-factor authentication immediately: **Settings → Team →
   Two-Factor Authentication** (or your account's security settings). Do
   this before inviting anyone else or adding your settlement bank account.
3. Complete business verification and add your settlement bank account —
   this is what Paystack pays out to after each transaction.
4. Grab your keys from **Settings → API Keys & Webhooks**:
   - Public key (`pk_test_...` / `pk_live_...`) — safe to expose client-side
   - Secret key (`sk_test_...` / `sk_live_...`) — server-only, env var only,
     never in the repo
5. Set your webhook URL on the same page to
   `https://your-domain/api/paystack/webhook`. Paystack signs every webhook
   with an HMAC-SHA512 hash of your **secret key** — there's no separate
   webhook secret to copy, which is exactly why protecting the secret key
   matters as much as it does.
6. Add the keys as environment variables — `.env.local` locally (already
   git-ignored) and Vercel's **Settings → Environment Variables** for the
   deployed app. Use `sk_test_...` / `pk_test_...` while testing. Only swap
   in `sk_live_...` / `pk_live_...` once you're ready to take real money,
   and scope them to **Production** only in Vercel — not Preview or
   Development.

---

## Part 2 — Make sure no one can redirect the money

The real risk isn't a key sitting in `.env.local` (that file should never
reach git in the first place — confirm with `git check-ignore .env.local`,
it should print the filename). The real risk is your **settlement bank
account**, your **webhook URL**, or a **key** getting changed by someone
with access to your Paystack dashboard, GitHub repo, or Vercel project,
without you noticing. Lock down all three:

### Paystack dashboard access
- **Settings → Team.** Give yourself the **Owner** role. Give anyone else
  the most limited role that does their job (Paystack offers roles like
  Admin, Developer, View Only — reserve Owner/Admin for yourself alone).
  Never hand out a second Owner casually.
- **Settings → Business/Bank Account.** Paystack notifies you when
  settlement account details change — confirm that notification goes to
  an email you personally check, not a shared inbox someone else can also
  read and dismiss.
- Paystack's secret key is a single all-access key (unlike Stripe, it
  doesn't currently offer scoped "restricted" keys), which makes protecting
  it — and rotating it immediately if you ever suspect exposure — even more
  important. Rotate from **Settings → API Keys & Webhooks → Roll key**.
- Where available, restrict API key usage to your server's IP ranges under
  the dashboard's security settings, so a leaked key is useless from
  anywhere else.

### GitHub repo access
- **Settings → Branches → Add branch protection rule** on `main`: require
  a pull request before merging, require at least one approving review,
  disable force-pushes. No one — including you, on a bad day — should be
  able to push a change to the payment code straight to production without
  a second set of eyes.
- Add a `CODEOWNERS` file requiring your explicit review on anything
  payment-related:
  ```
  /app/api/paystack/          @your-github-username
  /lib/paystack/               @your-github-username
  .env.local.example           @your-github-username
  ```
- Keep the repo private unless you have a specific reason not to.
- Never commit real keys — test or live — to any commit, including ones
  you plan to delete later. Git history isn't gone until the repo is.

### Vercel project access
- **Settings → Members.** Only you should hold the Owner/Admin role.
- **Settings → Environment Variables.** Scope `PAYSTACK_SECRET_KEY` and
  `SUPABASE_SERVICE_ROLE_KEY` to **Production** only — they shouldn't be
  readable in Preview deployments that an outside contributor's PR could
  trigger.
- Never `console.log` these values in either direction — Vercel encrypts
  env vars at rest, but a stray log line prints the secret in plaintext to
  anyone with log access.

### Already built into the webhook code
- `app/api/paystack/webhook/route.ts` recomputes the HMAC-SHA512 signature
  from the raw request body using `PAYSTACK_SECRET_KEY` and rejects
  anything that doesn't match, using a constant-time comparison
  (`crypto.timingSafeEqual`) so the check itself can't be timed and
  brute-forced. Without this, anyone who found the webhook URL could POST a
  fake "payment succeeded" event and grant themselves a subscription for
  free.
- The webhook only ever updates the `subscriptions` table in Supabase — it
  has no code path that can touch a bank account, a key, or team
  membership. Those only live in Paystack's dashboard and your env vars,
  which is why the dashboard/GitHub/Vercel lockdown above is the part that
  actually matters most.
- `subscriptions` has no insert/update policy for ordinary users in
  `supabase/schema.sql` — only the service-role client (used exclusively by
  the checkout and webhook routes) can write to it. A signed-in user can
  read their own row but can never grant themselves "active" status by
  calling the API directly.

---

## Quick checklist before going live

- [ ] 2FA enabled on your Paystack account
- [ ] Only you hold Owner role in Paystack, GitHub, and Vercel
- [ ] Settlement-account-change email notifications confirmed working
- [ ] Branch protection + CODEOWNERS active on `main`
- [ ] Secret keys scoped to Production only in Vercel
- [ ] Webhook URL set to your real production domain
- [ ] `.env.local` confirmed git-ignored, no keys anywhere in git history
- [ ] Tested a full checkout in test mode before switching to live keys
