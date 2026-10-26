BEGIN;

-- RLS policies restrict rows, but Realtime also needs table-level SELECT.
-- Prisma's clean shadow database does not have Supabase's authenticated role.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT ON TABLE public."Conversation", public."Message" TO authenticated;
  END IF;
END $$;

-- Earlier edits could retain a verdict for different claims or photos. There is
-- no edit history to distinguish those results, so discard them once on rollout.
UPDATE public."Listing"
SET "aiVerified" = false, "aiVerdict" = NULL, "aiCheckedAt" = NULL
WHERE "aiVerified" OR "aiVerdict" IS NOT NULL OR "aiCheckedAt" IS NOT NULL;

COMMIT;
