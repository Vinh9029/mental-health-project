import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { User, Shield, Heart, Sparkles, Save, Sun, Moon, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useTheme } from "@/components/ThemeProvider";
import Navbar from "@/components/Navbar";

import { AVATARS } from "@/lib/avatars";

const severityColor: Record<string, string> = {
  Normal: "text-primary",
  Mild: "text-accent",
  Moderate: "text-yellow-600",
  Severe: "text-destructive",
};

export default function Profile() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [nickname, setNickname] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("avatar-calm");
  const [baselineLevel, setBaselineLevel] = useState("Normal");
  const [primaryIssue, setPrimaryIssue] = useState("None");
  const [realtimeStatus, setRealtimeStatus] = useState<string | null>(null);
  const [realtimeConfidence, setRealtimeConfidence] = useState<number | null>(null);
  const [lastAssessmentDate, setLastAssessmentDate] = useState<string | null>(null);
  const [phq9Score, setPhq9Score] = useState<number | null>(null);
  const [gad7Score, setGad7Score] = useState<number | null>(null);
  const [phq9Severity, setPhq9Severity] = useState<string | null>(null);
  const [gad7Severity, setGad7Severity] = useState<string | null>(null);
  const [copingMethods, setCopingMethods] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // ── Instant sync from FollowUp navigation state ──────────────────────────
  // When the user clicks "View My Profile" right after finishing the assessment,
  // FollowUp passes the fresh result via router state so Profile renders it
  // immediately — no DB round-trip needed and no race-condition.
  const location = useLocation();
  useEffect(() => {
    const fa = (location.state as any)?.freshAssessment;
    if (!fa) return;
    if (fa.phq9Score    != null) setPhq9Score(fa.phq9Score);
    if (fa.gad7Score    != null) setGad7Score(fa.gad7Score);
    if (fa.phq9Severity)         setPhq9Severity(fa.phq9Severity);
    if (fa.gad7Severity)         setGad7Severity(fa.gad7Severity);
    if (fa.overallBaseline)      setBaselineLevel(fa.overallBaseline);
    if (fa.primaryIssue)         setPrimaryIssue(fa.primaryIssue);
    // realtimeStatus may be undefined if user skipped all text answers
    setRealtimeStatus(fa.realtimeStatus ?? null);
    setRealtimeConfidence(fa.realtimeConfidence ?? null);
    setLastAssessmentDate(new Date().toISOString());
  }, [location.state]);

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setNickname(data.nickname || data.display_name || "");
        setSelectedAvatar(data.avatar_url || "avatar-calm");
        setBaselineLevel(data.baseline_level || "Normal");
        setPrimaryIssue(data.primary_issue || "None");
        setRealtimeStatus(data.realtime_status ?? null);
        setRealtimeConfidence(data.realtime_confidence ?? null);
        setLastAssessmentDate(data.last_assessment_date ?? null);
        setPhq9Severity(data.phq9_severity ?? null);
        setGad7Severity(data.gad7_severity ?? null);
        setPhq9Score(data.phq9_score ?? null);
        setGad7Score(data.gad7_score ?? null);
      }

      // Fetch user state (coping methods)
      const { data: stateData } = await supabase
        .from("user_states")
        .select("preferred_coping_methods")
        .eq("user_id", user.id)
        .single();

      if (stateData) {
        setCopingMethods(stateData.preferred_coping_methods || []);
      }
      setLoading(false);
    };

    // Initial fetch
    fetchProfile();

    // Re-fetch when the page becomes visible again (e.g. user returns from
    // Screening / FollowUp flow and navigates back to Profile)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchProfile();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
      display_name: nickname,
      nickname: nickname,
      avatar_url: selectedAvatar,
      } as any)
      .eq("user_id", user.id);

    setSaving(false);
    if (error) {
      toast({ title: "Error", description: "Failed to save profile.", variant: "destructive" });
    } else {
      toast({ title: "Saved!", description: "Your profile has been updated." });
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Please sign in to view your profile.</p>
          <Button variant="hero" asChild><Link to="/auth">Sign In</Link></Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <Navbar />

      <div className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-2xl space-y-8">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="font-heading text-3xl font-bold text-foreground mb-1">Your Profile</h1>
            <p className="text-muted-foreground">Manage your wellness identity and preferences.</p>
          </motion.div>

          {/* Avatar Selection */}
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-card rounded-2xl p-6 card-elevated"
          >
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5 text-primary" />
              <h2 className="font-heading text-lg font-semibold text-card-foreground">Virtual Avatar</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Choose an avatar that represents you. No photos — your privacy matters.</p>
            <div className="grid grid-cols-4 gap-3 mb-6">
              {AVATARS.map((av) => (
                <button
                  key={av.id}
                  onClick={() => setSelectedAvatar(av.id)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                    selectedAvatar === av.id
                      ? "border-primary bg-primary/5 scale-105"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <span className="text-3xl">{av.emoji}</span>
                  <span className="text-xs text-muted-foreground">{av.label}</span>
                </button>
              ))}
            </div>

            {/* Nickname */}
            <label className="block text-sm font-medium text-card-foreground mb-2">Nickname</label>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Choose a nickname (no real names)"
              className="w-full h-11 px-4 rounded-xl border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            />

            <Button variant="hero" className="mt-4" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? "Saving..." : "Save Profile"}
            </Button>
          </motion.div>

          {/* Baseline & Assessment */}
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-card rounded-2xl p-6 card-elevated"
          >
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-primary" />
              <h2 className="font-heading text-lg font-semibold text-card-foreground">Assessment Overview</h2>
            </div>
            <div className="space-y-4">
              {/* Active Baseline */}
              <div className="border border-border rounded-xl p-4 bg-background">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center justify-between">
                  <span>Clinical Baseline</span>
                  <span className="bg-secondary px-2 py-0.5 rounded-full text-[10px]">PHQ-9 + GAD-7 · Past 2 Weeks</span>
                </p>

                {/* PHQ-9 and GAD-7 rows */}
                {(phq9Score !== null || phq9Severity) ? (
                  <div className="space-y-3 mb-3">
                    {/* PHQ-9 */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">Depression (PHQ-9)</span>
                        <div className="flex items-center gap-2">
                          {phq9Score !== null && (
                            <span className="text-xs font-bold text-foreground">{phq9Score}/27</span>
                          )}
                          {phq9Severity && (
                            <span className={`text-xs font-bold ${severityColor[phq9Severity] || "text-foreground"}`}>{phq9Severity}</span>
                          )}
                        </div>
                      </div>
                      {phq9Score !== null && (
                        <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${(phq9Score / 27) * 100}%`,
                              background: phq9Score <= 4 ? "var(--primary)" : phq9Score <= 9 ? "#f59e0b" : phq9Score <= 14 ? "#f97316" : "#ef4444"
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* GAD-7 */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">Anxiety (GAD-7)</span>
                        <div className="flex items-center gap-2">
                          {gad7Score !== null && (
                            <span className="text-xs font-bold text-foreground">{gad7Score}/21</span>
                          )}
                          {gad7Severity && (
                            <span className={`text-xs font-bold ${severityColor[gad7Severity] || "text-foreground"}`}>{gad7Severity}</span>
                          )}
                        </div>
                      </div>
                      {gad7Score !== null && (
                        <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${(gad7Score / 21) * 100}%`,
                              background: gad7Score <= 4 ? "var(--primary)" : gad7Score <= 9 ? "#f59e0b" : gad7Score <= 14 ? "#f97316" : "#ef4444"
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  // Fallback: only stored baseline_level / primary_issue available
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-secondary/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Baseline Level</p>
                      <p className={`text-lg font-bold font-heading ${severityColor[baselineLevel] || "text-foreground"}`}>
                        {baselineLevel}
                      </p>
                    </div>
                    <div className="bg-secondary/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Primary Issue</p>
                      <p className="text-lg font-bold font-heading text-foreground">
                        {primaryIssue === "None" ? "\u2014" : primaryIssue}
                      </p>
                    </div>
                  </div>
                )}

                {/* Summary row */}
                <div className="flex items-center justify-between bg-primary/5 rounded-lg px-3 py-2 border border-primary/20">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Overall Severity</p>
                    <p className={`text-sm font-bold ${severityColor[baselineLevel] || "text-foreground"}`}>{baselineLevel}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Dominant Concern</p>
                    <p className="text-sm font-bold">{primaryIssue === "None" ? "\u2014" : primaryIssue}</p>
                  </div>
                </div>
              </div>

              {/* Passive Real-time */}
              <div className="border border-border rounded-xl p-4 bg-background">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center justify-between">
                  <span>AI Sentiment Analysis</span>
                  <span className="bg-secondary px-2 py-0.5 rounded-full text-[10px]">BERT NLP</span>
                </p>
                {realtimeStatus ? (
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                      <Brain className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold font-heading text-foreground flex items-center gap-2">
                        {realtimeStatus}
                        {realtimeStatus === "Suicidal" && <span className="text-destructive text-sm">🚨 Red Flag</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">Detected emotional pattern</p>
                      {realtimeConfidence !== null && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="h-1.5 flex-1 bg-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${realtimeConfidence * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold whitespace-nowrap">{(realtimeConfidence * 100).toFixed(0)}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Brain className="h-4 w-4 shrink-0" />
                    <p className="text-xs">Complete the assessment with text responses to enable AI sentiment analysis.</p>
                  </div>
                )}
              </div>
            </div>
            {lastAssessmentDate && (
              <p className="text-xs text-muted-foreground mt-3">
                Last assessment: {new Date(lastAssessmentDate).toLocaleDateString()}
              </p>
            )}
            <Button variant="hero-outline" size="sm" className="mt-4" asChild>
              <Link to="/screening">
                <Sparkles className="h-4 w-4 mr-1" /> Take / Retake Assessment
              </Link>
            </Button>
          </motion.div>

          {/* Coping Methods */}
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="bg-card rounded-2xl p-6 card-elevated"
          >
            <div className="flex items-center gap-2 mb-4">
              <Heart className="h-5 w-5 text-primary" />
              <h2 className="font-heading text-lg font-semibold text-card-foreground">Preferred Coping Methods</h2>
            </div>
            {copingMethods.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {copingMethods.map((method) => (
                  <span key={method} className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
                    {method}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No coping methods recorded yet. Keep chatting with MindCare AI and your preferences will be tracked over time.
              </p>
            )}
          </motion.div>

          {/* Theme Toggle */}
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="bg-card rounded-2xl p-6 card-elevated"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {theme === "dark" ? (
                  <Moon className="h-5 w-5 text-primary" />
                ) : (
                  <Sun className="h-5 w-5 text-primary" />
                )}
                <div>
                  <h2 className="font-heading text-lg font-semibold text-card-foreground">Appearance</h2>
                  <p className="text-sm text-muted-foreground">
                    {theme === "dark" ? "Dark mode is on" : "Light mode is on"}
                  </p>
                </div>
              </div>
              <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
