# Supabase Setup — Bonus & Referral System

## 1. Run the SQL migration

1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **SQL Editor** → **New query**.
3. Paste the full contents of:

   `supabase/migrations/001_bonus_referral_setup.sql`

4. Click **Run**.

This creates:

- `profiles` (with `referred_by`, `phone`, `email`)
- `balances` (ETB + USD wallets)
- `deposits` (triggers referral bonuses)
- **Registration trigger**: 150 ETB + 1.7 USD on new `auth.users`
- **Referral trigger**: +3 USD or +125 ETB to referrer on approved deposit

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

- Users must enter **Email** and **Phone** (with icons on `/register`).
- Optional `?ref=<referrer_uuid_or_email>` sets `profiles.referred_by`.
- Frontend syncs profile via `syncProfileAfterSignup()` after Supabase Auth sign-up.

## 5. Referral on deposit approval

When an admin approves a deposit in the dashboard:

1. Local wallet is updated (existing behavior).
2. A row is inserted into `deposits` so the **Supabase trigger** awards the referrer.

## 6. Verify

- Register a new user → check `balances` for 150 / 1.7.
- Register with `?ref=` → check `profiles.referred_by`.
- Approve a deposit → referrer `balances` increase by 3 USD or 125 ETB.
