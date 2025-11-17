import React, { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
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
  
  // Page 4 - Vehicle Details
  vehicle_make: z.string().max(100, "Make is too long").optional(),
  vehicle_model: z.string().max(100, "Model is too long").optional(),
  vehicle_year: z.string().optional(),
  vehicle_registration_number: z.string().max(50, "Registration is too long").optional(),
  vehicle_type: z.string().optional(),
  vehicle_mileage: z.string().optional(),
  
  // Page 5 - Identity
  photo_upload: z.string().optional(),
  dvla_code: z.string().max(50, "DVLA code is too long").optional(),
  dbs_check: z.boolean().optional(),
  
  // Page 6 - Work Availability
  driver_availability: z.enum(["Full Time", "Part Time", "Flexi (Same Day)"]).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface Props {
  existingSession?: any;
}

const OnboardingFormOwn = ({ existingSession }: Props) => {
  const [currentStep, setCurrentStep] = useState(existingSession?.current_step || 1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionId, setSessionId] = useState(existingSession?.id);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [isCompleted, setIsCompleted] = useState(existingSession?.completed || existingSession?.status === 'submitted');
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const navigate = useNavigate();

  // Determine if form can be edited based on status
  // Allow editing if: in_progress, re-submit, or rejected
  // Prevent editing if: submitted or accepted
  const currentStatus = existingSession?.status || 'in_progress';
  const canEdit = currentStatus === 'in_progress' || currentStatus === 're-submit' || currentStatus === 'rejected';
  const isReadOnly = !canEdit && (currentStatus === 'submitted' || currentStatus === 'accepted');

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

  const totalSteps = 6;
  const progress = (currentStep / totalSteps) * 100;

  const statusBanner = isCompleted || isReadOnly ? (
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
            ? 'Your application was rejected. You can update and resubmit your application.'
            : 'Your application is read-only. You can view details and track status.'}
        </p>
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
      const fileName = `${user.id}/${fieldName}-${Date.now()}.${fileExt}`;
      const filePath = `onboarding-documents/${fileName}`;

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
            sessionId,
            current_step: currentStep,
            complete,
            data: {
              ...cleanedData,
              vehicle_year: data.vehicle_year ? parseInt(data.vehicle_year) : null,
              vehicle_mileage: data.vehicle_mileage ? parseInt(data.vehicle_mileage) : null,
            },
          },
        }
      );

      if (upsertError) throw upsertError;

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
    if (isReadOnly) {
      navigate("/onboarding");
      return;
    }
    setShowExitDialog(true);
  };

  const handleExitWithoutSaving = () => {
    setShowExitDialog(false);
    navigate("/onboarding");
  };

  const handleExitWithSaving = async () => {
    const values = getValues();
    await saveProgress(values, false);
    setShowExitDialog(false);
    navigate("/onboarding");
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
    await saveProgress(values, false);
  };

  const handleNext = async () => {
    setIsSubmitting(true);
    try {
      const values = getValues();
      
      // Validation for current step
      if (currentStep === 1) {
        if (!values.first_name || !values.surname || !values.email) {
          toast({
            title: "Required fields missing",
            description: "Please fill in First Name, Surname, and Email",
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
          // If resubmitting, update status back to submitted
          if (currentStatus === 're-submit' || currentStatus === 'rejected') {
            const { error: statusError } = await supabase
              .from("onboarding_sessions")
              .update({ status: 'submitted' })
              .eq("id", sessionId);
            
            if (statusError) throw statusError;
          } else {
            const { error } = await supabase.rpc("complete_onboarding", {
              p_session_id: sessionId,
            });
            
            if (error) throw error;
          }
          
          setIsCompleted(true);
          toast({ 
            title: "Success", 
            description: currentStatus === 're-submit' || currentStatus === 'rejected' 
              ? "Your application has been resubmitted and is awaiting approval!" 
              : "Your onboarding application has been submitted and is awaiting approval!" 
          });
          navigate('/onboarding');
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
            <h1 className="text-3xl font-bold mb-2">Own Vehicle Onboarding</h1>
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground mt-2">Step {currentStep} of {totalSteps}</p>
          </div>

          {statusBanner}
          <form onSubmit={handleSubmit(() => {})} className="space-y-6">
            {/* Page 1 - Personal Details */}
            {currentStep === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Page 1 - Personal Details</CardTitle>
                  <CardDescription>Tell us about yourself</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="first_name">First Name <span className="text-destructive">*</span></Label>
                      <Input id="first_name" {...register("first_name")} maxLength={100} />
                      {errors.first_name && <p className="text-sm text-destructive">{errors.first_name.message}</p>}
                    </div>
                    <div>
                      <Label htmlFor="surname">Surname <span className="text-destructive">*</span></Label>
                      <Input id="surname" {...register("surname")} maxLength={100} />
                      {errors.surname && <p className="text-sm text-destructive">{errors.surname.message}</p>}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="email">Email Address <span className="text-destructive">*</span></Label>
                    <Input id="email" type="email" {...register("email")} maxLength={255} />
                    {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="contact_phone">Contact Number</Label>
                    <Input id="contact_phone" {...register("contact_phone")} maxLength={20} />
                    {errors.contact_phone && <p className="text-sm text-destructive">{errors.contact_phone.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="address_line_1">Address Line 1</Label>
                    <Input id="address_line_1" {...register("address_line_1")} maxLength={200} />
                    {errors.address_line_1 && <p className="text-sm text-destructive">{errors.address_line_1.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="address_line_2">Address Line 2</Label>
                    <Input id="address_line_2" {...register("address_line_2")} maxLength={200} />
                    {errors.address_line_2 && <p className="text-sm text-destructive">{errors.address_line_2.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="address_line_3">Address Line 3</Label>
                    <Input id="address_line_3" {...register("address_line_3")} maxLength={200} />
                    {errors.address_line_3 && <p className="text-sm text-destructive">{errors.address_line_3.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="post_code">Post Code</Label>
                    <Input id="post_code" {...register("post_code")} maxLength={20} />
                    {errors.post_code && <p className="text-sm text-destructive">{errors.post_code.message}</p>}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="emergency_contact_name">Emergency Contact Name</Label>
                      <Input id="emergency_contact_name" {...register("emergency_contact_name")} maxLength={100} />
                      {errors.emergency_contact_name && <p className="text-sm text-destructive">{errors.emergency_contact_name.message}</p>}
                    </div>
                    <div>
                      <Label htmlFor="emergency_contact_phone">Emergency Contact Number</Label>
                      <Input id="emergency_contact_phone" {...register("emergency_contact_phone")} maxLength={20} />
                      {errors.emergency_contact_phone && <p className="text-sm text-destructive">{errors.emergency_contact_phone.message}</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Page 2 - Driver's License Details */}
            {currentStep === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle>Page 2 - Driver's License Details</CardTitle>
                  <CardDescription>Your license information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="drivers_license_number">Drivers License Number</Label>
                    <Input id="drivers_license_number" {...register("drivers_license_number")} maxLength={50} />
                    {errors.drivers_license_number && <p className="text-sm text-destructive">{errors.drivers_license_number.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="license_expiry_date">License Expiry Date</Label>
                    <Input id="license_expiry_date" type="date" {...register("license_expiry_date")} />
                    {errors.license_expiry_date && <p className="text-sm text-destructive">{errors.license_expiry_date.message}</p>}
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
            {currentStep === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle>Page 3 - Right to Work Details</CardTitle>
                  <CardDescription>Right to work documentation</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="national_insurance_number">National Insurance Number</Label>
                    <Input id="national_insurance_number" {...register("national_insurance_number")} maxLength={20} />
                    {errors.national_insurance_number && <p className="text-sm text-destructive">{errors.national_insurance_number.message}</p>}
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
                    <Input id="passport_number" {...register("passport_number")} maxLength={50} />
                    {errors.passport_number && <p className="text-sm text-destructive">{errors.passport_number.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="passport_expiry_date">Passport Expiry Date</Label>
                    <Input id="passport_expiry_date" type="date" {...register("passport_expiry_date")} />
                    {errors.passport_expiry_date && <p className="text-sm text-destructive">{errors.passport_expiry_date.message}</p>}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Page 4 - Vehicle Details */}
            {currentStep === 4 && (
              <Card>
                <CardHeader>
                  <CardTitle>Page 4 - Vehicle Details</CardTitle>
                  <CardDescription>Details about your vehicle</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="vehicle_make">Make</Label>
                      <Input id="vehicle_make" {...register("vehicle_make")} placeholder="e.g., Toyota" maxLength={100} />
                      {errors.vehicle_make && <p className="text-sm text-destructive">{errors.vehicle_make.message}</p>}
                    </div>
                    <div>
                      <Label htmlFor="vehicle_model">Model</Label>
                      <Input id="vehicle_model" {...register("vehicle_model")} placeholder="e.g., Corolla" maxLength={100} />
                      {errors.vehicle_model && <p className="text-sm text-destructive">{errors.vehicle_model.message}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="vehicle_year">Year</Label>
                      <Input id="vehicle_year" type="number" {...register("vehicle_year")} placeholder="e.g., 2020" min="1900" max="2100" />
                      {errors.vehicle_year && <p className="text-sm text-destructive">{errors.vehicle_year.message}</p>}
                    </div>
                    <div>
                      <Label htmlFor="vehicle_registration_number">Registration Number</Label>
                      <Input id="vehicle_registration_number" {...register("vehicle_registration_number")} maxLength={50} />
                      {errors.vehicle_registration_number && <p className="text-sm text-destructive">{errors.vehicle_registration_number.message}</p>}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="vehicle_type">Vehicle Type</Label>
                    <Select onValueChange={(value) => setValue("vehicle_type", value)} defaultValue={watch("vehicle_type")}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select vehicle type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Custom">Custom</SelectItem>
                        <SelectItem value="Long wheel base">Long wheel base</SelectItem>
                        <SelectItem value="Extra long wheel base">Extra long wheel base</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.vehicle_type && <p className="text-sm text-destructive">{errors.vehicle_type.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="vehicle_mileage">Vehicle Mileage</Label>
                    <Input id="vehicle_mileage" type="number" {...register("vehicle_mileage")} placeholder="e.g., 50000" min="0" />
                    {errors.vehicle_mileage && <p className="text-sm text-destructive">{errors.vehicle_mileage.message}</p>}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Page 5 - Identity Details */}
            {currentStep === 5 && (
              <Card>
                <CardHeader>
                  <CardTitle>Page 5 - Identity Details</CardTitle>
                  <CardDescription>Identity verification</CardDescription>
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
                    <Input id="dvla_code" {...register("dvla_code")} maxLength={50} placeholder="Enter your DVLA check code" />
                    {errors.dvla_code && <p className="text-sm text-destructive">{errors.dvla_code.message}</p>}
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="dbs_check"
                      {...register("dbs_check")}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="dbs_check" className="font-normal">DBS Check Completed</Label>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Page 6 - Work Availability */}
            {currentStep === 6 && (
              <Card>
                <CardHeader>
                  <CardTitle>Page 6 - Work Availability</CardTitle>
                  <CardDescription>Your work availability preferences</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="driver_availability">Driver Availability</Label>
                    <Select onValueChange={(value) => setValue("driver_availability", value as any)} defaultValue={watch("driver_availability")}>
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

            <div className="flex gap-4">
              {currentStep > 1 && (
              <Button type="button" variant="outline" onClick={() => setCurrentStep(currentStep - 1)} disabled={isSubmitting || isReadOnly}>
                  Previous
                </Button>
              )}
              {canEdit && (
                <Button type="button" variant="outline" onClick={handleSaveProgress} disabled={isSubmitting}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Progress
                </Button>
              )}
              {canEdit && (
                <Button type="button" onClick={handleNext} disabled={isSubmitting} className="ml-auto">
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {currentStep === totalSteps ? (currentStatus === 're-submit' || currentStatus === 'rejected' ? "Resubmit Application" : "Complete Onboarding") : "Next"}
                </Button>
              )}
              <Button type="button" variant="outline" onClick={handleExit} disabled={isSubmitting}>
                <X className="mr-2 h-4 w-4" />
                {isReadOnly ? "Back" : "Exit"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default OnboardingFormOwn;
