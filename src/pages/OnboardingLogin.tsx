import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Lock, LogIn } from "lucide-react";
import { PasswordChangePrompt } from "@/components/PasswordChangePrompt";

export default function OnboardingLogin() {
  const navigate = useNavigate();
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

      const hasOnboardingRole = roles?.some(r => r.role === "onboarding");
      
      if (!hasOnboardingRole) {
        toast({ 
          title: "Access denied", 
          description: "This login is only for onboarding applicants",
          variant: "destructive"
        });
        setIsLoading(false);
        return;
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
        navigate("/onboarding");
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
                <strong>Default password:</strong> <span className="font-mono">Password123</span>
              </p>
              <p className="text-xs text-muted-foreground text-center mt-1">
                (You'll be prompted to change it on first login)
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
