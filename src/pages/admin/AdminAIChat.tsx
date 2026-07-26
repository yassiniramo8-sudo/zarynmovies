import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Send, Bot, User, Loader2, Sparkles, Shield, Activity, AlertTriangle, CheckCircle, Settings2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface SiteLog {
  id: string;
  log_type: string;
  category: string;
  title: string;
  description: string | null;
  auto_fixed: boolean;
  created_at: string;
}

const SUGGESTED_PROMPTS_EN = [
  "Analyze website performance and suggest optimizations",
  "Check database health and query performance",
  "Show content statistics and trending analysis",
  "Suggest SEO improvements for better visibility",
  "Review security and recommend improvements",
  "Analyze user engagement patterns",
];

const SUGGESTED_PROMPTS_AR = [
  "تحليل أداء الموقع واقتراح تحسينات",
  "فحص صحة قاعدة البيانات وأداء الاستعلامات",
  "عرض إحصائيات المحتوى وتحليل الاتجاهات",
  "اقتراح تحسينات SEO لرؤية أفضل",
  "مراجعة الأمان وتقديم توصيات",
  "تحليل أنماط تفاعل المستخدمين",
];

export default function AdminAIChat() {
  const { language } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [aiAutoFix, setAiAutoFix] = useState(false);
  const [aiMonitoring, setAiMonitoring] = useState(true);
  const [siteLogs, setSiteLogs] = useState<SiteLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const suggestedPrompts = language === "ar" ? SUGGESTED_PROMPTS_AR : SUGGESTED_PROMPTS_EN;

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch AI settings
  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("key, value")
        .in("key", ["ai_auto_fix_enabled", "ai_monitoring_enabled"]);
      (data || []).forEach((s: any) => {
        if (s.key === "ai_auto_fix_enabled") setAiAutoFix(s.value === "true");
        if (s.key === "ai_monitoring_enabled") setAiMonitoring(s.value === "true");
      });
    };
    fetchSettings();
  }, []);

  // Fetch site logs
  useEffect(() => {
    const fetchLogs = async () => {
      setLogsLoading(true);
      const { data } = await supabase
        .from("ai_site_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      setSiteLogs((data || []) as SiteLog[]);
      setLogsLoading(false);
    };
    fetchLogs();
  }, []);

  const toggleSetting = async (key: string, value: boolean, setter: (v: boolean) => void) => {
    setter(value);
    await supabase
      .from("site_settings")
      .upsert({ key, value: value ? "true" : "false", updated_at: new Date().toISOString() }, { onConflict: "key" });
  };

  const clearLogs = async () => {
    await supabase.from("ai_site_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    setSiteLogs([]);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    let assistantContent = "";

    const updateAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantContent } : m));
        }
        return [...prev, { role: "assistant", content: assistantContent }];
      });
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-admin-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ message: text.trim() }),
        }
      );

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: "Failed" }));
        updateAssistant(`❌ Error: ${err.error || "Failed to get response"}`);
        setIsLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) updateAssistant(content);
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e) {
      updateAssistant(`❌ Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    }

    setIsLoading(false);
  };

  const logTypeIcon = (type: string) => {
    switch (type) {
      case "error": return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case "warning": return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "success": return <CheckCircle className="h-4 w-4 text-green-500" />;
      default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gradient-brand font-display flex items-center gap-2">
          <Sparkles className="h-8 w-8" /> AI Control Center
        </h1>
        <p className="text-muted-foreground mt-1">
          {language === "ar"
            ? "تحدث مع الذكاء الاصطناعي لتحليل موقعك وتشخيص المشكلات واقتراح التحسينات"
            : "Ask AI to analyze your website, diagnose issues, and suggest optimizations"}
        </p>
      </div>

      <Tabs defaultValue="chat">
        <TabsList>
          <TabsTrigger value="chat" className="gap-1"><Bot className="h-4 w-4" /> Chat</TabsTrigger>
          <TabsTrigger value="logs" className="gap-1"><Activity className="h-4 w-4" /> Logs</TabsTrigger>
          <TabsTrigger value="settings" className="gap-1"><Settings2 className="h-4 w-4" /> Controls</TabsTrigger>
        </TabsList>

        {/* Chat Tab */}
        <TabsContent value="chat">
          {messages.length === 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
              {suggestedPrompts.map((prompt) => (
                <Card
                  key={prompt}
                  className="border-border/50 bg-card/50 hover:bg-card/80 cursor-pointer transition-colors"
                  onClick={() => sendMessage(prompt)}
                >
                  <CardContent className="p-4">
                    <p className="text-sm text-foreground">{prompt}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-0">
              <ScrollArea className="h-[500px] p-4">
                <div className="space-y-4">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                      {msg.role === "assistant" && (
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="bg-primary/20 text-primary"><Bot className="h-4 w-4" /></AvatarFallback>
                        </Avatar>
                      )}
                      <div
                        className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/50 text-foreground"
                        }`}
                      >
                        {msg.role === "assistant" ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none break-words [&_pre]:overflow-x-auto [&_code]:text-xs">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                        )}
                      </div>
                      {msg.role === "user" && (
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="bg-secondary"><User className="h-4 w-4" /></AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))}
                  {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                    <div className="flex gap-3">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="bg-primary/20 text-primary"><Bot className="h-4 w-4" /></AvatarFallback>
                      </Avatar>
                      <div className="rounded-xl bg-muted/50 px-4 py-3">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      </div>
                    </div>
                  )}
                  <div ref={scrollRef} />
                </div>
              </ScrollArea>

              <div className="border-t border-border/50 p-4">
                <div className="flex gap-2">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={language === "ar" ? "اسأل الذكاء الاصطناعي عن موقعك..." : "Ask AI about your website..."}
                    className="flex-1 border-border/50 bg-background/50 min-h-[44px] max-h-[120px]"
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
                    }}
                  />
                  <Button
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim() || isLoading}
                    className="gradient-brand text-primary-foreground self-end"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">AI Site Monitoring Logs</CardTitle>
              <Button variant="ghost" size="sm" onClick={clearLogs}><Trash2 className="h-4 w-4 mr-1" /> Clear</Button>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : siteLogs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No logs yet. AI monitoring is active.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">Type</TableHead>
                        <TableHead>Issue</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {siteLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>{logTypeIcon(log.log_type)}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-foreground text-sm">{log.title}</p>
                              {log.description && <p className="text-xs text-muted-foreground mt-0.5">{log.description}</p>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs capitalize">{log.category}</Badge>
                          </TableCell>
                          <TableCell>
                            {log.auto_fixed ? (
                              <Badge className="bg-green-500/10 text-green-500 text-xs">Auto-fixed</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">Pending</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Controls Tab */}
        <TabsContent value="settings">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" /> AI Auto-Fix
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  When enabled, AI will automatically attempt to fix detected issues like broken links, missing images, and layout inconsistencies.
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Enable Auto-Fix</span>
                  <Switch
                    checked={aiAutoFix}
                    onCheckedChange={(v) => toggleSetting("ai_auto_fix_enabled", v, setAiAutoFix)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" /> AI Monitoring
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Continuously monitors site health, performance metrics, and user activity. Alerts are generated for anomalies.
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Enable Monitoring</span>
                  <Switch
                    checked={aiMonitoring}
                    onCheckedChange={(v) => toggleSetting("ai_monitoring_enabled", v, setAiMonitoring)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur-sm md:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm font-medium">AI Capabilities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    { title: "Multi-language Support", desc: "Understands Arabic, English, French & more", active: true },
                    { title: "Performance Analysis", desc: "Database queries, page load, caching", active: true },
                    { title: "SEO Optimization", desc: "Meta tags, sitemap, structured data", active: true },
                    { title: "Security Audit", desc: "RLS policies, auth flow, vulnerability scan", active: true },
                    { title: "Content Recommendations", desc: "Trending analysis, engagement insights", active: true },
                    { title: "Error Detection", desc: "Broken links, missing content, layout issues", active: aiMonitoring },
                  ].map((cap) => (
                    <div key={cap.title} className="rounded-lg border border-border/50 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-foreground">{cap.title}</span>
                        <Badge variant={cap.active ? "default" : "secondary"} className="text-xs">
                          {cap.active ? "Active" : "Off"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{cap.desc}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
