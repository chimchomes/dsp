import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Truck, MapPin, Clock, Package, Filter } from "lucide-react";

interface Driver {
  id: string;
  name: string;
  email: string;
  active: boolean;
}

interface Route {
  id: string;
  driver_id: string | null;
  address: string;
  time_window: string;
  customer_name: string;
  status: string;
  scheduled_date: string;
  package_type: string | null;
  tour_id?: string | null;
}

interface DriversPanelProps {
  drivers: Driver[];
  routes: Route[];
}

export const DriversPanel = ({ drivers, routes }: DriversPanelProps) => {
  const [selectedDriverId, setSelectedDriverId] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>("");

  const getDriverRoutes = (driverId: string) => {
    let driverRoutes = routes.filter((r) => r.driver_id === driverId && r.driver_id !== null);
    
    // Apply date filter if selected
    if (selectedDate) {
      driverRoutes = driverRoutes.filter((r) => {
        const routeDate = new Date(r.scheduled_date).toISOString().split("T")[0];
        return routeDate === selectedDate;
      });
    }
    
    // Sort by date (most recent first)
    return driverRoutes.sort((a, b) => {
      const dateA = new Date(a.scheduled_date).getTime();
      const dateB = new Date(b.scheduled_date).getTime();
      return dateB - dateA;
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-500",
      completed: "bg-green-500",
      delayed: "bg-orange-500",
      missed: "bg-red-500",
    };
    return colors[status] || "bg-gray-500";
  };

  // Get filtered drivers based on selection
  const filteredDrivers = selectedDriverId === "all" 
    ? drivers 
    : drivers.filter(d => d.id === selectedDriverId);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            Filter Drivers & Routes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="driver-filter" className="text-xs">Select Driver</Label>
              <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                <SelectTrigger id="driver-filter">
                  <SelectValue placeholder="All drivers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Drivers</SelectItem>
                  {drivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.name} ({driver.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-filter" className="text-xs">Filter by Date (Optional)</Label>
              <Input
                id="date-filter"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                placeholder="Select date to filter"
              />
            </div>
          </div>
          {selectedDriverId !== "all" && (
            <p className="text-xs text-muted-foreground mt-2">
              Showing all routes (past and present) for selected driver{selectedDate ? ` on ${selectedDate}` : ""}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Driver Cards */}
      {filteredDrivers.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">No drivers found</p>
          </CardContent>
        </Card>
      ) : (
        filteredDrivers.map((driver) => {
          const driverRoutes = getDriverRoutes(driver.id);
          const activeRoutes = driverRoutes.filter((r) => r.status === "pending" || r.status === "assigned" || r.status === "in_progress" || r.status === "delayed");
          const completedRoutes = driverRoutes.filter((r) => r.status === "completed");
          const totalRoutes = driverRoutes.length;

          return (
            <Card key={driver.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-full">
                      <Truck className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{driver.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{driver.email}</p>
                    </div>
                  </div>
                  <Badge variant={driver.active ? "default" : "secondary"}>
                    {driver.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total Routes:</span>
                    <span className="font-semibold">{totalRoutes}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Active Routes:</span>
                    <span className="font-semibold">{activeRoutes.length}</span>
                  </div>
                  {completedRoutes.length > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Completed Routes:</span>
                      <span className="font-semibold">{completedRoutes.length}</span>
                    </div>
                  )}
                  
                  {driverRoutes.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">
                      {selectedDate ? `No routes assigned for this date` : "No routes assigned"}
                    </p>
                  ) : (
                    <div className="space-y-2 mt-4">
                      {driverRoutes.map((route) => (
                        <div
                          key={route.id}
                          className="p-3 border rounded-lg space-y-2 bg-card hover:bg-accent/5 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 flex-1 min-w-0">
                              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {route.tour_id || route.customer_name}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">{route.address}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {new Date(route.scheduled_date).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <Badge variant="outline" className={getStatusColor(route.status)}>
                              {route.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {route.time_window || "TBD"}
                            </div>
                            {route.package_type && (
                              <div className="flex items-center gap-1">
                                <Package className="h-3 w-3" />
                                {route.package_type}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
};
