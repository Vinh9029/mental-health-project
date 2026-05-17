import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Send, Wind, SmilePlus, BookOpen, Moon, Volume2, VolumeX,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAppStore, type SeverityLevel, type PrimaryIssue } from "@/store/useAppStore";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { classifyText } from "@/lib/chatUtils";
import { useReassessment } from "@/hooks/useReassessment";
import ReassessmentBanner from "@/components/ReassessmentBanner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getAvatarEmoji } from "@/lib/avatars";
import { useMoodCheckin } from "@/hooks/useMoodCheckin";
import MoodCheckInModal from "@/components/MoodCheckInModal";
import VerifiedSourcePopup from "@/components/VerifiedSourcePopup";

// Custom Markdown components for rich chat bubble rendering
const getMarkdownComponents = (sources?: Array<{content: string, source: string, page: number | string, ref: string}>) => ({
  // Headings
  h2: ({ children }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="text-base font-semibold text-foreground mt-3 mb-1.5 pb-0.5 border-b border-border/40">{children}</h2>
  ),
  h3: ({ children }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="text-sm font-semibold text-foreground mt-2 mb-1">{children}</h3>
  ),
  // Tables
  table: ({ children }: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="overflow-x-auto my-2 rounded-lg border border-border">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <thead className="bg-primary/10">{children}</thead>
  ),
  th: ({ children }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
    <th className="px-3 py-2 text-left font-semibold text-foreground border-b border-border">{children}</th>
  ),
  td: ({ children }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <td className="px-3 py-2 border-b border-border/50 text-card-foreground">{children}</td>
  ),
  tr: ({ children }: React.HTMLAttributes<HTMLTableRowElement>) => (
    <tr className="even:bg-muted/30">{children}</tr>
  ),
  // Lists
  ul: ({ children }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="list-disc pl-5 my-1 space-y-0.5">{children}</ul>
  ),
  ol: ({ children }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="list-decimal pl-5 my-1 space-y-0.5">{children}</ol>
  ),
  li: ({ children }: React.LiHTMLAttributes<HTMLLIElement>) => (
    <li className="text-sm leading-relaxed">{children}</li>
  ),
  // Inline styles
  strong: ({ children }: React.HTMLAttributes<HTMLElement>) => (
    <strong className="font-semibold text-primary">{children}</strong>
  ),
  em: ({ children }: React.HTMLAttributes<HTMLElement>) => (
    <em className="italic text-muted-foreground/90">{children}</em>
  ),
  code: ({ children }: React.HTMLAttributes<HTMLElement>) => (
    <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
  ),
  // Paragraph with citation handling
  p: ({ children }: { children: React.ReactNode }) => {
    // Guard: only process citations when the message has RAG sources attached
    if (!sources || sources.length === 0) {
      return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>;
    }
    // Strict regex — only match [filename.pdf, p. X] or [filename.pdf, trang X] patterns
    const citationRegex = /\[([^\]]+\.(?:pdf|PDF|epub|EPUB)[^\]]*)\]/gi;
    const processChild = (child: React.ReactNode): React.ReactNode => {
      if (typeof child === 'string') {
        const parts = child.split(citationRegex);
        const matches = child.match(citationRegex) || [];
        const result: React.ReactNode[] = [];
        parts.forEach((text, idx) => {
          if (text) result.push(text);
          if (idx < matches.length) {
            const raw = matches[idx];
            const subCitations = raw.replace(/^\[/, '').replace(/\]$/, '').split(/\s*;\s*/);
            subCitations.forEach((sub, subIdx) => {
              const refText = sub.trim();
              const sourceInfo = sources?.find(s =>
                s.ref.replace(/\s/g, '') === `[${refText}]`.replace(/\s/g, '') ||
                s.ref === `[${refText}]`
              );
              result.push(
                <VerifiedSourcePopup key={`c${idx}-${subIdx}`} refText={refText} sourceInfo={sourceInfo} />
              );
            });
          }
        });
        return result;
      }
      return child;
    };
    return (
      <p className="mb-2 last:mb-0 leading-relaxed">
        {Array.isArray(children)
          ? children.map((c, i) => <span key={i}>{processChild(c)}</span>)
          : processChild(children)}
      </p>
    );
  },
  // Blockquote
  blockquote: ({ children }: React.HTMLAttributes<HTMLElement>) => (
    <blockquote className="border-l-2 border-primary/40 pl-3 my-2 text-muted-foreground italic">{children}</blockquote>
  ),
});


const quickReplies = [
  "I'm feeling anxious",
  "I need help relaxing",
  "I'm feeling stressed",
];

