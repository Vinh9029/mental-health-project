-- Mood check-ins table: stores daily quick mood snapshots
CREATE TABLE IF NOT EXISTS mood_checkins (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  emoji      text NOT NULL,
  label      text NOT NULL,
  stress_score int CHECK (stress_score >= 1 AND stress_score <= 10),
  note       text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE mood_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own mood check-ins"
  ON mood_checkins
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
