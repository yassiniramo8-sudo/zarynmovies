import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";
import { useComments } from "@/hooks/useComments";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserBan } from "@/hooks/useUserBan";
import { useVipStatusBatch } from "@/hooks/useVip";
import { CommentThread } from "@/components/CommentThread";

interface CommentsModalProps { open: boolean; onOpenChange: (open: boolean) => void; contentId: string; contentType: string; title: string; }

function CommentsModalContent({ contentId, contentType, title }: { contentId: string; contentType: string; title: string }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { isBanned, remainingText, reason: banReason } = useUserBan();
  const { comments, loading, addComment, deleteComment, toggleLike } = useComments(contentId, contentType);
  const [text, setText] = useState("");

  const collectUserIds = (list: typeof comments): string[] =>
    list.flatMap((c) => [c.user_id, ...collectUserIds(c.replies)]);
  const userIds = [...new Set(collectUserIds(comments))];
  const vipMap = useVipStatusBatch(userIds);

  const handleSubmit = async () => { await addComment(text); setText(""); };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-foreground">{t("comments.title")} — {title}</DialogTitle>
      </DialogHeader>

      {isBanned && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive shrink-0">
          🚫 {t("detail.banned")}{banReason ? ` ${t("admin.reason")}: ${banReason}` : ""}{remainingText ? ` (${remainingText})` : ""}
        </div>
      )}

      {user && !isBanned ? (
        <div className="flex gap-2 shrink-0">
          <Textarea placeholder={t("detail.writeComment")} value={text} onChange={(e) => setText(e.target.value)} className="flex-1 border-border/50 bg-background/50 min-h-[60px]" rows={2} />
          <Button onClick={handleSubmit} className="gradient-brand text-primary-foreground self-end" disabled={!text.trim()}><Send className="h-4 w-4" /></Button>
        </div>
      ) : !user ? (
        <p className="text-sm text-muted-foreground">{t("detail.signInToComment")}</p>
      ) : null}

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <>
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
          </>
        )}
        {!loading && comments.length === 0 && <p className="text-center py-6 text-sm text-muted-foreground">{t("detail.noComments")}</p>}
      </div>
    </>
  );
}

export function CommentsModal({ open, onOpenChange, contentId, contentType, title }: CommentsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col bg-card/95 backdrop-blur-xl border-border/50">
        {open && <CommentsModalContent contentId={contentId} contentType={contentType} title={title} />}
      </DialogContent>
    </Dialog>
  );
}
