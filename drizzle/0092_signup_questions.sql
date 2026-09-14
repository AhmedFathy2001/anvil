-- Custom questions on the SIGN-UP form, reusing the survey question model.
--
-- The same thing at two moments rather than two things: a question on an event has a prompt, a type,
-- an order and whether it is required, and that is as true of "how many hours a week can you play?"
-- as of "how was the board?". So the builder, the storage and the renderer are shared and this says
-- which form a row belongs to.
--
-- 'post' for every existing row, so nothing changes meaning. Everything reading or writing questions
-- must filter on it — the builder saves a whole set and deletes what is missing, so an unscoped save
-- would wipe the other form's questions.
ALTER TABLE "survey_questions" ADD COLUMN IF NOT EXISTS "stage" text DEFAULT 'post' NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "survey_questions_event_stage_idx"
  ON "survey_questions" ("event_id","stage");
