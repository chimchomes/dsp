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
import { ImportedRoutesPanel } from "@/components/dispatcher/ImportedRoutesPanel";
import { DispatcherManagement } from "@/components/admin/DispatcherManagement";
import { NotificationBadge } from "@/components/NotificationBadge";
import { NotificationSettings } from "@/components/NotificationSettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Driver {
  id: string;
  name: string;
  email: string;
  active: boolean;
}

interface Route {
  id: string;
  tour_id: string | null;
  dispatcher_id: string;
  driver_id: string | null;
  address: string;
  time_window: string;
  customer_name: string;
  delivery_notes: string | null;
  status: string;
  scheduled_date: string;
  package_type: string | null;
  parcel_count_total: number;
  parcels_delivered: number;
  driver?: {
    id: string;
    name: string;
    email: string;
  };
  dispatcher?: {
    id: string;
    dsp_name: string;
    tour_id_prefix: string | null;
  };
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentDispatcherId, setCurrentDispatcherId] = useState<string | null>(null);

  useEffect(() => {
    checkUserRole();
    loadData();
  }, []);

  useEffect(() => {
    // Set up real-time subscriptions for route-admin (can see all routes)
    const cleanup = setupRealtimeSubscriptions();
    return cleanup;
  }, []);

  const checkUserRole = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id);

      const hasAdminRole = userRoles?.some(ur => ur.role === 'admin') || false;
      setIsAdmin(hasAdminRole);
    } catch (error) {
      console.error("Error checking user role:", error);
    }
  };

  const loadData = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Check if user is admin or route-admin
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id);

      const isRouteAdmin = userRoles?.some(ur => ur.role === 'route-admin') || false;
      const isAdminUser = userRoles?.some(ur => ur.role === 'admin') || false;

      // Route-admin can see all routes from all dispatchers
      // Optionally, try to find a dispatcher account matching user email (for convenience)
      let defaultDispatcherId: string | null = null;
      
      if (!isAdminUser) {
        // For route-admin (not admin), try to find matching dispatcher account
        const { data: dispatcherData } = await supabase
          .from("dispatchers")
          .select("id, contact_email, dsp_name")
          .eq("contact_email", user.email)
          .maybeSingle();

        if (dispatcherData?.id) {
          defaultDispatcherId = dispatcherData.id;
          setCurrentDispatcherId(dispatcherData.id);
          console.log("Found matching dispatcher account:", dispatcherData.id, dispatcherData.dsp_name);
        } else {
          console.log("No matching dispatcher account found - route-admin can still manage all dispatchers");
          // Route-admin can still work without a matching dispatcher account
          // They can select any dispatcher when importing routes
        }
      }

      // Load all routes (route-admin can see routes from all dispatchers)
      // Admin can also see all routes
      const [driversRes, routesRes, incidentsRes] = await Promise.all([
        supabase.from("drivers").select("*").eq("active", true).order("name"),
        supabase
          .from("routes")
          .select(`
            *,
            driver:drivers(id, name, email),
            dispatcher:dispatchers(id, dsp_name, tour_id_prefix)
          `)
          .order("scheduled_date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase.from("incidents").select("*").order("created_at", { ascending: false }),
      ]);

      if (driversRes.error) {
        console.error("Error loading drivers:", driversRes.error);
      }
      if (routesRes.error) {
        console.error("Error loading routes:", routesRes.error);
        toast({
          variant: "destructive",
          title: "Error loading routes",
          description: routesRes.error.message,
        });
      }
      if (incidentsRes.error) {
        console.error("Error loading incidents:", incidentsRes.error);
      }

      if (driversRes.data) setDrivers(driversRes.data);
      if (routesRes.data) {
        console.log(`Loaded ${routesRes.data.length} routes (route-admin can see all routes)`);
        setRoutes(routesRes.data as Route[]);
      } else {
        setRoutes([]);
      }
      if (incidentsRes.data) setIncidents(incidentsRes.data);
    } catch (error: any) {
      console.error("Error loading data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to load dashboard data",
      });
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscriptions = () => {
    // Route-admin can see all routes, so subscribe to all route changes
    const routesChannel = supabase
      .channel("routes-changes-all")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "routes",
        },
        (payload) => {
          console.log("Route change detected:", payload.eventType);
          loadData();
        }
      )
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
    <AuthGuard allowedRoles={["route-admin", "admin"]}>
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-4">
              {isAdmin && (
                <Button
                  variant="ghost"
                  onClick={() => navigate("/admin")}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              )}
              <h1 className="text-2xl font-bold text-primary">Route Admin Dashboard</h1>
            </div>
            <div className="flex gap-2 items-center">
              <NotificationBadge />
              {isAdmin && (
                <>
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
                </>
              )}
              <Button variant="ghost" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6">
          <Tabs defaultValue="routes" className="space-y-6">
            <TabsList>
              <TabsTrigger value="routes">Routes</TabsTrigger>
              <TabsTrigger value="dispatchers">Dispatchers</TabsTrigger>
            </TabsList>

            <TabsContent value="routes" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Drivers and Routes Section */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold">Route Management</h2>
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

                  <ImportedRoutesPanel routes={routes} />
                  
                  <DriversPanel drivers={drivers} routes={routes.filter(r => r.driver_id)} />
                </div>

                {/* Messaging and Incidents Sidebar */}
                <div className="space-y-6">
                  <MessagingPanel drivers={drivers} />
                  <IncidentFeed incidents={incidents} drivers={drivers} />
                  <NotificationSettings />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="dispatchers" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Dispatcher Management</CardTitle>
                  <CardDescription>Create and manage dispatcher accounts</CardDescription>
                </CardHeader>
                <CardContent>
                  <DispatcherManagement />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
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
          dispatcherId={currentDispatcherId || undefined}
          onClose={() => {
            setShowIngestionForm(false);
            // Reload data after closing to ensure routes are refreshed
            setTimeout(() => loadData(), 500);
          }}
          onSuccess={() => {
            setShowIngestionForm(false);
            // Reload data immediately after successful import
            setTimeout(() => loadData(), 1000);
          }}
        />
      </div>
    </AuthGuard>
  );
};

export default DispatcherDashboard;
