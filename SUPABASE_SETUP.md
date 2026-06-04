# Supabase Setup — Bonus & Referral System

## 1. Run the SQL migration

1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **SQL Editor** → **New query**.
3. Paste the full contents of:

   `supabase/migrations/001_bonus_referral_setup.sql`

4. Click **Run**.

If you already ran an older version of `001` that included a `phone` column, also run:

`supabase/migrations/002_remove_phone_simplify_profile.sql`

Then run (first-deposit referral rule):

`supabase/migrations/003_first_deposit_referral_only.sql`

**If registration returns HTTP 500**, run step-by-step in SQL Editor:

`supabase/RUN_THIS_FIX_SIGNUP.sql`

(Or use `supabase/migrations/004_fix_registration_trigger.sql` for a one-shot fix.)

This creates:

- `profiles` (with `referred_by`, `email`)
- `balances` (ETB + USD wallets)
- `deposits` (triggers referral bonuses)
- **Registration trigger**: 150 ETB + 1.7 USD on new `auth.users`
- **Referral trigger**: +3 USD or +125 ETB to referrer on invitee's **first** approved deposit

## 2. Environment variables

Ensure `.env` includes:

```env
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## 3. Business rules (frontend + backend)

| Rule | Value |
|------|--------|
| Sign-up bonus | 150 ETB, 1.7 USD |
| Referral (USD deposit) | +3 USD to referrer |
| Referral (ETB deposit) | +125 ETB to referrer |
| Min withdrawal | 300 ETB or 3 USD |

## 4. screenshot_url NOT NULL on deposit approve

If admin deposit approval fails with `screenshot_url` constraint error, run:

`supabase/RUN_FIX_DEPOSIT_COLUMNS.sql`

## 5. referral_code NOT NULL error on signup

If registration fails with `null value in column "referral_code"`, run:

`supabase/RUN_FIX_REFERRAL_CODE.sql`

This sets `referral_code` to **nullable** and updates the signup trigger to insert `NULL` when no code is provided.

## 6. Sync auth.users → profiles (admin dashboard / deposits)

If admin shows **"No Supabase profile"** or zero users, run:

`supabase/RUN_SYNC_PROFILES.sql`

This re-creates the `handle_new_user` trigger (`SECURITY DEFINER`) and backfills `public.profiles` from `auth.users`.

## 7. Registration flow

- Users register with **Email** and **Password** on `/register`.
- Each user gets a share link: `/register?ref=<USER_UUID>`.
- Optional `?ref=<referrer_uuid_or_email>` sets `profiles.referred_by`.
- Frontend syncs profile via `syncProfileAfterSignup()` after Supabase Auth sign-up.

## 6. Admin dashboard (required for live stats + approvals)

Run in SQL Editor:

`supabase/migrations/005_admin_dashboard_backend.sql`

This adds admin RPC functions (`admin_get_dashboard_stats`, `admin_approve_deposit`, etc.) that bypass RLS for the admin JWT.

**Admin must sign in with Supabase Auth** as `workinehabche@gmail.com` (create this user in Auth → Users with the same password as the admin console). Use `/admin-login`.

**Bonus logic (signup once + 10% deposit bonus):**

Run `supabase/RUN_FIX_BONUS_LOGIC.sql` — creates `bonus_history`, unique indexes, updates `admin_approve_deposit`, and `handle_new_user`.

**If approve/reject fails with `invalid input syntax for type json`:**

1. Run `supabase/RUN_FIX_JSON_DEPOSITS.sql` (proof columns as TEXT, no base64 in RPC).
2. Run `supabase/RUN_FIX_RPC_PARAMS.sql` so SQL args match the frontend: `p_deposit_id`, `p_withdrawal_id`, `p_user_id`.

The admin UI logs the RPC payload in the browser console immediately before each `supabase.rpc` call.

When an admin approves a deposit:

1. `admin_approve_deposit(p_deposit_id)` credits `balances` in Supabase (user dashboard reads this).
2. Referral bonus runs via the deposit status trigger.
3. Local storage is still updated for backward compatibility.

## 9. Verify

- Register a new user → check `balances` for 150 / 1.7.
- Register with `?ref=` → check `profiles.referred_by`.
- Approve a deposit → referrer `balances` increase by 3 USD or 125 ETB.
