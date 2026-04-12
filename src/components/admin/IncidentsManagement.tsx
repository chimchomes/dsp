import { useEffect, useState } from "react";
import { useListPagination } from "@/hooks/useListPagination";
import { ListPaginationBar } from "@/components/ListPaginationBar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type IncidentStatus = "submitted" | "acknowledged" | "resolved";

interface Incident {
  id: string;
  driver_id: string;
  tenant_id: string;
  description: string;
  photo_url?: string | null;
  status: IncidentStatus;
  created_at: string;
  reviewed_at?: string | null;
  driver_profiles?: {
    name?: string | null;
    email?: string | null;
  } | null;
}

interface IncidentComment {
  id: string;
  comment: string;
  commenter_role: string;
  created_at: string;
}

const statusVariant: Record<IncidentStatus, "default" | "secondary" | "destructive" | "outline"> = {
  submitted: "destructive",
  acknowledged: "secondary",
  resolved: "outline",
};

export default function IncidentsManagement() {
  const { toast } = useToast();
  const { tenant, isLoading: tenantLoading, isMasterAdmin } = useTenant();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Incident | null>(null);
  const [nextStatus, setNextStatus] = useState<IncidentStatus>("submitted");
  const [newComment, setNewComment] = useState("");
  const [comments, setComments] = useState<IncidentComment[]>([]);
  const [saving, setSaving] = useState(false);
  const [photoLinks, setPhotoLinks] = useState<Record<string, string>>({});

  const {
    pageItems: pagedIncidents,
    page: incidentsPage,
    totalPages: incidentsTotalPages,
    totalItems: incidentsTotal,
    goPrev: incidentsGoPrev,
    goNext: incidentsGoNext,
    pageSize: incidentsPageSize,
  } = useListPagination(incidents, String(incidents.length));

  const loadIncidents = async () => {
    if (tenantLoading) return;
    if (!isMasterAdmin && !tenant?.id) {
      setIncidents([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      let query = supabase
        .from("incidents")
        .select("id, driver_id, tenant_id, description, photo_url, status, created_at, reviewed_at, driver_profiles(name, email)")
        .order("created_at", { ascending: false });

      if (!isMasterAdmin && tenant?.id) {
        query = query.eq("tenant_id", tenant.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      const rows = (data || []) as unknown as Incident[];
      setIncidents(rows);

      const withPhotos = rows.filter((r) => !!r.photo_url);
      const signed = await Promise.all(
        withPhotos.map(async (r) => {
          const { data: signedData, error: signErr } = await supabase.storage
            .from("delivery-files")
            .createSignedUrl(r.photo_url as string, 3600);
          if (signErr || !signedData?.signedUrl) return [r.id, ""] as const;
          return [r.id, signedData.signedUrl] as const;
        })
      );
      setPhotoLinks(Object.fromEntries(signed));
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
    void loadIncidents();
  }, [tenant?.id, tenantLoading, isMasterAdmin]);

  const openIncident = async (incident: Incident) => {
    setSelected(incident);
    setNextStatus(incident.status);
    setNewComment("");
    try {
      const { data, error } = await supabase
        .from("incident_comments")
        .select("id, comment, commenter_role, created_at")
        .eq("incident_id", incident.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setComments((data || []) as IncidentComment[]);
    } catch (error: any) {
      toast({
        title: "Error loading comments",
        description: error.message,
        variant: "destructive",
      });
      setComments([]);
    }
  };

  const handleSave = async () => {
    if (!selected) return;
    try {
      setSaving(true);
      const { data: authData } = await supabase.auth.getUser();
      const adminUserId = authData.user?.id || null;
      const now = new Date().toISOString();

      const { error: updateError } = await supabase
        .from("incidents")
        .update({
          status: nextStatus,
          reviewed_by: adminUserId,
          reviewed_at: now,
          resolved_at: nextStatus === "resolved" ? now : null,
        })
        .eq("id", selected.id);
      if (updateError) throw updateError;

      if (newComment.trim()) {
        const { error: insertCommentError } = await supabase
          .from("incident_comments")
          .insert({
            incident_id: selected.id,
            tenant_id: selected.tenant_id,
            user_id: adminUserId,
            commenter_role: "admin",
            comment: newComment.trim(),
          });
        if (insertCommentError) throw insertCommentError;
      }

      toast({ title: "Incident updated" });
      setSelected(null);
      setComments([]);
      setNewComment("");
      await loadIncidents();
    } catch (error: any) {
      toast({
        title: "Error updating incident",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Incidents</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading incidents...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Driver</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No incidents found
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedIncidents.map((incident) => (
                    <TableRow key={incident.id}>
                      <TableCell>
                        {incident.driver_profiles?.name || incident.driver_profiles?.email || "Unknown"}
                      </TableCell>
                      <TableCell className="max-w-[420px] truncate">{incident.description}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[incident.status]}>
                          {incident.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(incident.created_at).toLocaleString()}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => void openIncident(incident)}>
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
          {!loading && incidents.length > 0 && (
            <ListPaginationBar
              className="mt-4"
              page={incidentsPage}
              totalPages={incidentsTotalPages}
              totalItems={incidentsTotal}
              pageSize={incidentsPageSize}
              onPrev={incidentsGoPrev}
              onNext={incidentsGoNext}
            />
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setComments([]);
            setNewComment("");
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Incident Review</DialogTitle>
            <DialogDescription>
              Add comments and update status so drivers can track progress.
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div className="rounded border p-3 space-y-1">
                <p className="text-sm font-medium">Driver</p>
                <p className="text-sm text-muted-foreground">
                  {selected.driver_profiles?.name || selected.driver_profiles?.email || "Unknown"}
                </p>
                <p className="text-sm font-medium mt-2">Description</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selected.description}</p>
                {selected.photo_url && photoLinks[selected.id] && (
                  <a
                    href={photoLinks[selected.id]}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm underline text-primary"
                  >
                    Open uploaded photo
                  </a>
                )}
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Status</p>
                <Select value={nextStatus} onValueChange={(v) => setNextStatus(v as IncidentStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="acknowledged">Acknowledged</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Add Admin Comment</p>
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write an update for the driver..."
                  rows={4}
                />
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Comment History</p>
                {comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No comments yet.</p>
                ) : (
                  <div className="space-y-2">
                    {comments.map((comment) => (
                      <div key={comment.id} className="rounded border p-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <span>{comment.commenter_role}</span>
                          <span>{new Date(comment.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{comment.comment}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)} disabled={saving}>
              Close
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

