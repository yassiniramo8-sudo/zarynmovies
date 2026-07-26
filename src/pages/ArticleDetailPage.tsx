import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Heart, MessageCircle, Calendar, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLikes } from "@/hooks/useLikes";
import { useComments } from "@/hooks/useComments";
import { CommentsSection } from "@/components/CommentsSection";
import { AdvertisementRenderer } from "@/components/AdvertisementRenderer";
import { SEOHead } from "@/components/SEOHead";
import { SocialShareButtons } from "@/components/SocialShareButtons";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useTrackView } from "@/hooks/useTrackView";

interface Article {
  id: string;
  title: string;
  content: string | null;
  excerpt: string | null;
  cover_url: string | null;
  category: string | null;
  tags: string[] | null;
  created_at: string;
  published_at: string | null;
}

const ArticleDetailPage = () => {
  const { id } = useParams();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { t, language } = useLanguage();

  useEffect(() => {
    if (!id) return;
    supabase.from("articles").select("*").eq("id", id).single().then(({ data }) => {
      setArticle(data as Article | null);
      setLoading(false);
    });
  }, [id]);

  useTrackView(id, "article");
  const { liked, count: likeCount, toggle: toggleLike } = useLikes(id || "", "article");
  const { totalCount: commentCount } = useComments(id || "", "article");

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!article) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">{t("detail.contentNotFound")}</div>;

  const coverUrl = article.cover_url || "/placeholder.svg";
  const publishDate = article.published_at || article.created_at;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.excerpt || "",
    image: coverUrl,
    datePublished: publishDate,
    dateModified: publishDate,
    author: { "@type": "Organization", name: "Zaryn Movies" },
    publisher: { "@type": "Organization", name: "Zaryn Movies" },
    keywords: [...(article.tags || []), article.category].filter(Boolean).join(", "),
  };

  const isRtl = language === "ar";

  return (
    <div className="min-h-screen" dir={isRtl ? "rtl" : "ltr"}>
      <SEOHead
        title={article.title}
        description={article.excerpt || `Read ${article.title} on Zaryn Movies`}
        image={coverUrl}
        type="article"
        publishedAt={publishDate}
        tags={article.tags || undefined}
        jsonLd={jsonLd}
      />

      {/* Hero cover */}
      <div className="relative h-[45vh] min-h-[350px] overflow-hidden">
        <img src={coverUrl} alt={article.title} className="absolute inset-0 h-full w-full object-cover" loading="eager" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/30" />
      </div>

      <div className="container mx-auto -mt-28 relative z-10 px-4 pb-16">
        <AdvertisementRenderer placement="inside_article" />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Link to="/articles" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-6">
            <ArrowLeft className="h-4 w-4" /> {t("articles.backToArticles")}
          </Link>

          {/* Category & Tags */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {article.category && (
              <Badge className="bg-primary/20 text-primary border-primary/30">{article.category}</Badge>
            )}
            {article.tags?.map((tag) => (
              <Badge key={tag} variant="outline" className="border-border/50 text-muted-foreground">{tag}</Badge>
            ))}
          </div>

          <h1 className="mb-4 font-display text-4xl font-bold text-foreground md:text-5xl leading-tight">{article.title}</h1>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 mb-8 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {new Date(publishDate).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 mb-10">
            <Button variant={liked ? "default" : "ghost"} className="gap-2" onClick={toggleLike}>
              <Heart className={`h-5 w-5 ${liked ? "fill-current" : ""}`} /> {likeCount}
            </Button>
            <span className="flex items-center gap-1 text-muted-foreground">
              <MessageCircle className="h-5 w-5" /> {commentCount}
            </span>
            <SocialShareButtons title={article.title} description={article.excerpt || undefined} />
          </div>

          {/* Excerpt */}
          {article.excerpt && (
            <p className={`mb-8 text-lg text-muted-foreground italic ${isRtl ? "border-r-4 pr-4 border-primary/50" : "border-l-4 pl-4 border-primary/50"}`}>{article.excerpt}</p>
          )}

          {/* Content */}
          {article.content && (
            <article className={`max-w-3xl prose-lg ${isRtl ? "arabic-content" : ""}`}>
              <div
                className="text-foreground leading-relaxed whitespace-pre-wrap [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mt-8 [&_h1]:mb-4 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-3 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_p]:mb-4 [&_a]:text-primary [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: article.content }}
              />
            </article>
          )}
        </motion.div>

        {/* Comments Section */}
        <AdvertisementRenderer placement="before_comments" />
        <CommentsSection contentId={id || ""} contentType="article" />

        {/* Related Articles */}
        <RelatedArticles currentId={id || ""} category={article.category} tags={article.tags} />
      </div>
    </div>
  );
};

/* ---------- Related Articles ---------- */
const RelatedArticles = ({ currentId, category, tags }: { currentId: string; category: string | null; tags: string[] | null }) => {
  const [items, setItems] = useState<any[]>([]);
  const { t } = useLanguage();

  useEffect(() => {
    const fetchRelated = async () => {
      let results: any[] = [];

      // First try: match by category
      if (category) {
        const { data } = await supabase
          .from("articles")
          .select("id, title, cover_url, category, published_at, excerpt")
          .eq("status", "published")
          .neq("id", currentId)
          .eq("category", category)
          .order("published_at", { ascending: false })
          .limit(6);
        results = data || [];
      }

      // Fallback: latest articles
      if (results.length === 0) {
        const { data } = await supabase
          .from("articles")
          .select("id, title, cover_url, category, published_at, excerpt")
          .eq("status", "published")
          .neq("id", currentId)
          .order("published_at", { ascending: false })
          .limit(6);
        results = data || [];
      }

      setItems(results);
    };
    fetchRelated();
  }, [currentId, category]);

  if (items.length === 0) return null;

  return (
    <div className="mt-12 border-t border-border pt-8">
      <h2 className="mb-6 text-2xl font-bold text-foreground">{t("detail.relatedContent") || "Related Articles"}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((a) => (
          <Link key={a.id} to={`/articles/${a.id}`} className="group overflow-hidden rounded-xl border border-border/50 bg-card transition-all hover:border-primary/30 hover:shadow-lg">
            {a.cover_url && (
              <div className="aspect-video overflow-hidden">
                <img src={a.cover_url} alt={a.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              </div>
            )}
            <div className="p-3 space-y-1">
              <h3 className="font-semibold text-foreground line-clamp-2 text-sm group-hover:text-primary transition-colors">{a.title}</h3>
              <div className="flex items-center gap-2">
                {a.category && <Badge variant="outline" className="text-xs">{a.category}</Badge>}
                {a.published_at && (
                  <span className="text-xs text-muted-foreground">{new Date(a.published_at).toLocaleDateString()}</span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default ArticleDetailPage;
