-- Migration: Add detailed assessment fields to profiles table
-- Run this in Supabase SQL Editor > New Query

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phq9_score          SMALLINT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS phq9_severity       TEXT     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS gad7_score          SMALLINT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS gad7_severity       TEXT     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS realtime_status     TEXT     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS realtime_confidence FLOAT4   DEFAULT NULL;

-- Add check constraints only if they don't already exist
-- (ADD CONSTRAINT IF NOT EXISTS is not supported in PostgreSQL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'phq9_score_range' AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT phq9_score_range CHECK (phq9_score IS NULL OR (phq9_score >= 0 AND phq9_score <= 27));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gad7_score_range' AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT gad7_score_range CHECK (gad7_score IS NULL OR (gad7_score >= 0 AND gad7_score <= 21));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'phq9_severity_values' AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT phq9_severity_values CHECK (phq9_severity IS NULL OR phq9_severity IN ('Normal','Mild','Moderate','Severe'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gad7_severity_values' AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT gad7_severity_values CHECK (gad7_severity IS NULL OR gad7_severity IN ('Normal','Mild','Moderate','Severe'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'realtime_status_values' AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT realtime_status_values CHECK (
        realtime_status IS NULL OR realtime_status IN (
          'Anxiety','Bipolar','Depression','Normal',
          'Personality Disorder','Stress','Suicidal'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'realtime_confidence_range' AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT realtime_confidence_range CHECK (
        realtime_confidence IS NULL OR (realtime_confidence >= 0.0 AND realtime_confidence <= 1.0)
      );
  END IF;
END
$$;

