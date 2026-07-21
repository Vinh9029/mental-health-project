import { useState, useRef, useEffect } from "react";
import { X, Upload, Check, Palette, SlidersHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ── Theme definition ──────────────────────────────────────────────────────────
export interface ChatTheme {
  id: string;
  label: string;
  /** Full URL/path to background image. null = solid colour only. */
  url: string | null;
  /** CSS colour + alpha applied as overlay (e.g. "rgba(0,0,0,0.50)") */
  overlay: string;
  /** Overlay opacity 0–1 (used by the slider) */
  overlayOpacity: number;
  /** Base overlay colour without alpha, for recalculating when slider moves */
  overlayColor: string;
  /** Creator's user ID for community-uploaded themes */
  creatorId?: string;
}

// ── Presets ───────────────────────────────────────────────────────────────────
export const PRESET_THEMES: ChatTheme[] = [
  {
    id: "default",
    label: "Default",
    url: null,
    overlay: "transparent",
    overlayOpacity: 0,
    overlayColor: "0,0,0",
  },
  {
    id: "tech",
    label: "Tech Abstract",
    url: "/themes/technological_abstract.jpg",
    overlay: "rgba(0,0,0,0.55)",
    overlayOpacity: 0.55,
    overlayColor: "0,0,0",
  },
  {
    id: "forest",
    label: "Forest Calm",
    url: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=1920&q=80",
    overlay: "rgba(0,30,10,0.52)",
    overlayOpacity: 0.52,
    overlayColor: "0,30,10",
  },
  {
    id: "ocean",
    label: "Ocean Breeze",
    url: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=1920&q=80",
    overlay: "rgba(0,20,50,0.50)",
    overlayOpacity: 0.5,
    overlayColor: "0,20,50",
  },
  {
    id: "sakura",
    label: "Sakura",
    url: "https://images.unsplash.com/photo-1522383225653-ed111181a951?w=1920&q=80",
    overlay: "rgba(80,0,30,0.40)",
    overlayOpacity: 0.4,
    overlayColor: "80,0,30",
  },
  {
    id: "aurora",
    label: "Aurora",
    url: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1920&q=80",
    overlay: "rgba(0,10,40,0.55)",
    overlayOpacity: 0.55,
    overlayColor: "0,10,40",
  },
];

export const DEFAULT_THEME = PRESET_THEMES[0];

// ── Persistence ───────────────────────────────────────────────────────────────
const STORAGE_KEY = "mindbloom-chat-theme";

export function loadSavedTheme(): ChatTheme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_THEME;
    const saved = JSON.parse(raw) as ChatTheme;
    // Ensure new fields exist for older saved data
    return {
      overlayOpacity: 0.5,
      overlayColor: "0,0,0",
      ...saved,
    };
  } catch {
    return DEFAULT_THEME;
  }
}

export function saveThemeLocally(theme: ChatTheme) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
}

/** Rebuild `overlay` string from stored color + new opacity */
function buildOverlay(color: string, opacity: number): string {
  if (opacity === 0) return "transparent";
  return `rgba(${color},${opacity.toFixed(2)})`;
}

// ── Component ─────────────────────────────────────────────────────────────────
interface ChatThemePickerProps {
  currentTheme: ChatTheme;
  onThemeChange: (theme: ChatTheme) => void;
  onClose: () => void;
}

