import { useState, useMemo, useEffect, useRef } from "react";
// Chatbot conversation history type
type ChatMessage = {
  sender: "user" | "bot";
  text: string;
};
// --- Chatbot Conversation State ---
const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
const [chatInput, setChatInput] = useState("");
const [isBotTyping, setIsBotTyping] = useState(false);
const chatEndRef = useRef<HTMLDivElement>(null);

// Scroll to bottom on new message
useEffect(() => {
  if (chatEndRef.current) {
    chatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }
}, [chatHistory]);

// Send message to chatbot (dummy implementation, replace with real API call)
async function sendMessageToBot(message: string) {
  setIsBotTyping(true);
  setChatHistory((prev) => [...prev, { sender: "user", text: message }]);
  try {
    const response = await fetch("http://localhost:8000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    let botReply = "Sorry, no response.";
    if (response.ok) {
      const data = await response.json();
      // Support multiple possible keys from backend
      botReply = data.result || data.reply || data.text || "(No reply)";
    } else {
      botReply = "Chatbot service error.";
    }
    setChatHistory((prev) => [...prev, { sender: "bot", text: botReply }]);
  } catch (err) {
    setChatHistory((prev) => [...prev, { sender: "bot", text: "Error contacting chatbot." }]);
  }
  setIsBotTyping(false);
}
// --- Chatbot UI Section ---
const renderChatbotSection = () => (
  <div className="bg-card rounded-2xl p-6 card-elevated mb-8">
    <h3 className="font-heading text-lg font-bold mb-4 text-card-foreground">Chatbot Conversation</h3>
    <div className="h-64 overflow-y-auto border rounded-xl p-3 bg-background mb-3">
      {chatHistory.length === 0 && (
        <div className="text-muted-foreground text-sm text-center mt-16">No messages yet. Start the conversation!</div>
      )}
      {chatHistory.map((msg, idx) => (
        <div key={idx} className={`flex mb-2 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
          <div className={`px-4 py-2 rounded-xl max-w-[70%] ${msg.sender === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
            {msg.text}
          </div>
        </div>
      ))}
      {isBotTyping && (
        <div className="flex justify-start mb-2">
          <div className="px-4 py-2 rounded-xl bg-secondary text-foreground opacity-70">...
          </div>
        </div>
      )}
      <div ref={chatEndRef} />
    </div>
    <form
      className="flex gap-2"
      onSubmit={e => {
        e.preventDefault();
        if (chatInput.trim()) {
          sendMessageToBot(chatInput.trim());
          setChatInput("");
        }
      }}
    >
      <input
        className="flex-1 border rounded-xl px-3 py-2 text-sm bg-background"
        placeholder="Type your message..."
        value={chatInput}
        onChange={e => setChatInput(e.target.value)}
        disabled={isBotTyping}
      />
      <Button type="submit" variant="hero" disabled={isBotTyping || !chatInput.trim()}>Send</Button>
    </form>
  </div>
);
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, CheckCircle, MessageSquare, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { calculateBaseline, useAppStore } from "@/store/useAppStore";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";

// ── Follow-up Questions Pool ──
const CONVERSATION_QUESTIONS: Record<string, Record<string, string[]>> = {
  Depression: {
    Normal: [
      "That's great to hear! What activities bring you the most joy lately?",
      "How are your sleep and energy levels these days?",
      "Tell me about your typical day - what keeps you occupied?",
      "Do you have people you can talk to when feeling down?",
      "What's one thing that made you smile recently?",
    ],
    Mild: [
      "You mentioned feeling a bit low. When did this feeling start?",
      "How does this depression affect your daily activities like work or hobbies?",
      "Have you noticed changes in your sleep or appetite?",
      "What usually helps you feel a bit better?",
      "Do you find it hard to concentrate or make decisions?",
      "How's your energy level - do you feel tired a lot?",
      "Have you lost interest in things you usually enjoy?",
    ],
    Moderate: [
      "I can sense you're going through a tough time. How long have you felt this way?",
      "How is this affecting your ability to work or study?",
      "Have your sleep patterns changed significantly?",
      "Do you have support from family or friends right now?",
      "Have you thought about talking to a therapist or counselor?",
      "What was the trigger or when did this start?",
      "How are you coping with these feelings day-to-day?",
      "Have you experienced loss of appetite or significant weight change?",
    ],
    Severe: [
      "I'm concerned about what you're sharing. Do you have thoughts of harming yourself?",
      "Is there someone close to you - family, friend, doctor - you can reach out to?",
      "Have you considered professional help or therapy?",
      "How long have you been experiencing these severe feelings?",
      "Is there anything - even small - that brings you some comfort?",
      "Do you have a crisis hotline number you can call if things get worse?",
      "Have you tried any coping strategies that help, even temporarily?",
    ],
  },
  Anxiety: {
    Normal: [
      "That's wonderful that you're managing well! What's your secret?",
      "How do you typically handle stressful situations?",
      "What activities help you stay calm and grounded?",
      "Tell me about a time you felt completely relaxed recently.",
      "How are your relationships and social life?",
    ],
    Mild: [
      "You mentioned some anxiety. When does it typically show up?",
      "What situations tend to trigger your anxious feelings?",
      "How do you usually cope when anxiety kicks in?",
      "Have you tried any relaxation techniques like breathing exercises?",
      "Does the anxiety affect your sleep or concentration?",
      "How often would you say you feel worried?",
      "What's usually on your mind when you're feeling anxious?",
    ],
    Moderate: [
      "I hear that anxiety is affecting your daily life. What's been the hardest part?",
      "Can you describe a typical anxiety episode for me?",
      "How long does it usually last and how often does it happen?",
      "What physical symptoms do you experience (racing heart, sweating, etc)?",
      "Have you tried any strategies to manage these feelings?",
      "Is there a specific time of day when anxiety is worse?",
      "How's this impacting your work, relationships, or activities?",
      "Have you considered speaking with a mental health professional?",
    ],
    Severe: [
      "I'm hearing that anxiety is really overwhelming you. How are you holding up?",
      "Do you have panic attacks? Can you describe what they're like?",
      "Is the anxiety preventing you from doing everyday activities?",
      "Do you have support - family, friends, or professional help?",
      "Have you been to a doctor or therapist about this?",
      "What helps even slightly - is there anything that provides relief?",
      "Are there days when it feels completely unmanageable?",
    ],
  },
};

const GENERIC_QUESTIONS = [
  "Tell me a bit more about what's been on your mind lately.",
  "How have you been coping with everything?",
  "Is there anything positive happening in your life right now?",
  "Have you talked to anyone about how you're feeling?",
  "What would help you feel better right now?",
  "How's your support system - do you have people you can talk to?",
  "What's one thing you'd like to improve or change?",
  "When was the last time you felt genuinely happy or at peace?",
];

const HIGH_RISK_QUESTIONS = [
  "Have you had thoughts of harming yourself or ending your life?",
  "Do you have someone you can reach out to immediately if things get worse?",
  "Are you currently under the care of a mental health professional?",
];

function pickRandom(pool: string[], count: number): string[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function getFollowUpQuestions(phq9Score: number, gad7Score: number): string[] {
  const phq9Sev = phq9Score <= 4 ? "Normal" : phq9Score <= 9 ? "Mild" : phq9Score <= 14 ? "Moderate" : "Severe";
  const gad7Sev = gad7Score <= 4 ? "Normal" : gad7Score <= 9 ? "Mild" : gad7Score <= 14 ? "Moderate" : "Severe";

  if (phq9Sev === "Severe" || gad7Sev === "Severe") {
    const primaryPool = phq9Score >= gad7Score
      ? CONVERSATION_QUESTIONS.Depression.Severe
      : CONVERSATION_QUESTIONS.Anxiety.Severe;
    return [...pickRandom(primaryPool, 2), ...pickRandom(HIGH_RISK_QUESTIONS, 1)];
  }

  let pool: string[];
  if (phq9Score > gad7Score && phq9Score > 4) {
    pool = CONVERSATION_QUESTIONS.Depression[phq9Sev];
  } else if (gad7Score > phq9Score && gad7Score > 4) {
    pool = CONVERSATION_QUESTIONS.Anxiety[gad7Sev];
  } else if (phq9Score > 4) {
    pool = CONVERSATION_QUESTIONS.Depression[phq9Sev];
  } else if (gad7Score > 4) {
    pool = CONVERSATION_QUESTIONS.Anxiety[gad7Sev];
  } else {
    pool = GENERIC_QUESTIONS;
  }

  return pickRandom(pool, 3);
}

export default function FollowUp() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const setAssessmentResult = useAppStore((s) => s.setAssessmentResult);

  // Get scale answers passed from Screening via location state
  const scaleAnswers: number[] = location.state?.scaleAnswers;

  useEffect(() => {
    if (!scaleAnswers || scaleAnswers.length !== 16) {
      navigate("/screening", { replace: true });
    }
  }, [scaleAnswers, navigate]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [textAnswers, setTextAnswers] = useState<string[]>(["", "", ""]);
  const [submitted, setSubmitted] = useState(false);

  const phq9Score = scaleAnswers ? scaleAnswers.slice(0, 9).reduce((a, b) => a + b, 0) : 0;
  const gad7Score = scaleAnswers ? scaleAnswers.slice(9).reduce((a, b) => a + b, 0) : 0;

  const followUpQuestions = useMemo(() => {
    if (!scaleAnswers) return [];
    return getFollowUpQuestions(phq9Score, gad7Score);
  }, [scaleAnswers, phq9Score, gad7Score]);

  const assessmentResult = useMemo(() => {
    if (!scaleAnswers) return null;
    return calculateBaseline(scaleAnswers.slice(0, 9), scaleAnswers.slice(9));
  }, [scaleAnswers]);

  const submit = async () => {
    if (!assessmentResult) return;
    setSubmitted(true);

    let finalAssessmentResult = { ...assessmentResult };
    
    // Apply BERT sentiment analysis to text responses
    if (textAnswers.some(t => t.trim())) {
      try {
        console.log("📊 Analyzing text responses with BERT...");
        
        const sentimentRes = await fetch("http://localhost:8000/api/sentiment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text_responses: textAnswers,
            user_id: user?.id || "anonymous"
          })
        });
        
        if (sentimentRes.ok) {
          const sentimentData = await sentimentRes.json();
          console.log("🏷️ BERT Classification:", sentimentData);
          
          // Map BERT label to mental status
          const bertToMentalStatus: Record<string, string> = {
            "Anxiety": "Anxiety",
            "Depression": "Depression",
            "Stress": "Anxiety",  // Stress treated as Anxiety for profile
            "Bipolar": "Depression",  // Bipolar treated as Depression for profile
            "Personality Disorder": "Anxiety",  // Personality disorder as Anxiety
            "Suicidal": "Severe",  // Special case
            "Normal": "None"
          };
          
          // Override primaryIssue with BERT result
          const mentalStatus = bertToMentalStatus[sentimentData.label] || sentimentData.label;
          finalAssessmentResult = {
            ...finalAssessmentResult,
            primaryIssue: mentalStatus as any,  // Override with BERT classification
            label: sentimentData.label,  // Store original BERT label
            confidence: sentimentData.confidence
          };
          
          console.log("✅ Updated assessment with BERT:", finalAssessmentResult);
        } else {
          console.warn("⚠️ Sentiment API failed, using baseline classification");
        }
      } catch (error) {
        console.error("❌ Error calling sentiment API:", error);
        // Continue with baseline assessment if BERT fails
      }
    }
    
    setAssessmentResult(finalAssessmentResult);

    if (user) {
      await supabase
        .from("profiles")
        .update({
          baseline_level: finalAssessmentResult.overallBaseline,
          primary_issue: finalAssessmentResult.primaryIssue,
          last_assessment_date: new Date().toISOString(),
        } as any)
        .eq("user_id", user.id);
    }
  };

  const severityColor: Record<string, string> = {
    Normal: "text-primary",
    Mild: "text-accent",
    Moderate: "text-yellow-600",
    Severe: "text-destructive",
  };

  if (!scaleAnswers) return null;

  const progress = ((currentIndex + 1) / 3) * 100;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-2xl">

          {!submitted ? (
            <>
              {/* Header with AI avatar */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 mb-6"
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    <Brain className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-heading text-lg font-semibold text-foreground">Viki wants to know more</p>
                  <p className="text-sm text-muted-foreground">Share your thoughts — your responses help personalize your care.</p>
                </div>
              </motion.div>

              {/* Progress */}
              <div className="mb-6">
                <div className="flex justify-between text-sm text-muted-foreground mb-2">
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Follow-up Conversation
                  </span>
                  <span>{currentIndex + 1} / 3</span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <motion.div
                    className="h-full hero-gradient rounded-full"
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              {/* Chat-style Question */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={`followup-${currentIndex}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  {/* AI Message Bubble */}
                  <div className="flex gap-3">
                    <Avatar className="h-8 w-8 shrink-0 mt-1">
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                        <Brain className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-card border rounded-2xl rounded-bl-md px-5 py-4 card-elevated max-w-[85%]">
                      <p className="text-card-foreground leading-relaxed">
                        {followUpQuestions[currentIndex]}
                      </p>
                    </div>
                  </div>

                  {/* User Input Area */}
                  <div className="ml-11">
                    <textarea
                      value={textAnswers[currentIndex]}
                      onChange={(e) => {
                        const next = [...textAnswers];
                        next[currentIndex] = e.target.value;
                        setTextAnswers(next);
                      }}
                      placeholder="Type your response here..."
                      className="w-full min-h-[140px] p-4 rounded-2xl border-2 border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none transition-colors text-sm leading-relaxed"
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      💡 Your text will be analyzed by our AI to better understand your emotional state. You can skip if you prefer.
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Navigation */}
              <div className="flex justify-between items-center mt-8">
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (currentIndex === 0) {
                      navigate("/screening", { state: { returnAnswers: scaleAnswers } });
                    } else {
                      setCurrentIndex((i) => i - 1);
                    }
                  }}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                </Button>
                {currentIndex === 2 ? (
                  <Button variant="hero" onClick={submit}>
                    Submit Assessment <CheckCircle className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    onClick={() => setCurrentIndex((i) => i + 1)}
                  >
                    {textAnswers[currentIndex].trim() ? "Next" : "Skip"} <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            </>
          ) : (
            /* Results */
            assessmentResult && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-card rounded-2xl p-8 card-elevated text-center"
              >
                <div className="h-16 w-16 rounded-full hero-gradient flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="h-8 w-8 text-primary-foreground" />
                </div>
                <h2 className="font-heading text-2xl font-bold text-card-foreground mb-2">
                  Assessment Complete
                </h2>
                <p className="text-muted-foreground mb-8">Here are your results:</p>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-secondary rounded-xl p-5">
                    <p className="text-sm text-muted-foreground">Depression (PHQ-9)</p>
                    <p className="text-2xl font-bold font-heading text-foreground">{assessmentResult.phq9Score}/27</p>
                    <p className={`text-sm font-medium ${severityColor[assessmentResult.phq9Severity]}`}>
                      {assessmentResult.phq9Severity}
                    </p>
                  </div>
                  <div className="bg-secondary rounded-xl p-5">
                    <p className="text-sm text-muted-foreground">Anxiety (GAD-7)</p>
                    <p className="text-2xl font-bold font-heading text-foreground">{assessmentResult.gad7Score}/21</p>
                    <p className={`text-sm font-medium ${severityColor[assessmentResult.gad7Severity]}`}>
                      {assessmentResult.gad7Severity}
                    </p>
                  </div>
                </div>

                <div className="bg-secondary rounded-xl p-5 mb-8">
                  <p className="text-sm text-muted-foreground">Overall Assessment</p>
                  <p className={`text-xl font-bold font-heading ${severityColor[assessmentResult.overallBaseline]}`}>
                    {assessmentResult.overallBaseline}
                  </p>
                  {assessmentResult.primaryIssue !== "None" && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Primary concern: {assessmentResult.primaryIssue}
                    </p>
                  )}
                </div>

                {/* Sentiment Analysis Results */}
                {assessmentResult.label && (
                  <div className="bg-secondary rounded-xl p-5 mb-8">
                    <p className="text-sm text-muted-foreground mb-2">Sentiment Analysis (AI)</p>
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-lg font-bold">{assessmentResult.label}</span>
                      <span className="text-xs text-muted-foreground">Dominant Emotion</span>
                      {assessmentResult.confidence !== undefined && (
                        <span className="text-xs text-muted-foreground">Confidence: {(assessmentResult.confidence * 100).toFixed(1)}%</span>
                      )}
                    </div>
                    {/* Probabilities if available */}
                    {assessmentResult.probabilities && (
                      <div className="mt-3">
                        <p className="text-xs text-muted-foreground mb-1">All Sentiment Probabilities:</p>
                        <div className="flex flex-wrap gap-2 justify-center">
                          {Object.entries(assessmentResult.probabilities).map(([k, v]) => (
                            <span key={k} className="px-2 py-1 bg-gray-100 rounded text-xs">
                              {k}: {(v * 100).toFixed(1)}%
                            </span>
                          ))}
                        </div>
                        {/* Average Sentiment Score */}
                        <div className="mt-2 text-xs text-muted-foreground">
                          Average Sentiment: {(
                            Object.values(assessmentResult.probabilities).reduce((a, b) => a + b, 0) /
                            Object.values(assessmentResult.probabilities).length
                          ).toFixed(2)}
                        </div>
                      </div>
                    )}
                    {/* Suicidal warning */}
                    {assessmentResult.label === "Suicidal" && (
                      <div className="mt-4 p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded">
                        <strong>🚨 Immediate Help Needed!</strong><br />
                        We detected signs of suicidal thoughts. Please reach out to a crisis hotline:<br />
                        <b>Vietnam: 1925</b> | <b>US: 988</b> | <b>UK: 116 123</b>
                      </div>
                    )}
                  </div>
                )}

                <p className="text-xs text-muted-foreground mb-6">
                  This screening is not a diagnosis. Please consult a mental health professional for clinical evaluation.
                </p>

                {/* Chatbot Conversation Section */}
                {renderChatbotSection()}
              </motion.div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
