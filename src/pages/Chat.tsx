import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Send, Wind, SmilePlus, BookOpen, Moon,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAppStore } from "@/store/useAppStore";
import { classifyText } from "@/lib/chatUtils";
import { useReassessment } from "@/hooks/useReassessment";
import ReassessmentBanner from "@/components/ReassessmentBanner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

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

export default function Chat() {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userAvatar, setUserAvatar] = useState("🙂");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { chatMessages, addChatMessage, assessmentResult } = useAppStore();
  const { showReassessment, nickname, dismiss: dismissReassessment } = useReassessment();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("avatar_url")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.avatar_url) setUserAvatar(data.avatar_url);
      });
  }, [user]);

  useEffect(() => {
    if (chatMessages.length === 0) {
      addChatMessage({
        role: "assistant",
        content: `Welcome to MindCare AI! 💚 I'm your mental wellness companion. ${
          assessmentResult
            ? `Based on your screening, I'll tailor our conversation to support you. `
            : `Consider taking our screening assessment for personalized support. `
        }How are you feeling today?`,
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    setInput("");
    addChatMessage({ role: "user", content: text });
    setIsLoading(true);

    try {
      const nlpLabel = classifyText(text);
      
      // Gọi API FastAPI thay vì Mock Data
      const res = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          user_id: user?.id || "anonymous",
          severe_level: assessmentResult?.overallBaseline ?? "Normal",
          mental_status: assessmentResult?.primaryIssue && assessmentResult.primaryIssue !== "None" 
                         ? assessmentResult.primaryIssue 
                         : nlpLabel
        })
      });

      if (!res.ok) throw new Error("Lỗi khi kết nối với máy chủ AI");
      
      const data = await res.json();
      addChatMessage({ role: "assistant", content: data.reply });
    } catch {
      addChatMessage({
        role: "assistant",
        content: "I'm sorry, I encountered an issue. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
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
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
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
              {isLoading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3 justify-start">
                  <Avatar className="h-8 w-8 shrink-0 mt-1">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      <Brain className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-card border rounded-2xl rounded-bl-md px-5 py-3 card-elevated">
                    <div className="flex gap-1">
                      <span className="h-2 w-2 rounded-full bg-primary animate-pulse-gentle" />
                      <span className="h-2 w-2 rounded-full bg-primary animate-pulse-gentle" style={{ animationDelay: "0.2s" }} />
                      <span className="h-2 w-2 rounded-full bg-primary animate-pulse-gentle" style={{ animationDelay: "0.4s" }} />
                    </div>
                  </div>
                </motion.div>
              )}
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

          {assessmentResult && (
            <div className="mt-6 bg-secondary rounded-xl p-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Your Profile</p>
              <p className="text-sm font-medium text-secondary-foreground">
                {assessmentResult.overallBaseline} — {assessmentResult.primaryIssue}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PHQ-9: {assessmentResult.phq9Score} · GAD-7: {assessmentResult.gad7Score}
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
