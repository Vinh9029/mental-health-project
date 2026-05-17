import React from "react";
import { BookOpen, FileText, Bookmark } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SourceInfo {
  content: string;
  source: string;
  page: number | string;
  ref: string;
}

interface VerifiedSourcePopupProps {
  refText: string;
  sourceInfo?: SourceInfo;
}

const VerifiedSourcePopup: React.FC<VerifiedSourcePopupProps> = ({ refText, sourceInfo }) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span 
          className="inline-flex items-center px-1.5 py-0.5 mx-0.5 text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 rounded-md cursor-help transition-all hover:bg-primary/20 hover:scale-105 shadow-sm select-none"
        >
          <BookOpen className="h-2.5 w-2.5 mr-1" />
          {refText}
        </span>
      </TooltipTrigger>
      <TooltipContent 
        side="top" 
        className="max-w-[350px] p-0 overflow-hidden border-primary/20 shadow-2xl bg-card animate-in fade-in zoom-in duration-200"
      >
        <div className="flex flex-col">
          {/* Header */}
          <div className="bg-primary/10 px-4 py-2.5 border-b border-primary/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1 bg-primary/20 rounded">
                <Bookmark className="h-3 w-3 text-primary" />
              </div>
              <span className="text-[11px] font-bold text-primary uppercase tracking-wider">
                Verified AI Source
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium bg-background/50 px-2 py-0.5 rounded-full border border-border/50">
              <FileText className="h-3 w-3" />
              {refText}
            </div>
          </div>

          {/* Content Body */}
          <div className="p-4">
            <div className="relative">
              <span className="absolute -top-4 -left-2 text-5xl text-primary/10 font-serif leading-none select-none">“</span>
              <div className="max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                <div className="text-xs leading-relaxed text-foreground/90 italic relative z-10 px-1 space-y-2">
                  {sourceInfo?.content ? (
                    sourceInfo.content.replace(/\\n/g, '\n').split('\n').map((line, idx) => (
                      line.trim() ? <p key={idx}>{line}</p> : null
                    ))
                  ) : (
                    <p>Document content not available for this citation.</p>
                  )}
                </div>
              </div>
              <span className="absolute -bottom-2 -right-1 text-5xl text-primary/10 font-serif leading-none select-none">”</span>
            </div>
            
            {/* Footer Metadata */}
            <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[9px] uppercase text-muted-foreground font-bold tracking-tighter">Document Name</span>
                <span className="text-[10px] font-medium text-foreground truncate max-w-[180px]">
                  {sourceInfo?.source || "CBT Documentation"}
                  {sourceInfo?.page && ` • Page ${sourceInfo.page}`}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[9px] uppercase text-muted-foreground font-bold tracking-tighter block">Reliability</span>
                <span className="text-[10px] font-bold text-emerald-500">Verified Evidence</span>
              </div>
            </div>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

export default VerifiedSourcePopup;
