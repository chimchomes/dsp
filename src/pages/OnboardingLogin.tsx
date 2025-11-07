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
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <div className="bg-card rounded-lg shadow-xl p-8">
            <div className="flex items-center justify-center mb-6">
              <div className="rounded-full p-3 bg-primary/10">
                <Lock className="w-8 h-8 text-primary" />
              </div>
            </div>

            <h1 className="text-2xl font-bold text-center mb-2">Continue Application</h1>
            <p className="text-muted-foreground text-center mb-6">
              Log in with your email and password to resume your onboarding.
            </p>
            
            <div className="mb-4 p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground text-center">
                Forgot your password? Use the password reset link sent to your email.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                <LogIn className="mr-2 h-4 w-4" />
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>

              <Button type="button" variant="outline" className="w-full" onClick={() => navigate("/onboarding")}
              >
                Back to Onboarding
              </Button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
