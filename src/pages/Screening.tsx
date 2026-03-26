import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, ChevronLeft, ChevronRight, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { calculateBaseline, useAppStore } from "@/store/useAppStore";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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

const allQuestions = [
  ...phq9Questions.map((q) => ({ text: q, group: "PHQ-9" as const })),
  ...gad7Questions.map((q) => ({ text: q, group: "GAD-7" as const })),
];

const options = [
  { label: "Not at all", value: 0 },
  { label: "Several days", value: 1 },
  { label: "More than half the days", value: 2 },
  { label: "Nearly every day", value: 3 },
];

export default function Screening() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(Array(16).fill(null));
  const [showResults, setShowResults] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const setAssessmentResult = useAppStore((s) => s.setAssessmentResult);
  const assessmentResult = useAppStore((s) => s.assessmentResult);

  const current = allQuestions[currentIndex];
  const progress = ((currentIndex + 1) / allQuestions.length) * 100;
  const allAnswered = answers.every((a) => a !== null);

  const select = (value: number) => {
    const next = [...answers];
    next[currentIndex] = value;
    setAnswers(next);
    if (currentIndex < allQuestions.length - 1) {
      setTimeout(() => setCurrentIndex((i) => i + 1), 250);
    }
  };

  const submit = async () => {
    const phq9 = answers.slice(0, 9) as number[];
    const gad7 = answers.slice(9) as number[];
    const result = calculateBaseline(phq9, gad7);
    setAssessmentResult(result);
    setShowResults(true);

    // Save baseline to DB if logged in
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

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg hero-gradient flex items-center justify-center">
              <Brain className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-heading text-xl font-semibold text-foreground">MindCare AI</span>
          </Link>
        </div>
      </nav>

      <div className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-2xl">
          {!showResults ? (
            <>
              {/* Progress */}
              <div className="mb-8">
                <div className="flex justify-between text-sm text-muted-foreground mb-2">
                  <span>{current.group} Assessment</span>
                  <span>{currentIndex + 1} / {allQuestions.length}</span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <motion.div
                    className="h-full hero-gradient rounded-full"
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              {/* Question */}
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
                    {current.text}
                  </h2>
                  <div className="grid gap-3">
                    {options.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => select(opt.value)}
                        className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all duration-200 ${
                          answers[currentIndex] === opt.value
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
                {currentIndex === allQuestions.length - 1 && allAnswered ? (
                  <Button variant="hero" onClick={submit}>
                    Submit Assessment <CheckCircle className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    onClick={() => setCurrentIndex((i) => Math.min(allQuestions.length - 1, i + 1))}
                    disabled={answers[currentIndex] === null}
                  >
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            </>
          ) : assessmentResult ? (
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
                {assessmentResult.primaryIssue !== 'None' && (
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
          ) : null}
        </div>
      </div>
    </div>
  );
}
