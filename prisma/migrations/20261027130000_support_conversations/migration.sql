CREATE TYPE "SupportTurnStatus" AS ENUM ('PENDING', 'COMPLETE', 'FAILED');

CREATE TABLE "SupportConversation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "title" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "SupportTurn" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "conversationId" TEXT NOT NULL REFERENCES "SupportConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "question" TEXT NOT NULL,
  "answer" TEXT,
  "status" "SupportTurnStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3)
);
CREATE INDEX "SupportConversation_userId_lastMessageAt_id_idx" ON "SupportConversation"("userId", "lastMessageAt", "id");
CREATE INDEX "SupportConversation_lastMessageAt_idx" ON "SupportConversation"("lastMessageAt");
CREATE INDEX "SupportTurn_conversationId_createdAt_id_idx" ON "SupportTurn"("conversationId", "createdAt", "id");
CREATE UNIQUE INDEX "SupportTurn_one_pending_per_conversation" ON "SupportTurn"("conversationId") WHERE "status" = 'PENDING';

-- Server-only access. Prisma still verifies ownership on every operation.
ALTER TABLE "SupportConversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupportTurn" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "SupportConversation", "SupportTurn" FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "SupportConversation", "SupportTurn" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "SupportConversation", "SupportTurn" FROM authenticated;
  END IF;

  -- Supabase only; ordinary PostgreSQL/Prisma shadow databases lack auth.
  -- Do not silently skip a failed production scheduler installation.
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
    PERFORM cron.schedule(
      'renew-support-retention', '0 * * * *',
      $job$DELETE FROM public."SupportConversation"
        WHERE "lastMessageAt" <= timezone('UTC', now()) - interval '30 days'$job$
    );
  END IF;
END $$;
