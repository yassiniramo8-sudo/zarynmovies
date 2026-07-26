import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, ThumbsDown, Reply, Trash2, Send, ChevronDown, ChevronUp } from "lucide-react";
import { Comment } from "@/hooks/useComments";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { VipBadge } from "@/components/VipBadge";
import { motion, AnimatePresence } from "framer-motion";

interface CommentThreadProps {
  comment: Comment;
  depth: number;
  vipMap: Record<string, boolean>;
  onReply: (body: string, parentId: string) => void;
  onDelete: (id: string) => void;
  onToggleLike: (commentId: string, type: "like" | "dislike") => void;
  isAdmin?: boolean;
}

export function CommentThread({ comment: c, depth, vipMap, onReply, onDelete, onToggleLike, isAdmin }: CommentThreadProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [collapsed, setCollapsed] = useState(depth >= 3);
  const isVip = vipMap[c.user_id];
  const maxDepth = 4;

  const handleReply = () => {
    if (!replyText.trim()) return;
    onReply(replyText, c.id);
    setReplyText("");
    setReplying(false);
  };

  const borderStyle = c.highlighted && c.highlight_color
    ? { borderColor: c.highlight_color, borderWidth: 2 }
    : isVip
      ? { borderColor: "rgba(245, 158, 11, 0.4)" }
      : {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-lg border p-3 ${isVip ? "bg-gradient-to-r from-amber-500/10 to-yellow-500/5" : "border-border/50 bg-card/80"}`}
      style={borderStyle}
    >
      {/* Header */}
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {c.profile?.avatar_url ? (
            <img src={c.profile.avatar_url} alt="" className={`h-6 w-6 rounded-full object-cover ${isVip ? "ring-2 ring-amber-400/60" : ""}`} />
          ) : (
            <div className={`h-6 w-6 rounded-full ${isVip ? "bg-amber-500/20" : "bg-primary/20"}`} />
          )}
          <span className={`text-xs font-medium ${isVip ? "text-amber-400 font-bold" : "text-foreground"}`}>
            {c.profile?.username || "Anonymous"}
          </span>
          {isVip && <VipBadge />}
          <span className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</span>
          {c.pinned && <Badge variant="outline" className="text-[10px] border-primary/50 text-primary">Pinned</Badge>}
        </div>
        <div className="flex items-center gap-1">
          {(user?.id === c.user_id || isAdmin) && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDelete(c.id)}>
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          )}
        </div>
      </div>

      {/* Body */}
      <p className="text-sm text-muted-foreground mb-2">{c.body}</p>

      {/* Actions */}
      <div className="flex items-center gap-3 text-xs">
        <button
          onClick={() => onToggleLike(c.id, "like")}
          className={`flex items-center gap-1 transition-colors hover:text-primary ${c.userLike === "like" ? "text-primary font-bold" : "text-muted-foreground"}`}
        >
          <ThumbsUp className="h-3.5 w-3.5" /> {c.likes > 0 && c.likes}
        </button>
        <button
          onClick={() => onToggleLike(c.id, "dislike")}
          className={`flex items-center gap-1 transition-colors hover:text-destructive ${c.userLike === "dislike" ? "text-destructive font-bold" : "text-muted-foreground"}`}
        >
          <ThumbsDown className="h-3.5 w-3.5" /> {c.dislikes > 0 && c.dislikes}
        </button>
        {user && depth < maxDepth && (
          <button
            onClick={() => setReplying(!replying)}
            className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
          >
            <Reply className="h-3.5 w-3.5" /> {t("comments.reply") || "Reply"}
          </button>
        )}
      </div>

      {/* Reply input */}
      <AnimatePresence>
        {replying && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="flex gap-2 mt-2">
              <Textarea
                placeholder={t("comments.writeReply") || "Write a reply..."}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="flex-1 border-border/50 bg-background/50 min-h-[40px] text-sm"
                rows={1}
              />
              <Button size="sm" onClick={handleReply} disabled={!replyText.trim()} className="gradient-brand text-primary-foreground self-end">
                <Send className="h-3 w-3" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nested replies */}
      {c.replies.length > 0 && (
        <div className="mt-2">
          {depth >= 2 && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary mb-1"
            >
              {collapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
              {collapsed ? `Show ${c.replies.length} ${c.replies.length === 1 ? "reply" : "replies"}` : "Hide replies"}
            </button>
          )}
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="ml-3 border-l-2 border-border/30 pl-3 space-y-2 mt-1"
              >
                {c.replies.map((reply) => (
                  <CommentThread
                    key={reply.id}
                    comment={reply}
                    depth={depth + 1}
                    vipMap={vipMap}
                    onReply={onReply}
                    onDelete={onDelete}
                    onToggleLike={onToggleLike}
                    isAdmin={isAdmin}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
