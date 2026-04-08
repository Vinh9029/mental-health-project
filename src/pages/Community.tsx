import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { Heart, MessageCircle, Send, PenLine, CornerDownRight, Plus, Smile, Flame, Cloud, Zap, Sparkles, Loader2 } from "lucide-react";
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
  id: string;
  post_id: string;
  user_id: string;
  emoji: string;
}

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  parent_comment_id: string | null;
  content: string;
  created_at: string;
  profile?: Profile;
  replies?: Comment[];
}

interface Post {
  id: string;
  user_id: string;
  title: string;
  content: string;
  mood_tag: string | null;
  is_edited: boolean;
  created_at: string;
  updated_at: string;
  profile?: Profile;
  reactions: Reaction[];
  comments: Comment[];
}

export default function Community() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newMood, setNewMood] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    const allUserIds = [...userIds, ...commentUserIds];
    const profileMap = await fetchProfiles(allUserIds);

    const enriched: Post[] = postsData.map((post) => {
      const postReactions = reactionsData?.filter((r) => r.post_id === post.id) ?? [];
      const postComments = commentsData?.filter((c) => c.post_id === post.id) ?? [];

      // Build threaded comments
      const topLevel: Comment[] = [];
      const byParent: Record<string, Comment[]> = {};

      postComments.forEach((c) => {
        const comment: Comment = { ...c, profile: profileMap[c.user_id], replies: [] };
        if (c.parent_comment_id) {
          if (!byParent[c.parent_comment_id]) byParent[c.parent_comment_id] = [];
          byParent[c.parent_comment_id].push(comment);
        } else {
          topLevel.push(comment);
        }
      });

      topLevel.forEach((c) => (c.replies = byParent[c.id] ?? []));

      return {
        ...post,
        profile: profileMap[post.user_id],
        reactions: postReactions,
        comments: topLevel,
      };
    });

    setPosts(enriched);
    setLoading(false);
  }

  async function handleCreatePost() {
    if (!user || !newTitle.trim() || !newContent.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("posts").insert({
      user_id: user.id,
      title: newTitle.trim(),
      content: newContent.trim(),
      mood_tag: newMood || null,
    });
    setSubmitting(false);
    if (error) { toast.error("Failed to create post"); return; }
    setNewTitle("");
    setNewContent("");
    setNewMood("");
    setCreateOpen(false);
    toast.success("Post shared! 🎉");
    fetchPosts();
  }

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12 max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
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
                <Textarea
                  placeholder="Write your thoughts here..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows={5}
                  maxLength={2000}
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

        {/* Posts Feed */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : posts.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent>
              <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">No posts yet. Be the first to share!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <AnimatePresence>
              {posts.map((post) => (
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
  post,
  user,
  onRefresh,
  profiles,
}: {
  post: Post;
  user: { id: string };
  onRefresh: () => void;
  profiles: Record<string, Profile>;
}) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title);
  const [editContent, setEditContent] = useState(post.content);

  const isOwner = post.user_id === user.id;
  const displayName = post.profile?.nickname || post.profile?.display_name || "Anonymous";
  const avatarEmoji = getAvatarEmoji(post.profile?.avatar_url);
  const moodInfo = MOOD_OPTIONS.find((m) => m.value === post.mood_tag);

  const reactionCounts: Record<string, number> = {};
  post.reactions.forEach((r) => {
    reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1;
  });
  const userReaction = post.reactions.find((r) => r.user_id === user.id);

  async function toggleReaction(emoji: string) {
    if (userReaction?.emoji === emoji) {
      await supabase.from("reactions").delete().eq("id", userReaction.id);
    } else {
      if (userReaction) {
        await supabase.from("reactions").delete().eq("id", userReaction.id);
      }
      await supabase.from("reactions").insert({ post_id: post.id, user_id: user.id, emoji });
    }
    onRefresh();
  }

  async function handleComment() {
    if (!commentText.trim()) return;
    setSubmitting(true);
    await supabase.from("comments").insert({
      post_id: post.id,
      user_id: user.id,
      content: commentText.trim(),
    });
    setCommentText("");
    setSubmitting(false);
    onRefresh();
  }

  async function handleEdit() {
    if (!editTitle.trim() || !editContent.trim()) return;
    await supabase
      .from("posts")
      .update({ title: editTitle.trim(), content: editContent.trim(), is_edited: true })
      .eq("id", post.id);
    setEditing(false);
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
            {moodInfo && (
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
          <div className="space-y-3">
            <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} maxLength={120} />
            <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={4} maxLength={2000} />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleEdit}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setEditTitle(post.title); setEditContent(post.content); }}>Cancel</Button>
            </div>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-semibold text-foreground">{post.title}</h3>
            <p className="text-foreground/80 whitespace-pre-wrap leading-relaxed">{post.content}</p>
          </>
        )}

        {/* Reactions */}
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

        <Separator />

        {/* Comment toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-muted-foreground"
          onClick={() => setShowComments(!showComments)}
        >
          <MessageCircle className="h-4 w-4" />
          {totalComments > 0 ? `${totalComments} comment${totalComments > 1 ? "s" : ""}` : "Comment"}
        </Button>

        {showComments && (
          <div className="space-y-4 pl-2">
            {/* Comment input */}
            <div className="flex gap-2">
              <Textarea
                placeholder="Write a supportive comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={2}
                className="min-h-[60px]"
                maxLength={500}
              />
              <Button
                size="icon"
                variant="hero"
                className="h-10 w-10 shrink-0 self-end"
                onClick={handleComment}
                disabled={submitting || !commentText.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>

            {/* Comments list */}
            {post.comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                postId={post.id}
                userId={user.id}
                onRefresh={onRefresh}
                profiles={profiles}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Comment Item ──────────────────────────── */
function CommentItem({
  comment,
  postId,
  userId,
  onRefresh,
  profiles,
  isReply = false,
}: {
  comment: Comment;
  postId: string;
  userId: string;
  onRefresh: () => void;
  profiles: Record<string, Profile>;
  isReply?: boolean;
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
      post_id: postId,
      user_id: userId,
      parent_comment_id: comment.id,
      content: replyText.trim(),
    });
    setReplyText("");
    setReplyOpen(false);
    setSubmitting(false);
    onRefresh();
  }

  return (
    <div className={`${isReply ? "ml-8 border-l-2 border-muted pl-4" : ""}`}>
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

          {/* Threaded replies */}
          {comment.replies?.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              postId={postId}
              userId={userId}
              onRefresh={onRefresh}
              profiles={profiles}
              isReply
            />
          ))}
        </div>
      </div>
    </div>
  );
}
