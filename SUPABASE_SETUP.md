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

## 4. Registration flow

- Users register with **Email** and **Password** on `/register`.
- Each user gets a share link: `/register?ref=<USER_UUID>`.
- Optional `?ref=<referrer_uuid_or_email>` sets `profiles.referred_by`.
- Frontend syncs profile via `syncProfileAfterSignup()` after Supabase Auth sign-up.

## 5. Admin dashboard (required for live stats + approvals)

Run in SQL Editor:

`supabase/migrations/005_admin_dashboard_backend.sql`

This adds admin RPC functions (`admin_get_dashboard_stats`, `admin_approve_deposit`, etc.) that bypass RLS for the admin JWT.

**Admin must sign in with Supabase Auth** as `workinehabche@gmail.com` (create this user in Auth → Users with the same password as the admin console). Use `/admin-login`.

When an admin approves a deposit:

1. `admin_approve_deposit` credits `balances` in Supabase (user dashboard reads this).
2. Referral bonus runs via the deposit status trigger.
3. Local storage is still updated for backward compatibility.

## 6. Verify

- Register a new user → check `balances` for 150 / 1.7.
- Register with `?ref=` → check `profiles.referred_by`.
- Approve a deposit → referrer `balances` increase by 3 USD or 125 ETB.
