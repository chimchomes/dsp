import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Package, Calendar, User, Eye, List, Filter } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Route {
  id: string;
  tour_id: string | null;
  address: string;
  customer_name: string;
  scheduled_date: string;
  status: string;
  parcel_count_total: number;
  parcels_delivered: number;
  time_window: string;
  driver_id?: string | null;
  dispatcher?: {
    id: string;
    dsp_name: string;
  };
  driver?: {
    id: string;
    name: string;
    email: string;
  };
}

interface Stop {
  id: string;
  stop_sequence: number;
  street_address: string;
  customer_name: string | null;
  package_details: string | null;
  geocoded: boolean;
}

interface ImportedRoutesPanelProps {
  routes: Route[];
}

export const ImportedRoutesPanel = ({ routes }: ImportedRoutesPanelProps) => {
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [loadingStops, setLoadingStops] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [dispatcherFilter, setDispatcherFilter] = useState<string>("all");
  const [driverFilter, setDriverFilter] = useState<string>("all");

  const handleViewDetails = async (route: Route) => {
    setSelectedRoute(route);
    setShowDetailsDialog(true);
    setLoadingStops(true);

    try {
      const { data: stopsData, error } = await supabase
        .from("stops")
        .select("*")
        .eq("route_id", route.id)
        .order("stop_sequence");

      if (error) throw error;
      setStops(stopsData || []);
    } catch (error) {
      console.error("Error loading stops:", error);
    } finally {
      setLoadingStops(false);
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

  // Get unique dispatchers and drivers for filters
  const dispatchers = Array.from(new Set(routes.map(r => r.dispatcher?.id).filter(Boolean)));
  const drivers = Array.from(new Set(routes.map(r => r.driver?.id).filter(Boolean)));

  // Apply filters
  const filteredRoutes = routes.filter((route) => {
    // Status filter
    if (statusFilter !== "all" && route.status !== statusFilter) return false;
    
    // Date filter
    if (dateFilter) {
      const routeDate = new Date(route.scheduled_date).toISOString().split("T")[0];
      if (routeDate !== dateFilter) return false;
    }
    
    // Dispatcher filter
    if (dispatcherFilter !== "all" && route.dispatcher?.id !== dispatcherFilter) return false;
    
    // Driver filter
    if (driverFilter !== "all") {
      if (driverFilter === "unassigned" && route.driver_id) return false;
      if (driverFilter !== "unassigned" && route.driver?.id !== driverFilter) return false;
    }
    
    return true;
  });

  const unassignedRoutes = filteredRoutes.filter((r) => !r.driver_id);
  const assignedRoutes = filteredRoutes.filter((r) => r.driver_id);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Imported Routes
            </CardTitle>
            <div className="flex gap-2">
              <Badge variant="outline">{filteredRoutes.length} Total</Badge>
              <Badge variant="secondary">{unassignedRoutes.length} Unassigned</Badge>
              <Badge variant="default">{assignedRoutes.length} Assigned</Badge>
            </div>
          </div>
          {/* Filters */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status-filter" className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status-filter">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="delayed">Delayed</SelectItem>
                  <SelectItem value="missed">Missed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-filter" className="text-xs">Date</Label>
              <Input
                id="date-filter"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                placeholder="Filter by date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dispatcher-filter" className="text-xs">Dispatcher</Label>
              <Select value={dispatcherFilter} onValueChange={setDispatcherFilter}>
                <SelectTrigger id="dispatcher-filter">
                  <SelectValue placeholder="All dispatchers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dispatchers</SelectItem>
                  {routes
                    .filter((r, idx, self) => r.dispatcher && self.findIndex(rt => rt.dispatcher?.id === r.dispatcher?.id) === idx)
                    .map((route) => (
                      <SelectItem key={route.dispatcher?.id} value={route.dispatcher?.id || ""}>
                        {route.dispatcher?.dsp_name || "Unknown"}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="driver-filter" className="text-xs">Driver</Label>
              <Select value={driverFilter} onValueChange={setDriverFilter}>
                <SelectTrigger id="driver-filter">
                  <SelectValue placeholder="All drivers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Drivers</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {routes
                    .filter((r) => r.driver && r.driver.id)
                    .filter((r, idx, self) => self.findIndex(rt => rt.driver?.id === r.driver?.id) === idx)
                    .map((route) => (
                      <SelectItem key={route.driver?.id} value={route.driver?.id || ""}>
                        {route.driver?.name || "Unknown"}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredRoutes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {routes.length === 0 
                ? 'No routes imported yet. Use "Import Route" to add routes.'
                : "No routes match the selected filters."}
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tour ID</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Parcels</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRoutes.map((route) => (
                    <TableRow key={route.id}>
                      <TableCell className="font-mono text-sm">
                        {route.tour_id || "N/A"}
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
                            <span className="text-sm">{route.driver.name}</span>
                          </div>
                        ) : (
                          <Badge variant="outline">Unassigned</Badge>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(route.status)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(route)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Route Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Route Details</DialogTitle>
            <DialogDescription>
              Complete information about this imported route
            </DialogDescription>
          </DialogHeader>
          {selectedRoute && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Tour ID</p>
                  <p className="font-mono text-sm">{selectedRoute.tour_id || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Scheduled Date</p>
                  <p>{new Date(selectedRoute.scheduled_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <div>{getStatusBadge(selectedRoute.status)}</div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Total Parcels</p>
                  <p>{selectedRoute.parcel_count_total || 0}</p>
                </div>
                {selectedRoute.driver && (
                  <>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Assigned Driver</p>
                      <p>{selectedRoute.driver.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Driver Email</p>
                      <p className="text-sm">{selectedRoute.driver.email}</p>
                    </div>
                  </>
                )}
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Primary Address</p>
                <p>{selectedRoute.address}</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-2">Stops ({stops.length})</p>
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
    </>
  );
};

