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

interface RouteAssignmentFormProps {
  drivers: Driver[];
  onClose: () => void;
  onSuccess: () => void;
}

export const RouteAssignmentForm = ({ drivers: driversProp, onClose, onSuccess }: RouteAssignmentFormProps) => {
  const { toast } = useToast();
  const [unassignedRoutes, setUnassignedRoutes] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [drivers, setDrivers] = useState<Driver[]>(driversProp || []);
  const [loadingDrivers, setLoadingDrivers] = useState(false);

  useEffect(() => {
    loadUnassignedRoutes();
    // If no drivers provided, load them directly
    if (!driversProp || driversProp.length === 0) {
      loadDrivers();
    } else {
      setDrivers(driversProp);
    }
  }, [driversProp]);

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

  const loadUnassignedRoutes = async () => {
    setLoadingRoutes(true);
    try {
      const { data, error } = await supabase
        .from("routes")
        .select(`
          *,
          dispatcher:dispatchers(id, dsp_name)
        `)
        .is("driver_id", null)
        .order("scheduled_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUnassignedRoutes((data || []) as Route[]);
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
      const selectedRoute = unassignedRoutes.find(r => r.id === selectedRouteId);
      
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

  const selectedRoute = unassignedRoutes.find(r => r.id === selectedRouteId);

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
          {/* Route Selection */}
          <div className="space-y-2">
            <Label htmlFor="route">Select Route</Label>
            {loadingRoutes ? (
              <div className="text-sm text-muted-foreground">Loading routes...</div>
            ) : unassignedRoutes.length === 0 ? (
              <div className="p-4 border rounded-md bg-muted">
                <p className="text-sm text-muted-foreground">
                  No unassigned routes available. Import routes first using the "Import Route" button.
                </p>
              </div>
            ) : (
              <Select
                value={selectedRouteId}
                onValueChange={setSelectedRouteId}
                required
              >
                <SelectTrigger id="route">
                  <SelectValue placeholder="Choose a route to assign" />
                </SelectTrigger>
                <SelectContent>
                  {unassignedRoutes.map((route) => (
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

          {/* Route Details Preview */}
          {selectedRoute && (
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

          {/* Driver Selection */}
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
                disabled={!selectedRouteId}
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
            {!selectedRouteId && (
              <p className="text-xs text-muted-foreground">
                Please select a route first
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !selectedRouteId || !selectedDriverId || unassignedRoutes.length === 0} 
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
