import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Brain, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check for recovery token in URL
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    }

    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: "Password updated!", description: "You can now sign in with your new password." });
      navigate("/auth");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!isRecovery) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="bg-card rounded-2xl p-8 card-elevated text-center max-w-md">
          <Brain className="h-10 w-10 text-primary mx-auto mb-4" />
          <h1 className="font-heading text-xl font-bold text-card-foreground mb-2">Invalid Link</h1>
          <p className="text-sm text-muted-foreground">This password reset link is invalid or expired.</p>
          <Button variant="hero" className="mt-6" onClick={() => navigate("/auth")}>
            Back to Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="bg-card rounded-2xl p-8 card-elevated">
          <div className="text-center mb-8">
            <h1 className="font-heading text-2xl font-bold text-card-foreground">Set New Password</h1>
            <p className="text-sm text-muted-foreground mt-1">Enter your new password below</p>
          </div>
          <form onSubmit={handleReset} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="password"
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 pl-10 pr-4 rounded-xl border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                required
                minLength={6}
              />
            </div>
            <Button type="submit" variant="hero" className="w-full" size="lg" disabled={loading}>
              {loading ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
