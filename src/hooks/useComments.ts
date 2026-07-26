import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserBan } from "@/hooks/useUserBan";
import { toast } from "sonner";

export interface Comment {
  id: string;
  body: string;
  user_id: string;
  created_at: string;
  pinned: boolean;
  highlighted: boolean;
  highlight_color: string | null;
  parent_id: string | null;
  profile?: { username: string | null; avatar_url: string | null };
  likes: number;
  dislikes: number;
  userLike: "like" | "dislike" | null;
  replies: Comment[];
}

export function useComments(contentId: string, contentType: string) {
  const { user } = useAuth();
  const { isBanned, remainingText } = useUserBan();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchComments = useCallback(async () => {
    if (!contentId) return;
    const { data } = await supabase
      .from("comments")
      .select("*")
      .eq("content_id", contentId)
      .eq("content_type", contentType)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: true });

    if (!data) { setLoading(false); return; }

    // Fetch profiles
    const userIds = [...new Set(data.map((c) => c.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .in("id", userIds);
    const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

    // Fetch all likes for these comments
    const commentIds = data.map((c) => c.id);
    const { data: allLikes } = await supabase
      .from("comment_likes")
      .select("comment_id, like_type, user_id")
      .in("comment_id", commentIds);

    // Build like counts
    const likeCounts: Record<string, { likes: number; dislikes: number }> = {};
    const userLikes: Record<string, "like" | "dislike"> = {};
    (allLikes || []).forEach((l) => {
      if (!likeCounts[l.comment_id]) likeCounts[l.comment_id] = { likes: 0, dislikes: 0 };
      if (l.like_type === "like") likeCounts[l.comment_id].likes++;
      else likeCounts[l.comment_id].dislikes++;
      if (user && l.user_id === user.id) userLikes[l.comment_id] = l.like_type as "like" | "dislike";
    });

    // Build flat list with metadata
    const flat: Comment[] = data.map((c) => ({
      ...c,
      pinned: c.pinned ?? false,
      highlighted: c.highlighted ?? false,
      parent_id: c.parent_id ?? null,
      profile: profileMap.get(c.user_id) || { username: null, avatar_url: null },
      likes: likeCounts[c.id]?.likes || 0,
      dislikes: likeCounts[c.id]?.dislikes || 0,
      userLike: userLikes[c.id] || null,
      replies: [],
    }));

    // Build tree
    const map = new Map<string, Comment>();
    flat.forEach((c) => map.set(c.id, c));
    const roots: Comment[] = [];
    flat.forEach((c) => {
      if (c.parent_id && map.has(c.parent_id)) {
        map.get(c.parent_id)!.replies.push(c);
      } else {
        roots.push(c);
      }
    });

    // Sort roots: pinned first, then newest first
    roots.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    setComments(roots);
    setLoading(false);
  }, [contentId, contentType, user?.id]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  const addComment = async (body: string, parentId?: string) => {
    if (!user) { toast.error("Sign in to comment"); return; }
    if (isBanned) { toast.error(`You are temporarily restricted. ${remainingText || ""}`); return; }
    if (!body.trim()) return;

    // AI moderation check
    try {
      const { data: modResult } = await supabase.functions.invoke("ai-moderate-comment", {
        body: { comment_text: body.trim() },
      });
      if (modResult && !modResult.allowed) {
        toast.error(`Comment blocked: ${modResult.reason || "Inappropriate content detected"}`);
        return;
      }
    } catch (e) {
      // If moderation fails, allow the comment through
      console.warn("Moderation check failed, allowing comment:", e);
    }

    // Check comment delay setting
    try {
      const { data: delaySetting } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "comment_delay_seconds")
        .single();
      const delaySeconds = parseInt(delaySetting?.value || "0");
      if (delaySeconds > 0) {
        const { data: lastComment } = await supabase
          .from("comments")
          .select("created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        if (lastComment) {
          const elapsed = (Date.now() - new Date(lastComment.created_at).getTime()) / 1000;
          if (elapsed < delaySeconds) {
            toast.error(`Please wait ${Math.ceil(delaySeconds - elapsed)} seconds before commenting again`);
            return;
          }
        }
      }
    } catch {}

    const insertData: any = {
      body: body.trim(),
      content_id: contentId,
      content_type: contentType,
      user_id: user.id,
    };
    if (parentId) insertData.parent_id = parentId;

    const { error } = await supabase.from("comments").insert(insertData);

    if (error) { toast.error(error.message); return; }

    toast.success(parentId ? "Reply posted" : "Comment posted");

    // Send notification to parent comment author if replying
    if (parentId) {
      const { data: parentComment } = await supabase
        .from("comments")
        .select("user_id")
        .eq("id", parentId)
        .single();
      if (parentComment && parentComment.user_id !== user.id) {
        await supabase.from("notifications").insert({
          user_id: parentComment.user_id,
          title: "💬 New reply to your comment",
          message: body.trim().slice(0, 100),
          link: `/${contentType === "movie" ? "movies" : contentType === "anime" ? "anime" : "articles"}/${contentId}`,
        }).then(() => {});
      }
    }

    fetchComments();
  };

  const deleteComment = async (id: string) => {
    await supabase.from("comments").delete().eq("id", id);
    fetchComments();
  };

  const toggleLike = async (commentId: string, type: "like" | "dislike") => {
    if (!user) { toast.error("Sign in to react"); return; }
    if (isBanned) { toast.error(`You are temporarily restricted.`); return; }

    // Check existing
    const { data: existing } = await supabase
      .from("comment_likes")
      .select("id, like_type")
      .eq("comment_id", commentId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      if (existing.like_type === type) {
        // Remove
        await supabase.from("comment_likes").delete().eq("id", existing.id);
      } else {
        // Switch
        await supabase.from("comment_likes").update({ like_type: type }).eq("id", existing.id);
      }
    } else {
      await supabase.from("comment_likes").insert({
        comment_id: commentId,
        user_id: user.id,
        like_type: type,
      });
    }
    fetchComments();
  };

  // Count all comments including replies
  const countAll = (list: Comment[]): number => {
    return list.reduce((acc, c) => acc + 1 + countAll(c.replies), 0);
  };

  return { comments, loading, addComment, deleteComment, toggleLike, totalCount: countAll(comments) };
}
