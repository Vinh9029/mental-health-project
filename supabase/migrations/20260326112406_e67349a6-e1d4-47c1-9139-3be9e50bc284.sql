
-- Add columns to profiles for USD
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS nickname text,
  ADD COLUMN IF NOT EXISTS baseline_level text DEFAULT 'Normal',
  ADD COLUMN IF NOT EXISTS primary_issue text DEFAULT 'None',
  ADD COLUMN IF NOT EXISTS last_assessment_date timestamp with time zone;

-- Chat sessions (temporary storage, privacy-by-design)
CREATE TABLE public.chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own chat sessions" ON public.chat_sessions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- User state (USD - long term insights, no raw chat)
CREATE TABLE public.user_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  extracted_insights jsonb DEFAULT '[]'::jsonb,
  preferred_coping_methods text[] DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own user state" ON public.user_states
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at on new tables
CREATE TRIGGER update_chat_sessions_updated_at
  BEFORE UPDATE ON public.chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_states_updated_at
  BEFORE UPDATE ON public.user_states
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
