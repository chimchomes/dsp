import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/contexts/TenantContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Loader2 } from "lucide-react";
import {
  clearHrDriverDraft,
  emptyHrDriverForm,
  loadHrDriverDraft,
  saveHrDriverDraft,
  type HrDriverDraftForm,
} from "@/lib/hrDriverDraft";
import { uploadHrDriverDocument, type HrDriverDocField } from "@/lib/uploadHrDriverDocument";
import {
  HR_DRIVER_FORMAT_STEP_FIELDS,
  ukDriverPersonalFields,
  validateStepFormatFields,
} from "@/lib/ukFieldValidation";

const formSchema = z.object({
  first_name: z.string().min(2, "First name must be at least 2 characters").max(100),
  surname: z.string().min(2, "Surname must be at least 2 characters").max(100),
  ...ukDriverPersonalFields,
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
  operator_id: z.string().max(50).optional().or(z.literal("")),
  address_line_1: z.string().max(200).optional().or(z.literal("")),
  address_line_2: z.string().max(200).optional().or(z.literal("")),
  address_line_3: z.string().max(200).optional().or(z.literal("")),
  emergency_contact_name: z.string().max(100).optional().or(z.literal("")),
  license_expiry_date: z.string().optional().or(z.literal("")),
  license_picture: z.string().optional().or(z.literal("")),
  passport_upload: z.string().optional().or(z.literal("")),
  passport_expiry_date: z.string().optional().or(z.literal("")),
  photo_upload: z.string().optional().or(z.literal("")),
  dbs_check: z.boolean().optional(),
  driver_availability: z.string().max(80).optional().or(z.literal("")),
});

type FormData = z.infer<typeof formSchema>;

const TOTAL_STEPS = 5;

const DOC_FIELDS = new Set<HrDriverDocField>(["license_picture", "passport_upload", "photo_upload"]);

