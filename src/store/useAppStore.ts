import { create } from 'zustand';

export type SeverityLevel = 'Normal' | 'Mild' | 'Moderate' | 'Severe';
export type PrimaryIssue = 'Depression' | 'Anxiety' | 'None';

interface AssessmentResult {
  phq9Score: number;
  gad7Score: number;
  phq9Severity: SeverityLevel;
  gad7Severity: SeverityLevel;
  overallBaseline: SeverityLevel;
  primaryIssue: PrimaryIssue;
  phq9Q9Score?: number;
  realtimeStatus?: string;
  realtimeConfidence?: number;
  probabilities?: Record<string, number>;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: Array<{
    content: string;
    source: string;
    page: number | string;
    ref: string;
  }>;
}

interface AppState {
  assessmentResult: AssessmentResult | null;
  chatMessages: ChatMessage[];
  setAssessmentResult: (result: AssessmentResult) => void;
  addChatMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearChat: () => void;
}

function getSeverity(score: number): SeverityLevel {
  if (score <= 4) return 'Normal';
  if (score <= 9) return 'Mild';
  if (score <= 14) return 'Moderate';
  return 'Severe';
}

const severityRank: Record<SeverityLevel, number> = {
  Normal: 0, Mild: 1, Moderate: 2, Severe: 3,
};

export function calculateBaseline(phq9Scores: number[], gad7Scores: number[]): AssessmentResult {
  const phq9Score = phq9Scores.reduce((a, b) => a + b, 0);
  const gad7Score = gad7Scores.reduce((a, b) => a + b, 0);
  const phq9Severity = getSeverity(phq9Score);
  const gad7Severity = getSeverity(gad7Score);
  const phq9Q9Score = phq9Scores.length === 9 ? phq9Scores[8] : 0;

  const overallBaseline = severityRank[phq9Severity] >= severityRank[gad7Severity]
    ? phq9Severity : gad7Severity;

  let primaryIssue: PrimaryIssue = 'None';
  if (severityRank[phq9Severity] > severityRank[gad7Severity]) primaryIssue = 'Depression';
  else if (severityRank[gad7Severity] > severityRank[phq9Severity]) primaryIssue = 'Anxiety';
  else if (phq9Score > 4 || gad7Score > 4) primaryIssue = phq9Score >= gad7Score ? 'Depression' : 'Anxiety';

  return { phq9Score, gad7Score, phq9Severity, gad7Severity, overallBaseline, primaryIssue, phq9Q9Score };
}

export const useAppStore = create<AppState>((set) => ({
  assessmentResult: null,
  chatMessages: [],
  setAssessmentResult: (result) => set({ assessmentResult: result }),
  addChatMessage: (msg) =>
    set((state) => ({
      chatMessages: [
        ...state.chatMessages,
        { ...msg, id: crypto.randomUUID(), timestamp: new Date() },
      ],
    })),
  clearChat: () => set({ chatMessages: [] }),
}));
