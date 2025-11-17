import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { LogOut, Package, DollarSign, AlertTriangle, User, MapPin, Calculator, Car } from "lucide-react";
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

    // If user has inactive role, redirect to inbox
    if (roles?.some(r => r.role === "inactive")) {
      navigate("/inbox");
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
      .from("drivers")
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
        navigate("/inbox");
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
        .from("drivers")
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
    <div className="min-h-screen bg-muted/30">
        <header className="bg-primary text-primary-foreground p-4 shadow-md">
          <div className="container mx-auto flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold">Driver Portal</h1>
              <p className="text-sm opacity-90">{driver?.name}</p>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBadge />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="text-primary-foreground hover:bg-primary-foreground/10"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto p-4 space-y-6">
          <h2 className="text-2xl font-bold mb-4">Quick Actions</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => navigate("/routes")}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  My Routes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">View and manage your delivery routes</p>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => navigate("/earnings")}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Earnings & Deductions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">View your earnings and deductions</p>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => navigate("/cost-calculator")}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Cost Calculator
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Calculate your work costs</p>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => navigate("/vehicle")}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Car className="h-5 w-5" />
                  Vehicle Management
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Manage your vehicle details</p>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => navigate("/expenses")}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Expenses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Submit and track your expenses</p>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => navigate("/profile")}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  My Profile
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">View your profile and settings</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Report an Incident
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => setShowIncidentForm(true)}
                variant="destructive"
                className="w-full"
              >
                <AlertTriangle className="mr-2 h-5 w-5" />
                Report Incident
              </Button>
            </CardContent>
          </Card>
        </main>

        {showIncidentForm && driver && (
          <IncidentForm
            driverId={driver.id}
            onClose={() => setShowIncidentForm(false)}
            onSuccess={loadDriverAndRoutes}
          />
        )}
      </div>
  );
}
