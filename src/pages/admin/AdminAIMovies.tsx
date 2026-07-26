import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { LANGUAGES, Language } from "@/i18n/translations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { zarynToast } from "@/components/ZarynToast";
import { motion, AnimatePresence } from "framer-motion";
import {
  ContentBlockEditor,
  ContentBlock,
  blocksToHtml,
} from "@/components/admin/ContentBlockEditor";
import {
  Search, Sparkles, Film, Tv, Star, Calendar, Clock, Users, Tag, Globe,
  ChevronRight, Loader2, Eye, Send, Image as ImageIcon, Play, X, ExternalLink, Save, Layers,
} from "lucide-react";

type TMDbResult = {
  tmdb_id: number;
  title: string;
  original_title: string;
  media_type: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  popularity: number;
  genre_ids: number[];
};

type WatchProvider = { name: string; logo: string | null };

type MovieDetails = {
  tmdb_id: number;
  media_type: string;
  title: string;
  original_title: string;
  overview: string;
  poster_url: string | null;
  backdrop_url: string | null;
  trailer_url: string | null;
  year: number | null;
  rating: number;
  popularity: number;
  genres: string[];
  runtime: number | null;
  tagline: string | null;
  cast: { name: string; character: string; profile_path: string | null }[];
  gallery_images: string[];
  number_of_seasons: number | null;
  number_of_episodes: number | null;
  status: string;
  watch_providers?: {
    link: string | null;
    flatrate: WatchProvider[];
    rent: WatchProvider[];
    buy: WatchProvider[];
  };
};

type AIGenerated = {
  description: string;
  tags: string[];
  seo_title: string;
  seo_description: string;
  translated_genres: string[];
  translated_labels: Record<string, string>;
  translations: Record<string, string>;
};

