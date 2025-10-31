import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Image as ImageIcon } from "lucide-react";

interface Driver {
  id: string;
  name: string;
}

interface Incident {
  id: string;
  driver_id: string;
  description: string;
  photo_url: string | null;
  created_at: string;
}

interface IncidentFeedProps {
  incidents: Incident[];
  drivers: Driver[];
}

export const IncidentFeed = ({ incidents, drivers }: IncidentFeedProps) => {
  const getDriverName = (driverId: string) => {
    return drivers.find((d) => d.id === driverId)?.name || "Unknown Driver";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          Incident Feed
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {incidents.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No incidents reported</p>
          ) : (
            incidents.map((incident) => (
              <div key={incident.id} className="p-3 border rounded-lg bg-card space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="destructive" className="text-xs">
                        Incident
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {getDriverName(incident.driver_id)}
                      </span>
                    </div>
                    <p className="text-sm">{incident.description}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{new Date(incident.created_at).toLocaleString()}</span>
                  {incident.photo_url && (
                    <a
                      href={incident.photo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      <ImageIcon className="h-3 w-3" />
                      View Photo
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
