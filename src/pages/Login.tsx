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

      if (error) {
        console.error("Authentication error:", error);
        // Provide more specific error messages
        if (error.message.includes("Invalid login credentials") || error.message.includes("email") || error.message.includes("password")) {
          toast({
            title: "Login failed",
            description: "Invalid email or password. Please check your credentials and try again.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Login failed",
            description: error.message || "An error occurred during login. Please try again.",
            variant: "destructive",
          });
        }
        setIsLoading(false);
        return;
      }
      
      if (!data.user) {
        toast({
          title: "Login failed",
          description: "No user data returned. Please try again.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Check if password change is required
      const requiresPasswordChange = data.user?.user_metadata?.requires_password_change;
      
      if (requiresPasswordChange) {
        setShowPasswordChange(true);
        setIsLoading(false);
        return;
      }

      // Log the login activity (non-blocking - don't fail login if this fails)
      // Fire and forget - errors won't block login since we're not awaiting
      void supabase.rpc('log_activity', {
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
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);

      // Check if user is a driver by user_id (RLS-safe) - do this regardless of roles query result
      const { data: driverData, error: driverError } = await supabase
        .from("drivers")
        .select("id, active")
        .eq("user_id", data.user.id)
        .maybeSingle();

      const roleList = roles?.map(r => r.role) || [];
      
      console.log("User ID:", data.user.id);
      console.log("User email:", data.user.email);
      console.log("User roles:", roleList);
      console.log("Driver data:", driverData);
      console.log("Roles error:", rolesError);
      console.log("Driver error:", driverError);

      toast({
        title: "Welcome back!",
        description: "Successfully logged in.",
      });

      // Redirect based on role priority: Admin > Route Admin > Finance > Driver > Inactive
      // If roles query failed, try to infer from driver record or other data
      
      // If we have roles, use them
      if (!rolesError && roles && roles.length > 0) {
        if (roleList.includes("admin")) {
          navigate("/admin");
          return;
        } else if (roleList.includes("route-admin")) {
          navigate("/dispatcher");
          return;
        } else if (roleList.includes("finance")) {
          navigate("/finance");
          return;
        } else if (roleList.includes("hr")) {
          navigate("/hr");
          return;
        } else if (roleList.includes("inactive")) {
          navigate("/inbox");
          return;
        } else if (roleList.includes("driver")) {
          if (driverData) {
            navigate(driverData.active === false ? "/inbox" : "/dashboard");
          } else {
            navigate("/dashboard");
          }
          return;
        } else if (roleList.includes("onboarding")) {
          navigate("/onboarding");
          return;
        }
      }
      
      // If roles query failed or no roles found, try to infer from driver record
      if (driverData && !driverError) {
        // User has driver record - likely a driver
        navigate(driverData.active === false ? "/inbox" : "/dashboard");
        return;
      }
      
      // If roles query failed, try alternative: check via role_profiles view
      if (rolesError) {
        try {
          const { data: roleProfile } = await supabase
            .from("role_profiles")
            .select("role")
            .eq("user_id", data.user.id)
            .limit(1)
            .maybeSingle();
          
          if (roleProfile) {
            const inferredRole = roleProfile.role;
            if (inferredRole === "admin") {
              navigate("/admin");
              return;
            } else if (inferredRole === "route-admin") {
              navigate("/dispatcher");
              return;
            } else if (inferredRole === "finance") {
              navigate("/finance");
              return;
            } else if (inferredRole === "hr") {
              navigate("/hr");
              return;
            } else if (inferredRole === "driver") {
              navigate("/dashboard");
              return;
            } else if (inferredRole === "onboarding") {
              navigate("/onboarding");
              return;
            }
          }
        } catch (altError) {
          console.error("Alternative role check also failed:", altError);
        }
      }
      
      // Last resort: if we have no roles and no driver record, show error
      if (!rolesError && (!roles || roles.length === 0)) {
        toast({
          title: "Access denied",
          description: `Your account (${data.user.email}) has no assigned role. Please contact support to have a role assigned.`,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      } else if (rolesError) {
        toast({
          title: "Login issue",
          description: `Unable to verify your account roles. Error: ${rolesError.message}. Please contact support.`,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
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

  const handlePasswordChangeComplete = async () => {
    setShowPasswordChange(false);
    toast({
      title: "Password updated",
      description: "Your password has been changed successfully.",
    });
    
    // Get user roles to redirect appropriately
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    // Check if user is a driver
    const { data: driverData } = await supabase
      .from("drivers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

          // Redirect based on role priority: Admin > Route Admin > Finance > HR > Driver > Inactive
          // Inactive users can only access inbox to message admin
          if (roles?.some(r => r.role === "admin")) {
            navigate("/admin");
          } else if (roles?.some(r => r.role === "route-admin")) {
            navigate("/dispatcher");
          } else if (roles?.some(r => r.role === "finance")) {
            navigate("/finance");
          } else if (roles?.some(r => r.role === "hr")) {
            navigate("/hr");
          } else if (roles?.some(r => r.role === "inactive")) {
            // Inactive users can only access inbox to message admin
            navigate("/inbox");
          } else if (driverData) {
            navigate("/dashboard");
          } else if (roles?.some(r => r.role === "onboarding")) {
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
