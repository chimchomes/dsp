import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, Package } from "lucide-react";

interface Driver {
  id: string;
  name: string;
  email?: string;
}

interface Route {
  id: string;
  tour_id: string | null;
  dispatcher_id: string;
  address: string;
  customer_name: string;
  scheduled_date: string;
  parcel_count_total: number;
  status: string;
  dispatcher?: {
    id: string;
    dsp_name: string;
  };
}

interface Dispatcher {
  id: string;
  dsp_name: string;
  name: string;
}

interface RouteAssignmentFormProps {
  drivers: Driver[];
  onClose: () => void;
  onSuccess: () => void;
}

export const RouteAssignmentForm = ({ drivers: driversProp, onClose, onSuccess }: RouteAssignmentFormProps) => {
  const { toast } = useToast();
  const [dispatchers, setDispatchers] = useState<Dispatcher[]>([]);
  const [selectedDispatcherId, setSelectedDispatcherId] = useState<string>("");
  const [availableRoutes, setAvailableRoutes] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [loadingDispatchers, setLoadingDispatchers] = useState(true);
  const [drivers, setDrivers] = useState<Driver[]>(driversProp || []);
  const [loadingDrivers, setLoadingDrivers] = useState(false);

  useEffect(() => {
    loadDispatchers();
    // If no drivers provided, load them directly
    if (!driversProp || driversProp.length === 0) {
      loadDrivers();
    } else {
      setDrivers(driversProp);
    }
  }, [driversProp]);

  useEffect(() => {
    // When dispatcher is selected, load routes for that dispatcher
    if (selectedDispatcherId) {
      loadRoutesForDispatcher(selectedDispatcherId);
      // Reset route and driver selection when dispatcher changes
      setSelectedRouteId("");
      setSelectedDriverId("");
    } else {
      setAvailableRoutes([]);
      setSelectedRouteId("");
      setSelectedDriverId("");
    }
  }, [selectedDispatcherId]);

  const loadDispatchers = async () => {
    setLoadingDispatchers(true);
    try {
      const { data, error } = await supabase
        .from("dispatchers")
        .select("id, dsp_name, name")
        .eq("active", true)
        .order("dsp_name");

      if (error) throw error;
      setDispatchers(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading dispatchers",
        description: error.message,
      });
    } finally {
      setLoadingDispatchers(false);
    }
  };

  const loadRoutesForDispatcher = async (dispatcherId: string) => {
    setLoadingRoutes(true);
    try {
      const { data, error } = await supabase
        .from("routes")
        .select(`
          *,
          dispatcher:dispatchers(id, dsp_name)
        `)
        .eq("dispatcher_id", dispatcherId)
        .is("driver_id", null)
        .neq("status", "completed") // Exclude completed routes
        .order("scheduled_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAvailableRoutes((data || []) as Route[]);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading routes",
        description: error.message,
      });
    } finally {
      setLoadingRoutes(false);
    }
  };

  const loadDrivers = async () => {
    setLoadingDrivers(true);
    try {
      const { data, error } = await supabase
        .from("drivers")
        .select("id, name, email")
        .eq("active", true)
        .order("name");

      if (error) throw error;
      setDrivers(data || []);
    } catch (error: any) {
      console.error("Error loading drivers:", error);
      toast({
        variant: "destructive",
        title: "Error loading drivers",
        description: error.message,
      });
    } finally {
      setLoadingDrivers(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedRouteId || !selectedDriverId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select both a route and a driver",
      });
      return;
    }

    setLoading(true);

    try {
      // Get the selected route to check its current status
      const selectedRoute = availableRoutes.find(r => r.id === selectedRouteId);
      
      if (!selectedRoute) {
        throw new Error("Selected route not found");
      }

      // Update the route with driver assignment
      // Use 'assigned' status when assigning a route to a driver
      const newStatus = selectedRoute.status === "pending" ? "assigned" : 
                       (selectedRoute.status === "assigned" ? "assigned" : selectedRoute.status || "assigned");
      
      const { data: updatedRoute, error } = await supabase
        .from("routes")
        .update({
          driver_id: selectedDriverId,
          status: newStatus,
        })
        .eq("id", selectedRouteId)
        .select()
        .single();

      if (error) {
        console.error("Route assignment error:", error);
        throw error;
      }

      if (!updatedRoute) {
        throw new Error("Route update returned no data");
      }

      console.log("Route assigned successfully:", updatedRoute);

      toast({
        title: "Route assigned",
        description: `Route ${selectedRoute.tour_id || selectedRoute.id} has been assigned to the driver.`,
      });

      // Call onSuccess to refresh parent component
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error assigning route:", error);
      toast({
        variant: "destructive",
        title: "Error assigning route",
        description: error.message || "Failed to assign route. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedRoute = availableRoutes.find(r => r.id === selectedRouteId);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Route to Driver</DialogTitle>
          <DialogDescription>
            Select an imported route and assign it to a driver. The driver will see this route in their portal.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dispatcher Selection */}
          <div className="space-y-2">
            <Label htmlFor="dispatcher">Select Dispatcher</Label>
            {loadingDispatchers ? (
              <div className="text-sm text-muted-foreground">Loading dispatchers...</div>
            ) : dispatchers.length === 0 ? (
              <div className="p-4 border rounded-md bg-muted">
                <p className="text-sm text-muted-foreground">
                  No active dispatchers available. Please create dispatchers first.
                </p>
              </div>
            ) : (
              <Select
                value={selectedDispatcherId}
                onValueChange={setSelectedDispatcherId}
                required
              >
                <SelectTrigger id="dispatcher">
                  <SelectValue placeholder="Choose a dispatcher" />
                </SelectTrigger>
                <SelectContent>
                  {dispatchers.map((dispatcher) => (
                    <SelectItem key={dispatcher.id} value={dispatcher.id}>
                      {dispatcher.dsp_name || dispatcher.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Route Selection - Only shown after dispatcher is selected */}
          {selectedDispatcherId && (
            <div className="space-y-2">
              <Label htmlFor="route">Select Route</Label>
              {loadingRoutes ? (
                <div className="text-sm text-muted-foreground">Loading routes...</div>
              ) : availableRoutes.length === 0 ? (
                <div className="p-4 border rounded-md bg-muted">
                  <p className="text-sm text-muted-foreground">
                    No unassigned routes available for this dispatcher. Import routes first using the "Import Route" button.
                  </p>
                </div>
              ) : (
                <Select
                  value={selectedRouteId}
                  onValueChange={(value) => {
                    setSelectedRouteId(value);
                    setSelectedDriverId(""); // Reset driver selection when route changes
                  }}
                  required
                >
                  <SelectTrigger id="route">
                    <SelectValue placeholder="Choose a route to assign" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoutes.map((route) => (
                      <SelectItem key={route.id} value={route.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">{route.tour_id || "N/A"}</span>
                          <span className="text-muted-foreground">-</span>
                          <span className="truncate max-w-xs">{route.customer_name || route.address}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Route Details Preview - Only shown after route is selected */}
          {selectedRouteId && selectedRoute && (
            <div className="p-4 border rounded-md bg-muted space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">Route Details</h4>
                <Badge variant="outline">{selectedRoute.status}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">Tour ID</Label>
                  <p className="font-mono">{selectedRoute.tour_id || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Dispatcher</Label>
                  <p>{selectedRoute.dispatcher?.dsp_name || "Unknown"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Customer</Label>
                  <p className="truncate">{selectedRoute.customer_name}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Parcels</Label>
                  <p>{selectedRoute.parcel_count_total || 0}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Address
                  </Label>
                  <p className="text-sm">{selectedRoute.address}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Scheduled Date
                  </Label>
                  <p className="text-sm">
                    {new Date(selectedRoute.scheduled_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Driver Selection - Only shown after route is selected */}
          {selectedRouteId && (
            <div className="space-y-2">
              <Label htmlFor="driver">Select Driver</Label>
              {loadingDrivers ? (
                <div className="text-sm text-muted-foreground">Loading drivers...</div>
              ) : drivers.length === 0 ? (
                <div className="p-4 border rounded-md bg-muted">
                  <p className="text-sm text-muted-foreground">
                    No active drivers available. Please ensure drivers are created and marked as active.
                  </p>
                </div>
              ) : (
                <Select
                  value={selectedDriverId}
                  onValueChange={setSelectedDriverId}
                  required
                >
                  <SelectTrigger id="driver">
                    <SelectValue placeholder="Choose a driver" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.name} {driver.email && `(${driver.email})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !selectedDispatcherId || !selectedRouteId || !selectedDriverId || availableRoutes.length === 0} 
              className="flex-1"
            >
              {loading ? "Assigning..." : "Assign Route"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
