import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Smile, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MoodCheckInModalProps {
  onClose: () => void;
  onSubmit: (emoji: string, label: string, stress: number, note?: string) => Promise<void>;
}

const MOODS = [
  { emoji: "😄", label: "Great" },
  { emoji: "😊", label: "Good" },
  { emoji: "😐", label: "Okay" },
  { emoji: "😔", label: "Low" },
  { emoji: "😰", label: "Anxious" },
  { emoji: "😤", label: "Stressed" },
  { emoji: "😢", label: "Sad" },
  { emoji: "😡", label: "Angry" },
];

export default function MoodCheckInModal({ onClose, onSubmit }: MoodCheckInModalProps) {
  const [selected, setSelected] = useState<{ emoji: string; label: string } | null>(null);
  const [stress, setStress] = useState(5);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!selected) return;
    setSaving(true);
    await onSubmit(selected.emoji, selected.label, stress, note || undefined);
    setSaving(false);
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="relative bg-card border rounded-3xl shadow-2xl w-full max-w-md p-7"
          initial={{ scale: 0.92, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 25 }}
        >
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <div className="h-9 w-9 rounded-xl hero-gradient flex items-center justify-center shrink-0">
              <Smile className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-heading text-lg font-bold text-card-foreground">Daily Check-in</h2>
              <p className="text-xs text-muted-foreground">How are you feeling right now?</p>
            </div>
          </div>

          {/* Emoji grid */}
          <div className="grid grid-cols-4 gap-2 mt-5">
            {MOODS.map((m) => (
              <button
                key={m.label}
                onClick={() => setSelected(m)}
                className={`flex flex-col items-center gap-1 p-3 rounded-2xl border-2 transition-all duration-150 ${
                  selected?.label === m.label
                    ? "border-primary bg-primary/8 scale-105 shadow-sm"
                    : "border-border hover:border-primary/40 hover:bg-primary/5"
                }`}
              >
                <span className="text-3xl">{m.emoji}</span>
                <span className="text-[10px] font-medium text-muted-foreground">{m.label}</span>
              </button>
            ))}
          </div>

          {/* Stress slider */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-card-foreground flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5 text-orange-400" />
                Stress level
              </label>
              <span className="text-sm font-bold text-primary">{stress} / 10</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={stress}
              onChange={(e) => setStress(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none bg-secondary cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>Calm</span>
              <span>Overwhelmed</span>
            </div>
          </div>

          {/* Optional note */}
          <div className="mt-4">
            <label className="text-sm font-medium text-card-foreground mb-1.5 block">
              One-line note <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What's on your mind?"
              maxLength={120}
              className="w-full h-10 px-3 rounded-xl border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-5">
            <Button variant="ghost" className="flex-1" onClick={onClose}>
              Skip
            </Button>
            <Button
              variant="hero"
              className="flex-1"
              onClick={handleSubmit}
              disabled={!selected || saving}
            >
              {saving ? "Saving..." : "Log Mood ✨"}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
