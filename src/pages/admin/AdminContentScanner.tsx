import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Search, Film, Tv, Star, Calendar, Plus, Eye, Radar } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

type Suggestion = {
  type: string;
  tmdb_id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_url: string | null;
  backdrop_url: string | null;
  release_date: string;
  rating: number;
  popularity: number;
};

export default function AdminContentScanner() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanType, setScanType] = useState("all");
  const [filter, setFilter] = useState("all");

  const handleScan = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-content-scanner", {
        body: { type: scanType },
      });
      if (error) throw error;
      setSuggestions(data.suggestions || []);
      toast.success(`Found ${data.count} new content suggestions!`);
    } catch (err: any) {
      toast.error(err.message || "Scan failed");
    } finally {
      setLoading(false);
    }
  };

  const handleAddMovie = async (item: Suggestion) => {
    try {
      if (item.type === "movie") {
        const { error } = await supabase.from("movies").insert({
          title: item.title,
          description: item.overview,
          poster_url: item.poster_url,
          rating: Math.round((item.rating || 0) * 10) / 10,
          year: item.release_date ? parseInt(item.release_date.substring(0, 4)) : null,
        });
        if (error) throw error;
      } else if (item.type === "series") {
        const { error } = await supabase.from("series").insert({
          title: item.title,
          description: item.overview,
          poster_url: item.poster_url,
          rating: Math.round((item.rating || 0) * 10) / 10,
          year: item.release_date ? parseInt(item.release_date.substring(0, 4)) : null,
        });
        if (error) throw error;
      } else if (item.type === "anime") {
        const { error } = await supabase.from("anime").insert({
          title: item.title,
          description: item.overview,
          poster_url: item.poster_url,
          rating: Math.round((item.rating || 0) * 10) / 10,
          year: item.release_date ? parseInt(item.release_date.substring(0, 4)) : null,
        });
        if (error) throw error;
      }
      toast.success(`"${item.title}" added successfully!`);
      setSuggestions(prev => prev.filter(s => s.tmdb_id !== item.tmdb_id));
    } catch (err: any) {
      toast.error(err.message || "Failed to add");
    }
  };

  const filtered = filter === "all" ? suggestions : suggestions.filter(s => s.type === filter);
  const typeIcon = (type: string) => type === "movie" ? <Film className="h-3 w-3" /> : <Tv className="h-3 w-3" />;
  const typeColor = (type: string) => type === "movie" ? "default" : type === "series" ? "secondary" : "outline";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gradient-brand font-display">AI Content Scanner</h1>
        <p className="text-muted-foreground mt-1">Automatically discover trending movies, series, and anime not yet on your site</p>
      </div>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Radar className="h-4 w-4 text-primary" /> Scan Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Content Type</label>
            <Select value={scanType} onValueChange={setScanType}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="movies">Movies Only</SelectItem>
                <SelectItem value="tv">TV Series Only</SelectItem>
                <SelectItem value="anime">Anime Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleScan} disabled={loading} className="gradient-brand text-primary-foreground gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {loading ? "Scanning..." : "Scan for New Content"}
          </Button>
        </CardContent>
      </Card>

      {suggestions.length > 0 && (
        <>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{suggestions.length} suggestions</Badge>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="movie">Movies</SelectItem>
                <SelectItem value="series">Series</SelectItem>
                <SelectItem value="anime">Anime</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="h-[600px]">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map(item => (
                <Card key={`${item.type}-${item.tmdb_id}`} className="overflow-hidden border-border/50 bg-card/50">
                  {item.poster_url && (
                    <img src={item.poster_url} alt={item.title} className="h-48 w-full object-cover" />
                  )}
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant={typeColor(item.type)} className="gap-1 text-xs">
                        {typeIcon(item.type)} {item.type}
                      </Badge>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                        {item.rating?.toFixed(1)}
                      </div>
                    </div>
                    <h3 className="font-semibold text-sm line-clamp-1">{item.title}</h3>
                    {item.original_title !== item.title && (
                      <p className="text-xs text-muted-foreground">{item.original_title}</p>
                    )}
                    <p className="text-xs text-muted-foreground line-clamp-3">{item.overview}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" /> {item.release_date || "TBA"}
                    </div>
                    <Button size="sm" className="w-full gap-1 mt-2" onClick={() => handleAddMovie(item)}>
                      <Plus className="h-3 w-3" /> Add to Site
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </>
      )}

      {!loading && suggestions.length === 0 && (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="py-12 text-center">
            <Radar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Click "Scan for New Content" to discover trending content not yet on your site.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