const selfCareTools = [
  {
    icon: Wind,
    title: "Breathing Exercise",
    description: "4-7-8 technique for calm",
    action: "Guide me through a 4-7-8 breathing exercise",
  },
  {
    icon: SmilePlus,
    title: "Mood Tracking",
    description: "Log daily emotions",
    action: "Help me track my mood today",
  },
  {
    icon: BookOpen,
    title: "Journaling",
    description: "Express your thoughts",
    action: "Give me a journaling prompt",
  },
  {
    icon: Moon,
    title: "Sleep Guide",
    description: "Improve sleep quality",
    action: "Share tips to improve my sleep",
  },
];

// ── Text-to-Speech hook ──────────────────────────────────────────────────────
function useTTS() {
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const speak = useCallback((id: string, text: string) => {
    if (!window.speechSynthesis) return;

    // Stop any ongoing speech
    window.speechSynthesis.cancel();

    if (speakingId === id) {
      // Toggle off
      setSpeakingId(null);
      return;
    }

    // Strip markdown syntax for cleaner audio
    const clean = text
      .replace(/#{1,6}\s*/g, "")
      .replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/^[-*]\s+/gm, "")
      .replace(/\|[^\n]+\|/g, "")   // strip table rows
      .replace(/\n{2,}/g, ". ")
      .replace(/\n/g, " ")
      .trim();

    const utter = new SpeechSynthesisUtterance(clean);
    utter.rate  = 0.95;
    utter.pitch = 1.05;
    // Auto-select Vietnamese voice if text is likely Vietnamese
    const isVi = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(clean);
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      isVi ? v.lang.startsWith("vi") : v.lang.startsWith("en")
    );
    if (preferred) utter.voice = preferred;

    utter.onend   = () => setSpeakingId(null);
    utter.onerror = () => setSpeakingId(null);

    setSpeakingId(id);
    window.speechSynthesis.speak(utter);
  }, [speakingId]);

  // Cancel on unmount
  useEffect(() => () => { window.speechSynthesis?.cancel(); }, []);

  return { speakingId, speak };
}

