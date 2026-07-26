import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { zarynToast } from "@/components/ZarynToast";
import { motion } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, User } from "lucide-react";

const AuthPage = () => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const getErrorMessage = (error: any): string => {
    const msg = error?.message?.toLowerCase() || "";
    if (msg.includes("invalid login") || msg.includes("invalid_credentials")) {
      return t("auth.invalidCredentials") || "Incorrect email or password. Please try again.";
    }
    if (msg.includes("email not confirmed")) {
      return t("auth.emailNotConfirmed") || "Please verify your email before signing in.";
    }
    if (msg.includes("user already registered")) {
      return t("auth.userExists") || "An account with this email already exists.";
    }
    if (msg.includes("rate limit") || msg.includes("too many")) {
      return t("auth.tooManyAttempts") || "Too many attempts. Please wait a moment and try again.";
    }
    return error?.message || "An unexpected error occurred. Please try again.";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await signIn(email, password);
        if (error) throw error;
        zarynToast({ title: t("toast.welcomeBack"), type: "success", message: t("auth.loginSuccess") || "You have been signed in successfully." });
        navigate("/");
      } else if (mode === "signup") {
        if (!username.trim()) {
          zarynToast({ title: t("auth.error") || "Error", message: t("admin.titleRequired"), type: "warning" });
          setLoading(false);
          return;
        }
        const { error } = await signUp(email, password, username);
        if (error) throw error;
        zarynToast({ title: t("auth.accountCreated") || "Account Created", message: t("toast.checkEmail"), type: "success", duration: 8000 });
      }
    } catch (err: any) {
      zarynToast({
        title: mode === "login" ? (t("auth.loginFailed") || "Login Failed") : (t("auth.signupFailed") || "Sign Up Failed"),
        message: getErrorMessage(err),
        type: "error",
        duration: 7000,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-md">
        <Card className="border-border/50 bg-card/50 backdrop-blur-xl">
          <CardHeader className="text-center">
            <CardTitle className="font-display text-3xl font-bold text-gradient-brand">
              {mode === "login" ? t("auth.welcomeBack") : t("auth.createAccount")}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {mode === "login" ? t("auth.signInDesc") : t("auth.signUpDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-foreground">{t("auth.username")}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t("auth.chooseUsername")} className="pl-10 border-border/50 bg-background/50" required />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">{t("auth.email")}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="pl-10 border-border/50 bg-background/50" required />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground">{t("auth.password")}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pl-10 pr-10 border-border/50 bg-background/50" required minLength={6} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full gradient-brand text-primary-foreground" disabled={loading}>
                {loading ? t("auth.loading") : mode === "login" ? t("auth.signIn") : t("auth.signUp")}
              </Button>
            </form>

            <div className="mt-6 space-y-2 text-center text-sm">
              {mode === "login" && (
                <p className="text-muted-foreground">
                  {t("auth.noAccount")}{" "}
                  <button onClick={() => setMode("signup")} className="text-primary hover:underline">{t("auth.signUp")}</button>
                </p>
              )}
              {mode === "signup" && (
                <p className="text-muted-foreground">
                  {t("auth.hasAccount")}{" "}
                  <button onClick={() => setMode("login")} className="text-primary hover:underline">{t("auth.signIn")}</button>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default AuthPage;
