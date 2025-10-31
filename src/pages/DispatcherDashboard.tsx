import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { AuthGuard } from "@/components/AuthGuard";
import { LogOut, Plus, DollarSign, Users, Shield, ArrowLeft, Package } from "lucide-react";
import { DriversPanel } from "@/components/dispatcher/DriversPanel";
import { RouteAssignmentForm } from "@/components/dispatcher/RouteAssignmentForm";
import { RouteIngestionForm } from "@/components/admin/RouteIngestionForm";
import { MessagingPanel } from "@/components/dispatcher/MessagingPanel";
import { IncidentFeed } from "@/components/dispatcher/IncidentFeed";
import { NotificationBadge } from "@/components/NotificationBadge";
import { NotificationSettings } from "@/components/NotificationSettings";

interface Driver {
  id: string;
  name: string;
  email: string;
  active: boolean;
}

interface Route {
  id: string;
  driver_id: string;
  address: string;
  time_window: string;
  customer_name: string;
  delivery_notes: string | null;
  status: string;
  scheduled_date: string;
  package_type: string | null;
}

interface Incident {
  id: string;
  driver_id: string;
  description: string;
  photo_url: string | null;
  created_at: string;
}

const DispatcherDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRouteForm, setShowRouteForm] = useState(false);
  const [showIngestionForm, setShowIngestionForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    loadData();
    setupRealtimeSubscriptions();
  }, []);

  const loadData = async () => {
    try {
      const [driversRes, routesRes, incidentsRes] = await Promise.all([
        supabase.from("drivers").select("*").order("name"),
        supabase.from("routes").select("*").order("scheduled_date", { ascending: false }),
        supabase.from("incidents").select("*").order("created_at", { ascending: false }),
      ]);

      if (driversRes.data) setDrivers(driversRes.data);
      if (routesRes.data) setRoutes(routesRes.data);
      if (incidentsRes.data) setIncidents(incidentsRes.data);
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load dashboard data",
      });
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscriptions = () => {
    const routesChannel = supabase
      .channel("routes-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "routes" }, () => {
        loadData();
      })
      .subscribe();

    const incidentsChannel = supabase
      .channel("incidents-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents" }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(routesChannel);
      supabase.removeChannel(incidentsChannel);
    };
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/dispatcher-login");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <AuthGuard allowedRoles={["dispatcher", "admin"]}>
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => navigate("/admin")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <h1 className="text-2xl font-bold text-primary">Dispatcher Dashboard</h1>
            </div>
            <div className="flex gap-2 items-center">
              <NotificationBadge />
              <Button variant="outline" onClick={() => navigate("/finance")}>
                <DollarSign className="mr-2 h-4 w-4" />
                Finance
              </Button>
              <Button variant="outline" onClick={() => navigate("/hr")}>
                <Users className="mr-2 h-4 w-4" />
                HR Portal
              </Button>
              <Button variant="outline" onClick={() => navigate("/admin")}>
                <Shield className="mr-2 h-4 w-4" />
                Admin
              </Button>
              <Button variant="ghost" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Drivers and Routes Section */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Active Routes</h2>
                <div className="flex gap-2">
                  <Button onClick={() => setShowIngestionForm(true)} variant="outline">
                    <Package className="mr-2 h-4 w-4" />
                    Import Route
                  </Button>
                  <Button onClick={() => setShowRouteForm(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Assign Route
                  </Button>
                </div>
              </div>
              
              <DriversPanel drivers={drivers} routes={routes} />
            </div>

            {/* Messaging and Incidents Sidebar */}
            <div className="space-y-6">
              <MessagingPanel drivers={drivers} />
              <IncidentFeed incidents={incidents} drivers={drivers} />
              <NotificationSettings />
            </div>
          </div>
        </main>

        {showRouteForm && (
          <RouteAssignmentForm
            drivers={drivers}
            onClose={() => setShowRouteForm(false)}
            onSuccess={() => {
              setShowRouteForm(false);
              loadData();
            }}
          />
        )}

        <RouteIngestionForm
          open={showIngestionForm}
          onClose={() => setShowIngestionForm(false)}
          onSuccess={() => {
            setShowIngestionForm(false);
            loadData();
          }}
        />
      </div>
    </AuthGuard>
  );
};

export default DispatcherDashboard;
