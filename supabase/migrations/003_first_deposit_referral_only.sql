-- Referral bonus only on the invitee's first approved deposit

CREATE OR REPLACE FUNCTION public.handle_referral_bonus()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referrer_id UUID;
  prior_approved INTEGER;
BEGIN
  IF NEW.status IS DISTINCT FROM 'approved' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)::INTEGER INTO prior_approved
  FROM public.deposits
  WHERE user_id = NEW.user_id
    AND status = 'approved'
    AND id IS DISTINCT FROM NEW.id;

  IF prior_approved > 0 THEN
    RETURN NEW;
  END IF;

  SELECT referred_by INTO referrer_id
  FROM public.profiles
  WHERE id = NEW.user_id;

  IF referrer_id IS NOT NULL THEN
    IF NEW.currency IN ('USD', 'USDT') THEN
      UPDATE public.balances
      SET usd_balance = usd_balance + 3.00,
          updated_at = NOW()
      WHERE user_id = referrer_id;
    ELSIF NEW.currency = 'ETB' THEN
      UPDATE public.balances
      SET etb_balance = etb_balance + 125.00,
          updated_at = NOW()
      WHERE user_id = referrer_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
