import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, X, Upload } from "lucide-react";
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
import { PasswordChangePrompt } from "@/components/PasswordChangePrompt";

const formSchema = z.object({
  // Page 1 - Personal Details
  tenant_id: z.string().uuid("Please select a company").optional(),
  first_name: z.string().min(2, "First name must be at least 2 characters").max(100, "First name is too long"),
  surname: z.string().min(2, "Surname must be at least 2 characters").max(100, "Surname is too long"),
  email: z.string().email("Valid email is required").max(255, "Email is too long"),
  contact_phone: z.string().max(20, "Phone number is too long").optional(),
  address_line_1: z.string().max(200, "Address is too long").optional(),
  address_line_2: z.string().max(200, "Address is too long").optional(),
  address_line_3: z.string().max(200, "Address is too long").optional(),
  post_code: z.string().max(20, "Post code is too long").optional(),
  emergency_contact_name: z.string().max(100, "Name is too long").optional(),
  emergency_contact_phone: z.string().max(20, "Phone number is too long").optional(),
  
  // Page 2 - Driver's License
  drivers_license_number: z.string().max(50, "License number is too long").optional(),
  license_expiry_date: z.string().optional(),
  license_picture: z.string().optional(),
  
  // Page 3 - Right to Work
  national_insurance_number: z.string().max(20, "NI number is too long").optional(),
  passport_upload: z.string().optional(),
  passport_number: z.string().max(50, "Passport number is too long").optional(),
  passport_expiry_date: z.string().optional(),
  
  // Page 4 - Identity
  photo_upload: z.string().optional(),
  dvla_code: z.string().max(50, "DVLA code is too long").optional(),
  dbs_check: z.boolean().optional(),
  
  // Page 5 - Work Availability
  driver_availability: z.enum(["Full Time", "Part Time", "Flexi (Same Day)"]).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface Props {
  existingSession?: any;
}

interface TenantOption {
  id: string;
  company_name: string;
}

const OnboardingFormOwn = ({ existingSession }: Props) => {
  const [currentStep, setCurrentStep] = useState(existingSession?.current_step || 1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionId, setSessionId] = useState(existingSession?.id);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(existingSession?.status || 'in_progress');
  const [isCompleted, setIsCompleted] = useState(existingSession?.completed || existingSession?.status === 'submitted');
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Determine if form can be edited based on status
  // Allow editing only when actively in progress (or explicitly in re-submit)
  const canEdit = currentStatus === 'in_progress' || currentStatus === 're-submit';
  const isReadOnly = !canEdit && (currentStatus === 'submitted' || currentStatus === 'accepted');
  const isRejectedReadOnly = currentStatus === 'rejected';

  const { register, handleSubmit, formState: { errors }, getValues, setValue, watch, reset } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ...existingSession,
      full_name: existingSession?.full_name || "",
      first_name: existingSession?.first_name || existingSession?.full_name?.split(' ')[0] || "",
      surname: existingSession?.surname || existingSession?.full_name?.split(' ').slice(1).join(' ') || "",
    },
    shouldUnregister: false,
  });

  const totalSteps = 5;
  const progress = (currentStep / totalSteps) * 100;
  const showAllReadOnlySections = isReadOnly || isRejectedReadOnly;

  const selectedTenantId = watch("tenant_id");

  useEffect(() => {
    const loadTenants = async () => {
      setLoadingTenants(true);
      try {
        const { data, error } = await supabase
          .from("tenants")
          .select("id, company_name")
          .order("company_name", { ascending: true });

        let tenantRows = ((data || []) as TenantOption[]).filter((t) => !!t.id && !!t.company_name);
        if (error || tenantRows.length === 0) {
          const { data: fnData, error: fnError } = await supabase.functions.invoke("list-active-tenants", { body: {} });
          if (fnError) throw fnError;
          tenantRows = (fnData?.tenants || []) as TenantOption[];
        }

        setTenants(tenantRows);

        const existingTenantId = existingSession?.tenant_id as string | undefined;
        if (existingTenantId) {
          setValue("tenant_id", existingTenantId, { shouldValidate: true });
        } else if (!selectedTenantId && tenantRows.length === 1) {
          setValue("tenant_id", tenantRows[0].id, { shouldValidate: true });
        }
      } catch (error: any) {
        toast({
          title: "Could not load companies",
          description: error.message || "Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoadingTenants(false);
      }
    };

    void loadTenants();
  }, [toast, existingSession?.tenant_id, selectedTenantId, setValue]);

  const statusBanner = isCompleted || isReadOnly || isRejectedReadOnly ? (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>
          {currentStatus === 'accepted' ? 'Application Accepted' : 
           currentStatus === 'rejected' ? 'Application Rejected' :
           currentStatus === 're-submit' ? 'Resubmission Required' :
           'Application Submitted'}
        </CardTitle>
        <CardDescription>
          Current status: <span className="inline-flex px-2 py-1 rounded bg-muted">{currentStatus.replace('-', ' ').toUpperCase()}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {currentStatus === 're-submit' 
            ? 'Your application needs to be resubmitted. Please review and update the required information below.'
            : currentStatus === 'rejected'
            ? 'Your application was rejected. Review the admin comment below, then click Resubmit Application to unlock editing.'
            : 'Your application is read-only. You can view details and track status.'}
        </p>
        {currentStatus === 'rejected' && existingSession?.rejection_comment && (
          <div className="mt-3 rounded border p-3 bg-muted/40">
            <p className="text-sm font-medium mb-1">Admin Comment</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{existingSession.rejection_comment}</p>
          </div>
        )}
      </CardContent>
    </Card>
  ) : null;

  const handleFileUpload = async (file: File, fieldName: string) => {
    if (!file) return null;
    
    setUploadingFiles(prev => ({ ...prev, [fieldName]: true }));
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${fieldName}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('driver-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Store file path in form
      setValue(fieldName as keyof FormData, filePath);
      
      return filePath;
    } catch (error: any) {
      console.error(`Error uploading ${fieldName}:`, error);
      toast({
        title: "Upload failed",
        description: `Failed to upload ${fieldName}. Please try again.`,
        variant: "destructive",
      });
      return null;
    } finally {
      setUploadingFiles(prev => ({ ...prev, [fieldName]: false }));
    }
  };

  const saveProgress = async (data: Partial<FormData>, shouldNavigate: boolean = false, complete: boolean = false) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const emailToUse = data.email || sessionData.session?.user?.email || null;
      if (!emailToUse) {
        toast({
          title: "Email required",
          description: "Please enter your email to save progress",
          variant: "destructive",
        });
        return false;
      }

      // Combine first_name and surname into full_name
      const fullName = data.first_name && data.surname 
        ? `${data.first_name} ${data.surname}`.trim()
        : data.first_name || data.surname || existingSession?.full_name || "";
      const tenantIdToUse = data.tenant_id || existingSession?.tenant_id || null;

      // Clean up empty strings
      const cleanedData: any = {};
      Object.entries(data).forEach(([key, value]) => {
        if (value === "" || value === undefined || value === null) {
          cleanedData[key] = null;
        } else {
          cleanedData[key] = value;
        }
      });

      // Add full_name to cleaned data
      cleanedData.full_name = fullName;

      const { data: upsertData, error: upsertError } = await supabase.functions.invoke(
        "upsert-onboarding-session",
        {
          body: {
            email: emailToUse,
            fullName: fullName,
            ownershipType: "own",
            tenant_id: tenantIdToUse,
            sessionId,
            current_step: currentStep,
            complete,
            data: {
              ...cleanedData,
            },
          },
        }
      );

      if (upsertError) {
        let detail = upsertError.message;
        try { const body = await (upsertError as any).context?.json?.(); if (body?.error) detail = body.error; } catch {}
        throw new Error(detail);
      }

      if (upsertData?.sessionId && upsertData.sessionId !== sessionId) {
        setSessionId(upsertData.sessionId);
      }

      toast({ title: "Progress saved" });

      if (shouldNavigate) {
        navigate("/onboarding");
      }

      return true;
    } catch (error) {
      console.error("Save error:", error);
      const message = error instanceof Error ? error.message : String(error);
      toast({ title: "Error saving progress", description: message, variant: "destructive" });
      return false;
    }
  };

  const handlePasswordChangeComplete = async () => {
    setShowPasswordChange(false);
    await supabase.auth.signOut();
    toast({ 
      title: "Password updated", 
      description: "Please sign in with your new password to continue your application." 
    });
    navigate("/onboarding-login");
  };

  const handleExit = () => {
    // If already submitted/accepted, just navigate away without dialog
    if (isReadOnly || isRejectedReadOnly) {
      navigate("/onboarding?reset=true");
      return;
    }
    setShowExitDialog(true);
  };

  const handleStartResubmission = async () => {
    if (!sessionId) {
      toast({ title: "Session not found", variant: "destructive" });
      return;
    }

    try {
      setIsSubmitting(true);
      const { error } = await supabase
        .from("onboarding_sessions")
        .update({
          status: "in_progress",
          completed: false,
        })
        .eq("id", sessionId);

      if (error) throw error;

      setCurrentStatus("in_progress");
      setIsCompleted(false);
      toast({
        title: "Resubmission started",
        description: "Your application is now editable. Please make your updates and submit again.",
      });
    } catch (error: any) {
      toast({
        title: "Could not start resubmission",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExitWithoutSaving = () => {
    setShowExitDialog(false);
    navigate("/onboarding?reset=true");
  };

  const handleExitWithSaving = async () => {
    const values = getValues();
    await saveProgress(values, false);
    setShowExitDialog(false);
    navigate("/onboarding?reset=true");
  };

  const handleSaveProgress = async () => {
    const values = getValues();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!values.email && !sessionData.session?.user?.email) {
      toast({
        title: "Email required",
        description: "Please enter your email to save your progress",
        variant: "destructive",
      });
      return;
    }
    if (!values.tenant_id) {
      toast({
        title: "Company required",
        description: "Please select your company before saving.",
        variant: "destructive",
      });
      return;
    }
    await saveProgress(values, false);
  };

  const handleNext = async () => {
    setIsSubmitting(true);
    try {
      const values = getValues();
      
      // Validation for current step
      if (currentStep === 1) {
        if (!values.first_name || !values.surname || !values.email || !values.tenant_id) {
          toast({
            title: "Required fields missing",
            description: "Please select your company, and fill in First Name, Surname, and Email",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
      }
      
      if (currentStep < totalSteps) {
        const success = await saveProgress(values, false);
        if (success) {
          setCurrentStep(currentStep + 1);
        }
      } else if (currentStep === totalSteps) {
        const success = await saveProgress(values, false, true);
        if (success) {
          const { error: statusError } = await supabase
            .from("onboarding_sessions")
            .update({
              status: 'submitted',
              completed: true,
              completed_at: new Date().toISOString(),
              rejection_comment: null,
            })
            .eq("id", sessionId);

          if (statusError) throw statusError;
          
          setCurrentStatus('submitted');
          setIsCompleted(true);
          toast({ 
            title: "Success", 
            description: currentStatus === 're-submit' || currentStatus === 'rejected' 
              ? "Your application has been resubmitted and is awaiting approval!" 
              : "Your onboarding application has been submitted and is awaiting approval!" 
          });
          navigate('/onboarding?reset=true');
        }
      }
    } catch (error: any) {
      console.error('Error:', error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PasswordChangePrompt open={showPasswordChange} onComplete={handlePasswordChangeComplete} />
      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Exit</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to exit. You will lose any unsaved changes. Confirm exit?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleExitWithoutSaving}>No</AlertDialogCancel>
            <AlertDialogAction onClick={handleExitWithSaving}>Yes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">Driver Onboarding</h1>
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground mt-2">
              {showAllReadOnlySections ? "Read-only application view" : `Step ${currentStep} of ${totalSteps}`}
            </p>
          </div>

          {statusBanner}
          <form onSubmit={handleSubmit(() => {})} className="space-y-6">
            {/* Page 1 - Personal Details */}
            {(showAllReadOnlySections || currentStep === 1) && (
              <Card>
                <CardHeader>
                  <CardTitle>Page 1 - Personal Details</CardTitle>
                  <CardDescription>Tell us about yourself</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="first_name">First Name <span className="text-destructive">*</span></Label>
                      <Input id="first_name" {...register("first_name")} maxLength={100} disabled={isReadOnly || isRejectedReadOnly} />
                      {errors.first_name && <p className="text-sm text-destructive">{errors.first_name.message}</p>}
                    </div>
                    <div>
                      <Label htmlFor="surname">Surname <span className="text-destructive">*</span></Label>
                      <Input id="surname" {...register("surname")} maxLength={100} disabled={isReadOnly || isRejectedReadOnly} />
                      {errors.surname && <p className="text-sm text-destructive">{errors.surname.message}</p>}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="email">Email Address <span className="text-destructive">*</span></Label>
                    <Input id="email" type="email" {...register("email")} maxLength={255} disabled={isReadOnly || isRejectedReadOnly} />
                    {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="tenant_id">Company <span className="text-destructive">*</span></Label>
                    <Select
                      onValueChange={(value) => setValue("tenant_id", value as string, { shouldValidate: true })}
                      value={selectedTenantId || ""}
                      disabled={isReadOnly || isRejectedReadOnly || loadingTenants}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={loadingTenants ? "Loading companies..." : "Select your company"} />
                      </SelectTrigger>
                      <SelectContent>
                        {tenants.map((tenant) => (
                          <SelectItem key={tenant.id} value={tenant.id}>
                            {tenant.company_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.tenant_id && <p className="text-sm text-destructive">{errors.tenant_id.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="contact_phone">Contact Number</Label>
                    <Input id="contact_phone" {...register("contact_phone")} maxLength={20} disabled={isReadOnly || isRejectedReadOnly} />
                    {errors.contact_phone && <p className="text-sm text-destructive">{errors.contact_phone.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="address_line_1">Address Line 1</Label>
                    <Input id="address_line_1" {...register("address_line_1")} maxLength={200} disabled={isReadOnly || isRejectedReadOnly} />
                    {errors.address_line_1 && <p className="text-sm text-destructive">{errors.address_line_1.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="address_line_2">Address Line 2</Label>
                    <Input id="address_line_2" {...register("address_line_2")} maxLength={200} disabled={isReadOnly || isRejectedReadOnly} />
                    {errors.address_line_2 && <p className="text-sm text-destructive">{errors.address_line_2.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="address_line_3">Address Line 3</Label>
                    <Input id="address_line_3" {...register("address_line_3")} maxLength={200} disabled={isReadOnly || isRejectedReadOnly} />
                    {errors.address_line_3 && <p className="text-sm text-destructive">{errors.address_line_3.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="post_code">Post Code</Label>
                    <Input id="post_code" {...register("post_code")} maxLength={20} disabled={isReadOnly || isRejectedReadOnly} />
                    {errors.post_code && <p className="text-sm text-destructive">{errors.post_code.message}</p>}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="emergency_contact_name">Emergency Contact Name</Label>
                      <Input id="emergency_contact_name" {...register("emergency_contact_name")} maxLength={100} disabled={isReadOnly || isRejectedReadOnly} />
                      {errors.emergency_contact_name && <p className="text-sm text-destructive">{errors.emergency_contact_name.message}</p>}
                    </div>
                    <div>
                      <Label htmlFor="emergency_contact_phone">Emergency Contact Number</Label>
                      <Input id="emergency_contact_phone" {...register("emergency_contact_phone")} maxLength={20} disabled={isReadOnly || isRejectedReadOnly} />
                      {errors.emergency_contact_phone && <p className="text-sm text-destructive">{errors.emergency_contact_phone.message}</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Page 2 - Driver's License Details */}
            {(showAllReadOnlySections || currentStep === 2) && (
              <Card>
                <CardHeader>
                  <CardTitle>Page 2 - Driver's License Details</CardTitle>
                  <CardDescription>Your license information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="drivers_license_number">Drivers License Number</Label>
                    <Input id="drivers_license_number" {...register("drivers_license_number")} maxLength={50} disabled={isReadOnly || isRejectedReadOnly} />
                    {errors.drivers_license_number && <p className="text-sm text-destructive">{errors.drivers_license_number.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="license_expiry_date">License Expiry Date</Label>
                    <Input id="license_expiry_date" type="date" {...register("license_expiry_date")} disabled={isReadOnly || isRejectedReadOnly} />
                    {errors.license_expiry_date && <p className="text-sm text-destructive">{errors.license_expiry_date.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="license_picture">License Picture Upload</Label>
                    <Input
                      id="license_picture"
                      type="file"
                      accept="image/*,.pdf"
                      disabled={isReadOnly || isRejectedReadOnly || uploadingFiles.license_picture}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, "license_picture");
                      }}
                    />
                    {uploadingFiles.license_picture && (
                      <p className="text-sm text-muted-foreground mt-1">Uploading...</p>
                    )}
                    {watch("license_picture") && !uploadingFiles.license_picture && (
                      <p className="text-sm text-green-600 mt-1">✓ File uploaded</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Page 3 - Right to Work Details */}
            {(showAllReadOnlySections || currentStep === 3) && (
              <Card>
                <CardHeader>
                  <CardTitle>Page 3 - Right to Work Details</CardTitle>
                  <CardDescription>Right to work documentation</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="national_insurance_number">National Insurance Number</Label>
                    <Input id="national_insurance_number" {...register("national_insurance_number")} maxLength={20} disabled={isReadOnly || isRejectedReadOnly} />
                    {errors.national_insurance_number && <p className="text-sm text-destructive">{errors.national_insurance_number.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="passport_upload">Passport Upload</Label>
                    <Input
                      id="passport_upload"
                      type="file"
                      accept="image/*,.pdf"
                      disabled={isReadOnly || isRejectedReadOnly || uploadingFiles.passport_upload}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, "passport_upload");
                      }}
                    />
                    {uploadingFiles.passport_upload && (
                      <p className="text-sm text-muted-foreground mt-1">Uploading...</p>
                    )}
                    {watch("passport_upload") && !uploadingFiles.passport_upload && (
                      <p className="text-sm text-green-600 mt-1">✓ File uploaded</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="passport_number">Passport Number</Label>
                    <Input id="passport_number" {...register("passport_number")} maxLength={50} disabled={isReadOnly || isRejectedReadOnly} />
                    {errors.passport_number && <p className="text-sm text-destructive">{errors.passport_number.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="passport_expiry_date">Passport Expiry Date</Label>
                    <Input id="passport_expiry_date" type="date" {...register("passport_expiry_date")} disabled={isReadOnly || isRejectedReadOnly} />
                    {errors.passport_expiry_date && <p className="text-sm text-destructive">{errors.passport_expiry_date.message}</p>}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Page 4 - Identity Details */}
            {(showAllReadOnlySections || currentStep === 4) && (
              <Card>
                <CardHeader>
                  <CardTitle>Page 4 - Identity Details</CardTitle>
                  <CardDescription>Identity verification</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="photo_upload">Photo Upload</Label>
                    <Input
                      id="photo_upload"
                      type="file"
                      accept="image/*"
                      disabled={isReadOnly || isRejectedReadOnly || uploadingFiles.photo_upload}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, "photo_upload");
                      }}
                    />
                    {uploadingFiles.photo_upload && (
                      <p className="text-sm text-muted-foreground mt-1">Uploading...</p>
                    )}
                    {watch("photo_upload") && !uploadingFiles.photo_upload && (
                      <p className="text-sm text-green-600 mt-1">✓ File uploaded</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="dvla_code">Enter DVLA Code</Label>
                    <Input id="dvla_code" {...register("dvla_code")} maxLength={50} placeholder="Enter your DVLA check code" disabled={isReadOnly || isRejectedReadOnly} />
                    {errors.dvla_code && <p className="text-sm text-destructive">{errors.dvla_code.message}</p>}
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="dbs_check"
                      {...register("dbs_check")}
                      className="rounded border-gray-300"
                      disabled={isReadOnly || isRejectedReadOnly}
                    />
                    <Label htmlFor="dbs_check" className="font-normal">DBS Check Completed</Label>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Page 5 - Work Availability */}
            {(showAllReadOnlySections || currentStep === 5) && (
              <Card>
                <CardHeader>
                  <CardTitle>Page 5 - Work Availability</CardTitle>
                  <CardDescription>Your work availability preferences</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="driver_availability">Driver Availability</Label>
                    <Select
                      onValueChange={(value) => setValue("driver_availability", value as any)}
                      defaultValue={watch("driver_availability")}
                      disabled={isReadOnly || isRejectedReadOnly}
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
                    {errors.driver_availability && <p className="text-sm text-destructive">{errors.driver_availability.message}</p>}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex flex-wrap gap-3">
              {currentStep > 1 && (
              <Button type="button" variant="outline" onClick={() => setCurrentStep(currentStep - 1)} disabled={isSubmitting || isReadOnly || isRejectedReadOnly}>
                  Previous
                </Button>
              )}
              {canEdit && (
                <Button type="button" variant="outline" onClick={handleSaveProgress} disabled={isSubmitting}>
                  <Save className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Save Progress</span>
                  <span className="sm:hidden">Save</span>
                </Button>
              )}
              {canEdit && (
                <Button type="button" onClick={handleNext} disabled={isSubmitting} className="sm:ml-auto">
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {currentStep === totalSteps ? (currentStatus === 're-submit' ? "Resubmit" : "Complete") : "Next"}
                </Button>
              )}
              {currentStatus === "rejected" && (
                <Button type="button" onClick={handleStartResubmission} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Resubmit
                </Button>
              )}
              <Button type="button" variant="outline" onClick={handleExit} disabled={isSubmitting}>
                <X className="mr-2 h-4 w-4" />
                {isReadOnly || isRejectedReadOnly ? "Back" : "Exit"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default OnboardingFormOwn;