export default function ChatThemePicker({
  currentTheme,
  onThemeChange,
  onClose,
}: ChatThemePickerProps) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<ChatTheme>(currentTheme);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  // Community themes fetched from Supabase
  const [communityThemes, setCommunityThemes] = useState<ChatTheme[]>([]);

  // ── Fetch themes on mount ───────────────────────────────────────────────────
  useEffect(() => {
    const fetchThemes = async () => {
      try {
        const { data, error } = await supabase
          .from("chat_themes")
          .select("*")
          .order("created_at", { ascending: false });
        
        if (!error && data) {
          const mapped: ChatTheme[] = data.map((item: any) => ({
            id: item.id.toString(),
            label: item.label,
            url: item.url,
            overlay: item.overlay,
            overlayOpacity: Number(item.overlay_opacity),
            overlayColor: item.overlay_color,
            creatorId: item.user_id,
          }));
          setCommunityThemes(mapped);
        } else if (error) {
          console.warn("Table chat_themes may not exist yet:", error.message);
        }
      } catch (err) {
        console.error("Failed to load community themes:", err);
      }
    };
    fetchThemes();
  }, []);

  const fileRef = useRef<HTMLInputElement>(null);

  // ── Opacity slider ──────────────────────────────────────────────────────────
  const handleOpacity = (opacity: number) => {
    const updated: ChatTheme = {
      ...selected,
      overlayOpacity: opacity,
      overlay: buildOverlay(selected.overlayColor, opacity),
    };
    setSelected(updated);
  };

  // ── Select preset/community theme ───────────────────────────────────────────
  const handleSelect = (theme: ChatTheme) => setSelected(theme);

  // ── Apply ───────────────────────────────────────────────────────────────────
  const handleApply = () => {
    saveThemeLocally(selected);
    onThemeChange(selected);
    onClose();
  };

  // ── Upload ──────────────────────────────────────────────────────────────────
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("Please select an image file (JPG, PNG, WebP…)");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Image must be smaller than 10 MB");
      return;
    }

    setUploadError(null);
    setUploading(true);

    try {
      let url: string;

      if (user) {
        // Upload to Supabase Storage — 'community-images' bucket
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `chat-themes/${user.id}/${Date.now()}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from("community-images")
          .upload(path, file, { upsert: true, contentType: file.type });

        if (uploadErr) throw uploadErr;

        const { data } = supabase.storage.from("community-images").getPublicUrl(path);
        url = data.publicUrl;
      } else {
        // Guest: use object URL (session only, not persistent)
        url = URL.createObjectURL(file);
      }

      const newThemeName = file.name.replace(/\.[^.]+$/, "").slice(0, 20) || "My Theme";

      const custom: ChatTheme = {
        id: `custom_${Date.now()}`,
        label: newThemeName,
        url,
        overlay: "rgba(0,0,0,0.45)",
        overlayOpacity: 0.45,
        overlayColor: "0,0,0",
        creatorId: user?.id,
      };

      if (user) {
        // Logged in: write metadata to Supabase table
        const { data: dbData, error: dbError } = await supabase
          .from("chat_themes")
          .insert({
            user_id: user.id,
            label: newThemeName,
            url: url,
            overlay_opacity: 0.45,
            overlay_color: "0,0,0",
            overlay: "rgba(0,0,0,0.45)",
          })
          .select()
          .single();

        if (dbError) throw dbError;

        if (dbData) {
          custom.id = dbData.id.toString();
        }
      }

      setCommunityThemes((prev) => [custom, ...prev]);
      setSelected(custom);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setUploadError(msg);
    } finally {
      setUploading(false);
      // Reset input so same file can be selected again
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // ── Delete custom/community theme ──────────────────────────────────────────
  const deleteTheme = async (theme: ChatTheme) => {
    try {
      if (user && theme.creatorId === user.id && !theme.id.startsWith("custom")) {
        // Delete from Supabase database
        const { error } = await supabase
          .from("chat_themes")
          .delete()
          .eq("id", theme.id);
        if (error) throw error;
      }
      
      setCommunityThemes((prev) => prev.filter((t) => t.id !== theme.id));
      if (selected.id === theme.id) setSelected(DEFAULT_THEME);
    } catch (err) {
      console.error("Failed to delete theme:", err);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            <h2 className="font-heading font-semibold text-card-foreground">Chat Background</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">

          {/* Preset Themes Grid */}
          <div>
            <p className="text-xs font-semibold text-card-foreground mb-3 flex items-center gap-1.5">
              <span>Standard Presets</span>
            </p>
            <div className="grid grid-cols-3 gap-3">
              {PRESET_THEMES.map((theme) => (
                <div key={theme.id} className="relative">
                  <button
                    onClick={() => handleSelect(theme)}
                    className={`w-full relative rounded-xl overflow-hidden aspect-video border-2 transition-all ${
                      selected.id === theme.id
                        ? "border-primary ring-2 ring-primary/30 scale-[1.03]"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    {theme.url ? (
                      <img src={theme.url} alt={theme.label} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-background flex items-center justify-center">
                        <span className="text-[10px] text-muted-foreground">No image</span>
                      </div>
                    )}
                    {theme.url && (
                      <div className="absolute inset-0" style={{ background: theme.id === selected.id ? selected.overlay : theme.overlay }} />
                    )}
                    <div className="absolute bottom-0 inset-x-0 px-2 pb-1 pt-3 bg-gradient-to-t from-black/70 to-transparent">
                      <span className="text-[10px] font-medium text-white truncate block">{theme.label}</span>
                    </div>
                    {selected.id === theme.id && (
                      <div className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Community Shared Themes Grid */}
          <div>
            <p className="text-xs font-semibold text-card-foreground mb-3 flex items-center justify-between">
              <span>Shared Gallery</span>
              <span className="text-[10px] font-normal text-muted-foreground">Persisted to Supabase for everyone</span>
            </p>
            
            <div className="grid grid-cols-3 gap-3">
              {communityThemes.map((theme) => {
                const isCreator = user && theme.creatorId === user.id;
                
                return (
                  <div key={theme.id} className="relative group">
                    <button
                      onClick={() => handleSelect(theme)}
                      className={`w-full relative rounded-xl overflow-hidden aspect-video border-2 transition-all ${
                        selected.id === theme.id
                          ? "border-primary ring-2 ring-primary/30 scale-[1.03]"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      {theme.url ? (
                        <img src={theme.url} alt={theme.label} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-background flex items-center justify-center">
                          <span className="text-[10px] text-muted-foreground">No image</span>
                        </div>
                      )}
                      {theme.url && (
                        <div className="absolute inset-0" style={{ background: theme.id === selected.id ? selected.overlay : theme.overlay }} />
                      )}
                      <div className="absolute bottom-0 inset-x-0 px-2 pb-1 pt-3 bg-gradient-to-t from-black/70 to-transparent">
                        <span className="text-[10px] font-medium text-white truncate block">{theme.label}</span>
                      </div>
                      {selected.id === theme.id && (
                        <div className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                    {/* Delete button (uploader only) */}
                    {isCreator && (
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteTheme(theme); }}
                        className="absolute top-1.5 left-1.5 h-5 w-5 rounded-full bg-destructive/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove theme"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Upload image button */}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="relative rounded-xl overflow-hidden aspect-video border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1.5 transition-colors bg-secondary/50"
              >
                <Upload className={`h-5 w-5 ${uploading ? "animate-bounce text-primary" : "text-muted-foreground"}`} />
                <span className="text-[10px] text-muted-foreground px-1 text-center leading-tight">
                  {uploading ? "Uploading…" : "Add to Gallery"}
                </span>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              </button>
            </div>

            {uploadError && (
              <p className="text-xs text-destructive mt-2">{uploadError}</p>
            )}
            {!user && (
              <p className="text-[10px] text-muted-foreground mt-2">
                💡 Log in to upload themes to the community gallery.
              </p>
            )}
          </div>

          {/* Overlay opacity slider (only shown when theme has image) */}
          {selected.url && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-card-foreground">Overlay Darkness</span>
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                  {Math.round(selected.overlayOpacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={80}
                step={5}
                value={Math.round(selected.overlayOpacity * 100)}
                onChange={(e) => handleOpacity(Number(e.target.value) / 100)}
                className="w-full h-2 rounded-full accent-primary cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>Transparent</span>
                <span>Dark</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                💡 Higher darkness = better text readability on bright images.
              </p>
            </div>
          )}

          {/* Live preview strip */}
          {selected.url && (
            <div
              className="relative rounded-xl overflow-hidden h-20 border border-border"
              style={{ backgroundImage: `url(${selected.url})`, backgroundSize: "cover", backgroundPosition: "center" }}
            >
              <div className="absolute inset-0" style={{ background: selected.overlay }} />
              <div className="absolute inset-0 flex items-center justify-center gap-3 px-4">
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-3 py-1.5">
                  <p className="text-white text-xs font-medium">AI message preview</p>
                </div>
                <div className="bg-primary/80 rounded-xl px-3 py-1.5">
                  <p className="text-white text-xs font-medium">Your reply</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 pb-5 pt-3 border-t shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="hero" size="sm" onClick={handleApply}>Apply Theme</Button>
        </div>
      </div>
    </div>
  );
}
