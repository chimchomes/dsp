import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Truck } from "lucide-react";
import { PasswordChangePrompt } from "@/components/PasswordChangePrompt";

export default function Login() {
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

      // Check if password change is required
      const requiresPasswordChange = data.user?.user_metadata?.requires_password_change;
      
      if (requiresPasswordChange) {
        setShowPasswordChange(true);
        setIsLoading(false);
        return;
      }

      // Log the login activity
      await supabase.rpc('log_activity', {
        p_action_type: 'login',
        p_resource_type: null,
        p_resource_id: null,
        p_action_details: null
      });

      // Check for returnTo parameter (for continuing onboarding)
      const params = new URLSearchParams(window.location.search);
      const returnTo = params.get('returnTo');
      
      if (returnTo === 'onboarding') {
        // Check if user has an onboarding session
        const { data: sessionData } = await supabase
          .from("onboarding_sessions")
          .select("*")
          .eq("user_id", data.user.id)
          .eq("completed", false)
          .maybeSingle();

        if (sessionData) {
          toast({
            title: "Welcome back!",
            description: "Continuing your application.",
          });
          navigate("/onboarding");
          return;
        }
      }

      // Check user roles to determine redirect
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);

      // Check if user is a driver (by email in drivers table)
      const { data: driverData } = await supabase
        .from("drivers")
        .select("id")
        .eq("email", data.user.email)
        .single();

      toast({
        title: "Welcome back!",
        description: "Successfully logged in.",
      });

      // Redirect based on role priority: Admin > Dispatcher > Finance > Driver
      if (roles?.some(r => r.role === "admin")) {
        navigate("/admin");
      } else if (roles?.some(r => r.role === "dispatcher")) {
        navigate("/dispatcher");
      } else if (driverData) {
        navigate("/dashboard");
      } else {
        // No recognized role - redirect to onboarding
        navigate("/hr");
      }
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChangeComplete = () => {
    setShowPasswordChange(false);
    toast({
      title: "Password updated",
      description: "Your password has been changed successfully.",
    });
    
    // Check if user should return to onboarding
    const params = new URLSearchParams(window.location.search);
    const returnTo = params.get('returnTo');
    
    if (returnTo === 'onboarding') {
      navigate("/onboarding");
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <>
      <PasswordChangePrompt open={showPasswordChange} onComplete={handlePasswordChangeComplete} />
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-primary/80 p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-lg shadow-xl p-8">
          <div className="flex items-center justify-center mb-8">
            <div className="bg-secondary rounded-full p-3">
              <Truck className="w-8 h-8 text-white" />
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-center mb-2">Driver Portal</h1>
          <p className="text-muted-foreground text-center mb-8">
            Sign in to access your deliveries
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="driver@example.com"
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

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>

            <Button
              type="button"
              className="w-full"
              onClick={() => navigate("/onboarding")}
            >
              Onboarding
            </Button>
          </form>
        </div>
      </div>
    </div>
    </>
  );
}