export const CreateDriverAccountDialog = ({ onSuccess }: { onSuccess: () => void }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [hrUserId, setHrUserId] = useState<string | null>(null);
  const discardConfirmedRef = useRef(false);
  const { toast } = useToast();
  const { tenant } = useTenant();

  const { register, handleSubmit, formState: { errors }, getValues, setValue, watch, reset } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: emptyHrDriverForm(),
    shouldUnregister: false,
  });

  const driverAvailability = watch("driver_availability");
  const formValues = watch();

  const persistDraft = useCallback(() => {
    if (!tenant?.id || !hrUserId || !open) return;
    saveHrDriverDraft(tenant.id, hrUserId, {
      currentStep,
      form: getValues() as HrDriverDraftForm,
    });
  }, [tenant?.id, hrUserId, open, currentStep, getValues]);

  useEffect(() => {
    const initUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setHrUserId(user?.id ?? null);
    };
    void initUser();
  }, []);

  useEffect(() => {
    if (!open || !tenant?.id || !hrUserId) return;
    const draft = loadHrDriverDraft(tenant.id, hrUserId);
    if (draft) {
      reset(draft.form as FormData);
      setCurrentStep(draft.currentStep);
      toast({ title: "Draft restored", description: "Continue where you left off." });
    } else {
      reset(emptyHrDriverForm());
      setCurrentStep(1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- toast stable; restore only when dialog opens
  }, [open, tenant?.id, hrUserId, reset]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => persistDraft(), 400);
    return () => clearTimeout(t);
  }, [formValues, currentStep, open, persistDraft]);

  const handleFileUpload = async (file: File, fieldName: keyof FormData) => {
    if (!hrUserId) {
      toast({ title: "Not signed in", variant: "destructive" });
      return;
    }
    if (!DOC_FIELDS.has(fieldName as HrDriverDocField)) return;

    setUploadingFiles((prev) => ({ ...prev, [fieldName]: true }));
    try {
      const filePath = await uploadHrDriverDocument(file, fieldName as HrDriverDocField);
      setValue(fieldName, filePath, { shouldDirty: true });
      persistDraft();
    } catch (error: unknown) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Could not upload file",
        variant: "destructive",
      });
    } finally {
      setUploadingFiles((prev) => ({ ...prev, [fieldName]: false }));
    }
  };

  const onSubmit = async (values: FormData) => {
    if (!tenant?.id) {
      toast({ title: "Tenant required", description: "Could not determine company.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("create-driver-account", {
        body: {
          firstName: values.first_name,
          surname: values.surname,
          email: values.email,
          password: values.password,
          contactPhone: values.contact_phone || undefined,
          licenseNumber: values.drivers_license_number || undefined,
          licenseExpiry: values.license_expiry_date || undefined,
          addressLine1: values.address_line_1 || undefined,
          addressLine2: values.address_line_2 || undefined,
          addressLine3: values.address_line_3 || undefined,
          postcode: values.post_code || undefined,
          emergencyContactName: values.emergency_contact_name || undefined,
          emergencyContactPhone: values.emergency_contact_phone || undefined,
          operatorId: values.operator_id || undefined,
          nationalInsurance: values.national_insurance_number || undefined,
          passportNumber: values.passport_number || undefined,
          passportExpiry: values.passport_expiry_date || undefined,
          dvlaCode: values.dvla_code || undefined,
          dbsCheck: values.dbs_check ?? false,
          driverAvailability: values.driver_availability || undefined,
          tenant_id: tenant.id,
          licensePicturePath: values.license_picture || undefined,
          passportUploadPath: values.passport_upload || undefined,
          photoUploadPath: values.photo_upload || undefined,
        },
      });

      if (fnError) {
        let detail = fnError.message;
        try {
          const b = await (fnError as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.();
          if (b?.error) detail = b.error;
        } catch { /* ignore */ }
        throw new Error(detail);
      }
      if ((fnData as { error?: string })?.error) throw new Error((fnData as { error: string }).error);

      if (tenant.id && hrUserId) clearHrDriverDraft(tenant.id, hrUserId);
      reset(emptyHrDriverForm());
      setCurrentStep(1);
      discardConfirmedRef.current = true;
      setOpen(false);
      toast({
        title: "Driver account created",
        description: `${values.first_name} ${values.surname} must change their password on first login.`,
      });
      onSuccess();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create driver",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const validateStep = (step: number, values: FormData): boolean => {
    if (step === 1) {
      if (!values.first_name?.trim() || !values.surname?.trim() || !values.email?.trim() || !values.password || values.password.length < 8) {
        toast({
          title: "Required fields missing",
          description: "First name, surname, email, and password (min 8 characters) are required.",
          variant: "destructive",
        });
        return false;
      }
    }
    const formatFields = HR_DRIVER_FORMAT_STEP_FIELDS[step];
    if (formatFields?.length) {
      const formatError = validateStepFormatFields(values, formatFields);
      if (formatError) {
        toast({ title: "Invalid format", description: formatError, variant: "destructive" });
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    const values = getValues();
    const anyUploading = Object.values(uploadingFiles).some(Boolean);
    if (anyUploading) {
      toast({ title: "Upload in progress", description: "Please wait for the file upload to finish.", variant: "destructive" });
      return;
    }
    if (!validateStep(currentStep, values)) return;
    persistDraft();
    if (currentStep < TOTAL_STEPS) setCurrentStep((s) => s + 1);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      if (discardConfirmedRef.current) {
        discardConfirmedRef.current = false;
        setOpen(false);
        return;
      }
      persistDraft();
      setOpen(false);
      return;
    }
    setOpen(true);
  };

  const handleDiscardConfirm = () => {
    if (tenant?.id && hrUserId) clearHrDriverDraft(tenant.id, hrUserId);
    reset(emptyHrDriverForm());
    setCurrentStep(1);
    setShowDiscardDialog(false);
    discardConfirmedRef.current = true;
    setOpen(false);
  };

  const progress = (currentStep / TOTAL_STEPS) * 100;

  return (
    <>
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard draft?</AlertDialogTitle>
            <AlertDialogDescription>
              Any unsubmitted details will be lost. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscardConfirm}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button>
            <UserPlus className="mr-2 h-4 w-4" />
            Create Driver Account
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onInteractOutside={() => persistDraft()}>
          <DialogHeader>
            <DialogTitle>Create Driver Account</DialogTitle>
            <DialogDescription>
              Same steps as public driver onboarding. Progress is saved automatically if you close the form.
            </DialogDescription>
          </DialogHeader>

          <div className="mb-4">
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
              <span>Step {currentStep} of {TOTAL_STEPS}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" autoComplete="off">
            {currentStep === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Page 1 - Personal Details</CardTitle>
                  <CardDescription>Driver login and contact information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="first_name">First Name *</Label>
                      <Input id="first_name" autoComplete="off" {...register("first_name")} maxLength={100} />
                      {errors.first_name && <p className="text-sm text-destructive">{errors.first_name.message}</p>}
                    </div>
                    <div>
                      <Label htmlFor="surname">Surname *</Label>
                      <Input id="surname" autoComplete="off" {...register("surname")} maxLength={100} />
                      {errors.surname && <p className="text-sm text-destructive">{errors.surname.message}</p>}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input id="email" type="email" autoComplete="off" {...register("email")} maxLength={255} />
                    {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="password">Temporary Password *</Label>
                    <Input id="password" type="password" autoComplete="new-password" {...register("password")} minLength={8} maxLength={100} placeholder="Min 8 characters" />
                    {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
                    <p className="text-xs text-muted-foreground mt-1">Driver must change this on first login</p>
                  </div>
                  <div>
                    <Label htmlFor="operator_id">Operator ID</Label>
                    <Input id="operator_id" autoComplete="off" {...register("operator_id")} maxLength={50} placeholder="e.g., 0074666" />
                  </div>
                  <div>
                    <Label htmlFor="contact_phone">Contact Number</Label>
                    <Input id="contact_phone" autoComplete="off" {...register("contact_phone")} maxLength={20} />
                  </div>
                  <div>
                    <Label htmlFor="address_line_1">Address Line 1</Label>
                    <Input id="address_line_1" autoComplete="off" {...register("address_line_1")} maxLength={200} />
                  </div>
                  <div>
                    <Label htmlFor="address_line_2">Address Line 2</Label>
                    <Input id="address_line_2" autoComplete="off" {...register("address_line_2")} maxLength={200} />
                  </div>
                  <div>
                    <Label htmlFor="address_line_3">Address Line 3</Label>
                    <Input id="address_line_3" autoComplete="off" {...register("address_line_3")} maxLength={200} />
                  </div>
                  <div>
                    <Label htmlFor="post_code">Post Code</Label>
                    <Input id="post_code" autoComplete="off" {...register("post_code")} maxLength={20} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="emergency_contact_name">Emergency Contact Name</Label>
                      <Input id="emergency_contact_name" autoComplete="off" {...register("emergency_contact_name")} maxLength={100} />
                    </div>
                    <div>
                      <Label htmlFor="emergency_contact_phone">Emergency Contact Number</Label>
                      <Input id="emergency_contact_phone" autoComplete="off" {...register("emergency_contact_phone")} maxLength={20} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle>Page 2 - Driver&apos;s License Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="drivers_license_number">Drivers License Number</Label>
                    <Input id="drivers_license_number" {...register("drivers_license_number")} maxLength={50} />
                  </div>
                  <div>
                    <Label htmlFor="license_expiry_date">License Expiry Date</Label>
                    <Input id="license_expiry_date" type="date" {...register("license_expiry_date")} />
                  </div>
                  <div>
                    <Label htmlFor="license_picture">License Picture Upload</Label>
                    <Input
                      id="license_picture"
                      type="file"
                      accept="image/*,.pdf"
                      disabled={uploadingFiles.license_picture}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleFileUpload(file, "license_picture");
                      }}
                    />
                    {uploadingFiles.license_picture && <p className="text-sm text-muted-foreground mt-1">Uploading...</p>}
                    {watch("license_picture") && !uploadingFiles.license_picture && (
                      <p className="text-sm text-green-600 mt-1">File uploaded</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle>Page 3 - Right to Work Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="national_insurance_number">National Insurance Number</Label>
                    <Input id="national_insurance_number" {...register("national_insurance_number")} maxLength={20} />
                  </div>
                  <div>
                    <Label htmlFor="passport_upload">Passport Upload</Label>
                    <Input
                      id="passport_upload"
                      type="file"
                      accept="image/*,.pdf"
                      disabled={uploadingFiles.passport_upload}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleFileUpload(file, "passport_upload");
                      }}
                    />
                    {uploadingFiles.passport_upload && <p className="text-sm text-muted-foreground mt-1">Uploading...</p>}
                    {watch("passport_upload") && !uploadingFiles.passport_upload && (
                      <p className="text-sm text-green-600 mt-1">File uploaded</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="passport_number">Passport Number</Label>
                    <Input id="passport_number" {...register("passport_number")} maxLength={50} />
                  </div>
                  <div>
                    <Label htmlFor="passport_expiry_date">Passport Expiry Date</Label>
                    <Input id="passport_expiry_date" type="date" {...register("passport_expiry_date")} />
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === 4 && (
              <Card>
                <CardHeader>
                  <CardTitle>Page 4 - Identity Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="photo_upload">Photo Upload</Label>
                    <Input
                      id="photo_upload"
                      type="file"
                      accept="image/*"
                      disabled={uploadingFiles.photo_upload}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleFileUpload(file, "photo_upload");
                      }}
                    />
                    {uploadingFiles.photo_upload && <p className="text-sm text-muted-foreground mt-1">Uploading...</p>}
                    {watch("photo_upload") && !uploadingFiles.photo_upload && (
                      <p className="text-sm text-green-600 mt-1">File uploaded</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="dvla_code">Enter DVLA Code</Label>
                    <Input id="dvla_code" {...register("dvla_code")} maxLength={50} placeholder="Enter your DVLA check code" />
                  </div>
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id="dbs_check" {...register("dbs_check")} className="rounded border-gray-300" />
                    <Label htmlFor="dbs_check" className="font-normal">DBS Check Completed</Label>
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === 5 && (
              <Card>
                <CardHeader>
                  <CardTitle>Page 5 - Work Availability</CardTitle>
                </CardHeader>
                <CardContent>
                  <Label htmlFor="driver_availability">Driver Availability</Label>
                  <Select
                    value={driverAvailability || ""}
                    onValueChange={(v) => setValue("driver_availability", v as FormData["driver_availability"], { shouldDirty: true })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select availability" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Full Time">Full Time</SelectItem>
                      <SelectItem value="Part Time">Part Time</SelectItem>
                      <SelectItem value="Flexi (Same Day)">Flexi (Same Day)</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              {currentStep > 1 && (
                <Button type="button" variant="outline" onClick={() => setCurrentStep((s) => s - 1)} disabled={loading}>
                  Previous
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => setShowDiscardDialog(true)} disabled={loading}>
                Cancel
              </Button>
              {currentStep < TOTAL_STEPS ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={loading || Object.values(uploadingFiles).some(Boolean)}
                  className="ml-auto"
                >
                  Next
                </Button>
              ) : (
                <Button type="submit" disabled={loading} className="ml-auto">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Driver"
                  )}
                </Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
