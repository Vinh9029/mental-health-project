import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_id } = await req.json();

    /**
     * TODO: Implement the full summarization pipeline:
     *
     * 1. Fetch the chat_sessions row by session_id
     * 2. Extract the messages JSONB array
     * 3. Send messages to an LLM (OpenAI/Gemini) with a prompt like:
     *    "Extract key psychological insights and preferred coping methods
     *     from this conversation. Return JSON with:
     *     { extracted_insights: [...], preferred_coping_methods: [...] }"
     * 4. Upsert the result into user_states table
     * 5. DELETE the raw chat_sessions row (privacy-by-design)
     *
     * const supabase = createClient(
     *   Deno.env.get("SUPABASE_URL")!,
     *   Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
     * );
     */

    return new Response(
      JSON.stringify({
        status: "placeholder",
        message: "Summarization not yet implemented. TODO: Add LLM call here.",
        session_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
