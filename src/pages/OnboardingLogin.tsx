import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Lock, LogIn } from "lucide-react";
import { PasswordChangePrompt } from "@/components/PasswordChangePrompt";

export default function OnboardingLogin() {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { email?: string; type?: "own" | "lease" } };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      if (!data.user) throw new Error("No user data returned");

      const requiresPasswordChange = data.user?.user_metadata?.requires_password_change;
      if (requiresPasswordChange) {
        setShowPasswordChange(true);
        setIsLoading(false);
        return;
      }

      // Check user role to ensure they're an onboarding user
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);

      let hasOnboardingRole = roles?.some(r => r.role === "onboarding");
      
      // If user doesn't have onboarding role but is new, assign it
      // This handles the case where account was created but role wasn't assigned yet
      if (!hasOnboardingRole) {
        const { error: assignError } = await supabase.rpc("assign_user_role", {
          p_user_id: data.user.id,
          p_role: "onboarding",
        });
        
        if (!assignError) {
          hasOnboardingRole = true;
        } else {
          // If they're not an onboarding user and we can't assign the role, deny access
          toast({ 
            title: "Access denied", 
            description: "This login is only for onboarding applicants",
            variant: "destructive"
          });
          setIsLoading(false);
          return;
        }
      }

      // Check for existing onboarding session
      const { data: session } = await supabase
        .from("onboarding_sessions")
        .select("*")
        .eq("user_id", data.user.id)
        .maybeSingle();

      toast({ title: "Welcome back!" });
      
      // If there's a saved session, redirect to onboarding page with auto-load
      if (session) {
        navigate("/onboarding?autoload=true");
      } else {
        // No saved session: if a type and names were passed, create a starter session to prefill
        const selType = location?.state?.type as ("own" | "lease" | undefined);
        const first_name = (location?.state as any)?.first_name || (data.user.user_metadata as any)?.first_name || null;
        const surname = (location?.state as any)?.surname || (data.user.user_metadata as any)?.surname || null;

        if (selType) {
          try {
            await supabase.functions.invoke("upsert-onboarding-session", {
              body: {
                email: data.user.email,
                fullName: [first_name, surname].filter(Boolean).join(" ") || null,
                ownershipType: selType,
                current_step: 1,
                data: {
                  first_name: first_name || null,
                  surname: surname || null,
                },
              },
            });
          } catch (e) {
            // non-fatal: continue navigation even if prefill fails
          }
          navigate(`/onboarding?autoload=true&type=${selType}`);
        } else {
          navigate("/onboarding");
        }
      }
    } catch (error: any) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChangeComplete = async () => {
    setShowPasswordChange(false);
    
    // Sign out the user
    await supabase.auth.signOut();
    
    toast({ 
      title: "Password updated", 
      description: "Please sign in again with your new password." 
    });
    
    // Redirect to onboarding login page
    navigate("/onboarding-login");
  };

  return (
    <>
      <PasswordChangePrompt open={showPasswordChange} onComplete={handlePasswordChangeComplete} />
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/20 to-background p-4 relative overflow-hidden">
        <div className="w-full max-w-md relative z-10 animate-fade-in">
          <div className="bg-card rounded-2xl shadow-modern-lg p-8 border-2 border-border">
            <div className="flex items-center justify-center mb-8 animate-slide-up">
              <div className="p-4 rounded-2xl bg-primary/10">
                <img 
                  src="/logo.png" 
                  alt="DSP Logo" 
                  className="h-24 w-auto"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              </div>
            </div>

            <div className="text-center mb-8 animate-slide-up">
              <h1 className="text-4xl font-bold mb-3 text-foreground">Continue Application</h1>
              <p className="text-muted-foreground text-base font-medium">
                Log in with your email and password to resume your onboarding.
              </p>
            </div>
            
            <div className="mb-6 p-4 bg-muted/50 rounded-xl border border-muted">
              <p className="text-base text-muted-foreground text-center font-medium">
                Forgot your password? Use the password reset link sent to your email.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5 animate-slide-up">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-base font-semibold text-foreground">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 text-base font-medium bg-background border-2 border-border focus:ring-2 focus:ring-primary transition-all"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-base font-semibold text-foreground">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 text-base font-medium bg-background border-2 border-border focus:ring-2 focus:ring-primary transition-all"
                />
              </div>

              <Button type="submit" className="w-full h-12 text-base font-bold shadow-modern hover:shadow-modern-lg transition-all duration-200 bg-primary hover:bg-primary/90" disabled={isLoading}>
                <LogIn className="mr-2 h-4 w-4" />
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>

              <Button type="button" variant="outline" className="w-full h-12 text-base font-semibold border-2 hover:bg-muted/50 transition-all duration-200" onClick={() => navigate("/onboarding")}>
                Back to Onboarding
              </Button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
