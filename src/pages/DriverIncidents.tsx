import { useEffect, useMemo, useState } from "react";
import { useListPagination } from "@/hooks/useListPagination";
import { ListPaginationBar } from "@/components/ListPaginationBar";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { IncidentForm } from "@/components/IncidentForm";

type IncidentStatus = "submitted" | "acknowledged" | "resolved";

interface DriverProfile {
  id: string;
  name: string;
  email: string;
}

interface DriverIncident {
  id: string;
  description: string;
  photo_url?: string | null;
  status: IncidentStatus;
  created_at: string;
}

interface IncidentComment {
  id: string;
  incident_id: string;
  comment: string;
  commenter_role: string;
  created_at: string;
}

const incidentStatusVariant: Record<IncidentStatus, "default" | "secondary" | "destructive" | "outline"> = {
  submitted: "destructive",
  acknowledged: "secondary",
  resolved: "outline",
};

export default function DriverIncidents() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [incidents, setIncidents] = useState<DriverIncident[]>([]);
  const [incidentComments, setIncidentComments] = useState<Record<string, IncidentComment[]>>({});
  const [incidentPhotoLinks, setIncidentPhotoLinks] = useState<Record<string, string>>({});
  const [showIncidentForm, setShowIncidentForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | IncidentStatus>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (roles?.some((r) => r.role === "inactive")) {
        toast({
          title: "Access denied",
          description: "Your account is inactive. Please contact support.",
          variant: "destructive",
        });
        navigate("/login");
        return;
      }

      if (!roles?.some((r) => r.role === "driver")) {
        toast({
          title: "Access denied",
          description: "Driver access required.",
          variant: "destructive",
        });
        navigate("/login");
        return;
      }

      const { data: driverData, error: driverError } = await supabase
        .from("driver_profiles")
        .select("id, name, email, active")
        .eq("user_id", user.id)
        .maybeSingle();

      if (driverError) throw driverError;
      if (!driverData) {
        toast({
          title: "Profile setup required",
          description: "Driver profile not found. Please contact support.",
        });
        navigate("/dashboard");
        return;
      }
      if (driverData.active === false) {
        toast({
          title: "Access denied",
          description: "Your account is inactive. Please contact support.",
          variant: "destructive",
        });
        navigate("/login");
        return;
      }

      const profile: DriverProfile = {
        id: driverData.id,
        name: driverData.name || "Driver",
        email: driverData.email || "",
      };
      setDriver(profile);

      const { data: incidentsData, error: incidentsError } = await supabase
        .from("incidents")
        .select("id, description, photo_url, status, created_at")
        .eq("driver_id", profile.id)
        .order("created_at", { ascending: false });
      if (incidentsError) throw incidentsError;

      const rows = (incidentsData || []) as DriverIncident[];
      setIncidents(rows);

      const ids = rows.map((r) => r.id);
      if (ids.length > 0) {
        const { data: commentsData, error: commentsError } = await supabase
          .from("incident_comments")
          .select("id, incident_id, comment, commenter_role, created_at")
          .in("incident_id", ids)
          .order("created_at", { ascending: true });
        if (commentsError) throw commentsError;

        const grouped: Record<string, IncidentComment[]> = {};
        (commentsData || []).forEach((comment: any) => {
          if (!grouped[comment.incident_id]) grouped[comment.incident_id] = [];
          grouped[comment.incident_id].push(comment as IncidentComment);
        });
        setIncidentComments(grouped);
      } else {
        setIncidentComments({});
      }

      const withPhoto = rows.filter((r) => !!r.photo_url);
      const signed = await Promise.all(
        withPhoto.map(async (incident) => {
          const { data: signedData, error: signErr } = await supabase.storage
            .from("delivery-files")
            .createSignedUrl(incident.photo_url as string, 3600);
          if (signErr || !signedData?.signedUrl) return [incident.id, ""] as const;
          return [incident.id, signedData.signedUrl] as const;
        })
      );
      setIncidentPhotoLinks(Object.fromEntries(signed));
    } catch (error: any) {
      toast({
        title: "Error loading incidents",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredIncidents = useMemo(
    () =>
      incidents.filter((incident) => {
        if (statusFilter !== "all" && incident.status !== statusFilter) return false;

        const incidentDate = new Date(incident.created_at);
        if (dateFrom) {
          const fromDate = new Date(`${dateFrom}T00:00:00`);
          if (incidentDate < fromDate) return false;
        }
        if (dateTo) {
          const toDate = new Date(`${dateTo}T23:59:59`);
          if (incidentDate > toDate) return false;
        }

        return true;
      }),
    [incidents, statusFilter, dateFrom, dateTo]
  );

  const incidentsPaginationKey = `${statusFilter}|${dateFrom}|${dateTo}`;
  const {
    pageItems: pagedIncidents,
    page: incidentsPage,
    totalPages: incidentsTotalPages,
    totalItems: incidentsListTotal,
    goPrev: incidentsGoPrev,
    goNext: incidentsGoNext,
    pageSize: incidentsPageSize,
  } = useListPagination(filteredIncidents, incidentsPaginationKey);

  const selectedIncident = selectedIncidentId
    ? incidents.find((incident) => incident.id === selectedIncidentId) || null
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold">My Incidents</h1>
            <p className="text-sm text-muted-foreground">Track status and comments for your incident reports</p>
          </div>
        </div>
        <Button variant="destructive" onClick={() => setShowIncidentForm(true)} className="shrink-0">
          <AlertTriangle className="mr-2 h-4 w-4" />
          Report Incident
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Incident History</CardTitle>
          <div className="grid gap-3 md:grid-cols-4">
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | IncidentStatus)}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="acknowledged">Acknowledged</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>

            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              aria-label="Filter from date"
            />

            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              aria-label="Filter to date"
            />

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setStatusFilter("all");
                setDateFrom("");
                setDateTo("");
              }}
            >
              Clear filters
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {incidents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No incidents submitted yet.</p>
          ) : filteredIncidents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No incidents match the selected filters.</p>
          ) : (
            <div className="space-y-4">
              {pagedIncidents.map((incident) => (
                <div key={incident.id} className="rounded border p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant={incidentStatusVariant[incident.status]}>
                      {incident.status.toUpperCase()}
                    </Badge>
                    <p className="text-xs text-muted-foreground">
                      {new Date(incident.created_at).toLocaleString()}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {incident.description.length > 140
                      ? `${incident.description.slice(0, 140)}...`
                      : incident.description}
                  </p>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      {(incidentComments[incident.id] || []).length} comment(s)
                      {incident.photo_url && incidentPhotoLinks[incident.id] ? " • photo uploaded" : ""}
                    </p>
                    <Button type="button" variant="outline" onClick={() => setSelectedIncidentId(incident.id)}>
                      Review incident
                    </Button>
                  </div>
                </div>
              ))}
              <ListPaginationBar
                page={incidentsPage}
                totalPages={incidentsTotalPages}
                totalItems={incidentsListTotal}
                pageSize={incidentsPageSize}
                onPrev={incidentsGoPrev}
                onNext={incidentsGoNext}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {showIncidentForm && driver && (
        <IncidentForm
          driverId={driver.id}
          driverName={driver.name}
          driverEmail={driver.email}
          onClose={() => setShowIncidentForm(false)}
          onSuccess={() => {
            void loadData();
            setShowIncidentForm(false);
          }}
        />
      )}

      <Dialog open={!!selectedIncident} onOpenChange={(open) => !open && setSelectedIncidentId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Incident Details</DialogTitle>
          </DialogHeader>

          {selectedIncident && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <Badge variant={incidentStatusVariant[selectedIncident.status]}>
                  {selectedIncident.status.toUpperCase()}
                </Badge>
                <p className="text-xs text-muted-foreground">
                  {new Date(selectedIncident.created_at).toLocaleString()}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium mb-1">Description</p>
                <p className="text-sm whitespace-pre-wrap rounded bg-muted/40 p-3">
                  {selectedIncident.description}
                </p>
              </div>

              {selectedIncident.photo_url && incidentPhotoLinks[selectedIncident.id] && (
                <div>
                  <p className="text-sm font-medium mb-1">Evidence photo</p>
                  <a
                    href={incidentPhotoLinks[selectedIncident.id]}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-primary underline"
                  >
                    Open uploaded photo
                  </a>
                </div>
              )}

              <div>
                <p className="text-sm font-medium mb-1">Comments</p>
                {(incidentComments[selectedIncident.id] || []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">No comments yet.</p>
                ) : (
                  <div className="space-y-2">
                    {(incidentComments[selectedIncident.id] || []).map((comment) => (
                      <div key={comment.id} className="text-xs rounded bg-muted/40 p-2">
                        <div className="flex items-center justify-between text-muted-foreground mb-1">
                          <span>{comment.commenter_role}</span>
                          <span>{new Date(comment.created_at).toLocaleString()}</span>
                        </div>
                        <p className="whitespace-pre-wrap">{comment.comment}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

