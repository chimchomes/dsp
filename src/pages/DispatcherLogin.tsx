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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-primary/10 p-3 rounded-full">
              <Shield className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Dispatcher Portal</CardTitle>
          <CardDescription>Admin access only</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="dispatcher@example.com"
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
            <Button type="submit" className="w-full" disabled={loading}>
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
