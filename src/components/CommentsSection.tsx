import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, Send, Loader2 } from "lucide-react";
import { useComments } from "@/hooks/useComments";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserBan } from "@/hooks/useUserBan";
import { useVipStatusBatch } from "@/hooks/useVip";
import { CommentThread } from "@/components/CommentThread";

interface CommentsSectionProps {
  contentId: string;
  contentType: string;
}

export function CommentsSection({ contentId, contentType }: CommentsSectionProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { isBanned, remainingText, reason: banReason } = useUserBan();
  const { comments, loading, addComment, deleteComment, toggleLike, totalCount } = useComments(contentId, contentType);
  const [text, setText] = useState("");

  // Collect all user IDs from nested tree
  const collectUserIds = (list: typeof comments): string[] => {
    return list.flatMap((c) => [c.user_id, ...collectUserIds(c.replies)]);
  };
  const userIds = [...new Set(collectUserIds(comments))];
  const vipMap = useVipStatusBatch(userIds);

  const handleSubmit = async () => {
    await addComment(text);
    setText("");
  };

  return (
    <div className="mt-16 max-w-2xl">
      <h2 className="mb-6 flex items-center gap-2 font-display text-2xl font-bold text-foreground">
        <MessageCircle className="h-6 w-6" /> {t("detail.comments")} ({totalCount})
      </h2>

      {isBanned && (
        <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          🚫 {t("detail.banned")}{banReason ? ` ${t("admin.reason")}: ${banReason}` : ""}{remainingText ? ` (${remainingText})` : ""}
        </div>
      )}

      {user && !isBanned ? (
        <div className="flex gap-2 mb-6">
          <Textarea
            placeholder={t("detail.writeComment")}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="flex-1 border-border/50 bg-background/50"
            rows={2}
          />
          <Button onClick={handleSubmit} className="gradient-brand text-primary-foreground self-end" disabled={!text.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      ) : !user ? (
        <p className="mb-6 text-sm text-muted-foreground">{t("detail.signInToComment")}</p>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <CommentThread
              key={c.id}
              comment={c}
              depth={0}
              vipMap={vipMap}
              onReply={addComment}
              onDelete={deleteComment}
              onToggleLike={toggleLike}
            />
          ))}
          {comments.length === 0 && (
            <p className="text-center py-8 text-sm text-muted-foreground">{t("detail.noComments")}</p>
          )}
        </div>
      )}
    </div>
  );
}
