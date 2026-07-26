import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Send, CheckCircle2, Mail, MessageSquare, Loader2 } from "lucide-react";

export default function ContactPage() {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const [name, setName] = useState(profile?.username || "");
  const [email, setEmail] = useState(user?.email || "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid email");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("contact_messages" as any).insert({
      name: name.trim(),
      email: email.trim(),
      subject: subject.trim(),
      message: message.trim(),
      user_id: user?.id || null,
    } as any);
    setSubmitting(false);
    if (error) {
      toast.error("Failed to send message. Please try again.");
      return;
    }
    setSubmitted(true);
    toast.success("Message sent successfully!");
  };

  if (submitted) {
    return (
      <div className="min-h-screen pt-24 pb-16 px-4 flex items-center justify-center">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-4">
          <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
          <h2 className="text-2xl font-bold text-foreground font-display">Thank You!</h2>
          <p className="text-muted-foreground max-w-md">Your message has been sent successfully. We'll get back to you as soon as possible.</p>
          <Button onClick={() => { setSubmitted(false); setSubject(""); setMessage(""); }} variant="outline" className="border-primary/50 text-primary">
            Send Another Message
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <Mail className="h-8 w-8 text-primary" />
            <h1 className="text-3xl md:text-4xl font-bold font-display text-gradient-brand">Contact Us</h1>
          </div>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Have a question, suggestion, or issue? Send us a message and we'll respond as soon as possible.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" maxLength={100} className="border-border/50 bg-background/50" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" maxLength={255} className="border-border/50 bg-background/50" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input id="subject" value={subject} onChange={e => setSubject(e.target.value)} placeholder="What is this about?" maxLength={200} className="border-border/50 bg-background/50" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea id="message" value={message} onChange={e => setMessage(e.target.value)} placeholder="Describe your issue, suggestion, or message..." rows={6} maxLength={2000} className="border-border/50 bg-background/50 resize-none" />
                  <p className="text-xs text-muted-foreground text-right">{message.length}/2000</p>
                </div>
                <Button type="submit" disabled={submitting} className="w-full gradient-brand text-primary-foreground">
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  {submitting ? "Sending..." : "Send Message"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {/* Social links from site settings */}
        <SocialLinks />
      </div>
    </div>
  );
}

function SocialLinks() {
  const [links, setLinks] = useState<{ platform: string; url: string }[]>([]);
  
  useEffect(() => {
    supabase.from("site_settings").select("value").eq("key", "social_links").single().then(({ data }) => {
      if (data?.value) {
        try { setLinks(JSON.parse(data.value)); } catch {}
      }
    });
  }, []);

  if (links.length === 0) return null;

  return (
    <div className="text-center space-y-3">
      <p className="text-sm text-muted-foreground">Or reach us on social media</p>
      <div className="flex justify-center gap-3 flex-wrap">
        {links.map((l, i) => (
          <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-lg border border-border/50 bg-card/50 text-sm text-foreground hover:border-primary/50 transition-colors">
            {l.platform}
          </a>
        ))}
      </div>
    </div>
  );
}
