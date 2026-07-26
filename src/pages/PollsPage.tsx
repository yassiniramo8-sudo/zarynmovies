import { useState, useEffect } from "react";
import { ArrowLeft, Vote, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { SEOHead } from "@/components/SEOHead";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Poll {
  id: string;
  question: string;
  question_ar: string | null;
  poll_type: string;
  options: { label: string; label_ar?: string }[];
  category: string | null;
  status: string;
  expires_at: string | null;
  created_at: string;
}

interface VoteCount {
  poll_id: string;
  option_index: number;
  count: number;
}

const PollsPage = () => {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [votes, setVotes] = useState<Record<string, number[]>>({});
  const [userVotes, setUserVotes] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { language } = useLanguage();
  const isAr = language === "ar";

  const fetchData = async () => {
    const { data: pollData } = await supabase
      .from("polls")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    const parsedPolls = ((pollData as any[]) || []).map(p => ({
      ...p,
      options: typeof p.options === 'string' ? JSON.parse(p.options) : p.options,
    }));
    setPolls(parsedPolls);

    // Get vote counts
    const { data: voteData } = await supabase.from("poll_votes").select("poll_id, option_index");
    const countMap: Record<string, number[]> = {};
    (voteData || []).forEach((v: any) => {
      if (!countMap[v.poll_id]) countMap[v.poll_id] = [];
      countMap[v.poll_id][v.option_index] = (countMap[v.poll_id][v.option_index] || 0) + 1;
    });
    setVotes(countMap);

    // Get user's votes
    if (user) {
      const { data: myVotes } = await supabase
        .from("poll_votes")
        .select("poll_id, option_index")
        .eq("user_id", user.id);
      const myMap: Record<string, number> = {};
      (myVotes || []).forEach((v: any) => { myMap[v.poll_id] = v.option_index; });
      setUserVotes(myMap);
    }

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  const handleVote = async (pollId: string, optionIndex: number) => {
    if (!user) { toast.error(isAr ? "سجّل الدخول للتصويت" : "Sign in to vote"); return; }
    if (userVotes[pollId] !== undefined) { toast.info(isAr ? "لقد صوّتت مسبقاً" : "You already voted"); return; }

    const { error } = await supabase.from("poll_votes").insert({
      poll_id: pollId,
      user_id: user.id,
      option_index: optionIndex,
    });

    if (error) {
      toast.error(isAr ? "فشل التصويت" : "Vote failed");
    } else {
      toast.success(isAr ? "تم التصويت!" : "Vote recorded!");
      fetchData();
    }
  };

  const getTotalVotes = (pollId: string) => {
    const counts = votes[pollId] || [];
    return counts.reduce((sum, c) => sum + (c || 0), 0);
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <>
      <SEOHead title={isAr ? "استطلاعات - ZarynMovies" : "Polls - ZarynMovies"} description="Vote on football polls and see live results." />
      <div className="container mx-auto min-h-screen px-4 py-8" dir={isAr ? "rtl" : "ltr"}>
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/news"><ArrowLeft className="mr-1 h-4 w-4" />{isAr ? "العودة للأخبار" : "Back to News"}</Link>
        </Button>

        <h1 className="font-display text-3xl font-bold text-foreground mb-8">
          {isAr ? "استطلاعات وتصويت" : "Polls & Voting"}
        </h1>

        <div className="grid gap-6 lg:grid-cols-2">
          {polls.map((poll) => {
            const total = getTotalVotes(poll.id);
            const hasVoted = userVotes[poll.id] !== undefined;
            const question = isAr && poll.question_ar ? poll.question_ar : poll.question;

            return (
              <div key={poll.id} className="rounded-xl border border-border/50 bg-card p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <h3 className="text-lg font-semibold text-foreground">{question}</h3>
                  {poll.category && <Badge variant="secondary">{poll.category}</Badge>}
                </div>

                <div className="space-y-3">
                  {poll.options.map((opt, idx) => {
                    const count = votes[poll.id]?.[idx] || 0;
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    const isSelected = userVotes[poll.id] === idx;
                    const label = isAr && opt.label_ar ? opt.label_ar : opt.label;

                    return (
                      <button
                        key={idx}
                        onClick={() => handleVote(poll.id, idx)}
                        disabled={hasVoted}
                        className={`w-full rounded-lg border p-3 text-left transition-all ${
                          isSelected
                            ? "border-primary bg-primary/10"
                            : hasVoted
                            ? "border-border/50 bg-muted/30"
                            : "border-border/50 hover:border-primary/30 hover:bg-muted/30 cursor-pointer"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-foreground flex items-center gap-2">
                            {isSelected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                            {label}
                          </span>
                          {hasVoted && <span className="text-sm font-bold text-primary">{pct}%</span>}
                        </div>
                        {hasVoted && <Progress value={pct} className="h-1.5" />}
                      </button>
                    );
                  })}
                </div>

                <p className="text-xs text-muted-foreground">
                  {total} {isAr ? "صوت" : total === 1 ? "vote" : "votes"}
                  {poll.expires_at && ` · ${isAr ? "ينتهي" : "Expires"} ${new Date(poll.expires_at).toLocaleDateString(isAr ? "ar-EG" : "en-US")}`}
                </p>
              </div>
            );
          })}
        </div>

        {polls.length === 0 && (
          <p className="py-20 text-center text-muted-foreground">{isAr ? "لا توجد استطلاعات حالياً." : "No active polls yet."}</p>
        )}
      </div>
    </>
  );
};

export default PollsPage;
