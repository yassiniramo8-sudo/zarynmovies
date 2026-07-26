import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useVipStatus } from "@/hooks/useVip";
import { VipBadge } from "@/components/VipBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Crown, Upload, CheckCircle2, Loader2, Clock, Ban as BanIcon, Star, Shield, Zap, Gift, Eye, Sparkles, Heart, Award, Gem, CreditCard } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { CardPaymentForm, type CardData } from "@/components/CardPaymentForm";

export default function SubscribePage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { isVip, subscription } = useVipStatus();
  const [plans, setPlans] = useState<any[]>([]);
  const [methods, setMethods] = useState<any[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<any>(null);
  const [proofUrl, setProofUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [useCardPayment, setUseCardPayment] = useState(false);
  const [cardData, setCardData] = useState<CardData | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetch = async () => {
      const [plansRes, methodsRes] = await Promise.all([
        supabase.from("subscription_plans").select("*").eq("active", true).order("sort_order"),
        supabase.from("payment_methods").select("*").eq("active", true).order("sort_order"),
      ]);
      setPlans(plansRes.data || []);
      setMethods(methodsRes.data || []);
      if (user) {
        const { data } = await supabase.from("subscription_requests").select("*, plan:subscription_plans(name)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5);
        setMyRequests(data || []);
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  const handleSelectPlan = (plan: any) => {
    if (!user) { toast.error("Please sign in first"); return; }
    setSelectedPlan(plan);
    setSelectedMethod(null);
    setProofUrl("");
    setUseCardPayment(false);
    setCardData(null);
    setPaymentDialog(true);
  };

  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const path = `payment-proofs/${user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("content").upload(path, file);
    if (error) { toast.error("Upload failed"); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("content").getPublicUrl(path);
    setProofUrl(publicUrl);
    setUploading(false);
  };

  const handleSubmit = async () => {
    if (!user || !selectedPlan || !selectedMethod) return;
    if (!useCardPayment && !proofUrl) { toast.error("Please upload payment proof"); return; }
    if (useCardPayment && !cardData) { toast.error("Please fill in all card details"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("subscription_requests").insert({
      user_id: user.id,
      plan_id: selectedPlan.id,
      payment_method_id: selectedMethod.id,
      proof_url: useCardPayment ? `card:${cardData!.cardType}:****${cardData!.cardNumber.slice(-4)}` : proofUrl,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(useCardPayment ? "Card payment submitted for processing!" : "Request submitted! We'll review it shortly.");
    setPaymentDialog(false);
    // Refresh requests
    const { data } = await supabase.from("subscription_requests").select("*, plan:subscription_plans(name)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5);
    setMyRequests(data || []);
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-5xl mx-auto space-y-10">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <Crown className="h-10 w-10 text-amber-400" />
            <h1 className="text-4xl md:text-5xl font-bold font-display text-gradient-brand">VIP Membership</h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Enjoy ad-free browsing, exclusive content access, and a VIP badge on your profile.
          </p>
        </motion.div>

        {/* Current VIP Status */}
        {isVip && subscription && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card className="border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-yellow-500/10 backdrop-blur-sm">
              <CardContent className="p-6 flex items-center gap-4">
                <Crown className="h-8 w-8 text-amber-400" />
                <div className="flex-1">
                  <h3 className="font-bold text-foreground flex items-center gap-2">You're a VIP! <VipBadge size="md" /></h3>
                  <p className="text-sm text-muted-foreground">
                    Plan: {subscription.plan?.name} • Expires: {new Date(subscription.expires_at).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Plans */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan, i) => (
            <motion.div key={plan.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all h-full flex flex-col">
                <CardContent className="p-6 flex-1 flex flex-col">
                  <h3 className="text-xl font-bold text-foreground font-display">{plan.name}</h3>
                  <div className="mt-2 mb-4">
                    <span className="text-3xl font-bold text-primary">{plan.price}</span>
                    <span className="text-muted-foreground ml-1">{plan.currency}</span>
                    <span className="text-muted-foreground text-sm ml-2">/ {plan.duration_days} days</span>
                  </div>
                  {(() => {
                    const planFeatures = Array.isArray(plan.features) && plan.features.length > 0
                      ? plan.features
                      : [
                          { text: "Ad-free browsing", icon: "CheckCircle2", color: "#22c55e" },
                          { text: "No AdBlock restrictions", icon: "CheckCircle2", color: "#22c55e" },
                          { text: "VIP badge on profile", icon: "CheckCircle2", color: "#22c55e" },
                          { text: "VIP badge in comments", icon: "CheckCircle2", color: "#22c55e" },
                        ];
                    const iconMap: Record<string, any> = { CheckCircle2, Star, Shield, Zap, Gift, Eye, Ban: BanIcon, Crown, Sparkles, Heart, Award, Gem };
                    return (
                      <ul className="text-sm text-muted-foreground space-y-1.5 mb-6">
                        {planFeatures.map((f: any, fi: number) => {
                          const Icon = iconMap[f.icon] || CheckCircle2;
                          return (
                            <li key={fi} className="flex items-center gap-2">
                              <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: f.color || "#22c55e" }} />
                              {f.text}
                            </li>
                          );
                        })}
                      </ul>
                    );
                  })()}
                  <Button onClick={() => handleSelectPlan(plan)} className="w-full gradient-brand text-primary-foreground mt-auto">
                    <Crown className="mr-1 h-4 w-4" /> Subscribe
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {plans.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">No subscription plans available yet.</div>
          )}
        </div>

        {/* My Requests */}
        {user && myRequests.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xl font-bold text-foreground font-display">My Requests</h2>
            <div className="space-y-2">
              {myRequests.map(r => (
                <Card key={r.id} className="border-border/50 bg-card/50">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{r.plan?.name}</p>
                      <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
                    </div>
                    <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"} className="capitalize text-xs">
                      {r.status === "pending" && <Clock className="mr-1 h-3 w-3" />}
                      {r.status}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {!user && (
          <div className="text-center">
            <Link to="/auth">
              <Button variant="outline" className="border-primary/50 text-primary">Sign in to subscribe</Button>
            </Link>
          </div>
        )}
      </div>

      {/* Payment Dialog */}
      <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
        <DialogContent className="border-border/50 bg-card/95 backdrop-blur-xl max-w-lg">
          <DialogHeader><DialogTitle>Complete Payment — {selectedPlan?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="rounded-lg border border-border/50 bg-background/30 p-3 text-sm">
              <p className="text-foreground font-medium">Amount: {selectedPlan?.price} {selectedPlan?.currency}</p>
              <p className="text-muted-foreground">Duration: {selectedPlan?.duration_days} days</p>
            </div>

            <div className="space-y-2">
              <Label>Select Payment Method</Label>
              {/* Card Payment Option */}
              <button
                onClick={() => { setUseCardPayment(true); setSelectedMethod(methods[0] || null); }}
                className={`w-full text-left rounded-lg border p-3 transition-all flex items-center gap-3 ${
                  useCardPayment ? "border-primary bg-primary/10" : "border-border/50 bg-background/30 hover:border-primary/50"
                }`}
              >
                <CreditCard className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="font-medium text-foreground">Credit / Debit Card</p>
                  <p className="text-xs text-muted-foreground">Visa, MasterCard — Secure payment</p>
                </div>
              </button>
              {/* Other payment methods */}
              {methods.map(m => (
                <button
                  key={m.id}
                  onClick={() => { setUseCardPayment(false); setSelectedMethod(m); }}
                  className={`w-full text-left rounded-lg border p-3 transition-all ${
                    !useCardPayment && selectedMethod?.id === m.id ? "border-primary bg-primary/10" : "border-border/50 bg-background/30 hover:border-primary/50"
                  }`}
                >
                  <p className="font-medium text-foreground">{m.name}</p>
                  {m.wallet_info && <p className="text-xs text-muted-foreground mt-0.5 font-mono">{m.wallet_info}</p>}
                </button>
              ))}
            </div>

            {/* Card Payment Form */}
            {useCardPayment && (
              <CardPaymentForm onCardDataChange={setCardData} />
            )}

            {/* Manual payment details */}
            {!useCardPayment && selectedMethod && (
              <>
                {selectedMethod.instructions && (
                  <div className="rounded-lg border border-border/50 bg-background/30 p-3">
                    <Label className="text-xs text-muted-foreground">Payment Instructions</Label>
                    <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{selectedMethod.instructions}</p>
                  </div>
                )}
                {selectedMethod.qr_image_url && (
                  <div className="flex justify-center">
                    <img src={selectedMethod.qr_image_url} alt="QR" className="h-32 w-32 rounded-lg border border-border/50 object-contain" />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>Upload Payment Proof</Label>
                  <div className="flex items-center gap-3">
                    {proofUrl && <img src={proofUrl} alt="Proof" className="h-16 w-16 rounded-lg border border-border/50 object-cover" />}
                    <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="border-border/50">
                      <Upload className="mr-1 h-4 w-4" /> {uploading ? "Uploading..." : "Upload Screenshot"}
                    </Button>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleProofUpload} />
                  </div>
                </div>
              </>
            )}

            <Button
              onClick={handleSubmit}
              disabled={!selectedMethod || (!useCardPayment && !proofUrl) || (useCardPayment && !cardData) || submitting}
              className="w-full gradient-brand text-primary-foreground"
            >
              {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : useCardPayment ? <CreditCard className="mr-1 h-4 w-4" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
              {useCardPayment ? "Pay Now" : "Submit Request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
