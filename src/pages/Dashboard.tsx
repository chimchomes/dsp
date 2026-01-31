import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, User, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { NotificationBadge } from "@/components/NotificationBadge";
import { IncidentForm } from "@/components/IncidentForm";

interface Driver {
  id: string;
  name: string;
  email: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showIncidentForm, setShowIncidentForm] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    checkDriverAccess();
  }, []);

  const checkDriverAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
      return;
    }

    // Check user roles
    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (rolesError) {
      console.error("Error fetching roles:", rolesError);
      toast({
        title: "Error",
        description: "Failed to verify access. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    // If user has inactive role, redirect to login
    if (roles?.some(r => r.role === "inactive")) {
      toast({
        title: "Access denied",
        description: "Your account is inactive. Please contact support.",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    // Check if user is a driver (has driver role)
    const hasDriverRole = roles?.some(r => r.role === "driver");
    if (!hasDriverRole) {
      toast({
        title: "Access denied",
        description: "Driver access required. Please contact support if you believe this is an error.",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    // Check if user has a driver record (use maybeSingle to avoid error if not found)
    const { data: driverData, error: driverError } = await supabase
      .from("driver_profiles")
      .select("id, active")
      .eq("user_id", user.id)
      .maybeSingle();

    if (driverError) {
      console.error("Error fetching driver data:", driverError);
      // Don't block access if query fails - might be RLS issue
    }

    // If driver record exists, check if active
    if (driverData) {
      if (driverData.active === false) {
        toast({
          title: "Access denied",
          description: "Your account is inactive. Please contact support.",
          variant: "destructive",
        });
        navigate("/login");
        return;
      }
    } else {
      // Driver role exists but no driver record - still allow access
      // Show a message that profile needs to be set up
      console.warn("Driver role found but no driver record. Allowing access but driver data may be limited.");
    }

    setHasAccess(true);
    loadDriverAndRoutes();
  };

  const loadDriverAndRoutes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: driverData, error: driverError } = await supabase
        .from("driver_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (driverError) {
        console.error("Error loading driver data:", driverError);
        // Don't throw - allow dashboard to load even without driver record
        toast({
          title: "Notice",
          description: "Driver profile not found. Some features may be limited. Please contact support.",
          variant: "default",
        });
        return;
      }

      if (!driverData) {
        toast({
          title: "Profile Setup Required",
          description: "Your driver profile needs to be set up. Please contact support.",
          variant: "default",
        });
        return;
      }

      setDriver(driverData);
    } catch (error: any) {
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (isLoading || !hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
        <div className="mb-8 animate-fade-in">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">DSP Portal</h1>
            <p className="text-muted-foreground text-base font-semibold">{driver?.name || "Driver"}</p>
          </div>
        </div>

        <div className="space-y-6 animate-fade-in">
          <div className="mb-6">
            <h2 className="text-3xl font-bold mb-2">Quick Actions</h2>
            <p className="text-muted-foreground text-base font-medium">Access your most used features</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="cursor-pointer hover:shadow-modern-lg transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/50 group bg-card" onClick={() => navigate("/payslips")}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg font-bold">
                  <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  My Payslips
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-base font-medium">View and download your payslips</p>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-modern-lg transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/50 group bg-card" onClick={() => navigate("/profile")}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg font-bold">
                  <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  My Profile
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-base font-medium">View your profile and settings</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-2 border-destructive/20 hover:border-destructive/40 transition-all duration-300 bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-lg font-bold">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                Report an Incident
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => setShowIncidentForm(true)}
                variant="destructive"
                className="w-full h-11 font-semibold shadow-modern hover:shadow-modern-lg transition-all duration-200"
              >
                <AlertTriangle className="mr-2 h-5 w-5" />
                Report Incident
              </Button>
            </CardContent>
          </Card>
        </div>

        {showIncidentForm && driver && (
          <IncidentForm
            driverId={driver.id}
            driverName={driver.name}
            driverEmail={driver.email}
            onClose={() => setShowIncidentForm(false)}
            onSuccess={loadDriverAndRoutes}
          />
        )}
      </div>
  );
}
