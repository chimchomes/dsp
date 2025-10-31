import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Eye } from "lucide-react";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface OnboardingSession {
  id: string;
  user_id: string;
  full_name: string;
  contact_phone: string;
  email: string;
  vehicle_ownership_type: string;
  status: string;
  created_at: string;
  submitted_at?: string;
  license_number?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
}

export function OnboardingApplications() {
  const [applications, setApplications] = useState<OnboardingSession[]>([]);
  const [selectedApp, setSelectedApp] = useState<OnboardingSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    try {
      const { data, error } = await supabase
        .from("onboarding_sessions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setApplications(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading applications",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatus = async (id: string, status: "accepted" | "rejected") => {
    try {
      // Get the session to find the user_id
      const session = applications.find(app => app.id === id);
      if (!session) {
        throw new Error("Session not found");
      }

      // Update session status
      const { error: updateError } = await supabase
        .from("onboarding_sessions")
        .update({
          status,
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateError) throw updateError;

      // If accepted, change user role from onboarding to driver and create driver record
      if (status === "accepted") {
        // Remove onboarding role
        const { error: removeError } = await supabase.rpc("remove_user_role", {
          p_user_id: session.user_id,
          p_role: "onboarding",
        });

        if (removeError) {
          console.error("Error removing onboarding role:", removeError);
        }

        // Assign driver role
        const { error: assignError } = await supabase.rpc("assign_user_role", {
          p_user_id: session.user_id,
          p_role: "driver",
        });

        if (assignError) throw assignError;

        // Create driver record
        const { error: driverError } = await supabase
          .from("drivers")
          .insert({
            email: session.email,
            name: session.full_name,
            contact_phone: session.contact_phone,
            license_number: session.license_number,
            address: session.address,
            emergency_contact_name: session.emergency_contact_name,
            emergency_contact_phone: session.emergency_contact_phone,
            onboarded_at: new Date().toISOString(),
            onboarded_by: (await supabase.auth.getUser()).data.user?.id,
          });

        if (driverError) throw driverError;
      }

      toast({
        title: "Application updated",
        description: `Application ${status}${status === "accepted" ? ", driver role assigned, and driver account created" : ""}`,
      });

      loadApplications();
      setSelectedApp(null);
    } catch (error: any) {
      toast({
        title: "Error updating application",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      in_progress: "secondary",
      submitted: "default",
      accepted: "default",
      rejected: "destructive",
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {status.replace("_", " ").toUpperCase()}
      </Badge>
    );
  };

  if (isLoading) {
    return <div>Loading applications...</div>;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Onboarding Applications</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Vehicle Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((app) => (
                <TableRow key={app.id}>
                  <TableCell>{app.full_name || "N/A"}</TableCell>
                  <TableCell>{app.email}</TableCell>
                  <TableCell className="capitalize">{app.vehicle_ownership_type}</TableCell>
                  <TableCell>{getStatusBadge(app.status)}</TableCell>
                  <TableCell>{new Date(app.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedApp(app)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {app.status === "submitted" && (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => updateStatus(app.id, "accepted")}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => updateStatus(app.id, "rejected")}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedApp} onOpenChange={() => setSelectedApp(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Application Details</DialogTitle>
            <DialogDescription>
              Review the applicant's information
            </DialogDescription>
          </DialogHeader>
          {selectedApp && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold">Personal Information</h3>
                <p>Name: {selectedApp.full_name || "N/A"}</p>
                <p>Email: {selectedApp.email}</p>
                <p>Phone: {selectedApp.contact_phone || "N/A"}</p>
              </div>
              <div>
                <h3 className="font-semibold">Vehicle Information</h3>
                <p className="capitalize">Ownership: {selectedApp.vehicle_ownership_type}</p>
              </div>
              <div>
                <h3 className="font-semibold">Status</h3>
                {getStatusBadge(selectedApp.status)}
              </div>
              {selectedApp.status === "submitted" && (
                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={() => updateStatus(selectedApp.id, "accepted")}
                    className="flex-1"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Accept Application
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => updateStatus(selectedApp.id, "rejected")}
                    className="flex-1"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject Application
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
