import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Returns whether the current user has already submitted a mood check-in today.
 * Used by Chat.tsx to decide whether to show the daily check-in modal.
 */
export function useMoodCheckin() {
  const { user } = useAuth();
  const [hasCheckedInToday, setHasCheckedInToday] = useState<boolean | null>(null);

  const checkTodayStatus = async () => {
    if (!user) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("mood_checkins")
      .select("id")
      .eq("user_id", user.id)
      .gte("created_at", today.toISOString())
      .limit(1);

    setHasCheckedInToday(!!(data && data.length > 0));
  };

  useEffect(() => {
    checkTodayStatus();
  }, [user]);

  const submitCheckin = async (
    emoji: string,
    label: string,
    stress_score: number,
    note?: string
  ) => {
    if (!user) return;
    await supabase.from("mood_checkins").insert({
      user_id: user.id,
      emoji,
      label,
      stress_score,
      note: note || null,
    });
    setHasCheckedInToday(true);
  };

  return { hasCheckedInToday, submitCheckin, refetch: checkTodayStatus };
}
