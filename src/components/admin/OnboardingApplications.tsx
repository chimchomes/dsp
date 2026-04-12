import { useEffect, useState } from "react";
import { useListPagination } from "@/hooks/useListPagination";
import { ListPaginationBar } from "@/components/ListPaginationBar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Eye } from "lucide-react";
import { useTenant } from "@/contexts/TenantContext";
import { Textarea } from "@/components/ui/textarea";
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

interface OnboardingSession {
  id: string;
  user_id: string;
  tenant_id?: string;
  full_name: string;
  first_name?: string;
  surname?: string;
  contact_phone: string;
  email: string;
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
  // Additional onboarding fields
  passport_number?: string;
  passport_expiry_date?: string;
  driver_availability?: string;
  dvla_code?: string;
  dbs_check?: boolean;
  license_picture?: string;
  passport_upload?: string;
  photo_upload?: string;
  rejection_comment?: string;
}

export function OnboardingApplications() {
  const [applications, setApplications] = useState<OnboardingSession[]>([]);
  const [selectedApp, setSelectedApp] = useState<OnboardingSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectingApp, setRejectingApp] = useState<OnboardingSession | null>(null);
  const [rejectionComment, setRejectionComment] = useState("");
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);
  const { toast } = useToast();
  const { tenant, isLoading: tenantLoading, isMasterAdmin } = useTenant();

  const {
    pageItems: pagedApplications,
    page: appsPage,
    totalPages: appsTotalPages,
    totalItems: appsTotal,
    goPrev: appsGoPrev,
    goNext: appsGoNext,
    pageSize: appsPageSize,
  } = useListPagination(applications, String(applications.length));

  useEffect(() => {
    if (tenantLoading) return;
    loadApplications();
  }, [tenant?.id, tenantLoading, isMasterAdmin]);

  useEffect(() => {
    const loadDocumentUrls = async () => {
      if (!selectedApp) {
        setDocumentUrls({});
        return;
      }

      const docFields = ["license_picture", "passport_upload", "photo_upload"] as const;
      const paths = docFields
        .map((field) => ({ field, path: selectedApp[field] }))
        .filter((x) => !!x.path);

      if (paths.length === 0) {
        setDocumentUrls({});
        return;
      }

      setLoadingDocs(true);
      try {
        const entries = await Promise.all(
          paths.map(async ({ field, path }) => {
            const { data, error } = await supabase.storage
              .from("driver-documents")
              .createSignedUrl(path as string, 3600);
            if (error || !data?.signedUrl) return [field, ""] as const;
            return [field, data.signedUrl] as const;
          })
        );
        setDocumentUrls(Object.fromEntries(entries));
      } finally {
        setLoadingDocs(false);
      }
    };

    void loadDocumentUrls();
  }, [selectedApp]);

  const loadApplications = async () => {
    if (tenantLoading) return;
    if (!isMasterAdmin && !tenant?.id) {
      setApplications([]);
      setIsLoading(false);
      return;
    }

    try {
      let query = supabase
        .from("onboarding_sessions")
        .select("*")
        .order("created_at", { ascending: false });

      if (!isMasterAdmin && tenant?.id) {
        query = query.eq("tenant_id", tenant.id);
      }

      const { data, error } = await query;

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

  const updateStatus = async (
    id: string,
    status: "accepted" | "rejected" | "re-submit",
    rejectionReason?: string
  ) => {
    try {
      // Get the session to find the user_id
      const session = applications.find(app => app.id === id);
      if (!session) {
        throw new Error("Session not found");
      }

      if (status === "rejected" && !rejectionReason?.trim()) {
        throw new Error("Rejection comment is required.");
      }

      // Update session status
      const { error: updateError } = await supabase
        .from("onboarding_sessions")
        .update({
          status,
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          reviewed_at: new Date().toISOString(),
          rejection_comment: status === "rejected" ? rejectionReason?.trim() : null,
        })
        .eq("id", id);

      if (updateError) throw updateError;

      // If accepted, change user role from onboarding to driver and create driver record
      if (status === "accepted") {
        console.log("Processing acceptance for user:", session.user_id, session.email);
        const targetTenantId = session.tenant_id || tenant?.id || null;
        
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

          if (targetTenantId) {
            const { error: roleTenantFixError } = await supabase
              .from("user_roles")
              .update({ tenant_id: targetTenantId })
              .eq("user_id", session.user_id)
              .eq("role", "driver");
            if (roleTenantFixError) throw roleTenantFixError;

            const { error: existingDriverTenantFixError } = await supabase
              .from("driver_profiles")
              .update({ tenant_id: targetTenantId })
              .eq("id", existingDriver.id);
            if (existingDriverTenantFixError) throw existingDriverTenantFixError;
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
          const driverData: Record<string, any> = {
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

          driverData.tenant_id = targetTenantId;

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

          if (targetTenantId) {
            const { error: roleTenantFixError } = await supabase
              .from("user_roles")
              .update({ tenant_id: targetTenantId })
              .eq("user_id", session.user_id)
              .eq("role", "driver");
            if (roleTenantFixError) throw roleTenantFixError;
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

  const openRejectDialog = (app: OnboardingSession) => {
    setRejectingApp(app);
    setRejectionComment(app.rejection_comment || "");
    setShowRejectDialog(true);
  };

  const submitRejection = async () => {
    if (!rejectingApp) return;
    if (!rejectionComment.trim()) {
      toast({
        title: "Comment required",
        description: "Please add a rejection reason before rejecting this application.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmittingReject(true);
      await updateStatus(rejectingApp.id, "rejected", rejectionComment);
      setShowRejectDialog(false);
      setRejectingApp(null);
      setRejectionComment("");
    } finally {
      setIsSubmittingReject(false);
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

  const isImagePath = (path?: string) => {
    if (!path) return false;
    return /\.(png|jpe?g|gif|webp)$/i.test(path);
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
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedApplications.map((app) => (
                <TableRow key={app.id}>
                  <TableCell>{app.full_name || "N/A"}</TableCell>
                  <TableCell>{app.email}</TableCell>
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
                            onClick={() => openRejectDialog(app)}
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
          {applications.length > 0 && (
            <ListPaginationBar
              className="mt-4"
              page={appsPage}
              totalPages={appsTotalPages}
              totalItems={appsTotal}
              pageSize={appsPageSize}
              onPrev={appsGoPrev}
              onNext={appsGoNext}
            />
          )}
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
                <p>Address 1: {selectedApp.address_line_1 || "N/A"}</p>
                <p>Address 2: {selectedApp.address_line_2 || "N/A"}</p>
                <p>Address 3: {selectedApp.address_line_3 || "N/A"}</p>
                <p>Post Code: {selectedApp.post_code || "N/A"}</p>
              </div>
              <div>
                <h3 className="font-semibold">License & Right to Work</h3>
                <p>Drivers License Number: {selectedApp.drivers_license_number || selectedApp.license_number || "N/A"}</p>
                <p>License Expiry: {selectedApp.license_expiry_date || selectedApp.license_expiry || "N/A"}</p>
                <p>National Insurance: {selectedApp.national_insurance_number || "N/A"}</p>
                <p>Passport Number: {selectedApp.passport_number || "N/A"}</p>
                <p>Passport Expiry: {selectedApp.passport_expiry_date || "N/A"}</p>
              </div>
              <div>
                <h3 className="font-semibold">Identity & Availability</h3>
                <p>DVLA Code: {selectedApp.dvla_code || "N/A"}</p>
                <p>DBS Check: {selectedApp.dbs_check ? "Yes" : "No"}</p>
                <p>Driver Availability: {selectedApp.driver_availability || "N/A"}</p>
              </div>
              <div>
                <h3 className="font-semibold">Emergency Contact</h3>
                <p>Name: {selectedApp.emergency_contact_name || "N/A"}</p>
                <p>Phone: {selectedApp.emergency_contact_phone || "N/A"}</p>
              </div>
              <div>
                <h3 className="font-semibold">Uploaded Documents</h3>
                {loadingDocs && <p className="text-sm text-muted-foreground">Loading document links...</p>}
                {!loadingDocs && (
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium">License Picture</p>
                      {documentUrls.license_picture ? (
                        <div className="space-y-2">
                          <a href={documentUrls.license_picture} target="_blank" rel="noreferrer" className="text-primary underline">
                            Open document
                          </a>
                          {isImagePath(selectedApp.license_picture) && (
                            <img
                              src={documentUrls.license_picture}
                              alt="License upload"
                              className="max-h-40 rounded border"
                            />
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Not uploaded</p>
                      )}
                    </div>
                    <div>
                      <p className="font-medium">Passport Upload</p>
                      {documentUrls.passport_upload ? (
                        <div className="space-y-2">
                          <a href={documentUrls.passport_upload} target="_blank" rel="noreferrer" className="text-primary underline">
                            Open document
                          </a>
                          {isImagePath(selectedApp.passport_upload) && (
                            <img
                              src={documentUrls.passport_upload}
                              alt="Passport upload"
                              className="max-h-40 rounded border"
                            />
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Not uploaded</p>
                      )}
                    </div>
                    <div>
                      <p className="font-medium">Photo Upload</p>
                      {documentUrls.photo_upload ? (
                        <div className="space-y-2">
                          <a href={documentUrls.photo_upload} target="_blank" rel="noreferrer" className="text-primary underline">
                            Open document
                          </a>
                          {isImagePath(selectedApp.photo_upload) && (
                            <img
                              src={documentUrls.photo_upload}
                              alt="Photo upload"
                              className="max-h-40 rounded border"
                            />
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Not uploaded</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-semibold">Status</h3>
                {getStatusBadge(selectedApp.status)}
                {selectedApp.rejection_comment && (
                  <div className="mt-2 rounded border p-3 bg-muted/40">
                    <p className="text-sm font-medium mb-1">Rejection Comment</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedApp.rejection_comment}
                    </p>
                  </div>
                )}
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
                    onClick={() => openRejectDialog(selectedApp)}
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

      <Dialog
        open={showRejectDialog}
        onOpenChange={(open) => {
          setShowRejectDialog(open);
          if (!open) {
            setRejectingApp(null);
            setRejectionComment("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Application</DialogTitle>
            <DialogDescription>
              Add a comment explaining why this application is rejected. The applicant will see this and can resubmit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Applicant: {rejectingApp?.full_name || rejectingApp?.email || "Unknown"}
            </p>
            <Textarea
              value={rejectionComment}
              onChange={(e) => setRejectionComment(e.target.value)}
              placeholder="Enter rejection reason and required corrections..."
              rows={5}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false);
                setRejectingApp(null);
                setRejectionComment("");
              }}
              disabled={isSubmittingReject}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={submitRejection}
              disabled={isSubmittingReject || !rejectionComment.trim()}
            >
              {isSubmittingReject ? "Rejecting..." : "Reject Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
