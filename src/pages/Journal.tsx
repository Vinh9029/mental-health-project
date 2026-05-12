import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  BookOpen, Sparkles, ArrowLeft, Trash2, ChevronDown, ChevronUp,
  Clock, PenLine, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import { format, parseISO } from "date-fns";

interface JournalEntry {
  id: string;
  content: string;
  ai_summary: string | null;
  created_at: string;
  updated_at: string;
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Render the AI summary with each numbered bullet on its own line */
function AISummaryText({ text }: { text: string }) {
  // Split on numbered bullets like "1.", "2.", "3.", "4." that start a new segment
  const lines = text.split(/(?=\d+\.\s)/g).filter(Boolean);
  if (lines.length <= 1) {
    // Plain text — just show with whitespace preserved
    return <p className="text-xs text-card-foreground leading-relaxed whitespace-pre-wrap">{text}</p>;
  }
  return (
    <ul className="space-y-1.5">
      {lines.map((line, i) => (
        <li key={i} className="text-xs text-card-foreground leading-relaxed flex gap-1.5">
          <span className="shrink-0 text-primary font-bold">{line.match(/^\d+\./)?.[0]}</span>
          <span>{line.replace(/^\d+\.\s*/, "")}</span>
        </li>
      ))}
    </ul>
  );
}

/** Streaming bubble while AI is generating */
function StreamingBubble({ text }: { text: string }) {
  return (
    <div className="mt-3 bg-primary/6 border border-primary/20 rounded-xl p-3">
      <p className="text-xs font-semibold text-primary flex items-center gap-1 mb-2">
        <Sparkles className="h-3.5 w-3.5 animate-pulse" /> AI Insight
        <span className="ml-1 text-[10px] text-muted-foreground font-normal">(generating…)</span>
      </p>
      {text ? (
        <>
          <AISummaryText text={text} />
          <span
            className="inline-block w-0.5 h-3 bg-primary ml-0.5 align-middle"
            style={{ animation: "blink 0.9s step-end infinite" }}
          />
        </>
      ) : (
        <div className="flex gap-1 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.2s" }} />
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.4s" }} />
        </div>
      )}
    </div>
  );
}

