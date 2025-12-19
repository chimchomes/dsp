import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Shield } from "lucide-react";
import { PasswordChangePrompt } from "@/components/PasswordChangePrompt";

const DispatcherLogin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

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
        setLoading(false);
        return;
      }

      // Check if user has route-admin or admin role
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);

      const hasAccess = roles?.some(r => r.role === "route-admin" || r.role === "admin");

      if (!hasAccess) {
        await supabase.auth.signOut();
        throw new Error("Access denied. Dispatcher or Admin credentials required.");
      }

      // Log the login activity
      await supabase.rpc('log_activity', {
        p_action_type: 'login',
        p_resource_type: 'route-admin',
        p_resource_id: null,
        p_action_details: null
      });

      toast({
        title: "Welcome back!",
        description: "Successfully logged in to route admin dashboard.",
      });

      navigate("/dispatcher");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChangeComplete = async () => {
    setShowPasswordChange(false);
    toast({
      title: "Password updated",
      description: "Your password has been changed successfully.",
    });
    
    // Get user roles to redirect appropriately
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/dispatcher-login");
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

      const hasAccess = roles?.some(r => r.role === "route-admin" || r.role === "admin");

    if (!hasAccess) {
      await supabase.auth.signOut();
      toast({
        title: "Access denied",
        description: "Dispatcher or Admin credentials required.",
        variant: "destructive",
      });
      navigate("/dispatcher-login");
      return;
    }

    // Redirect based on role
    if (roles?.some(r => r.role === "admin")) {
      navigate("/admin");
    } else {
      navigate("/dispatcher");
    }
  };

  return (
    <>
      <PasswordChangePrompt open={showPasswordChange} onComplete={handlePasswordChangeComplete} />
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/20 to-background p-4 relative overflow-hidden">
        <Card className="w-full max-w-md bg-card shadow-modern-lg border-2 border-border relative z-10 animate-fade-in">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-6 animate-slide-up">
              <div className="p-4 rounded-2xl bg-primary/10">
                <img 
                  src="/logo.png" 
                  alt="DSP Logo" 
                  className="h-32 w-auto"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              </div>
            </div>
            <CardTitle className="text-4xl font-bold text-foreground mb-3">Route Admin Portal</CardTitle>
            <CardDescription className="text-base font-medium">Admin and Route Admin access only</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-5 animate-slide-up">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-base font-semibold text-foreground">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
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
              <Button type="submit" className="w-full h-12 text-base font-bold shadow-modern hover:shadow-modern-lg transition-all duration-200 bg-primary hover:bg-primary/90" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default DispatcherLogin;
