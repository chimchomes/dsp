import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Package, MapPin, Calendar, User, Truck, Eye, UserPlus } from "lucide-react";
import { Label } from "@/components/ui/label";

interface Route {
  id: string;
  tour_id: string | null;
  dispatcher_id: string;
  driver_id: string | null;
  address: string;
  customer_name: string;
  scheduled_date: string;
  status: string;
  parcel_count_total: number;
  parcels_delivered: number;
  time_window: string;
  created_at: string;
  dispatcher?: {
    id: string;
    dsp_name: string;
    tour_id_prefix: string | null;
  };
  driver?: {
    id: string;
    name: string;
    email: string;
  };
}

interface Driver {
  id: string;
  name: string;
  email: string;
  active: boolean;
}

interface Stop {
  id: string;
  stop_sequence: number;
  street_address: string;
  customer_name: string | null;
  package_details: string | null;
  geocoded: boolean;
}

export const RouteManagement = () => {
  const { toast } = useToast();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loadingStops, setLoadingStops] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load all routes (including unassigned ones)
      const { data: routesData, error: routesError } = await supabase
        .from("routes")
        .select(`
          *,
          dispatcher:dispatchers(id, dsp_name, tour_id_prefix),
          driver:drivers(id, name, email)
        `)
        .order("created_at", { ascending: false });

      if (routesError) throw routesError;

      // Load all active drivers
      const { data: driversData, error: driversError } = await supabase
        .from("drivers")
        .select("*")
        .eq("active", true)
        .order("name");

      if (driversError) throw driversError;

      setRoutes((routesData || []) as Route[]);
      setDrivers(driversData || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading data",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadRouteStops = async (routeId: string) => {
    setLoadingStops(true);
    try {
      const { data: stopsData, error } = await supabase
        .from("stops")
        .select("*")
        .eq("route_id", routeId)
        .order("stop_sequence");

      if (error) throw error;
      setStops(stopsData || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading stops",
        description: error.message,
      });
    } finally {
      setLoadingStops(false);
    }
  };

  const handleViewDetails = async (route: Route) => {
    setSelectedRoute(route);
    setShowDetailsDialog(true);
    await loadRouteStops(route.id);
  };

  const handleAssignRoute = (route: Route) => {
    setSelectedRoute(route);
    setSelectedDriverId(route.driver_id || "");
    setShowAssignDialog(true);
  };

  const handleSaveAssignment = async () => {
    if (!selectedRoute || !selectedDriverId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a driver",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("routes")
        .update({
          driver_id: selectedDriverId,
          status: selectedRoute.status === "pending" ? "assigned" : selectedRoute.status,
        })
        .eq("id", selectedRoute.id);

      if (error) throw error;

      toast({
        title: "Route assigned",
        description: "The route has been successfully assigned to the driver",
      });

      setShowAssignDialog(false);
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error assigning route",
        description: error.message,
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "outline",
      assigned: "default",
      in_progress: "default",
      completed: "default",
      delayed: "secondary",
      missed: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const unassignedRoutes = routes.filter((r) => !r.driver_id);
  const assignedRoutes = routes.filter((r) => r.driver_id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Route Management</h2>
          <p className="text-muted-foreground">
            View and assign imported routes to drivers
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">{routes.length} Total Routes</Badge>
          <Badge variant="secondary">{unassignedRoutes.length} Unassigned</Badge>
          <Badge variant="default">{assignedRoutes.length} Assigned</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Routes</CardTitle>
          <CardDescription>
            Routes imported by dispatchers. Assign unassigned routes to drivers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tour ID</TableHead>
                  <TableHead>Dispatcher</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Scheduled Date</TableHead>
                  <TableHead>Parcels</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No routes found. Routes will appear here after dispatchers import them.
                    </TableCell>
                  </TableRow>
                ) : (
                  routes.map((route) => (
                    <TableRow key={route.id}>
                      <TableCell className="font-mono text-sm">
                        {route.tour_id || "N/A"}
                      </TableCell>
                      <TableCell>
                        {route.dispatcher?.dsp_name || "Unknown"}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {route.address}
                      </TableCell>
                      <TableCell>
                        {new Date(route.scheduled_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {route.parcels_delivered || 0} / {route.parcel_count_total || 0}
                      </TableCell>
                      <TableCell>
                        {route.driver ? (
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span>{route.driver.name}</span>
                          </div>
                        ) : (
                          <Badge variant="outline">Unassigned</Badge>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(route.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(route)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAssignRoute(route)}
                          >
                            <UserPlus className="h-4 w-4 mr-1" />
                            {route.driver_id ? "Reassign" : "Assign"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Route Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Route Details</DialogTitle>
            <DialogDescription>
              Complete information about this route including all stops
            </DialogDescription>
          </DialogHeader>
          {selectedRoute && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Tour ID</Label>
                  <p className="font-mono text-sm">{selectedRoute.tour_id || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Dispatcher</Label>
                  <p>{selectedRoute.dispatcher?.dsp_name || "Unknown"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Scheduled Date</Label>
                  <p>{new Date(selectedRoute.scheduled_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <div>{getStatusBadge(selectedRoute.status)}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Total Parcels</Label>
                  <p>{selectedRoute.parcel_count_total || 0}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Delivered</Label>
                  <p>{selectedRoute.parcels_delivered || 0}</p>
                </div>
                {selectedRoute.driver && (
                  <>
                    <div>
                      <Label className="text-xs text-muted-foreground">Assigned Driver</Label>
                      <p>{selectedRoute.driver.name}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Driver Email</Label>
                      <p className="text-sm">{selectedRoute.driver.email}</p>
                    </div>
                  </>
                )}
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Primary Address</Label>
                <p>{selectedRoute.address}</p>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Stops ({stops.length})</Label>
                {loadingStops ? (
                  <p className="text-sm text-muted-foreground">Loading stops...</p>
                ) : stops.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No stops recorded for this route</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto border rounded p-2">
                    {stops.map((stop) => (
                      <div key={stop.id} className="flex items-start gap-2 p-2 border-b last:border-0">
                        <Badge variant="outline" className="mt-1">
                          #{stop.stop_sequence}
                        </Badge>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{stop.street_address}</p>
                          {stop.customer_name && (
                            <p className="text-xs text-muted-foreground">Customer: {stop.customer_name}</p>
                          )}
                          {stop.package_details && (
                            <p className="text-xs text-muted-foreground">Package: {stop.package_details}</p>
                          )}
                          {!stop.geocoded && (
                            <Badge variant="destructive" className="text-xs mt-1">Not Geocoded</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Assign Route Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Route to Driver</DialogTitle>
            <DialogDescription>
              Select a driver to assign this route to. Drivers can be assigned routes from any dispatcher.
            </DialogDescription>
          </DialogHeader>
          {selectedRoute && (
            <div className="space-y-4">
              <div>
                <Label>Route Information</Label>
                <div className="mt-2 p-3 bg-muted rounded-md space-y-1 text-sm">
                  <p><strong>Tour ID:</strong> {selectedRoute.tour_id || "N/A"}</p>
                  <p><strong>Dispatcher:</strong> {selectedRoute.dispatcher?.dsp_name || "Unknown"}</p>
                  <p><strong>Address:</strong> {selectedRoute.address}</p>
                  <p><strong>Parcels:</strong> {selectedRoute.parcel_count_total || 0}</p>
                </div>
              </div>

              <div>
                <Label htmlFor="driver-select">Select Driver</Label>
                <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                  <SelectTrigger id="driver-select" className="mt-2">
                    <SelectValue placeholder="Choose a driver" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.name} ({driver.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveAssignment}>
                  Assign Route
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

