import { Link, useNavigate } from "react-router-dom";
import { Brain, LogOut, User, ChevronDown, Users, Smile, BookOpen, Bell, CheckCheck, MessageCircle, CornerDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAvatarEmoji } from "@/lib/avatars";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";

export default function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ nickname?: string; avatar_url?: string; baseline_level?: string; display_name?: string } | null>(null);

  // Notification state
  const { notifications, unreadCount, loading: notifLoading, markAllRead, markOneRead } = useNotifications();
  const [popupOpen, setPopupOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("nickname, display_name, avatar_url, baseline_level")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data));
  }, [user]);

  // Close popup when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        popupRef.current && !popupRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setPopupOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleMouseEnterTrigger() {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setPopupOpen(true);
  }

  function handleMouseLeaveTrigger() {
    hoverTimeout.current = setTimeout(() => setPopupOpen(false), 200);
  }

  function handleMouseEnterPopup() {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
  }

  function handleMouseLeavePopup() {
    hoverTimeout.current = setTimeout(() => setPopupOpen(false), 200);
  }

  const displayName = profile?.nickname || profile?.display_name || user?.email?.split("@")[0] || "User";
  const avatarEmoji = getAvatarEmoji(profile?.avatar_url);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b">
      <div className="container mx-auto h-16 px-4 items-center justify-between flex flex-row shadow-none font-sans text-justify">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg hero-gradient flex items-center justify-center">
            <Brain className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-heading text-xl font-semibold text-foreground">MindCare AI</span>
        </Link>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/chat">Chat</Link>
          </Button>

          {/* ── Community button with notification badge + hover popup ── */}
          <div
            ref={triggerRef}
            className="relative"
            onMouseEnter={handleMouseEnterTrigger}
            onMouseLeave={handleMouseLeaveTrigger}
          >
            <Button variant="ghost" size="sm" className="gap-1.5 relative" asChild>
              <Link to="/community">
                <Users className="h-4 w-4" />
                Community
                {/* Badge */}
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse shadow-md">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
            </Button>

            {/* ── Hover Popup ── */}
            <AnimatePresence>
              {popupOpen && user && (
                <motion.div
                  ref={popupRef}
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  onMouseEnter={handleMouseEnterPopup}
                  onMouseLeave={handleMouseLeavePopup}
                  className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-80 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-[200]"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold text-foreground">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        Mark all read
                      </button>
                    )}
                  </div>

                  {/* Notification list */}
                  <div className="max-h-[340px] overflow-y-auto divide-y divide-border">
                    {notifLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                        <Bell className="h-8 w-8 opacity-30" />
                        <p className="text-sm">No notifications yet</p>
                        <p className="text-xs opacity-70">When others comment on your posts,<br />you'll see them here.</p>
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <button
                          key={notif.id}
                          className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-muted/40 transition-colors ${!notif.is_read ? "bg-primary/5" : ""}`}
                          onClick={() => {
                            markOneRead(notif.id);
                            setPopupOpen(false);
                            navigate("/community");
                          }}
                        >
                          {/* Avatar */}
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-base shrink-0 mt-0.5">
                            {getAvatarEmoji(notif.actor_avatar)}
                          </div>

                          {/* Text */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground leading-snug">
                              <span className="font-semibold">{notif.actor_name}</span>{" "}
                              {notif.type === "comment_on_post" ? (
                                <>
                                  commented on your post{" "}
                                  <span className="font-medium text-primary truncate">"{notif.post_title}"</span>
                                </>
                              ) : (
                                <>
                                  replied to your comment on{" "}
                                  <span className="font-medium text-primary truncate">"{notif.post_title}"</span>
                                </>
                              )}
                            </p>
                            {notif.comment_preview && (
                              <p className="text-xs text-muted-foreground mt-0.5 italic line-clamp-1">
                                "{notif.comment_preview}"
                              </p>
                            )}
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                            </p>
                          </div>

                          {/* Type icon + unread dot */}
                          <div className="shrink-0 flex flex-col items-center gap-1.5 mt-0.5">
                            {notif.type === "comment_on_post" ? (
                              <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                            {!notif.is_read && (
                              <span className="h-2 w-2 rounded-full bg-primary" />
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>

                  {/* Footer */}
                  {notifications.length > 0 && (
                    <div className="px-4 py-2 border-t border-border bg-muted/20">
                      <button
                        onClick={() => { setPopupOpen(false); navigate("/community"); }}
                        className="text-xs text-primary hover:underline font-medium w-full text-center"
                      >
                        Go to Community →
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {/* ── end Community button ── */}

          <Button variant="ghost" size="sm" asChild className="gap-1.5">
            <Link to="/mood"><Smile className="h-4 w-4" /> Mood</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild className="gap-1.5">
            <Link to="/journal"><BookOpen className="h-4 w-4" /> Journal</Link>
          </Button>
          <Button variant="hero" size="sm" asChild>
            <Link to="/screening">Start Screening</Link>
          </Button>
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary/10 text-base">
                      {avatarEmoji}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-sm font-medium text-foreground max-w-[100px] truncate">
                    {displayName}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  {profile?.baseline_level && profile.baseline_level !== "Normal" && (
                    <p className="text-xs text-primary mt-1">Level: {profile.baseline_level}</p>
                  )}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="cursor-pointer">
                    <User className="h-4 w-4 mr-2" /> Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-destructive cursor-pointer">
                  <LogOut className="h-4 w-4 mr-2" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="outline" size="sm" asChild>
              <Link to="/auth">Sign In</Link>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
