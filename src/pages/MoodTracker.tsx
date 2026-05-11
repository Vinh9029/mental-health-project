import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Smile, Calendar, Flame, ArrowLeft, TrendingUp,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { format, parseISO, startOfWeek, isToday, isYesterday } from "date-fns";

interface CheckIn {
  id: string;
  emoji: string;
  label: string;
  stress_score: number | null;
  note: string | null;
  created_at: string;
}

const STRESS_COLOR = (s: number) => {
  if (s <= 3) return "text-green-500";
  if (s <= 6) return "text-yellow-500";
  return "text-destructive";
};

function relativeDate(dateStr: string) {
  const d = parseISO(dateStr);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEE, MMM d");
}

export default function MoodTracker() {
  const { user } = useAuth();
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("mood_checkins")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setCheckins(data as CheckIn[]);
        setLoading(false);
      });
  }, [user]);

  // Streak calculation
  const streak = (() => {
    if (checkins.length === 0) return 0;
    let count = 0;
    let current = new Date();
    current.setHours(0, 0, 0, 0);
    const sorted = [...checkins].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    for (const c of sorted) {
      const d = new Date(c.created_at);
      d.setHours(0, 0, 0, 0);
      if (d.getTime() === current.getTime()) {
        count++;
        current.setDate(current.getDate() - 1);
      } else {
        break;
      }
    }
    return count;
  })();

  // Average stress
  const avgStress = (() => {
    const withStress = checkins.filter((c) => c.stress_score != null);
    if (withStress.length === 0) return null;
    return (
      withStress.reduce((acc, c) => acc + (c.stress_score ?? 0), 0) / withStress.length
    ).toFixed(1);
  })();

  // Most frequent mood
  const topMood = (() => {
    if (checkins.length === 0) return null;
    const freq: Record<string, { emoji: string; count: number }> = {};
    checkins.forEach((c) => {
      if (!freq[c.label]) freq[c.label] = { emoji: c.emoji, count: 0 };
      freq[c.label].count++;
    });
    return Object.entries(freq).sort((a, b) => b[1].count - a[1].count)[0];
  })();

  const displayed = showAll ? checkins : checkins.slice(0, 10);

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Please sign in to view your mood history.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-2xl space-y-6">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 mb-1">
              <Button variant="ghost" size="icon" asChild className="-ml-2">
                <Link to="/chat"><ArrowLeft className="h-4 w-4" /></Link>
              </Button>
              <div>
                <h1 className="font-heading text-3xl font-bold text-foreground">Mood History</h1>
                <p className="text-muted-foreground text-sm">Track your emotional patterns over time.</p>
              </div>
            </div>
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
            className="grid grid-cols-3 gap-3"
          >
            <div className="bg-card rounded-2xl p-4 card-elevated text-center">
              <Flame className="h-5 w-5 text-orange-400 mx-auto mb-1" />
              <p className="text-2xl font-bold font-heading text-foreground">{streak}</p>
              <p className="text-xs text-muted-foreground">Day streak</p>
            </div>
            <div className="bg-card rounded-2xl p-4 card-elevated text-center">
              <Calendar className="h-5 w-5 text-primary mx-auto mb-1" />
              <p className="text-2xl font-bold font-heading text-foreground">{checkins.length}</p>
              <p className="text-xs text-muted-foreground">Total entries</p>
            </div>
            <div className="bg-card rounded-2xl p-4 card-elevated text-center">
              {topMood ? (
                <>
                  <span className="text-2xl">{topMood[1].emoji}</span>
                  <p className="text-xs text-muted-foreground mt-1">{topMood[0]} (×{topMood[1].count})</p>
                </>
              ) : (
                <>
                  <Smile className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">No data yet</p>
                </>
              )}
            </div>
          </motion.div>

          {/* Avg stress */}
          {avgStress && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
              className="bg-card rounded-2xl p-4 card-elevated flex items-center gap-4"
            >
              <div className="h-10 w-10 rounded-xl hero-gradient flex items-center justify-center shrink-0">
                <TrendingUp className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Average stress</p>
                <p className="text-xl font-bold font-heading text-foreground">{avgStress} <span className="text-sm font-normal text-muted-foreground">/ 10</span></p>
              </div>
              <div className="flex-1 ml-2">
                <div className="h-2 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-orange-400 transition-all"
                    style={{ width: `${(parseFloat(avgStress) / 10) * 100}%` }}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* Check-in list */}
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="bg-card rounded-2xl p-6 card-elevated"
          >
            <h2 className="font-heading text-lg font-semibold text-card-foreground mb-4">Recent Check-ins</h2>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="h-7 w-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            ) : checkins.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <span className="text-4xl mb-3 block">🌱</span>
                <p className="text-sm">No check-ins yet. Start from the Chat page.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {displayed.map((c, i) => (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-start gap-3 p-3 rounded-xl border border-border bg-background"
                    >
                      <span className="text-3xl mt-0.5">{c.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-foreground">{c.label}</p>
                          <p className="text-xs text-muted-foreground">{relativeDate(c.created_at)}</p>
                        </div>
                        {c.stress_score !== null && (
                          <p className={`text-xs font-medium mt-0.5 ${STRESS_COLOR(c.stress_score)}`}>
                            Stress: {c.stress_score}/10
                          </p>
                        )}
                        {c.note && (
                          <p className="text-xs text-muted-foreground mt-1 italic truncate">"{c.note}"</p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {checkins.length > 10 && (
                  <button
                    onClick={() => setShowAll(!showAll)}
                    className="w-full text-xs text-primary hover:underline flex items-center justify-center gap-1 pt-1"
                  >
                    {showAll ? <><ChevronUp className="h-3 w-3" /> Show less</> : <><ChevronDown className="h-3 w-3" /> Show all {checkins.length} entries</>}
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
