-- Assessment history table: stores each PHQ-9/GAD-7 submission for trend charting
CREATE TABLE IF NOT EXISTS assessment_history (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL,
  phq9_score       int,
  gad7_score       int,
  phq9_severity    text,
  gad7_severity    text,
  overall_baseline text,
  primary_issue    text,
  taken_at         timestamptz DEFAULT now()
);

ALTER TABLE assessment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own assessment history"
  ON assessment_history
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
