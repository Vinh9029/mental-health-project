import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const REASSESSMENT_DAYS = 14;

export function useReassessment() {
  const { user } = useAuth();
  const [needsReassessment, setNeedsReassessment] = useState(false);
  const [nickname, setNickname] = useState("bạn");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) return;
    const check = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("nickname, display_name, last_assessment_date" as any)
        .eq("user_id", user.id)
        .single();

      if (!data) return;
      const profile = data as any;
      setNickname(profile.nickname || profile.display_name || "bạn");

      if (profile.last_assessment_date) {
        const last = new Date(profile.last_assessment_date);
        const now = new Date();
        const diffDays = (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays >= REASSESSMENT_DAYS) {
          setNeedsReassessment(true);
        }
      }
    };
    check();
  }, [user]);

  const dismiss = () => setDismissed(true);

  return {
    showReassessment: needsReassessment && !dismissed,
    nickname,
    dismiss,
  };
}
