import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  nickname: string;
  onDismiss: () => void;
}

export default function ReassessmentBanner({ nickname, onDismiss }: Props) {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="mx-4 mb-3"
    >
      <div className="max-w-2xl mx-auto bg-primary/5 border border-primary/20 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg hero-gradient flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-card-foreground leading-relaxed">
              Hi <strong>{nickname}</strong> 👋, MindCare-AI has been with you for two weeks now.
              You have done very well by being persistent in taking care of yourself! To help MindCare-AI understand better about your current emotions and adjust the exercises accordingly, are you ready to spend 2 minutes doing a small test together with MindCare-AI?
            </p>
            <div className="flex gap-2 mt-4">
              <Button variant="hero" size="sm" onClick={() => navigate("/screening")}>
                Let's do a quick check-in
              </Button>
              <Button variant="ghost" size="sm" onClick={onDismiss}>
                Do it later
              </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
