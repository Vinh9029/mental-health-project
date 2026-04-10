import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAvatarEmoji } from "@/lib/avatars";
import {
  Heart, MessageCircle, Send, PenLine, CornerDownRight,
  Plus, Sparkles, Loader2, ImagePlus, X, Maximize2,
  Search, User, Globe, Bold, Italic, List, Quote,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const MOOD_OPTIONS = [
  { value: "happy", label: "Happy", icon: "😊" },
  { value: "sad", label: "Sad", icon: "😢" },
  { value: "anxious", label: "Anxious", icon: "😰" },
  { value: "calm", label: "Calm", icon: "😌" },
  { value: "grateful", label: "Grateful", icon: "🙏" },
  { value: "hopeful", label: "Hopeful", icon: "🌟" },
  { value: "frustrated", label: "Frustrated", icon: "😤" },
  { value: "reflective", label: "Reflective", icon: "🤔" },
];

const REACTION_EMOJIS = ["❤️", "🤗", "💪", "🙏", "✨"];

interface Profile {
  user_id: string;
  nickname: string | null;
  display_name: string | null;
  avatar_url: string | null;
}
interface Reaction {
  id: string; post_id: string; user_id: string; emoji: string;
}
interface Comment {
  id: string; post_id: string; user_id: string;
  parent_comment_id: string | null; content: string; created_at: string;
  profile?: Profile; replies?: Comment[];
}
interface Post {
  id: string; user_id: string; title: string; content: string;
  image_url: string | null; mood_tag: string | null; is_edited: boolean;
  created_at: string; updated_at: string;
  profile?: Profile; reactions: Reaction[]; comments: Comment[];
}

/* ─── Rich Text Toolbar ──────────────────────── */
function RichTextarea({
  value, onChange, placeholder, rows = 5,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function wrap(before: string, after: string) {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const sel = value.slice(start, end);
    const next =
      value.slice(0, start) + before + (sel || "text") + after + value.slice(end);
    onChange(next);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + (sel || "text").length);
    }, 0);
  }

  function insertPrefix(prefix: string) {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    onChange(next);
  }

  return (
    <div className="border-2 border-border rounded-xl overflow-hidden focus-within:border-primary transition-colors">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 bg-secondary/40 border-b border-border">
        <button
          type="button"
          title="Bold"
          onClick={() => wrap("**", "**")}
          className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        ><Bold className="h-3.5 w-3.5" /></button>
        <button
          type="button"
          title="Italic"
          onClick={() => wrap("_", "_")}
          className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        ><Italic className="h-3.5 w-3.5" /></button>
        <button
          type="button"
          title="Quote"
          onClick={() => insertPrefix("> ")}
          className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        ><Quote className="h-3.5 w-3.5" /></button>
        <button
          type="button"
          title="List item"
          onClick={() => insertPrefix("• ")}
          className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        ><List className="h-3.5 w-3.5" /></button>
        <span className="ml-auto text-[10px] text-muted-foreground">{value.length}/2000</span>
      </div>
      {/* Textarea */}
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        maxLength={2000}
        className="w-full p-4 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none resize-none text-sm leading-relaxed"
      />
    </div>
  );
}

/* ─── Image picker (shared between Create & Edit) ── */
function ImagePicker({
  preview, onSelect, onRemove,
}: {
  preview: string | null;
  onSelect: (file: File, url: string) => void;
  onRemove: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be < 5MB"); return; }
    onSelect(file, URL.createObjectURL(file));
  }

  return (
    <div className="space-y-2">
      {preview && (
        <div className="relative rounded-xl overflow-hidden border border-border">
          <img src={preview} alt="Preview" className="w-full h-48 object-cover" />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-7 w-7 rounded-full"
            onClick={onRemove}
          ><X className="h-4 w-4" /></Button>
        </div>
      )}
      <input type="file" accept="image/*" className="hidden" ref={ref} onChange={handleChange} />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2 text-muted-foreground"
        onClick={() => ref.current?.click()}
      >
        <ImagePlus className="h-4 w-4" />
        {preview ? "Change Image" : "Add Image"}
      </Button>
    </div>
  );
}

