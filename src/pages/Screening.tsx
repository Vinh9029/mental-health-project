import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";

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

const standardQuestions = [
  ...phq9Questions.map((q) => ({ text: q, group: "PHQ-9" as const })),
  ...gad7Questions.map((q) => ({ text: q, group: "GAD-7" as const })),
];

const scaleOptions = [
  { label: "Not at all", value: 0 },
  { label: "Several days", value: 1 },
  { label: "More than half the days", value: 2 },
  { label: "Nearly every day", value: 3 },
];

export default function Screening() {
  const location = useLocation();
  const returnAnswers = location.state?.returnAnswers;
  const [currentIndex, setCurrentIndex] = useState(returnAnswers ? 15 : 0);
  const [scaleAnswers, setScaleAnswers] = useState<(number | null)[]>(
    returnAnswers || Array(16).fill(null)
  );
  const navigate = useNavigate();

  const current = standardQuestions[currentIndex];
  const totalQuestions = standardQuestions.length;
  const allAnswered = scaleAnswers.every((a) => a !== null);
  const progress = ((currentIndex + 1) / totalQuestions) * 100;

  const selectScale = (value: number) => {
    const next = [...scaleAnswers];
    next[currentIndex] = value;
    setScaleAnswers(next);
    if (currentIndex < totalQuestions - 1) {
      setTimeout(() => setCurrentIndex((i) => Math.min(i + 1, totalQuestions - 1)), 250);
    }
  };


  const [showComplete, setShowComplete] = useState(false);
  const goToFollowUp = () => {
    setShowComplete(true);
    setTimeout(() => {
      navigate("/followup", { state: { scaleAnswers: scaleAnswers as number[] } });
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-2xl">
          {showComplete ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card rounded-2xl p-8 card-elevated text-center"
            >
              <div className="h-16 w-16 rounded-full hero-gradient flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="h-8 w-8 text-primary-foreground" />
              </div>
              <h2 className="font-heading text-2xl font-bold text-card-foreground mb-2">
                Screening Complete
              </h2>
              <p className="text-muted-foreground mb-8">Thank you for completing the assessment. Preparing your personalized follow-up questions...</p>
            </motion.div>
          ) : (
            <>
              {/* Progress */}
              <div className="mb-8">
                <div className="flex justify-between text-sm text-muted-foreground mb-2">
                  <span>{current.group} Assessment</span>
                  <span>{currentIndex + 1} / {totalQuestions}</span>
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
                {currentIndex === totalQuestions - 1 && allAnswered ? (
                  <Button variant="hero" onClick={goToFollowUp}>
                    Continue <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    onClick={() => setCurrentIndex((i) => Math.min(totalQuestions - 1, i + 1))}
                    disabled={scaleAnswers[currentIndex] === null}
                  >
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