export default function Journal() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [summarizing, setSummarizing] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Clinical profile for personalizing AI journal analysis
  const [clinicalProfile, setClinicalProfile] = useState<{
    phq9_score: number | null;
    phq9_severity: string | null;
    gad7_score: number | null;
    gad7_severity: string | null;
    baseline_level: string | null;
  } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("phq9_score, phq9_severity, gad7_score, gad7_severity, baseline_level")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setClinicalProfile(data as typeof clinicalProfile);
      });
  }, [user]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [draft]);

  const fetchEntries = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("journal_entries")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setEntries(data as JournalEntry[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchEntries();
  }, [user]);

  const handleSave = async () => {
    if (!draft.trim() || !user) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("journal_entries")
      .insert({ user_id: user.id, content: draft.trim() })
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: "Could not save entry.", variant: "destructive" });
      return;
    }
    setEntries((prev) => [data as JournalEntry, ...prev]);
    setDraft("");
    toast({ title: "Saved ✨", description: "Journal entry added." });
  };

  /** Streaming SSE summarisation — word-by-word typing effect */
  const handleSummarize = async (entry: JournalEntry) => {
    setSummarizing(entry.id);
    setStreamingText((prev) => ({ ...prev, [entry.id]: "" }));

    try {
      const res = await fetch("http://localhost:8000/api/journal/summarize/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: entry.content,
          // Clinical profile — personalize AI insight depth
          phq9_score: clinicalProfile?.phq9_score ?? null,
          phq9_severity: clinicalProfile?.phq9_severity ?? null,
          gad7_score: clinicalProfile?.gad7_score ?? null,
          gad7_severity: clinicalProfile?.gad7_severity ?? null,
          baseline_level: clinicalProfile?.baseline_level ?? null,
        }),
      });

      if (!res.ok || !res.body) throw new Error("Stream unavailable");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") break;
          try {
            const { token } = JSON.parse(payload);
            fullText += token;
            setStreamingText((prev) => ({ ...prev, [entry.id]: fullText }));
          } catch {
            // skip malformed chunk
          }
        }
      }

      // Commit to DB and state
      await supabase
        .from("journal_entries")
        .update({ ai_summary: fullText })
        .eq("id", entry.id);

      setEntries((prev) =>
        prev.map((e) => (e.id === entry.id ? { ...e, ai_summary: fullText } : e))
      );
      setStreamingText((prev) => {
        const next = { ...prev };
        delete next[entry.id];
        return next;
      });
      toast({ title: "AI Insight ready ✨" });
    } catch {
      toast({
        title: "Error",
        description: "AI summarisation failed. Is the backend running?",
        variant: "destructive",
      });
      setStreamingText((prev) => {
        const next = { ...prev };
        delete next[entry.id];
        return next;
      });
    } finally {
      setSummarizing(null);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("journal_entries").delete().eq("id", id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    toast({ title: "Entry deleted." });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Please sign in to use the journal.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-2xl space-y-6">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 mb-1">
              <Button variant="ghost" size="icon" asChild className="-ml-2">
                <Link to="/chat"><ArrowLeft className="h-4 w-4" /></Link>
              </Button>
              <div>
                <h1 className="font-heading text-3xl font-bold text-foreground flex items-center gap-2">
                  <BookOpen className="h-7 w-7 text-primary" /> My Journal
                </h1>
                <p className="text-muted-foreground text-sm">Your private space. Words are analysed only when you ask.</p>
              </div>
            </div>
          </motion.div>

          {/* New entry composer */}
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
            className="bg-card rounded-2xl p-6 card-elevated"
          >
            <div className="flex items-center gap-2 mb-3">
              <PenLine className="h-4 w-4 text-primary" />
              <h2 className="font-heading text-base font-semibold text-card-foreground">New Entry</h2>
              {draft.trim() && (
                <span className="ml-auto text-xs text-muted-foreground">{wordCount(draft)} words</span>
              )}
            </div>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="What's on your mind today? Write freely — this is just for you. / Hôm nay bạn đang nghĩ gì?"
              rows={5}
              className="w-full resize-none rounded-xl border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm leading-relaxed px-4 py-3 transition-all overflow-hidden"
            />
            <div className="flex justify-end mt-3 gap-2">
              {draft.trim() && (
                <Button variant="ghost" size="sm" onClick={() => setDraft("")}>
                  <X className="h-3.5 w-3.5 mr-1" /> Clear
                </Button>
              )}
              <Button
                variant="hero"
                size="sm"
                onClick={handleSave}
                disabled={!draft.trim() || saving}
              >
                {saving ? "Saving..." : "Save Entry"}
              </Button>
            </div>
          </motion.div>

          {/* Past entries */}
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}
          >
            <h2 className="font-heading text-lg font-semibold text-card-foreground mb-3">
              Past Entries <span className="text-muted-foreground font-normal text-sm">({entries.length})</span>
            </h2>

            {loading ? (
              <div className="flex justify-center py-10">
                <div className="h-7 w-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground bg-card rounded-2xl card-elevated">
                <span className="text-5xl mb-4 block">📓</span>
                <p className="text-sm font-medium">No entries yet.</p>
                <p className="text-xs mt-1">Write your first entry above.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence>
                  {entries.map((entry, i) => {
                    const isExpanded = expandedId === entry.id;
                    const preview = entry.content.slice(0, 180) + (entry.content.length > 180 ? "…" : "");
                    const isStreaming = summarizing === entry.id;
                    const streamText = streamingText[entry.id];

                    return (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ delay: i * 0.04 }}
                        className="bg-card rounded-2xl p-5 card-elevated"
                      >
                        {/* Entry header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{format(parseISO(entry.created_at), "EEE, MMM d · h:mm a")}</span>
                          </div>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                            title="Delete entry"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Entry content */}
                        <p className="text-sm text-card-foreground leading-relaxed whitespace-pre-wrap">
                          {isExpanded ? entry.content : preview}
                        </p>
                        {entry.content.length > 180 && (
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                            className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                          >
                            {isExpanded
                              ? <><ChevronUp className="h-3 w-3" /> Collapse</>
                              : <><ChevronDown className="h-3 w-3" /> Read more</>}
                          </button>
                        )}

                        {/* AI Summary — streaming or saved */}
                        {isStreaming ? (
                          <StreamingBubble text={streamText ?? ""} />
                        ) : entry.ai_summary ? (
                          <div className="mt-3 bg-primary/6 border border-primary/20 rounded-xl p-3">
                            <p className="text-xs font-semibold text-primary flex items-center gap-1 mb-2">
                              <Sparkles className="h-3.5 w-3.5" /> AI Insight
                            </p>
                            <AISummaryText text={entry.ai_summary} />
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-3 text-xs text-primary hover:bg-primary/5"
                            onClick={() => handleSummarize(entry)}
                            disabled={!!summarizing}
                          >
                            <Sparkles className="h-3.5 w-3.5 mr-1" />
                            Get AI insight
                          </Button>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
