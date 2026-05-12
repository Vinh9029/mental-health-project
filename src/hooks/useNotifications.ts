import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CommunityNotification {
  id: string;
  type: "comment_on_post" | "reply_on_comment";
  actor_id: string;
  actor_name: string;
  actor_avatar: string | null;
  post_id: string;
  post_title: string;
  comment_preview: string;
  is_read: boolean;
  created_at: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<CommunityNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Fetch notifications for this user
    const { data: notifData } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);

    if (!notifData || notifData.length === 0) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    // Collect unique actor IDs + post IDs
    const actorIds = [...new Set(notifData.map((n) => n.actor_id))];
    const postIds = [...new Set(notifData.map((n) => n.post_id))];

    const [{ data: profilesData }, { data: postsData }] = await Promise.all([
      supabase.from("profiles").select("user_id, nickname, display_name, avatar_url").in("user_id", actorIds),
      supabase.from("posts").select("id, title").in("id", postIds),
    ]);

    const profileMap: Record<string, { name: string; avatar: string | null }> = {};
    profilesData?.forEach((p) => {
      profileMap[p.user_id] = {
        name: p.nickname || p.display_name || "Someone",
        avatar: p.avatar_url,
      };
    });

    const postMap: Record<string, string> = {};
    postsData?.forEach((p) => { postMap[p.id] = p.title; });

    const enriched: CommunityNotification[] = notifData.map((n) => ({
      id: n.id,
      type: n.type as CommunityNotification["type"],
      actor_id: n.actor_id,
      actor_name: profileMap[n.actor_id]?.name ?? "Someone",
      actor_avatar: profileMap[n.actor_id]?.avatar ?? null,
      post_id: n.post_id,
      post_title: postMap[n.post_id] ?? "your post",
      comment_preview: n.comment_preview ?? "",
      is_read: n.is_read,
      created_at: n.created_at,
    }));

    setNotifications(enriched);
    setLoading(false);
  }, [user]);

  // Initial fetch
  useEffect(() => {
    if (user) fetchNotifications();
  }, [user, fetchNotifications]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${user.id}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAllRead = useCallback(async () => {
    if (!user || unreadCount === 0) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("recipient_id", user.id)
      .eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }, [user, unreadCount]);

  const markOneRead = useCallback(async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  }, []);

  return { notifications, unreadCount, loading, markAllRead, markOneRead, refetch: fetchNotifications };
}
