import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { calculateBaseline, useAppStore } from "@/store/useAppStore";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";

// ── Standard PHQ-9 & GAD-7 Questions ──
const phq9Questions = [
  "Little interest or pleasure in doing things",
  "Feeling down, depressed, or hopeless",
  "Trouble falling or staying asleep, or sleeping too much",
  "Feeling tired or having little energy",
  "Poor appetite or overeating",
  "Feeling bad about yourself — or that you are a failure",
  "Trouble concentrating on things",
  "Moving or speaking so slowly that other people could have noticed",
  "Thoughts that you would be better off dead, or of hurting yourself",
];

const gad7Questions = [
  "Feeling nervous, anxious, or on edge",
  "Not being able to stop or control worrying",
  "Worrying too much about different things",
  "Trouble relaxing",
  "Being so restless that it is hard to sit still",
  "Becoming easily annoyed or irritable",
  "Feeling afraid, as if something awful might happen",
];

// ── Follow-up Questions Pool (Conversation Questions) ──
// Selected based on baseline severity from PHQ-9/GAD-7 scores.
// Text responses will be passed to a sentiment/NLP model for label assignment.
// Labels: Anxiety(0), Bipolar(1), Depression(2), Normal(3), Personality Disorder(4), Stress(5), Suicidal(6)

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

