import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, MapPin, Clock, User, Package, FileText, CheckCircle, XCircle, List } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Route {
  id: string;
  tour_id: string | null;
  address: string;
  time_window: string;
  customer_name: string;
  delivery_notes: string | null;
  status: string;
  scheduled_date: string;
  parcel_count_total: number;
  parcels_delivered: number;
  parcels_undelivered: number | null;
  undelivered_reason: string | null;
  completion_notes: string | null;
  dispatcher?: {
    id: string;
    dsp_name: string;
  };
}

interface Stop {
  id: string;
  stop_sequence: number;
  street_address: string;
  customer_name: string | null;
  package_details: string | null;
  geocoded: boolean;
  latitude: number | null;
  longitude: number | null;
}

export default function RouteDetailsScreen() {
  const navigate = useNavigate();
  const { routeId } = useParams<{ routeId: string }>();
  const [route, setRoute] = useState<Route | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Completion form state
  const [parcelsDelivered, setParcelsDelivered] = useState(0);
  const [parcelsUndelivered, setParcelsUndelivered] = useState(0);
  const [undeliveredReason, setUndeliveredReason] = useState("");
  const [completionNotes, setCompletionNotes] = useState("");

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

      // Load route with dispatcher info
      const { data: routeData, error } = await supabase
        .from("routes")
        .select(`
          *,
          dispatcher:dispatchers(id, dsp_name)
        `)
        .eq("id", routeId)
        .single();

      if (error) throw error;
      setRoute(routeData as Route);
      
      // Set form values from existing data
      setParcelsDelivered(routeData.parcels_delivered || 0);
      setParcelsUndelivered(routeData.parcels_undelivered || 0);
      setUndeliveredReason(routeData.undelivered_reason || "");
      setCompletionNotes(routeData.completion_notes || "");

      // Load stops for this route
      const { data: stopsData, error: stopsError } = await supabase
        .from("stops")
        .select("*")
        .eq("route_id", routeId)
        .order("stop_sequence");

      if (stopsError) throw stopsError;
      setStops(stopsData || []);
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

  const handleCompletionSubmit = async () => {
    if (!route) return;

    // Validation
    if (parcelsDelivered + parcelsUndelivered > (route.parcel_count_total || 0)) {
      toast({
        variant: "destructive",
        title: "Invalid numbers",
        description: `Total delivered + undelivered (${parcelsDelivered + parcelsUndelivered}) cannot exceed total parcels (${route.parcel_count_total || 0})`,
      });
      return;
    }

    if (parcelsUndelivered > 0 && !undeliveredReason.trim()) {
      toast({
        variant: "destructive",
        title: "Reason required",
        description: "Please provide a reason for undelivered parcels",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("routes")
        .update({
          parcels_delivered: parcelsDelivered,
          parcels_undelivered: parcelsUndelivered,
          undelivered_reason: parcelsUndelivered > 0 ? undeliveredReason : null,
          completion_notes: completionNotes || null,
          status: "completed",
        })
        .eq("id", route.id);

      if (error) throw error;

      toast({
        title: "Route completed",
        description: "Completion details have been saved successfully",
      });

      // Reload route data
      await loadRouteDetails();
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
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

  const canEditCompletion = route.status !== "completed" || parcelsDelivered === 0;
  const totalParcels = route.parcel_count_total || 0;

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
            {route.tour_id && (
              <p className="text-sm opacity-90">Tour ID: {route.tour_id}</p>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 space-y-6">
        {/* Route Information */}
        <Card>
          <CardHeader>
            <CardTitle>Route Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Primary Address</p>
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

              <div className="flex items-start gap-3">
                <Package className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Total Parcels</p>
                  <p className="text-muted-foreground">{totalParcels}</p>
                </div>
              </div>

              {route.dispatcher && (
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Dispatcher</p>
                    <p className="text-muted-foreground">{route.dispatcher.dsp_name}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Status</p>
                  <Badge variant={route.status === "completed" ? "default" : "outline"}>
                    {route.status}
                  </Badge>
                </div>
              </div>
            </div>

            {route.delivery_notes && (
              <div className="pt-4 border-t">
                <p className="font-medium mb-1">Delivery Notes</p>
                <p className="text-muted-foreground">{route.delivery_notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stops List */}
        {stops.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <List className="h-5 w-5" />
                Stops ({stops.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stops.map((stop) => (
                  <div key={stop.id} className="flex items-start gap-3 p-3 border rounded-lg">
                    <Badge variant="outline" className="mt-1">
                      #{stop.stop_sequence}
                    </Badge>
                    <div className="flex-1">
                      <p className="font-medium">{stop.street_address}</p>
                      {stop.customer_name && (
                        <p className="text-sm text-muted-foreground">Customer: {stop.customer_name}</p>
                      )}
                      {stop.package_details && (
                        <p className="text-sm text-muted-foreground">Package: {stop.package_details}</p>
                      )}
                      {!stop.geocoded && (
                        <Badge variant="destructive" className="text-xs mt-1">Not Geocoded</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Completion Form */}
        <Card>
          <CardHeader>
            <CardTitle>Route Completion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="parcels-delivered">Parcels Delivered</Label>
                <Input
                  id="parcels-delivered"
                  type="number"
                  min="0"
                  max={totalParcels}
                  value={parcelsDelivered}
                  onChange={(e) => setParcelsDelivered(parseInt(e.target.value) || 0)}
                  disabled={!canEditCompletion}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Out of {totalParcels} total parcels
                </p>
              </div>

              <div>
                <Label htmlFor="parcels-undelivered">Parcels Undelivered</Label>
                <Input
                  id="parcels-undelivered"
                  type="number"
                  min="0"
                  max={totalParcels}
                  value={parcelsUndelivered}
                  onChange={(e) => setParcelsUndelivered(parseInt(e.target.value) || 0)}
                  disabled={!canEditCompletion}
                />
              </div>
            </div>

            {parcelsUndelivered > 0 && (
              <div>
                <Label htmlFor="undelivered-reason">Reason for Undelivered Parcels</Label>
                <Select
                  value={undeliveredReason}
                  onValueChange={setUndeliveredReason}
                  disabled={!canEditCompletion}
                >
                  <SelectTrigger id="undelivered-reason">
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Customer not available">Customer not available</SelectItem>
                    <SelectItem value="Wrong address">Wrong address</SelectItem>
                    <SelectItem value="Damaged package">Damaged package</SelectItem>
                    <SelectItem value="Refused by customer">Refused by customer</SelectItem>
                    <SelectItem value="Address inaccessible">Address inaccessible</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="completion-notes">Completion Notes</Label>
              <Textarea
                id="completion-notes"
                placeholder="Add any additional notes about the route completion..."
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                disabled={!canEditCompletion}
                rows={4}
              />
            </div>

            {canEditCompletion && (
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => navigate("/routes")}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCompletionSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Saving..." : "Save Completion Details"}
                </Button>
              </div>
            )}

            {route.status === "completed" && !canEditCompletion && (
              <div className="pt-4 border-t">
                <div className="bg-muted p-4 rounded-md space-y-2">
                  <p className="font-medium">Completion Summary</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <p><strong>Delivered:</strong> {parcelsDelivered}</p>
                    <p><strong>Undelivered:</strong> {parcelsUndelivered}</p>
                  </div>
                  {undeliveredReason && (
                    <p className="text-sm"><strong>Reason:</strong> {undeliveredReason}</p>
                  )}
                  {completionNotes && (
                    <div>
                      <p className="font-medium text-sm mb-1">Notes:</p>
                      <p className="text-sm text-muted-foreground">{completionNotes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
