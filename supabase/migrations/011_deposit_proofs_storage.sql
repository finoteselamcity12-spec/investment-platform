-- Receipt uploads for pending deposits (run in Supabase SQL Editor if not applied via CLI)
INSERT INTO storage.buckets (id, name, public)
VALUES ('deposit-proofs', 'deposit-proofs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Users upload own deposit proofs" ON storage.objects;
CREATE POLICY "Users upload own deposit proofs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'deposit-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Public read deposit proofs" ON storage.objects;
CREATE POLICY "Public read deposit proofs"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'deposit-proofs');

DROP POLICY IF EXISTS "Users update own deposit proofs" ON storage.objects;
CREATE POLICY "Users update own deposit proofs"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'deposit-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
