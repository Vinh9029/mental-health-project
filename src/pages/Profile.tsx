import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Brain, User, Shield, Heart, Sparkles, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const AVATARS = [
  { id: "avatar-calm", label: "Calm Cloud", emoji: "☁️" },
  { id: "avatar-sun", label: "Sunshine", emoji: "🌤️" },
  { id: "avatar-leaf", label: "Peaceful Leaf", emoji: "🍃" },
  { id: "avatar-star", label: "Bright Star", emoji: "⭐" },
  { id: "avatar-wave", label: "Ocean Wave", emoji: "🌊" },
  { id: "avatar-moon", label: "Night Moon", emoji: "🌙" },
  { id: "avatar-flower", label: "Bloom", emoji: "🌸" },
  { id: "avatar-mountain", label: "Mountain", emoji: "⛰️" },
];

const severityColor: Record<string, string> = {
  Normal: "text-primary",
  Mild: "text-accent",
  Moderate: "text-yellow-600",
  Severe: "text-destructive",
};

export default function Profile() {
  const { user } = useAuth();
  const [nickname, setNickname] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("avatar-calm");
  const [baselineLevel, setBaselineLevel] = useState("Normal");
  const [primaryIssue, setPrimaryIssue] = useState("None");
  const [lastAssessmentDate, setLastAssessmentDate] = useState<string | null>(null);
  const [copingMethods, setCopingMethods] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setNickname((data as any).nickname || data.display_name || "");
        setSelectedAvatar(data.avatar_url || "avatar-calm");
        setBaselineLevel((data as any).baseline_level || "Normal");
        setPrimaryIssue((data as any).primary_issue || "None");
        setLastAssessmentDate((data as any).last_assessment_date || null);
      }

      // Fetch user state (coping methods)
      const { data: stateData } = await supabase
        .from("user_states" as any)
        .select("preferred_coping_methods")
        .eq("user_id", user.id)
        .single();

      if (stateData) {
        setCopingMethods((stateData as any).preferred_coping_methods || []);
      }
      setLoading(false);
    };
    fetchProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: nickname,
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
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg hero-gradient flex items-center justify-center">
              <Brain className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-heading text-xl font-semibold text-foreground">MindCare AI</span>
          </Link>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" asChild><Link to="/chat">Chat</Link></Button>
            <Button variant="ghost" size="sm" asChild><Link to="/screening">Screening</Link></Button>
          </div>
        </div>
      </nav>

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
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-secondary rounded-xl p-4">
                <p className="text-xs text-muted-foreground">Baseline Level</p>
                <p className={`text-lg font-bold font-heading ${severityColor[baselineLevel] || "text-foreground"}`}>
                  {baselineLevel}
                </p>
              </div>
              <div className="bg-secondary rounded-xl p-4">
                <p className="text-xs text-muted-foreground">Primary Issue</p>
                <p className="text-lg font-bold font-heading text-foreground">
                  {primaryIssue === "None" ? "—" : primaryIssue}
                </p>
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
        </div>
      </div>
    </div>
  );
}