/* ─── Main Community Page ────────────────────── */
export default function Community() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  // Create post form
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newMood, setNewMood] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [moodFilter, setMoodFilter] = useState<string>("all");
  const [tab, setTab] = useState<"all" | "mine">("all");

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) fetchPosts();
  }, [user]);

  async function fetchProfiles(userIds: string[]) {
    const unique = [...new Set(userIds)];
    const missing = unique.filter((id) => !profiles[id]);
    if (missing.length === 0) return profiles;
    const { data } = await supabase
      .from("profiles")
      .select("user_id, nickname, display_name, avatar_url")
      .in("user_id", missing);
    const map = { ...profiles };
    data?.forEach((p) => (map[p.user_id] = p));
    setProfiles(map);
    return map;
  }

  async function fetchPosts() {
    setLoading(true);
    const { data: postsData } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });
    if (!postsData) { setLoading(false); return; }

    const postIds = postsData.map((p) => p.id);
    const userIds = postsData.map((p) => p.user_id);
    const [{ data: reactionsData }, { data: commentsData }] = await Promise.all([
      supabase.from("reactions").select("*").in("post_id", postIds),
      supabase.from("comments").select("*").in("post_id", postIds).order("created_at", { ascending: true }),
    ]);
    const commentUserIds = commentsData?.map((c) => c.user_id) ?? [];
    const profileMap = await fetchProfiles([...userIds, ...commentUserIds]);

    const enriched: Post[] = postsData.map((post) => {
      const postReactions = reactionsData?.filter((r) => r.post_id === post.id) ?? [];
      const postComments = commentsData?.filter((c) => c.post_id === post.id) ?? [];
      const topLevel: Comment[] = [];
      const byParent: Record<string, Comment[]> = {};
      postComments.forEach((c) => {
        const comment: Comment = { ...c, profile: profileMap[c.user_id], replies: [] };
        if (c.parent_comment_id) {
          if (!byParent[c.parent_comment_id]) byParent[c.parent_comment_id] = [];
          byParent[c.parent_comment_id].push(comment);
        } else { topLevel.push(comment); }
      });
      topLevel.forEach((c) => (c.replies = byParent[c.id] ?? []));
      return { ...post, profile: profileMap[post.user_id], reactions: postReactions, comments: topLevel };
    });
    setPosts(enriched);
    setLoading(false);
  }

  async function handleCreatePost() {
    if (!user || !newTitle.trim() || !newContent.trim()) return;
    setSubmitting(true);
    let uploadedImageUrl = null;
    if (imageFile) {
      const fileExt = imageFile.name.split(".").pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("community-images").upload(fileName, imageFile);
      if (uploadError) { toast.error("Failed to upload image"); setSubmitting(false); return; }
      uploadedImageUrl = supabase.storage.from("community-images").getPublicUrl(fileName).data.publicUrl;
    }
    const { error } = await supabase.from("posts").insert({
      user_id: user.id, title: newTitle.trim(), content: newContent.trim(),
      mood_tag: newMood || null, image_url: uploadedImageUrl,
    });
    setSubmitting(false);
    if (error) { toast.error("Failed to create post"); return; }
    setNewTitle(""); setNewContent(""); setNewMood("");
    setImageFile(null); setImagePreview(null);
    setCreateOpen(false);
    toast.success("Post shared! 🎉");
    fetchPosts();
  }

  // Derived filtered posts
  const visiblePosts = posts.filter((p) => {
    if (tab === "mine" && p.user_id !== user?.id) return false;
    if (moodFilter !== "all" && p.mood_tag !== moodFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12 max-w-2xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground">Community</h1>
            <p className="text-muted-foreground mt-1">Share how you're feeling. You're not alone.</p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button variant="hero" size="lg" className="gap-2">
                <Plus className="h-5 w-5" /> New Post
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Share Your Thoughts</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <Input
                  placeholder="Title — what's on your mind?"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  maxLength={120}
                />
                <RichTextarea
                  value={newContent}
                  onChange={setNewContent}
                  placeholder="Write your thoughts here..."
                  rows={5}
                />
                <ImagePicker
                  preview={imagePreview}
                  onSelect={(file, url) => { setImageFile(file); setImagePreview(url); }}
                  onRemove={() => { setImageFile(null); setImagePreview(null); }}
                />
                <Select value={newMood} onValueChange={setNewMood}>
                  <SelectTrigger>
                    <SelectValue placeholder="How are you feeling? (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {MOOD_OPTIONS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.icon} {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="hero"
                  className="w-full"
                  onClick={handleCreatePost}
                  disabled={submitting || !newTitle.trim() || !newContent.trim()}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Share Post
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        ── Filters bar ──
        <div className="space-y-3 mb-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search posts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Tab: All / My Posts */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab("all")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${tab === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
            >
              <Globe className="h-3.5 w-3.5" /> All Posts
            </button>
            <button
              onClick={() => setTab("mine")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${tab === "mine"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
            >
              <User className="h-3.5 w-3.5" /> My Posts
            </button>

            {/* Mood filter chips */}
            <div className="flex gap-1.5 overflow-x-auto flex-1 scrollbar-hide">
              <button
                onClick={() => setMoodFilter("all")}
                className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${moodFilter === "all"
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
              >All moods</button>
              {MOOD_OPTIONS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMoodFilter(moodFilter === m.value ? "all" : m.value)}
                  className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${moodFilter === m.value
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                >
                  {m.icon}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Posts Feed */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : visiblePosts.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent>
              <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">
                {search || moodFilter !== "all" || tab === "mine"
                  ? "No posts match your filters."
                  : "No posts yet. Be the first to share!"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <AnimatePresence>
              {visiblePosts.map((post) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <PostCard post={post} user={user} onRefresh={fetchPosts} profiles={profiles} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Post Card ─────────────────────────────── */
function PostCard({
  post, user, onRefresh, profiles,
}: {
  post: Post; user: { id: string }; onRefresh: () => void; profiles: Record<string, Profile>;
}) {
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);
  // Edit form state — mirrors create form
  const [editTitle, setEditTitle] = useState(post.title);
  const [editContent, setEditContent] = useState(post.content);
  const [editMood, setEditMood] = useState(post.mood_tag || "");
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(post.image_url);
  const [editRemoveImage, setEditRemoveImage] = useState(false);

  const isOwner = post.user_id === user.id;
  const displayName = post.profile?.nickname || post.profile?.display_name || "Anonymous";
  const avatarEmoji = getAvatarEmoji(post.profile?.avatar_url);
  const moodInfo = MOOD_OPTIONS.find((m) => m.value === post.mood_tag);

  const reactionCounts: Record<string, number> = {};
  post.reactions.forEach((r) => { reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1; });
  const userReaction = post.reactions.find((r) => r.user_id === user.id);

  async function toggleReaction(emoji: string) {
    if (userReaction?.emoji === emoji) {
      await supabase.from("reactions").delete().eq("id", userReaction.id);
    } else {
      if (userReaction) await supabase.from("reactions").delete().eq("id", userReaction.id);
      await supabase.from("reactions").insert({ post_id: post.id, user_id: user.id, emoji });
    }
    onRefresh();
  }

  async function handleComment() {
    if (!commentText.trim()) return;
    setSubmitting(true);
    await supabase.from("comments").insert({ post_id: post.id, user_id: user.id, content: commentText.trim() });
    setCommentText(""); setSubmitting(false); onRefresh();
  }

  function cancelEdit() {
    setEditing(false);
    setEditTitle(post.title);
    setEditContent(post.content);
    setEditMood(post.mood_tag || "");
    setEditImageFile(null);
    setEditImagePreview(post.image_url);
    setEditRemoveImage(false);
  }

  async function handleEdit() {
    if (!editTitle.trim() || !editContent.trim()) return;
    let imageUrl: string | null = editRemoveImage ? null : (post.image_url ?? null);
    if (editImageFile) {
      const fileExt = editImageFile.name.split(".").pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("community-images").upload(fileName, editImageFile);
      if (uploadError) { toast.error("Failed to upload image"); return; }
      imageUrl = supabase.storage.from("community-images").getPublicUrl(fileName).data.publicUrl;
    }
    await supabase.from("posts").update({
      title: editTitle.trim(),
      content: editContent.trim(),
      mood_tag: editMood || null,
      image_url: imageUrl,
      is_edited: true,
    }).eq("id", post.id);
    setEditing(false);
    toast.success("Post updated!");
    onRefresh();
  }

  const totalComments = post.comments.reduce((acc, c) => acc + 1 + (c.replies?.length ?? 0), 0);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-lg">{avatarEmoji}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-foreground">{displayName}</p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                {post.is_edited && " · edited"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {moodInfo && !editing && (
              <Badge variant="secondary" className="gap-1">
                {moodInfo.icon} {moodInfo.label}
              </Badge>
            )}
            {isOwner && !editing && (
              <Button variant="ghost" size="icon" onClick={() => setEditing(true)} className="h-8 w-8">
                <PenLine className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {editing ? (
          /* ── Edit Form (mirrors Create Form) ── */
          <div className="space-y-3">
            <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} maxLength={120} placeholder="Title" />
            <RichTextarea value={editContent} onChange={setEditContent} placeholder="Write your thoughts here..." rows={4} />
            <ImagePicker
              preview={editRemoveImage ? null : editImagePreview}
              onSelect={(file, url) => {
                setEditImageFile(file); setEditImagePreview(url); setEditRemoveImage(false);
              }}
              onRemove={() => { setEditImageFile(null); setEditImagePreview(null); setEditRemoveImage(true); }}
            />
            <Select value={editMood} onValueChange={setEditMood}>
              <SelectTrigger>
                <SelectValue placeholder="How are you feeling? (optional)" />
              </SelectTrigger>
              <SelectContent>
                {MOOD_OPTIONS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.icon} {m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button size="sm" variant="hero" onClick={handleEdit}>Save Changes</Button>
              <Button size="sm" variant="ghost" onClick={cancelEdit}>Cancel</Button>
            </div>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-semibold text-foreground">{post.title}</h3>
            <p className="text-foreground/80 whitespace-pre-wrap leading-relaxed line-clamp-3">{post.content}</p>
            {post.image_url && (
              <div
                className="relative rounded-xl overflow-hidden border border-border mt-3 cursor-pointer group"
                onClick={() => setIsDetailModalOpen(true)}
              >
                <img src={post.image_url} alt="Post attachment" className="w-full max-h-80 object-cover transition-transform duration-300 group-hover:scale-105" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Maximize2 className="h-8 w-8 text-white" />
                </div>
              </div>
            )}
          </>
        )}

        {/* Reactions */}
        {!editing && (
          <div className="flex items-center gap-2 flex-wrap">
            {REACTION_EMOJIS.map((emoji) => {
              const count = reactionCounts[emoji] || 0;
              const isActive = userReaction?.emoji === emoji;
              return (
                <Button
                  key={emoji}
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  className={`h-8 gap-1 text-sm ${isActive ? "ring-1 ring-primary/30" : ""}`}
                  onClick={() => toggleReaction(emoji)}
                >
                  {emoji} {count > 0 && <span className="text-xs">{count}</span>}
                </Button>
              );
            })}
          </div>
        )}

        {!editing && <Separator />}

        {/* Detail View Dialog */}
        {!editing && (
          <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground w-full justify-start">
                <MessageCircle className="h-4 w-4" />
                {totalComments > 0 ? `View all ${totalComments} comments` : "Be the first to comment"}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col overflow-hidden p-0">
              <DialogHeader className="p-6 pb-2 shrink-0">
                <DialogTitle className="flex items-center gap-3">
                  <Avatar className="h-8 w-8"><AvatarFallback className="bg-primary/10 text-sm">{avatarEmoji}</AvatarFallback></Avatar>
                  <span>{displayName}'s Post</span>
                </DialogTitle>
              </DialogHeader>
              <div className="overflow-y-auto p-6 pt-2 flex-1 space-y-6">
                <div>
                  <h3 className="text-xl font-bold mb-2 text-foreground">{post.title}</h3>
                  <p className="text-foreground/90 whitespace-pre-wrap">{post.content}</p>
                  {post.image_url && (
                    <img src={post.image_url} alt="Post" className="w-full rounded-xl mt-4 border border-border" />
                  )}
                </div>
                <Separator />
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-muted-foreground">Comments ({totalComments})</h4>
                  {post.comments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-xl">No comments yet. Leave a supportive message!</p>
                  ) : (
                    post.comments.map((comment) => (
                      <CommentItem key={comment.id} comment={comment} postId={post.id} userId={user.id} onRefresh={onRefresh} profiles={profiles} />
                    ))
                  )}
                </div>
              </div>
              {/* Comment Input Sticky Bottom */}
              <div className="p-4 bg-card border-t border-border mt-auto shrink-0">
                <div className="flex gap-2">
                  <textarea
                    placeholder="Write a supportive comment..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    rows={1}
                    className="flex-1 min-h-[44px] resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    maxLength={500}
                  />
                  <Button size="icon" variant="hero" className="h-11 w-11 shrink-0" onClick={handleComment} disabled={submitting || !commentText.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Comment Item ──────────────────────────── */
function CommentItem({
  comment, postId, userId, onRefresh, profiles, isReply = false,
}: {
  comment: Comment; postId: string; userId: string;
  onRefresh: () => void; profiles: Record<string, Profile>; isReply?: boolean;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const profile = comment.profile || profiles[comment.user_id];
  const displayName = profile?.nickname || profile?.display_name || "Anonymous";
  const avatarEmoji = getAvatarEmoji(profile?.avatar_url);

  async function handleReply() {
    if (!replyText.trim()) return;
    setSubmitting(true);
    await supabase.from("comments").insert({
      post_id: postId, user_id: userId, parent_comment_id: comment.id, content: replyText.trim(),
    });
    setReplyText(""); setReplyOpen(false); setSubmitting(false); onRefresh();
  }

  return (
    <div className={isReply ? "ml-8 border-l-2 border-muted pl-4" : ""}>
      <div className="flex items-start gap-2">
        <Avatar className="h-7 w-7 mt-0.5">
          <AvatarFallback className="bg-primary/10 text-sm">{avatarEmoji}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="bg-muted/50 rounded-xl px-3 py-2">
            <p className="text-sm font-medium text-foreground">{displayName}</p>
            <p className="text-sm text-foreground/80">{comment.content}</p>
          </div>
          <div className="flex items-center gap-3 mt-1 ml-1">
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </span>
            {!isReply && (
              <button
                onClick={() => setReplyOpen(!replyOpen)}
                className="text-xs text-primary hover:underline font-medium flex items-center gap-1"
              >
                <CornerDownRight className="h-3 w-3" /> Reply
              </button>
            )}
          </div>
          {replyOpen && (
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="Reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                maxLength={500}
                className="text-sm"
              />
              <Button size="sm" onClick={handleReply} disabled={submitting || !replyText.trim()}>
                <Send className="h-3 w-3" />
              </Button>
            </div>
          )}
          {comment.replies?.map((reply) => (
            <CommentItem key={reply.id} comment={reply} postId={postId} userId={userId} onRefresh={onRefresh} profiles={profiles} isReply />
          ))}
        </div>
      </div>
    </div>
  );
}
