import { useState, useMemo } from "react";
import { translations, LANGUAGES, Language } from "@/i18n/translations";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Languages, Globe } from "lucide-react";

export default function AdminTranslations() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const keys = Object.keys(translations.en) as (keyof typeof translations.en)[];

  const categories = useMemo(() => {
    const cats = new Set<string>();
    keys.forEach((k) => cats.add(k.split(".")[0]));
    return Array.from(cats).sort();
  }, []);

  const filtered = keys.filter((key) => {
    const matchesCat = categoryFilter === "all" || key.startsWith(categoryFilter + ".");
    const matchesSearch =
      !search ||
      key.toLowerCase().includes(search.toLowerCase()) ||
      translations.en[key].toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gradient-brand font-display flex items-center gap-2">
          <Languages className="h-7 w-7" /> Translations Manager
        </h1>
        <p className="text-muted-foreground mt-1">
          {LANGUAGES.length} languages • {keys.length} translation keys
        </p>
      </div>

      {/* Language Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {LANGUAGES.map((lang) => {
          const langKeys = Object.keys(translations[lang.code]);
          const coverage = Math.round((langKeys.length / keys.length) * 100);
          return (
            <Card key={lang.code} className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="p-3 text-center">
                <span className="text-2xl">{lang.flag}</span>
                <p className="text-sm font-medium text-foreground mt-1">{lang.label}</p>
                <Badge variant={coverage === 100 ? "default" : "secondary"} className="text-xs mt-1">
                  {coverage}%
                </Badge>
                {lang.dir === "rtl" && (
                  <Badge variant="outline" className="text-[10px] ml-1">RTL</Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search translation keys or values..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-background/50 border-border/50"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px] bg-background/50 border-border/50">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat} className="capitalize">
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Translations Table */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead className="text-muted-foreground min-w-[180px] sticky left-0 bg-card/95 z-10">Key</TableHead>
                  {LANGUAGES.map((lang) => (
                    <TableHead key={lang.code} className="text-muted-foreground min-w-[200px]">
                      <span className="flex items-center gap-1.5">
                        <span>{lang.flag}</span>
                        <span>{lang.label}</span>
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 50).map((key) => (
                  <TableRow key={key} className="border-border/50">
                    <TableCell className="font-mono text-xs text-muted-foreground sticky left-0 bg-card/95 z-10">
                      {key}
                    </TableCell>
                    {LANGUAGES.map((lang) => {
                      const value = (translations[lang.code] as any)?.[key];
                      return (
                        <TableCell
                          key={lang.code}
                          className={`text-sm ${value ? "text-foreground" : "text-destructive/50 italic"}`}
                          dir={lang.dir}
                        >
                          {value || "—"}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={LANGUAGES.length + 1} className="text-center py-8 text-muted-foreground">
                      No translation keys found.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.length > 50 && (
                  <TableRow>
                    <TableCell colSpan={LANGUAGES.length + 1} className="text-center py-4 text-muted-foreground text-sm">
                      Showing 50 of {filtered.length} keys. Use search to narrow down.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
