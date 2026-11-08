-- Credit first, proof after (lib/proofAfter): a plugin credit can land before its screenshot. Such a row
-- carries the key the screenshot upload names it by, the moment it is reversed if no screenshot came
-- (60s after filing), and what its stamp will be drawn from. All three are cleared once it is attached.
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "proof_key" text;
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "proof_due_at" text;
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "proof_pending" text;
CREATE INDEX IF NOT EXISTS "submissions_proof_key_idx" ON "submissions" USING btree ("proof_key") WHERE proof_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS "submissions_proof_due_idx" ON "submissions" USING btree ("proof_due_at") WHERE proof_due_at IS NOT NULL;
