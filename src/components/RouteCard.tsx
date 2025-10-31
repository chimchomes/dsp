import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, User, FileText, CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface Route {
  id: string;
  address: string;
  time_window: string;
  customer_name: string;
  delivery_notes: string | null;
  status: string;
}

interface RouteCardProps {
  route: Route;
  onStatusUpdate: (routeId: string, status: string) => void;
}

const statusConfig = {
  pending: { color: "bg-muted", icon: Clock, label: "Pending" },
  completed: { color: "bg-green-100 dark:bg-green-900/20", icon: CheckCircle, label: "Completed" },
  missed: { color: "bg-red-100 dark:bg-red-900/20", icon: XCircle, label: "Missed" },
  delayed: { color: "bg-yellow-100 dark:bg-yellow-900/20", icon: AlertCircle, label: "Delayed" },
};

export const RouteCard = ({ route, onStatusUpdate }: RouteCardProps) => {
  const status = statusConfig[route.status as keyof typeof statusConfig] || statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <Card className={`p-4 ${status.color} transition-all`}>
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="font-semibold">{route.address}</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{route.time_window}</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4" />
              <span>{route.customer_name}</span>
            </div>

            {route.delivery_notes && (
              <div className="flex items-start gap-2 text-sm">
                <FileText className="h-4 w-4 mt-0.5" />
                <span className="text-muted-foreground">{route.delivery_notes}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <StatusIcon className="h-5 w-5" />
            <span className="text-sm font-medium">{status.label}</span>
          </div>
        </div>

        {route.status === "pending" && (
          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              onClick={() => onStatusUpdate(route.id, "completed")}
              className="flex-1"
            >
              Complete
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onStatusUpdate(route.id, "delayed")}
              className="flex-1"
            >
              Delayed
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onStatusUpdate(route.id, "missed")}
              className="flex-1"
            >
              Missed
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
};
