import { motion, AnimatePresence } from "framer-motion";
import { AlertOctagon, Phone, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CrisisFloatboxProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CrisisFloatbox({ isOpen, onClose }: CrisisFloatboxProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          {/* Floatbox — fixed dead-center, unaffected by scroll */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90%] max-w-md bg-destructive text-destructive-foreground p-6 rounded-2xl shadow-2xl border border-destructive-foreground/20"
          >
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 text-destructive-foreground/70 hover:text-destructive-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            
            <div className="flex flex-col items-center text-center gap-4">
              <div className="bg-background/20 p-3 rounded-full shrink-0">
                <AlertOctagon className="h-8 w-8" />
              </div>
              <div className="space-y-4">
                <h3 className="font-bold text-xl">Cảnh báo An toàn / Safety Warning</h3>
                <p className="text-sm opacity-90 leading-relaxed text-justify">
                  Chúng tôi nhận thấy bạn đang có những suy nghĩ tiêu cực hoặc ý định làm hại bản thân. Xin hãy nhớ rằng bạn không cô đơn, luôn có những người sẵn lòng lắng nghe và hỗ trợ bạn.
                  <br /><br />
                  We noticed you might be having negative thoughts or intentions of self-harm. Please remember you are not alone, there are always people ready to listen and support you.
                </p>
                
                <div className="space-y-3 bg-background/10 rounded-xl p-4 text-left">
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5" />
                    <div>
                      <p className="text-xs opacity-80 uppercase tracking-wider font-semibold">Vietnam Helpline</p>
                      <p className="font-bold text-lg">1925</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5" />
                    <div>
                      <p className="text-xs opacity-80 uppercase tracking-wider font-semibold">US Crisis Lifeline</p>
                      <p className="font-bold text-lg">988</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5" />
                    <div>
                      <p className="text-xs opacity-80 uppercase tracking-wider font-semibold">UK Samaritans</p>
                      <p className="font-bold text-lg">116 123</p>
                    </div>
                  </div>
                </div>
                
                <Button 
                  variant="secondary" 
                  className="w-full mt-2 bg-background text-destructive hover:bg-background/90"
                  onClick={onClose}
                >
                  Tôi đã hiểu / I understand
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
