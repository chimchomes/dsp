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

    // Check if user is a driver
    const { data: driverData } = await supabase
      .from("drivers")
      .select("id")
      .eq("email", user.email)
      .single();

    if (!driverData) {
      navigate("/login");
      return;
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
        .eq("email", user.email)
        .single();

      if (driverError) throw driverError;
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
