import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, MapPin, Clock, User, Package, FileText } from "lucide-react";

interface Route {
  id: string;
  address: string;
  time_window: string;
  customer_name: string;
  delivery_notes: string | null;
  status: string;
  scheduled_date: string;
  package_type: string | null;
}

export default function RouteDetailsScreen() {
  const navigate = useNavigate();
  const { routeId } = useParams<{ routeId: string }>();
  const [route, setRoute] = useState<Route | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadRouteDetails();
  }, [routeId]);

  const loadRouteDetails = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      const { data: routeData, error } = await supabase
        .from("routes")
        .select("*")
        .eq("id", routeId)
        .single();

      if (error) throw error;
      setRoute(routeData);
    } catch (error: any) {
      toast({
        title: "Error loading route details",
        description: error.message,
        variant: "destructive",
      });
      navigate("/routes");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!route) return;

    try {
      const { error } = await supabase
        .from("routes")
        .update({ status: newStatus })
        .eq("id", route.id);

      if (error) throw error;

      setRoute({ ...route, status: newStatus });
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!route) return null;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-primary text-primary-foreground p-4 shadow-md">
        <div className="container mx-auto flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/routes")}
            className="text-primary-foreground hover:bg-primary-foreground/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Route Details</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Delivery Manifest</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Address</p>
                <p className="text-muted-foreground">{route.address}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Time Window</p>
                <p className="text-muted-foreground">{route.time_window}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Customer</p>
                <p className="text-muted-foreground">{route.customer_name}</p>
              </div>
            </div>

            {route.package_type && (
              <div className="flex items-start gap-3">
                <Package className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Package Type</p>
                  <p className="text-muted-foreground">{route.package_type}</p>
                </div>
              </div>
            )}

            {route.delivery_notes && (
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Delivery Notes</p>
                  <p className="text-muted-foreground">{route.delivery_notes}</p>
                </div>
              </div>
            )}

            <div className="pt-4 border-t">
              <p className="font-medium mb-2">Current Status: <span className="text-primary capitalize">{route.status}</span></p>
              
              {route.status === "pending" && (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => handleStatusUpdate("completed")} variant="default">
                    Mark Completed
                  </Button>
                  <Button onClick={() => handleStatusUpdate("delayed")} variant="secondary">
                    Mark Delayed
                  </Button>
                  <Button onClick={() => handleStatusUpdate("missed")} variant="destructive">
                    Mark Missed
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
