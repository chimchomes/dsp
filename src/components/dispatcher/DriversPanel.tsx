import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, MapPin, Clock, Package } from "lucide-react";

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
}

interface DriversPanelProps {
  drivers: Driver[];
  routes: Route[];
}

export const DriversPanel = ({ drivers, routes }: DriversPanelProps) => {
  const getDriverRoutes = (driverId: string) => {
    return routes.filter((r) => r.driver_id === driverId && r.driver_id !== null);
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

  return (
    <div className="space-y-4">
      {drivers.map((driver) => {
        const driverRoutes = getDriverRoutes(driver.id);
        const activeRoutes = driverRoutes.filter((r) => r.status === "pending" || r.status === "delayed");

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
                  <span className="text-muted-foreground">Active Routes:</span>
                  <span className="font-semibold">{activeRoutes.length}</span>
                </div>
                
                {driverRoutes.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No routes assigned</p>
                ) : (
                  <div className="space-y-2">
                    {driverRoutes.slice(0, 3).map((route) => (
                      <div
                        key={route.id}
                        className="p-3 border rounded-lg space-y-2 bg-card hover:bg-accent/5 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{route.customer_name}</p>
                              <p className="text-xs text-muted-foreground truncate">{route.address}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className={getStatusColor(route.status)}>
                            {route.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {route.time_window}
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
                    {driverRoutes.length > 3 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{driverRoutes.length - 3} more routes
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