function pickRandomQuestions(pool: string[], count: number): string[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function getFollowUpQuestions(phq9Score: number, gad7Score: number): string[] {
  const phq9Sev = phq9Score <= 4 ? "Normal" : phq9Score <= 9 ? "Mild" : phq9Score <= 14 ? "Moderate" : "Severe";
  const gad7Sev = gad7Score <= 4 ? "Normal" : gad7Score <= 9 ? "Mild" : gad7Score <= 14 ? "Moderate" : "Severe";

  // For severe cases, include a high-risk question
  if (phq9Sev === "Severe" || gad7Sev === "Severe") {
    const primaryPool = phq9Score >= gad7Score
      ? CONVERSATION_QUESTIONS.Depression.Severe
      : CONVERSATION_QUESTIONS.Anxiety.Severe;
    return [...pickRandomQuestions(primaryPool, 2), ...pickRandomQuestions(HIGH_RISK_QUESTIONS, 1)];
  }

  // Determine primary issue and severity
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

  return pickRandomQuestions(pool, 3);
}

const standardQuestions = [
  ...phq9Questions.map((q) => ({ text: q, group: "PHQ-9" as const, type: "scale" as const })),
  ...gad7Questions.map((q) => ({ text: q, group: "GAD-7" as const, type: "scale" as const })),
];

const scaleOptions = [
  { label: "Not at all", value: 0 },
  { label: "Several days", value: 1 },
  { label: "More than half the days", value: 2 },
  { label: "Nearly every day", value: 3 },
];

export default function Screening() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scaleAnswers, setScaleAnswers] = useState<(number | null)[]>(Array(16).fill(null));
  const [textAnswers, setTextAnswers] = useState<string[]>(["", "", ""]);
  const [phase, setPhase] = useState<"scales" | "followup" | "results">("scales");
  const navigate = useNavigate();
  const { user } = useAuth();
  const setAssessmentResult = useAppStore((s) => s.setAssessmentResult);
  const assessmentResult = useAppStore((s) => s.assessmentResult);

  // Generate follow-up questions based on severity after scale phase
  const followUpQuestions = useMemo(() => {
    if (phase !== "followup" && phase !== "results") return [];
    const phq9 = scaleAnswers.slice(0, 9) as number[];
    const gad7 = scaleAnswers.slice(9) as number[];
    const phq9Score = phq9.reduce((a, b) => a + b, 0);
    const gad7Score = gad7.reduce((a, b) => a + b, 0);
    return getFollowUpQuestions(phq9Score, gad7Score);
  }, [phase, scaleAnswers]);

  const current = phase === "scales" ? standardQuestions[currentIndex] : null;
  const totalScaleQuestions = standardQuestions.length;
  const allScaleAnswered = scaleAnswers.every((a) => a !== null);

  const selectScale = (value: number) => {
    const next = [...scaleAnswers];
    next[currentIndex] = value;
    setScaleAnswers(next);
    if (currentIndex < totalScaleQuestions - 1) {
      setTimeout(() => setCurrentIndex((i) => i + 1), 250);
    }
  };

  const goToFollowUp = () => {
    setPhase("followup");
    setCurrentIndex(0);
  };

  const submit = async () => {
    const phq9 = scaleAnswers.slice(0, 9) as number[];
    const gad7 = scaleAnswers.slice(9) as number[];
    const result = calculateBaseline(phq9, gad7);
    setAssessmentResult(result);
    setPhase("results");

    // TODO: Send textAnswers to sentiment analysis model
    // The follow-up text responses should be classified using an NLP model
    // to assign a label (e.g., "Depressive", "Anxious", "Stressed", "Normal")
    // which updates the user's profile.
    // Example:
    // const sentimentLabels = await classifySentiment(textAnswers);
    // await updateUserProfile(user.id, sentimentLabels);

    if (user) {
      await supabase
        .from("profiles")
        .update({
          baseline_level: result.overallBaseline,
          primary_issue: result.primaryIssue,
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

  // Progress calculation
  const totalSteps = totalScaleQuestions + 3;
  const currentStep = phase === "scales" ? currentIndex + 1 : totalScaleQuestions + currentIndex + 1;
  const progress = (currentStep / totalSteps) * 100;
  const groupLabel = phase === "scales" ? current?.group + " Assessment" : "Follow-up Questions";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-2xl">
          {phase === "scales" && (
            <>
              {/* Progress */}
              <div className="mb-8">
                <div className="flex justify-between text-sm text-muted-foreground mb-2">
                  <span>{groupLabel}</span>
                  <span>{currentStep} / {totalSteps}</span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <motion.div
                    className="h-full hero-gradient rounded-full"
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              {/* Scale Question */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentIndex}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.25 }}
                  className="bg-card rounded-2xl p-8 card-elevated"
                >
                  <p className="text-xs font-medium text-primary mb-3 uppercase tracking-wider">
                    Over the last 2 weeks, how often have you been bothered by:
                  </p>
                  <h2 className="font-heading text-xl font-semibold text-card-foreground mb-8">
                    {current?.text}
                  </h2>
                  <div className="grid gap-3">
                    {scaleOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => selectScale(opt.value)}
                        className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all duration-200 ${
                          scaleAnswers[currentIndex] === opt.value
                            ? "border-primary bg-primary/5 text-foreground"
                            : "border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <span className="font-medium">{opt.label}</span>
                        <span className="ml-2 text-xs opacity-60">({opt.value})</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Navigation */}
              <div className="flex justify-between items-center mt-6">
                <Button
                  variant="ghost"
                  onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                  disabled={currentIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                </Button>
                {currentIndex === totalScaleQuestions - 1 && allScaleAnswered ? (
                  <Button variant="hero" onClick={goToFollowUp}>
                    Continue <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    onClick={() => setCurrentIndex((i) => Math.min(totalScaleQuestions - 1, i + 1))}
                    disabled={scaleAnswers[currentIndex] === null}
                  >
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            </>
          )}

          {phase === "followup" && (
            <>
              {/* Progress */}
              <div className="mb-8">
                <div className="flex justify-between text-sm text-muted-foreground mb-2">
                  <span>{groupLabel}</span>
                  <span>{currentStep} / {totalSteps}</span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <motion.div
                    className="h-full hero-gradient rounded-full"
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              {/* Follow-up Text Question */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={`followup-${currentIndex}`}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.25 }}
                  className="bg-card rounded-2xl p-8 card-elevated"
                >
                  <p className="text-xs font-medium text-primary mb-3 uppercase tracking-wider">
                    Tell us more about how you feel
                  </p>
                  <h2 className="font-heading text-xl font-semibold text-card-foreground mb-6">
                    {followUpQuestions[currentIndex]}
                  </h2>
                  <textarea
                    value={textAnswers[currentIndex]}
                    onChange={(e) => {
                      const next = [...textAnswers];
                      next[currentIndex] = e.target.value;
                      setTextAnswers(next);
                    }}
                    placeholder="Share your thoughts here... (your response will be analyzed to personalize your experience)"
                    className="w-full min-h-[120px] p-4 rounded-xl border-2 border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none transition-colors"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Your response helps our AI understand you better. You can skip if you prefer.
                  </p>
                </motion.div>
              </AnimatePresence>

              {/* Navigation */}
              <div className="flex justify-between items-center mt-6">
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (currentIndex === 0) {
                      setPhase("scales");
                      setCurrentIndex(totalScaleQuestions - 1);
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
          )}

          {phase === "results" && assessmentResult && (
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

              <p className="text-xs text-muted-foreground mb-6">
                This screening is not a diagnosis. Please consult a mental health professional for clinical evaluation.
              </p>

              <Button variant="hero" size="lg" onClick={() => navigate("/chat")}>
                Continue to AI Chat <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
