import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Package } from "lucide-react";
import { RouteCard } from "@/components/RouteCard";

interface Driver {
  id: string;
  name: string;
  email: string;
}

interface Route {
  id: string;
  address: string;
  time_window: string;
  customer_name: string;
  delivery_notes: string | null;
  status: string;
  scheduled_date: string;
}

export default function RoutesScreen() {
  const navigate = useNavigate();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDriverAndRoutes();
  }, []);

  const loadDriverAndRoutes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      const { data: driverData, error: driverError } = await supabase
        .from("drivers")
        .select("*")
        .eq("email", user.email)
        .single();

      if (driverError) throw driverError;
      setDriver(driverData);

      const today = new Date().toISOString().split('T')[0];
      const { data: routesData, error: routesError } = await supabase
        .from("routes")
        .select("*")
        .eq("driver_id", driverData.id)
        .eq("scheduled_date", today)
        .order("time_window");

      if (routesError) throw routesError;
      setRoutes(routesData || []);
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

  const handleStatusUpdate = async (routeId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("routes")
        .update({ status: newStatus })
        .eq("id", routeId);

      if (error) throw error;

      setRoutes(routes.map(r => 
        r.id === routeId ? { ...r, status: newStatus } : r
      ));

      toast({
        title: "Status updated",
        description: `Route marked as ${newStatus}`,
      });
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleViewRoute = (routeId: string) => {
    navigate(`/route-details/${routeId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-primary text-primary-foreground p-4 shadow-md">
        <div className="container mx-auto flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
            className="text-primary-foreground hover:bg-primary-foreground/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">My Routes</h1>
            <p className="text-sm opacity-90">{driver?.name}</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold">Today's Deliveries</h2>
          </div>

          {routes.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No deliveries scheduled for today</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {routes.map((route) => (
                <div key={route.id} onClick={() => handleViewRoute(route.id)} className="cursor-pointer">
                  <RouteCard
                    route={route}
                    onStatusUpdate={handleStatusUpdate}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
