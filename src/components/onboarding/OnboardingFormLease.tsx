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
import { Loader2, Save, X } from "lucide-react";
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
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Valid email is required"),
  contact_phone: z.string().min(10, "Phone number is required"),
  address: z.string().min(5, "Address is required"),
  emergency_contact_name: z.string().min(2, "Emergency contact name is required"),
  emergency_contact_phone: z.string().min(10, "Emergency contact phone is required"),
  license_number: z.string().min(3, "License number is required"),
  license_expiry: z.string().min(1, "License expiry date is required"),
  preferred_vehicle_type: z.string().min(1, "Please select a vehicle type"),
  lease_start_date: z.string().min(1, "Lease start date is required"),
});

type FormData = z.infer<typeof formSchema>;

interface Props {
  existingSession?: any;
}

const OnboardingFormLease = ({ existingSession }: Props) => {
  const [currentStep, setCurrentStep] = useState(existingSession?.current_step || 1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionId, setSessionId] = useState(existingSession?.id);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [isCompleted, setIsCompleted] = useState(existingSession?.completed || existingSession?.status === 'submitted');
  const { toast } = useToast();
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors }, setValue, watch, getValues, reset } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: existingSession || {},
    shouldUnregister: false,
  });

  const totalSteps = 3;
  const progress = (currentStep / totalSteps) * 100;

  const saveProgress = async (data: Partial<FormData>, shouldNavigate: boolean = false, complete: boolean = false) => {
    try {
      // Determine email from form or current session
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

      const cleanedData: any = {};
      Object.entries(data).forEach(([key, value]) => {
        if (value === "" || value === undefined) cleanedData[key] = null;
        else cleanedData[key] = value;
      });

      const { data: upsertData, error: upsertError } = await supabase.functions.invoke(
        "upsert-onboarding-session",
        {
          body: {
            email: emailToUse,
            fullName: data.full_name || undefined,
            ownershipType: "lease",
            sessionId,
            current_step: currentStep,
            complete,
            data: cleanedData,
          },
        }
      );

      if (upsertError) throw upsertError;

      if (upsertData?.sessionId && upsertData.sessionId !== sessionId) {
        setSessionId(upsertData.sessionId);
      }

      if (upsertData?.createdUser) {
        toast({ title: "Account created", description: "Your progress has been saved." });
      } else {
        toast({ title: "Progress saved" });
      }

      if (shouldNavigate) navigate("/onboarding");
      return true;
    } catch (error) {
      console.error("Save error:", error);
      const message = error instanceof Error ? error.message : String(error);
      toast({ title: "Error saving progress", description: message, variant: "destructive" });
      return false;
    }
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      await saveProgress(data, false);
      
      if (currentStep < totalSteps) {
        setCurrentStep(currentStep + 1);
      } else {
        // Final step - save data and mark complete via backend
        const success = await saveProgress(data, false, true);
        if (success) {
          toast({ title: "Success", description: "Your onboarding application has been submitted successfully!" });
          navigate('/onboarding');
        }
      }
    } catch (error) {
      console.error("Submit error:", error);
      toast({ title: "Error submitting form", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordChangeComplete = async () => {
    setShowPasswordChange(false);
    
    // Sign out the user after password change
    await supabase.auth.signOut();
    
    toast({ 
      title: "Password updated", 
      description: "Please sign in with your new password to continue your application." 
    });
    
    // Redirect to onboarding login page
    navigate("/onboarding-login");
  };

  const handleExit = () => {
    setShowExitDialog(true);
  };

  const handleExitWithoutSaving = () => {
    // Stay on the form - just close the dialog
    setShowExitDialog(false);
  };

  const handleExitWithSaving = async () => {
    // Confirm exit: clear form and go back to onboarding dashboard
    reset({
      full_name: "",
      email: "",
      contact_phone: "",
      address: "",
      emergency_contact_name: "",
      emergency_contact_phone: "",
      license_number: "",
      license_expiry: "",
      preferred_vehicle_type: "",
      lease_start_date: "",
    });
    setCurrentStep(1);
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
    await saveProgress(values, false);
  };

  const handleNext = async () => {
    setIsSubmitting(true);
    try {
      const values = getValues();
      
      // Basic validation for current step
      if (currentStep === 1) {
        if (!values.full_name || !values.email) {
          toast({
            title: "Required fields missing",
            description: "Please fill in Full Name and Email",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
      }
      
      if (currentStep < totalSteps) {
        // Save and move to next step
        const success = await saveProgress(values, false);
        if (success) {
          setCurrentStep(currentStep + 1);
        }
      } else if (currentStep === totalSteps) {
        // Final step - save data and complete onboarding
        const success = await saveProgress(values, false);
        if (success) {
          const { error } = await supabase.rpc('complete_onboarding', {
            p_session_id: sessionId
          });
          
          if (error) throw error;
          
          setIsCompleted(true);
          toast({ title: "Success", description: "Your onboarding application has been submitted and is awaiting approval!" });
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
              you are about to exit. you will loose any unsaved changes.  Confirm exit?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleExitWithoutSaving}>
              No
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleExitWithSaving}>
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Vehicle Lease Onboarding</h1>
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground mt-2">Step {currentStep} of {totalSteps}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {currentStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Tell us about yourself</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input id="full_name" {...register("full_name")} />
                  {errors.full_name && <p className="text-sm text-destructive">{errors.full_name.message}</p>}
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" {...register("email")} />
                  {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                </div>
                <div>
                  <Label htmlFor="contact_phone">Phone Number</Label>
                  <Input id="contact_phone" {...register("contact_phone")} />
                  {errors.contact_phone && <p className="text-sm text-destructive">{errors.contact_phone.message}</p>}
                </div>
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" {...register("address")} />
                  {errors.address && <p className="text-sm text-destructive">{errors.address.message}</p>}
                </div>
                <div>
                  <Label htmlFor="emergency_contact_name">Emergency Contact Name</Label>
                  <Input id="emergency_contact_name" {...register("emergency_contact_name")} />
                  {errors.emergency_contact_name && <p className="text-sm text-destructive">{errors.emergency_contact_name.message}</p>}
                </div>
                <div>
                  <Label htmlFor="emergency_contact_phone">Emergency Contact Phone</Label>
                  <Input id="emergency_contact_phone" {...register("emergency_contact_phone")} />
                  {errors.emergency_contact_phone && <p className="text-sm text-destructive">{errors.emergency_contact_phone.message}</p>}
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>Driver's License</CardTitle>
                <CardDescription>Your license information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="license_number">License Number</Label>
                  <Input id="license_number" {...register("license_number")} />
                  {errors.license_number && <p className="text-sm text-destructive">{errors.license_number.message}</p>}
                </div>
                <div>
                  <Label htmlFor="license_expiry">License Expiry Date</Label>
                  <Input id="license_expiry" type="date" {...register("license_expiry")} />
                  {errors.license_expiry && <p className="text-sm text-destructive">{errors.license_expiry.message}</p>}
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>Vehicle Lease Details</CardTitle>
                <CardDescription>Choose your vehicle preference</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="preferred_vehicle_type">Preferred Vehicle Type</Label>
                  <Select onValueChange={(value) => setValue("preferred_vehicle_type", value)} defaultValue={watch("preferred_vehicle_type")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select vehicle type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="van">Van</SelectItem>
                      <SelectItem value="small-van">Small Van</SelectItem>
                      <SelectItem value="electric-van">Electric Van</SelectItem>
                      <SelectItem value="truck">Truck</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.preferred_vehicle_type && <p className="text-sm text-destructive">{errors.preferred_vehicle_type.message}</p>}
                </div>
                <div>
                  <Label htmlFor="lease_start_date">Preferred Start Date</Label>
                  <Input id="lease_start_date" type="date" {...register("lease_start_date")} />
                  {errors.lease_start_date && <p className="text-sm text-destructive">{errors.lease_start_date.message}</p>}
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2">Lease Terms</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Weekly payment: £150-£250 depending on vehicle type</li>
                    <li>• All maintenance and insurance included</li>
                    <li>• Fuel costs covered by company</li>
                    <li>• Minimum 6-month commitment</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-4">
            {currentStep > 1 && (
              <Button type="button" variant="outline" onClick={() => setCurrentStep(currentStep - 1)}>
                Previous
              </Button>
            )}
            <Button type="button" variant="outline" onClick={handleSaveProgress} disabled={isSubmitting}>
              <Save className="mr-2 h-4 w-4" />
              Save Progress
            </Button>
            <Button type="button" onClick={handleNext} disabled={isSubmitting || (currentStep === totalSteps && isCompleted)} className="ml-auto">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {currentStep === totalSteps ? (isCompleted ? "Submitted - Awaiting Approval" : "Complete Onboarding") : "Next"}
            </Button>
            <Button type="button" variant="outline" onClick={handleExit} disabled={isSubmitting}>
              <X className="mr-2 h-4 w-4" />
              Exit
            </Button>
          </div>
        </form>
      </div>
      </div>
    </>
  );
};

export default OnboardingFormLease;
