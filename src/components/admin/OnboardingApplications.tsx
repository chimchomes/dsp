import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Eye, Edit } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
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
  first_name?: string;
  surname?: string;
  contact_phone: string;
  email: string;
  vehicle_ownership_type: string;
  vehicle_type?: string;
  status: string;
  created_at: string;
  submitted_at?: string;
  // Legacy license fields
  license_number?: string;
  license_expiry?: string;
  // New license fields
  drivers_license_number?: string;
  license_expiry_date?: string;
  // Address fields
  address?: string;
  address_line_1?: string;
  address_line_2?: string;
  address_line_3?: string;
  post_code?: string;
  // Emergency contact
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  // National Insurance
  national_insurance_number?: string;
}

export function OnboardingApplications() {
  const [applications, setApplications] = useState<OnboardingSession[]>([]);
  const [selectedApp, setSelectedApp] = useState<OnboardingSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingVehicleType, setEditingVehicleType] = useState(false);
  const [vehicleTypeValue, setVehicleTypeValue] = useState<string>("");
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

  const updateStatus = async (id: string, status: "accepted" | "rejected" | "re-submit") => {
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
        console.log("Processing acceptance for user:", session.user_id, session.email);
        
        // Check if driver record already exists in driver_profiles
        const { data: existingDriver, error: checkError } = await supabase
          .from("driver_profiles")
          .select("id, user_id, email, name")
          .eq("user_id", session.user_id)
          .maybeSingle();

        if (checkError) {
          console.error("Error checking for existing driver:", checkError);
          throw new Error(`Failed to check for existing driver: ${checkError.message}`);
        }

        if (existingDriver) {
          console.log("Driver record already exists:", existingDriver.id);
          // Driver already exists, just update role
          const { error: removeError } = await supabase.rpc("remove_user_role", {
            p_user_id: session.user_id,
            p_role: "onboarding",
          });

          if (removeError) {
            console.error("Error removing onboarding role:", removeError);
            // Continue anyway - might already be removed
          }

          const { error: assignError } = await supabase.rpc("assign_user_role", {
            p_user_id: session.user_id,
            p_role: "driver",
          });

          if (assignError) {
            console.error("Error assigning driver role:", assignError);
            throw new Error(`Failed to assign driver role: ${assignError.message}`);
          }

          toast({
            title: "Application approved",
            description: `Driver role assigned. ${session.full_name || session.email} can now log in to the DSP Portal.`,
          });
        } else {
          console.log("No existing driver record found. Creating new driver record...");
          
          // Remove onboarding role first
          const { error: removeError } = await supabase.rpc("remove_user_role", {
            p_user_id: session.user_id,
            p_role: "onboarding",
          });

          if (removeError) {
            console.error("Error removing onboarding role:", removeError);
            // Continue anyway - might already be removed
          }

          // Assign driver role
          const { error: assignError } = await supabase.rpc("assign_user_role", {
            p_user_id: session.user_id,
            p_role: "driver",
          });

          if (assignError) {
            console.error("Error assigning driver role:", assignError);
            throw new Error(`Failed to assign driver role: ${assignError.message}`);
          }

          console.log("Driver role assigned successfully");

          // Use first_name/surname if available, otherwise parse from full_name
          const firstName = session.first_name || session.full_name?.split(' ')[0] || null;
          const surname = session.surname || session.full_name?.split(' ').slice(1).join(' ') || null;
          const fullName = session.full_name || (firstName && surname ? `${firstName} ${surname}` : null);
          
          // Get license info - prefer new fields, fallback to legacy
          const licenseNumber = session.drivers_license_number || session.license_number || null;
          const licenseExpiry = session.license_expiry_date || session.license_expiry || null;
          
          // Get approver user ID
          const { data: { user: approver } } = await supabase.auth.getUser();

          // Prepare driver data - driver_profiles is now the single source of truth
          const driverData = {
            user_id: session.user_id,
            email: session.email,
            name: fullName || session.email,
            first_name: firstName,
            surname: surname,
            contact_phone: session.contact_phone || null,
            address_line_1: session.address_line_1 || null,
            address_line_2: session.address_line_2 || null,
            address_line_3: session.address_line_3 || null,
            postcode: session.post_code || null,
            emergency_contact_name: session.emergency_contact_name || null,
            emergency_contact_phone: session.emergency_contact_phone || null,
            license_number: licenseNumber,
            license_expiry: licenseExpiry ? new Date(licenseExpiry).toISOString().split('T')[0] : null,
            national_insurance: session.national_insurance_number || null,
            onboarded_at: new Date().toISOString(),
            onboarded_by: approver?.id || null,
            active: true,
          };

          console.log("Creating driver_profiles record with data:", driverData);

          // Create driver_profiles record (single source of truth for driver data)
          const { data: newDriver, error: driverError } = await supabase
            .from("driver_profiles")
            .insert(driverData)
            .select("id, user_id, email, name")
            .single();

          if (driverError) {
            console.error("Error creating driver record:", driverError);
            console.error("Full error details:", JSON.stringify(driverError, null, 2));
            throw new Error(`Failed to create driver record: ${driverError.message}. Details: ${JSON.stringify(driverError)}`);
          }

          if (!newDriver) {
            throw new Error("Driver record insert returned no data");
          }

          console.log("Driver record created successfully:", newDriver.id);

          toast({
            title: "Application approved",
            description: `Driver account created and role assigned. ${session.full_name || session.email} can now log in to the DSP Portal.`,
          });
        }
      } else if (status === "rejected") {
        toast({
          title: "Application rejected",
          description: `Application for ${session.full_name || session.email} has been rejected.`,
        });
      } else if (status === "re-submit") {
        toast({
          title: "Resubmission requested",
          description: `${session.full_name || session.email} has been notified to resubmit their application.`,
        });
      }

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
                      {app.status === "accepted" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus(app.id, "re-submit")}
                        >
                          Request Resubmit
                        </Button>
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
            <div className="space-y-4" onLoad={() => setEditingVehicleType(false)}>
              <div>
                <h3 className="font-semibold">Personal Information</h3>
                <p>Name: {selectedApp.full_name || "N/A"}</p>
                <p>Email: {selectedApp.email}</p>
                <p>Phone: {selectedApp.contact_phone || "N/A"}</p>
              </div>
              <div>
                <h3 className="font-semibold">Vehicle Information</h3>
                <p className="capitalize">Ownership: {selectedApp.vehicle_ownership_type}</p>
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="vehicle_type">Vehicle Type:</Label>
                    {editingVehicleType ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Select
                          value={vehicleTypeValue || selectedApp.vehicle_type || ""}
                          onValueChange={setVehicleTypeValue}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="Select vehicle type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="own vehicle">Own Vehicle</SelectItem>
                            <SelectItem value="LEASED">LEASED</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          onClick={async () => {
                            try {
                              const { error } = await supabase
                                .from("onboarding_sessions")
                                .update({ vehicle_type: vehicleTypeValue })
                                .eq("id", selectedApp.id);
                              
                              if (error) throw error;
                              
                              toast({
                                title: "Success",
                                description: "Vehicle type updated successfully",
                              });
                              
                              setEditingVehicleType(false);
                              loadApplications();
                              // Update selectedApp to reflect the change
                              setSelectedApp({ ...selectedApp, vehicle_type: vehicleTypeValue });
                            } catch (error: any) {
                              toast({
                                title: "Error",
                                description: error.message,
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingVehicleType(false);
                            setVehicleTypeValue("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span>{selectedApp.vehicle_type || "Not set"}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingVehicleType(true);
                            setVehicleTypeValue(selectedApp.vehicle_type || "");
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Used for pay rate allocation by Finance
                  </p>
                </div>
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
              {selectedApp.status === "accepted" && (
                <div className="pt-4">
                  <Button
                    variant="outline"
                    onClick={() => updateStatus(selectedApp.id, "re-submit")}
                    className="w-full"
                  >
                    Request Resubmit
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