export default function Chat() {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<string | null>(null);
  const [streamingSources, setStreamingSources] = useState<any[]>([]);
  const [userAvatar, setUserAvatar] = useState("🙂");
  const [showMoodModal, setShowMoodModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { chatMessages, addChatMessage, assessmentResult, setAssessmentResult } = useAppStore();
  const { showReassessment, nickname, dismiss: dismissReassessment } = useReassessment();
  const { user } = useAuth();
  const { speakingId, speak } = useTTS();
  const { hasCheckedInToday, submitCheckin } = useMoodCheckin();

  // -- Behavioural context (mood + journal) fetched once per session --
  const [moodContext, setMoodContext] = useState<Array<Record<string, unknown>> | null>(null);
  const [journalContext, setJournalContext] = useState<Array<Record<string, unknown>> | null>(null);

  // Fetch mood + journal context from Supabase (once per user session)
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ data: moods }, { data: journals }] = await Promise.all([
        supabase
          .from("mood_checkins")
          .select("emoji, label, stress_score, note, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("journal_entries")
          .select("ai_summary, created_at")
          .eq("user_id", user.id)
          .not("ai_summary", "is", null)
          .order("created_at", { ascending: false })
          .limit(2),
      ]);
      if (moods) setMoodContext(moods as Array<Record<string, unknown>>);
      if (journals) setJournalContext(journals as Array<Record<string, unknown>>);
    };
    load();
  }, [user]);

  // Sync profile (PHQ-9 / GAD-7) from Supabase when store is empty after page reload
  useEffect(() => {
    if (!user || assessmentResult) return;
    supabase
      .from("profiles")
      .select("phq9_score, phq9_severity, gad7_score, gad7_severity, baseline_level, primary_issue, realtime_status, realtime_confidence")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data || data.phq9_score == null) return;
        setAssessmentResult({
          phq9Score: data.phq9_score,
          phq9Severity: (data.phq9_severity ?? "Normal") as SeverityLevel,
          gad7Score: data.gad7_score ?? 0,
          gad7Severity: (data.gad7_severity ?? "Normal") as SeverityLevel,
          overallBaseline: (data.baseline_level ?? "Normal") as SeverityLevel,
          primaryIssue: (data.primary_issue ?? "None") as PrimaryIssue,
          realtimeStatus: data.realtime_status ?? undefined,
          realtimeConfidence: data.realtime_confidence ?? undefined,
        });
      });
  }, [user, assessmentResult]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("avatar_url")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.avatar_url) setUserAvatar(getAvatarEmoji(data.avatar_url));
      });
  }, [user]);

  // Show mood check-in modal once per day
  useEffect(() => {
    if (hasCheckedInToday === false) {
      // Small delay so the chat page renders first
      const t = setTimeout(() => setShowMoodModal(true), 1200);
      return () => clearTimeout(t);
    }
  }, [hasCheckedInToday]);

  useEffect(() => {
    const loadChatHistory = async () => {
      if (chatMessages.length === 0) {
        if (user) {
          const { data, error } = await supabase
            .from("chat_messages")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true });
            
          if (!error && data && data.length > 0) {
            data.forEach((msg) => {
              addChatMessage({ 
                role: msg.role as "user" | "assistant", 
                content: msg.content,
                sources: msg.sources as any[] 
              });
            });
            return;
          }
        }
        
        addChatMessage({
          role: "assistant",
          content: `Welcome to MindCare AI! 💚 I'm your mental wellness companion. ${
            assessmentResult
              ? `Based on your screening, I'll tailor our conversation to support you. `
              : `Consider taking our screening assessment for personalized support. `
          }How are you feeling today?`,
        });
      }
    };
    loadChatHistory();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, streamingMessage]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    setInput("");
    addChatMessage({ role: "user", content: text });
    setIsLoading(true);
    setStreamingMessage(""); // start streaming bubble immediately
    setStreamingSources([]); // clear previous streaming sources

    if (user) {
      await supabase.from("chat_messages").insert({
        user_id: user.id,
        role: "user",
        content: text
      });
    }

    try {
      const nlpLabel = classifyText(text);

      // Derive realtime_status: priority = 1) NLP on current text, 2) today's mood, 3) stored assessment
      const deriveMoodStatus = () => {
        const latestMood = moodContext?.[0];
        if (latestMood) {
          const label  = (latestMood as any).label as string;
          const stress = ((latestMood as any).stress_score as number) ?? 0;
          if (label === "Anxious" || stress >= 8) return "Anxiety";
          if (label === "Sad"     || label === "Low")  return "Depression";
          if (label === "Stressed"|| stress >= 7) return "Stressed";
          if (label === "Angry")                  return "Anger";
        }
        return assessmentResult?.realtimeStatus || "Normal";
      };
      const derivedRealtimeStatus = nlpLabel !== "Normal" ? nlpLabel : deriveMoodStatus();

      const res = await fetch("http://localhost:8000/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          user_id: user?.id || "anonymous",
          baseline_severity: assessmentResult?.overallBaseline ?? "Normal",
          baseline_issue: assessmentResult?.primaryIssue && assessmentResult.primaryIssue !== "None"
                         ? assessmentResult.primaryIssue
                         : "None",
          realtime_status: derivedRealtimeStatus,
          history: chatMessages.map(msg => ({ role: msg.role, content: msg.content })),
          phq9_score: assessmentResult?.phq9Score ?? null,
          phq9_severity: assessmentResult?.phq9Severity ?? null,
          gad7_score: assessmentResult?.gad7Score ?? null,
          gad7_severity: assessmentResult?.gad7Severity ?? null,
          mood_context: moodContext ?? [],
          journal_context: journalContext ?? [],
        })
      });

      if (!res.ok || !res.body) throw new Error("Lỗi khi kết nối với máy chủ AI");

      // Read SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let buffer = "";
      let accumulatedSources: any[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // keep incomplete last line

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") break;
          try {
            const data = JSON.parse(payload);
            if (data.token) {
              fullText += data.token;
              setStreamingMessage(fullText);
            } else if (data.sources) {
              accumulatedSources = data.sources;
              setStreamingSources(accumulatedSources);
            }
          } catch {
            // skip malformed chunk
          }
        }
      }

      // Commit to store and clear streaming bubble
      addChatMessage({ role: "assistant", content: fullText, sources: accumulatedSources });
      setStreamingMessage(null);
      setStreamingSources([]);

      if (user) {
        await supabase.from("chat_messages").insert({
          user_id: user.id,
          role: "assistant",
          content: fullText,
          sources: accumulatedSources
        });
      }
    } catch {
      setStreamingMessage(null);
      addChatMessage({
        role: "assistant",
        content: "I'm sorry, I encountered an issue. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TooltipProvider delayDuration={400}>
      <div className="h-screen flex flex-col bg-background">
        {/* Navbar */}
        <nav className="shrink-0 bg-background/80 backdrop-blur-md border-b z-10">
          <div className="flex items-center justify-between h-14 px-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg hero-gradient flex items-center justify-center">
                <Brain className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-heading text-lg font-semibold text-foreground">MindCare AI</span>
            </Link>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/screening">Take Screening</Link>
            </Button>
          </div>
        </nav>

        <div className="flex-1 flex overflow-hidden">
          {/* Chat Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-6">
              <div className="max-w-2xl mx-auto space-y-4">
                <AnimatePresence initial={false}>
                  {chatMessages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {msg.role === "assistant" && (
                        <Avatar className="h-8 w-8 shrink-0 mt-1">
                          <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                            <Brain className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div
                        className={`max-w-[75%] rounded-2xl px-5 py-3 text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "hero-gradient text-primary-foreground rounded-br-md"
                            : "bg-card border text-card-foreground rounded-bl-md card-elevated"
                        }`}
                      >
                        {msg.role === "assistant" ? (
                          <div className="prose prose-sm max-w-none text-card-foreground">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={getMarkdownComponents(msg.sources)}
                            >
                              {msg.content}
                            </ReactMarkdown>

                            {/* Verified Sources footer — always shown when sources exist */}
                            {msg.sources && msg.sources.length > 0 && (
                              <div className="mt-3 pt-2.5 border-t border-border/30">
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                  <BookOpen className="h-3 w-3" />
                                  Verified Sources ({msg.sources.length})
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {msg.sources.map((src, i) => (
                                    <VerifiedSourcePopup
                                      key={i}
                                      refText={`${src.source}, ${src.page !== '?' ? `trang ${src.page}` : 'p. ?'}`}
                                      sourceInfo={src}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* TTS Speaker button */}
                            <div className="flex justify-end mt-2">
                              <button
                                onClick={() => speak(msg.id, msg.content)}
                                title={speakingId === msg.id ? "Stop reading" : "Read aloud"}
                                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-all ${
                                  speakingId === msg.id
                                    ? "bg-primary/15 text-primary"
                                    : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                                }`}
                              >
                                {speakingId === msg.id ? (
                                  <><VolumeX className="h-3.5 w-3.5" /><span>Stop</span></>
                                ) : (
                                  <><Volume2 className="h-3.5 w-3.5" /><span>Read</span></>
                                )}
                              </button>
                            </div>
                          </div>
                        ) : (
                          msg.content
                        )}
                      </div>
                      {msg.role === "user" && (
                        <Avatar className="h-8 w-8 shrink-0 mt-1">
                          <AvatarFallback className="bg-secondary text-base">
                            {userAvatar}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Streaming / typing bubble */}
                <AnimatePresence>
                  {streamingMessage !== null && (
                    <motion.div
                      key="streaming"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex gap-3 justify-start"
                    >
                      <Avatar className="h-8 w-8 shrink-0 mt-1">
                        <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                          <Brain className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="max-w-[75%] rounded-2xl rounded-bl-md px-5 py-3 bg-card border text-card-foreground card-elevated text-sm leading-relaxed">
                        {streamingMessage.length === 0 ? (
                          /* Initial dots while LLM is generating */
                          <div className="flex gap-1 py-1">
                            <span className="h-2 w-2 rounded-full bg-primary animate-pulse-gentle" />
                            <span className="h-2 w-2 rounded-full bg-primary animate-pulse-gentle" style={{ animationDelay: "0.2s" }} />
                            <span className="h-2 w-2 rounded-full bg-primary animate-pulse-gentle" style={{ animationDelay: "0.4s" }} />
                          </div>
                        ) : (
                          /* Live markdown render with blinking cursor */
                          <div className="prose prose-sm max-w-none text-card-foreground">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={getMarkdownComponents(streamingSources)}
                            >
                              {streamingMessage}
                            </ReactMarkdown>
                            <span
                              className="inline-block w-0.5 h-4 bg-primary ml-0.5 align-middle"
                              style={{ animation: "blink 0.9s step-end infinite" }}
                            />
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* No longer need the old dots-only loader */}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Re-assessment banner */}
            {showReassessment && (
              <ReassessmentBanner nickname={nickname} onDismiss={dismissReassessment} />
            )}

            {/* Quick replies + Input */}
            <div className="shrink-0 border-t bg-background px-4 py-3">
              <div className="max-w-2xl mx-auto">
                <div className="flex flex-wrap gap-2 mb-3">
                  {quickReplies.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="text-xs px-3 py-1.5 rounded-full border border-primary/30 text-primary hover:bg-primary/5 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <form
                  onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
                  className="flex gap-2"
                >
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 h-11 px-4 rounded-xl border bg-card text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                  />
                  <Button type="submit" variant="hero" size="icon" disabled={!input.trim() || isLoading}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="hidden lg:flex w-72 shrink-0 border-l bg-card flex-col p-5 overflow-y-auto">
            <h3 className="font-heading text-lg font-semibold text-card-foreground mb-1">Self-Care Tools</h3>
            <p className="text-xs text-muted-foreground mb-5">Quick access to wellness resources</p>
            <div className="space-y-3">
              {selfCareTools.map((tool) => (
                <button
                  key={tool.title}
                  onClick={() => sendMessage(tool.action)}
                  className="w-full text-left bg-secondary hover:bg-secondary/70 rounded-xl p-4 transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-lg hero-gradient flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <tool.icon className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-secondary-foreground">{tool.title}</p>
                      <p className="text-xs text-muted-foreground">{tool.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Mental Status Panel */}
            <div className="mt-6 space-y-3">
              {assessmentResult ? (
                <div className="bg-secondary rounded-xl p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Clinical Profile</p>
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">PHQ-9 (Depression)</span>
                        <span className="font-bold text-foreground">{assessmentResult.phq9Score}/27 · {assessmentResult.phq9Severity}</span>
                      </div>
                      <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(assessmentResult.phq9Score / 27) * 100}%`, background: assessmentResult.phq9Score <= 4 ? "var(--primary)" : assessmentResult.phq9Score <= 9 ? "#f59e0b" : assessmentResult.phq9Score <= 14 ? "#f97316" : "#ef4444" }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">GAD-7 (Anxiety)</span>
                        <span className="font-bold text-foreground">{assessmentResult.gad7Score}/21 · {assessmentResult.gad7Severity}</span>
                      </div>
                      <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(assessmentResult.gad7Score / 21) * 100}%`, background: assessmentResult.gad7Score <= 4 ? "var(--primary)" : assessmentResult.gad7Score <= 9 ? "#f59e0b" : assessmentResult.gad7Score <= 14 ? "#f97316" : "#ef4444" }} />
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-border/40 flex justify-between text-xs">
                    <span className="text-muted-foreground">Overall</span>
                    <span className="font-bold">{assessmentResult.overallBaseline} · {assessmentResult.primaryIssue === "None" ? "—" : assessmentResult.primaryIssue}</span>
                  </div>
                </div>
              ) : (
                <div className="bg-secondary rounded-xl p-4">
                  <p className="text-xs text-muted-foreground">No assessment yet. <a href="/screening" className="text-primary hover:underline">Take screening →</a></p>
                </div>
              )}

              {/* Today's Mood */}
              {moodContext?.[0] && (
                <div className="bg-secondary rounded-xl p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Today's Mood</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{(moodContext[0] as any).emoji}</span>
                    <div>
                      <p className="text-sm font-medium text-secondary-foreground">{(moodContext[0] as any).label}</p>
                      {(moodContext[0] as any).stress_score != null && (
                        <p className="text-xs text-muted-foreground">Stress {(moodContext[0] as any).stress_score}/10</p>
                      )}
                    </div>
                  </div>
                  {(moodContext[0] as any).note && (
                    <p className="text-xs text-muted-foreground mt-2 italic">"{(moodContext[0] as any).note}"</p>
                  )}
                </div>
              )}

              {/* AI Sentiment (realtime_status) */}
              {assessmentResult?.realtimeStatus && assessmentResult.realtimeStatus !== "Normal" && (
                <div className="bg-secondary rounded-xl p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">AI Perception</p>
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                      assessmentResult.realtimeStatus === "Suicidal"  ? "bg-red-500 animate-pulse" :
                      assessmentResult.realtimeStatus === "Depression" ? "bg-orange-400" :
                      assessmentResult.realtimeStatus === "Anxiety"   ? "bg-yellow-400" :
                      "bg-primary"
                    }`} />
                    <div>
                      <p className="text-sm font-semibold text-secondary-foreground">
                        {assessmentResult.realtimeStatus === "Suicidal"   ? "⚠️ Crisis Risk Detected" :
                         assessmentResult.realtimeStatus === "Depression" ? "Depressive Pattern" :
                         assessmentResult.realtimeStatus === "Anxiety"    ? "Anxiety Pattern" :
                         assessmentResult.realtimeStatus}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Sent to AI · shapes response tone</p>
                    </div>
                  </div>
                  {assessmentResult.realtimeConfidence != null && (
                    <div className="mt-2">
                      <div className="h-1 w-full bg-border rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${assessmentResult.realtimeConfidence * 100}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 text-right">{(assessmentResult.realtimeConfidence * 100).toFixed(0)}% confidence</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>

        {/* Daily Mood Check-in Modal */}
        {showMoodModal && (
          <MoodCheckInModal
            onClose={() => setShowMoodModal(false)}
            onSubmit={submitCheckin}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