export default function AdminAIMovies() {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [primaryLang, setPrimaryLang] = useState<Language>("ar");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TMDbResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<MovieDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [aiContent, setAiContent] = useState<AIGenerated | null>(null);
  const [generating, setGenerating] = useState(false);
  const [editableDesc, setEditableDesc] = useState("");
  const [editableTags, setEditableTags] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [step, setStep] = useState<"search" | "details" | "review">("search");
  const [extraBlocks, setExtraBlocks] = useState<ContentBlock[]>([]);

  const selectedLangConfig = LANGUAGES.find((l) => l.code === primaryLang)!;
  const isRtl = selectedLangConfig.dir === "rtl";

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("ai-movie-search", {
        body: { action: "search", query: searchQuery, primaryLanguage: primaryLang },
      });
      if (error) throw error;
      setSearchResults(data.results || []);
      if ((data.results || []).length === 0) {
        zarynToast({ title: "No Results", message: "No movies or series found.", type: "warning" });
      }
    } catch (err: any) {
      zarynToast({ title: "Search Failed", message: err.message, type: "error" });
    } finally {
      setSearching(false);
    }
  };

  const handleSelectResult = async (result: TMDbResult) => {
    setLoadingDetails(true);
    setStep("details");
    try {
      const { data, error } = await supabase.functions.invoke("ai-movie-search", {
        body: { action: "details", movieData: { tmdb_id: result.tmdb_id, media_type: result.media_type }, primaryLanguage: primaryLang },
      });
      if (error) throw error;
      setSelectedMovie(data.result);
    } catch (err: any) {
      zarynToast({ title: "Failed to Load Details", message: err.message, type: "error" });
      setStep("search");
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedMovie) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-movie-search", {
        body: {
          action: "generate",
          movieData: selectedMovie,
          primaryLanguage: primaryLang,
          languages: LANGUAGES.map((l) => l.code),
        },
      });
      if (error) throw error;
      const gen = data.generated;
      setAiContent(gen);
      setEditableDesc(gen.description || "");
      setEditableTags(gen.tags || []);
      setExtraBlocks([]);
      setStep("review");
    } catch (err: any) {
      zarynToast({ title: "AI Generation Failed", message: err.message, type: "error" });
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async (contentType: "movies" | "anime" | "series") => {
    if (!selectedMovie || !user) return;
    setPublishing(true);
    try {
      const extraHtml = extraBlocks.length > 0 ? "\n" + blocksToHtml(extraBlocks) : "";
      const finalDescription = (editableDesc || selectedMovie.overview) + extraHtml;
      const entry: any = {
        title: selectedMovie.title,
        description: finalDescription,
        poster_url: selectedMovie.poster_url,
        trailer_url: selectedMovie.trailer_url,
        year: selectedMovie.year,
        rating: selectedMovie.rating,
        genre: aiContent?.translated_genres?.length ? aiContent.translated_genres : selectedMovie.genres,
        gallery_images: selectedMovie.gallery_images,
        trending: selectedMovie.popularity > 50,
        pinned: false,
        created_by: user.id,
      };

      if (contentType !== "series") {
        entry.watch_servers = [];
        entry.download_servers = [];
      }

      const { error } = await supabase.from(contentType).insert(entry);
      if (error) throw error;

      zarynToast({
        title: "Published! 🎬",
        message: `"${selectedMovie.title}" added to ${contentType}.`,
        type: "success",
        duration: 5000,
      });

      setStep("search");
      setSelectedMovie(null);
      setAiContent(null);
      setSearchQuery("");
      setSearchResults([]);
    } catch (err: any) {
      zarynToast({ title: "Publish Failed", message: err.message, type: "error" });
    } finally {
      setPublishing(false);
    }
  };

  const removeTag = (idx: number) => setEditableTags(editableTags.filter((_, i) => i !== idx));
  const addTag = (tag: string) => {
    if (tag && !editableTags.includes(tag)) setEditableTags([...editableTags, tag]);
  };

  const allProviders = selectedMovie?.watch_providers;
  const hasProviders = allProviders && (allProviders.flatrate.length > 0 || allProviders.rent.length > 0 || allProviders.buy.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gradient-brand font-display flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-primary" />
            AI Movie Manager
          </h1>
          <p className="text-muted-foreground mt-1">
            Search, fetch, and publish movies with AI-powered content generation
          </p>
        </div>

        {/* Language Selector */}
        <div className="flex items-center gap-2 shrink-0">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <Select value={primaryLang} onValueChange={(v) => setPrimaryLang(v as Language)}>
            <SelectTrigger className="w-[180px] border-border/50 bg-background/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  <span className="flex items-center gap-2">
                    <span>{l.flag}</span>
                    <span>{l.label}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 text-sm">
        {(["search", "details", "review"] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <button
              onClick={() => {
                if (s === "search") setStep("search");
                else if (s === "details" && selectedMovie) setStep("details");
                else if (s === "review" && aiContent) setStep("review");
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                step === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {i + 1}. {s === "search" ? "Search" : s === "details" ? "Details" : "Review & Publish"}
            </button>
            {i < 2 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* STEP 1: Search */}
        {step === "search" && (
          <motion.div key="search" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-primary" /> Search Movies & Series
                  <Badge variant="outline" className="ml-2 text-[10px]">{selectedLangConfig.flag} {selectedLangConfig.label}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <Input
                    placeholder="Enter movie or series name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="border-border/50 bg-background/50"
                  />
                  <Button onClick={handleSearch} disabled={searching} className="gradient-brand text-primary-foreground shrink-0">
                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    <span className="ml-2">Search</span>
                  </Button>
                </div>

                {searchResults.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {searchResults.map((r) => (
                      <motion.button
                        key={`${r.tmdb_id}-${r.media_type}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => handleSelectResult(r)}
                        className="flex gap-3 p-3 rounded-lg border border-border/30 bg-muted/20 hover:bg-muted/40 transition-all text-left group"
                      >
                        {r.poster_path ? (
                          <img src={r.poster_path} alt={r.title} className="w-16 h-24 rounded object-cover shrink-0" loading="lazy" />
                        ) : (
                          <div className="w-16 h-24 rounded bg-muted flex items-center justify-center shrink-0">
                            <Film className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate group-hover:text-primary transition-colors">{r.title}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-[10px]">
                              {r.media_type === "movie" ? <Film className="h-3 w-3 mr-1" /> : <Tv className="h-3 w-3 mr-1" />}
                              {r.media_type === "movie" ? "Movie" : "TV Series"}
                            </Badge>
                            {r.release_date && <span>{r.release_date.substring(0, 4)}</span>}
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                            <span className="text-xs text-muted-foreground">{r.vote_average?.toFixed(1)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.overview}</p>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* STEP 2: Details */}
        {step === "details" && (
          <motion.div key="details" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
            {loadingDetails ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Fetching movie details from TMDb ({selectedLangConfig.label})...</span>
              </div>
            ) : selectedMovie && (
              <div className="space-y-6">
                {/* Hero Banner */}
                {selectedMovie.backdrop_url && (
                  <div className="relative rounded-xl overflow-hidden h-48 sm:h-64">
                    <img src={selectedMovie.backdrop_url} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4" dir={isRtl ? "rtl" : "ltr"}>
                      <h2 className="text-2xl font-bold text-foreground font-display">{selectedMovie.title}</h2>
                      {selectedMovie.tagline && <p className="text-sm text-muted-foreground italic">{selectedMovie.tagline}</p>}
                    </div>
                  </div>
                )}

                <div className="grid gap-6 lg:grid-cols-3">
                  {/* Main Info */}
                  <Card className="lg:col-span-2 border-border/50 bg-card/50 backdrop-blur-sm">
                    <CardContent className="pt-6 space-y-4" dir={isRtl ? "rtl" : "ltr"}>
                      <div className="flex flex-wrap gap-2">
                        {selectedMovie.genres.map((g) => (
                          <Badge key={g} variant="secondary">{g}</Badge>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Star className="h-4 w-4 text-yellow-500" />
                          <span>{selectedMovie.rating}/10</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>{selectedMovie.year || "N/A"}</span>
                        </div>
                        {selectedMovie.runtime && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>{selectedMovie.runtime} min</span>
                          </div>
                        )}
                        <Badge variant="outline" className="text-xs w-fit">{selectedMovie.status}</Badge>
                      </div>

                      {selectedMovie.number_of_seasons && (
                        <div className="flex gap-4 text-sm text-muted-foreground">
                          <span>{selectedMovie.number_of_seasons} Season{selectedMovie.number_of_seasons > 1 ? "s" : ""}</span>
                          {selectedMovie.number_of_episodes && (
                            <span>{selectedMovie.number_of_episodes} Episode{selectedMovie.number_of_episodes > 1 ? "s" : ""}</span>
                          )}
                        </div>
                      )}

                      <p className="text-sm text-muted-foreground leading-relaxed">{selectedMovie.overview}</p>

                      {/* Cast */}
                      {selectedMovie.cast.length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                            <Users className="h-4 w-4" /> Cast
                          </h3>
                          <div className="flex gap-3 overflow-x-auto pb-2">
                            {selectedMovie.cast.map((c, i) => (
                              <div key={i} className="text-center shrink-0 w-16">
                                {c.profile_path ? (
                                  <img src={c.profile_path} alt={c.name} className="w-14 h-14 rounded-full object-cover mx-auto" loading="lazy" />
                                ) : (
                                  <div className="w-14 h-14 rounded-full bg-muted mx-auto flex items-center justify-center">
                                    <Users className="h-5 w-5 text-muted-foreground" />
                                  </div>
                                )}
                                <p className="text-[10px] font-medium text-foreground mt-1 truncate">{c.name}</p>
                                <p className="text-[9px] text-muted-foreground truncate">{c.character}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Gallery */}
                      {selectedMovie.gallery_images.length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                            <ImageIcon className="h-4 w-4" /> Gallery ({selectedMovie.gallery_images.length})
                          </h3>
                          <div className="grid grid-cols-4 gap-2">
                            {selectedMovie.gallery_images.slice(0, 4).map((img, i) => (
                              <img key={i} src={img} alt="" className="rounded-lg object-cover h-20 w-full" loading="lazy" />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Streaming Providers */}
                      {hasProviders && (
                        <div className="space-y-3">
                          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                            <ExternalLink className="h-4 w-4" /> Available On
                          </h3>
                          {allProviders.flatrate.length > 0 && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Stream</p>
                              <div className="flex flex-wrap gap-2">
                                {allProviders.flatrate.map((p, i) => (
                                  <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/30 border border-border/30">
                                    {p.logo && <img src={p.logo} alt={p.name} className="w-5 h-5 rounded" />}
                                    <span className="text-xs text-foreground">{p.name}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {allProviders.rent.length > 0 && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Rent</p>
                              <div className="flex flex-wrap gap-2">
                                {allProviders.rent.map((p, i) => (
                                  <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/30 border border-border/30">
                                    {p.logo && <img src={p.logo} alt={p.name} className="w-5 h-5 rounded" />}
                                    <span className="text-xs text-foreground">{p.name}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {allProviders.buy.length > 0 && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Buy</p>
                              <div className="flex flex-wrap gap-2">
                                {allProviders.buy.map((p, i) => (
                                  <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/30 border border-border/30">
                                    {p.logo && <img src={p.logo} alt={p.name} className="w-5 h-5 rounded" />}
                                    <span className="text-xs text-foreground">{p.name}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {allProviders.link && (
                            <a href={allProviders.link} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1">
                              <ExternalLink className="h-3 w-3" /> View all streaming options on TMDb
                            </a>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Side Panel */}
                  <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                    <CardContent className="pt-6 space-y-4">
                      {selectedMovie.poster_url && (
                        <img src={selectedMovie.poster_url} alt={selectedMovie.title} className="rounded-lg w-full" loading="lazy" />
                      )}
                      {selectedMovie.trailer_url && (
                        <a href={selectedMovie.trailer_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-primary hover:underline">
                          <Play className="h-4 w-4" /> Watch Trailer
                        </a>
                      )}
                      <Button onClick={handleGenerate} disabled={generating} className="w-full gradient-brand text-primary-foreground">
                        {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                        {generating ? "AI Generating..." : `Generate AI Content (${selectedLangConfig.label})`}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* STEP 3: Review & Publish */}
        {step === "review" && selectedMovie && aiContent && (
          <motion.div key="review" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
            <div className="space-y-6">
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-primary" /> Review & Edit — {selectedMovie.title}
                    <Badge variant="outline" className="ml-2">{selectedLangConfig.flag} {selectedLangConfig.label}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* SEO Preview */}
                  {(aiContent.seo_title || aiContent.seo_description) && (
                    <div className="p-4 rounded-lg border border-border/30 bg-muted/10 space-y-1" dir={isRtl ? "rtl" : "ltr"}>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">SEO Preview</p>
                      <p className="text-primary text-base font-medium">{aiContent.seo_title}</p>
                      <p className="text-sm text-muted-foreground">{aiContent.seo_description}</p>
                    </div>
                  )}

                  {/* Translated Genres */}
                  {aiContent.translated_genres?.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-foreground">Genres ({selectedLangConfig.label})</Label>
                      <div className="flex flex-wrap gap-2" dir={isRtl ? "rtl" : "ltr"}>
                        {aiContent.translated_genres.map((g, i) => (
                          <Badge key={i} variant="secondary">{g}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Translated UI Labels */}
                  {aiContent.translated_labels && Object.keys(aiContent.translated_labels).length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-foreground">UI Labels ({selectedLangConfig.label})</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" dir={isRtl ? "rtl" : "ltr"}>
                        {Object.entries(aiContent.translated_labels).map(([key, val]) => (
                          <div key={key} className="p-2 rounded bg-muted/20 border border-border/20">
                            <p className="text-[10px] text-muted-foreground uppercase">{key}</p>
                            <p className="text-sm text-foreground">{val}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Primary Description */}
                  <div className="space-y-2">
                    <Label className="text-foreground">AI-Generated Description ({selectedLangConfig.label})</Label>
                    <Textarea
                      value={editableDesc}
                      onChange={(e) => setEditableDesc(e.target.value)}
                      className="min-h-[150px] border-border/50 bg-background/50"
                      dir={isRtl ? "rtl" : "ltr"}
                    />
                  </div>

                  {/* Extra Content Blocks */}
                  <div className="space-y-2">
                    <Label className="text-foreground flex items-center gap-2">
                      <Layers className="h-4 w-4" /> Additional Content (Images, Videos, Links)
                    </Label>
                    <p className="text-xs text-muted-foreground">Add extra content blocks that will be appended to the description.</p>
                    <ContentBlockEditor
                      blocks={extraBlocks}
                      onChange={setExtraBlocks}
                      isRtl={isRtl}
                    />
                  </div>

                  {/* Tags */}
                  <div className="space-y-2">
                    <Label className="text-foreground flex items-center gap-2">
                      <Tag className="h-4 w-4" /> Tags ({selectedLangConfig.label})
                    </Label>
                    <div className="flex flex-wrap gap-2" dir={isRtl ? "rtl" : "ltr"}>
                      {editableTags.map((tag, i) => (
                        <Badge key={i} variant="secondary" className="gap-1">
                          {tag}
                          <button onClick={() => removeTag(i)} className="hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                      <Input
                        placeholder="Add tag..."
                        className="w-32 h-6 text-xs border-border/50 bg-background/50"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            addTag((e.target as HTMLInputElement).value.trim());
                            (e.target as HTMLInputElement).value = "";
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Multi-language Translations */}
                  {Object.keys(aiContent.translations).length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-foreground flex items-center gap-2">
                        <Globe className="h-4 w-4" /> Other Translations
                      </Label>
                      <Tabs defaultValue={Object.keys(aiContent.translations)[0]} className="w-full">
                        <TabsList className="flex flex-wrap gap-1 h-auto bg-muted/30">
                          {Object.keys(aiContent.translations).map((lang) => {
                            const lc = LANGUAGES.find((l) => l.code === lang);
                            return (
                              <TabsTrigger key={lang} value={lang} className="text-xs px-2 py-1">
                                {lc?.flag} {lang.toUpperCase()}
                              </TabsTrigger>
                            );
                          })}
                        </TabsList>
                        {Object.entries(aiContent.translations).map(([lang, text]) => {
                          const lc = LANGUAGES.find((l) => l.code === lang);
                          return (
                            <TabsContent key={lang} value={lang}>
                              <div className="p-3 rounded-lg bg-muted/20 border border-border/30 text-sm text-muted-foreground leading-relaxed" dir={lc?.dir || "ltr"}>
                                {text}
                              </div>
                            </TabsContent>
                          );
                        })}
                      </Tabs>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Publish Actions */}
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button onClick={() => handlePublish("movies")} disabled={publishing} className="flex-1 gradient-brand text-primary-foreground">
                      {publishing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                      Publish as Movie
                    </Button>
                    {selectedMovie.media_type === "tv" && (
                      <Button onClick={() => handlePublish("series")} disabled={publishing} variant="outline" className="flex-1">
                        <Tv className="h-4 w-4 mr-2" />
                        Publish as Series
                      </Button>
                    )}
                    <Button onClick={() => handlePublish("anime")} disabled={publishing} variant="outline" className="flex-1">
                      <Send className="h-4 w-4 mr-2" />
                      Publish as Anime
                    </Button>
                    <Button variant="ghost" onClick={() => setStep("details")} className="flex-1">
                      Back to Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
