import type { SeverityLevel, PrimaryIssue } from "@/store/useAppStore";

// ============================================================
// SCORING & SEVERITY CALCULATION
// ============================================================

export type MentalHealthLabel = "Suicidal" | "Anxiety" | "Depression" | "Stress" | "Bipolar" | "Personality Disorder" | "Normal";

// PHQ-9 Score Thresholds (0-27)
const PHQ9_THRESHOLDS: Record<SeverityLevel, [number, number]> = {
  Normal: [0, 4],
  Mild: [5, 9],
  Moderate: [10, 14],
  Severe: [15, 27]
};

// GAD-7 Score Thresholds (0-21)
const GAD7_THRESHOLDS: Record<SeverityLevel, [number, number]> = {
  Normal: [0, 4],
  Mild: [5, 9],
  Moderate: [10, 14],
  Severe: [15, 21]
};

/**
 * Get severity level from a score
 */
export function getSeverityLevel(score: number, assessmentType: "phq9" | "gad7"): SeverityLevel {
  const thresholds = assessmentType === "phq9" ? PHQ9_THRESHOLDS : GAD7_THRESHOLDS;

  for (const [level, [min, max]] of Object.entries(thresholds)) {
    if (score >= min && score <= max) {
      return level as SeverityLevel;
    }
  }
  return "Severe";
}

/**
 * Calculate baseline assessment profile from raw scores
 */
export function calculateAssessmentProfile(phq9Answers: number[], gad7Answers: number[]) {
  const phq9Score = phq9Answers.reduce((a, b) => a + b, 0);
  const gad7Score = gad7Answers.reduce((a, b) => a + b, 0);

  const phq9Severity = getSeverityLevel(phq9Score, "phq9");
  const gad7Severity = getSeverityLevel(gad7Score, "gad7");

  // Determine overall baseline (highest severity)
  const severityRank: Record<SeverityLevel, number> = {
    Normal: 0,
    Mild: 1,
    Moderate: 2,
    Severe: 3
  };

  const overallSeverity = severityRank[phq9Severity] >= severityRank[gad7Severity]
    ? phq9Severity
    : gad7Severity;

  // Determine primary issue
  let primaryIssue: PrimaryIssue = "None";
  if (severityRank[phq9Severity] > severityRank[gad7Severity]) {
    primaryIssue = "Depression";
  } else if (severityRank[gad7Severity] > severityRank[phq9Severity]) {
    primaryIssue = "Anxiety";
  } else if (phq9Score > 4 || gad7Score > 4) {
    primaryIssue = phq9Score >= gad7Score ? "Depression" : "Anxiety";
  }

  return {
    phq9Score,
    gad7Score,
    phq9Severity,
    gad7Severity,
    overallBaseline: overallSeverity,
    primaryIssue
  };
}

// ============================================================
// NLP CLASSIFICATION
// ============================================================

const keywordMap: Record<string, string[]> = {
  Anxiety: ["anxious", "nervous", "worry", "panic", "fear", "scared", "tense"],
  Depression: ["depressed", "sad", "hopeless", "worthless", "empty", "numb", "miserable"],
  Stress: ["stressed", "overwhelmed", "pressure", "burnout", "exhausted", "overloaded"],
  Suicidal: ["suicide", "kill myself", "end my life", "better off dead", "don't want to live", "self-harm"],
  Bipolar: ["mood swings", "manic", "bipolar", "highs and lows"],
  "Personality disorder": ["identity", "unstable relationships", "abandonment"],
  Normal: [],
};

export function classifyText(text: string): MentalHealthLabel {
  const lower = text.toLowerCase();
  // Safety check first
  if (keywordMap.Suicidal.some((kw) => lower.includes(kw))) return "Suicidal";
  for (const [label, keywords] of Object.entries(keywordMap)) {
    if (label === "Suicidal" || label === "Normal") continue;
    if (keywords.some((kw) => lower.includes(kw))) return label as MentalHealthLabel;
  }
  return "Normal";
}

const CRISIS_RESPONSE = `🚨 **I'm concerned about your safety.**

I want you to know that you're not alone, and help is available right now.

**Please reach out immediately:**
- 🇺🇸 **988 Suicide & Crisis Lifeline:** Call or text **988**
- 🌍 **Crisis Text Line:** Text **HOME** to **741741**
- 🇬🇧 **Samaritans:** Call **116 123**
- 🇻🇳 **Đường dây nóng tâm lý:** Gọi **1925**

You matter. Your feelings are valid. A trained counselor can help you through this moment.

*I'm an AI assistant and not equipped to provide crisis support. Please contact the resources above — they are available 24/7.*`;



