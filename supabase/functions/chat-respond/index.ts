import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * TODO: Implement RAG Retrieval here.
 * 1. Connect to ChromaDB/Pinecone vector store.
 * 2. Embed user_query and perform similarity search with Metadata Filtering (disease_label).
 * 3. Return retrieved text chunks (CBT techniques, exercises).
 */
function retrieveMedicalDocuments(
  _diseaseLabel: string,
  _userQuery: string
): string {
  return "MOCK_RETRIEVED_DOCUMENT";
}

/**
 * TODO: Implement LLM summarization for the USD.
 * 1. Fetch raw messages from ChatSession.
 * 2. Ask LLM to extract key psychological insights and preferred coping methods.
 * 3. Update user_states table and DELETE the raw chat_sessions entry.
 */
async function summarizeChatToInsights(
  _supabase: any,
  _chatSessionId: string
): Promise<void> {
  // Placeholder — will call OpenAI/Gemini to summarize
}

/**
 * TODO: Implement LangChain/LLM Generation here.
 * 1. Fetch user's user_states (insights) from DB.
 * 2. Call retrieveMedicalDocuments().
 * 3. Construct System Prompt combining: User Insights + Retrieved Docs + NLP Label.
 * 4. Call OpenAI/Gemini API to stream response.
 */
function generateChatResponse(
  _userId: string,
  _userMessage: string,
  _nlpLabel: string
): string {
  return "Đây là tin nhắn phản hồi giả lập từ MindCare AI. Phần LLM và RAG sẽ được code sau.";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, message, nlp_label } = await req.json();

    // TODO: Replace with real LLM pipeline
    const _docs = retrieveMedicalDocuments(nlp_label || "Normal", message);
    const reply = generateChatResponse(user_id, message, nlp_label || "Normal");

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
