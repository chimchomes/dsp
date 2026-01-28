import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload } from "lucide-react";

const onboardingSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  license_number: z.string().min(5, "License number is required"),
  contact_phone: z.string().min(10, "Valid phone number is required"),
  address: z.string().min(5, "Address is required"),
  emergency_contact_name: z.string().min(2, "Emergency contact name is required"),
  emergency_contact_phone: z.string().min(10, "Emergency contact phone is required"),
});

type OnboardingFormData = z.infer<typeof onboardingSchema>;

interface DocumentUpload {
  type: 'license' | 'proof_of_address' | 'right_to_work';
  file: File | null;
  label: string;
}

const DriverOnboardingForm = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [documents, setDocuments] = useState<DocumentUpload[]>([
    { type: 'license', file: null, label: 'Driver License' },
    { type: 'proof_of_address', file: null, label: 'Proof of Address' },
    { type: 'right_to_work', file: null, label: 'Right to Work Document' },
  ]);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
  });

  const handleFileChange = (type: DocumentUpload['type'], file: File | null) => {
    setDocuments(prev => prev.map(doc => 
      doc.type === type ? { ...doc, file } : doc
    ));
  };

  const uploadDocument = async (driverId: string, doc: DocumentUpload) => {
    if (!doc.file) return null;

    const fileExt = doc.file.name.split('.').pop();
    const fileName = `${driverId}/${doc.type}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('driver-documents')
      .upload(fileName, doc.file, { upsert: true });

    if (uploadError) throw uploadError;

    // Store file path instead of public URL - signed URLs generated on access
    // This ensures documents are only accessible via RLS policies
    const { data: { user } } = await supabase.auth.getUser();

    const { error: dbError } = await supabase
      .from('driver_documents')
      .insert({
        driver_id: driverId,
        document_type: doc.type,
        file_name: doc.file.name,
        file_url: fileName, // Store file path, not public URL
        uploaded_by: user?.id,
      });

    if (dbError) throw dbError;
  };

  const onSubmit = async (data: OnboardingFormData) => {
    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      // Use the create-driver-account edge function to properly create user account,
      // assign driver role, and create driver record with user_id linked
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-driver-account`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: data.name,
            email: data.email,
            contactPhone: data.contact_phone,
            licenseNumber: data.license_number,
            address: data.address,
            emergencyContactName: data.emergency_contact_name,
            emergencyContactPhone: data.emergency_contact_phone,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create driver account");
      }

      // Get the created driver record to upload documents
      const { data: driver, error: driverError } = await supabase
        .from('drivers')
        .select('id')
        .eq('email', data.email)
        .single();

      if (driverError) {
        console.error("Error fetching driver record:", driverError);
        // Continue even if we can't fetch the driver record - documents can be uploaded later
      } else if (driver) {
        // Upload documents
        await Promise.all(
          documents
            .filter(doc => doc.file)
            .map(doc => uploadDocument(driver.id, doc))
        );

        // Initialize training progress
        const { data: trainingItems } = await supabase
          .from('training_items')
          .select('id');

        if (trainingItems) {
          await supabase
            .from('driver_training_progress')
            .insert(
              trainingItems.map(item => ({
                driver_id: driver.id,
                training_item_id: item.id,
                completed: false,
              }))
            );
        }
      }

      toast({
        title: "Driver onboarded successfully",
        description: `${data.name} has been added to the system. User account created with temporary password.`,
      });

      reset();
      setDocuments(prev => prev.map(doc => ({ ...doc, file: null })));
    } catch (error: any) {
      toast({
        title: "Error onboarding driver",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Full Name *</Label>
          <Input id="name" {...register("name")} />
          {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
        </div>

        <div>
          <Label htmlFor="email">Email *</Label>
          <Input id="email" type="email" {...register("email")} />
          {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <Label htmlFor="license_number">License Number *</Label>
          <Input id="license_number" {...register("license_number")} />
          {errors.license_number && <p className="text-sm text-destructive mt-1">{errors.license_number.message}</p>}
        </div>

        <div>
          <Label htmlFor="contact_phone">Contact Phone *</Label>
          <Input id="contact_phone" {...register("contact_phone")} />
          {errors.contact_phone && <p className="text-sm text-destructive mt-1">{errors.contact_phone.message}</p>}
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="address">Address *</Label>
          <Textarea id="address" {...register("address")} rows={2} />
          {errors.address && <p className="text-sm text-destructive mt-1">{errors.address.message}</p>}
        </div>

        <div>
          <Label htmlFor="emergency_contact_name">Emergency Contact Name *</Label>
          <Input id="emergency_contact_name" {...register("emergency_contact_name")} />
          {errors.emergency_contact_name && <p className="text-sm text-destructive mt-1">{errors.emergency_contact_name.message}</p>}
        </div>

        <div>
          <Label htmlFor="emergency_contact_phone">Emergency Contact Phone *</Label>
          <Input id="emergency_contact_phone" {...register("emergency_contact_phone")} />
          {errors.emergency_contact_phone && <p className="text-sm text-destructive mt-1">{errors.emergency_contact_phone.message}</p>}
        </div>
      </div>

      <div className="space-y-4 border-t pt-6">
        <h3 className="font-semibold text-lg">Upload Documents</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <div key={doc.type} className="space-y-2">
              <Label htmlFor={doc.type}>{doc.label}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id={doc.type}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => handleFileChange(doc.type, e.target.files?.[0] || null)}
                  className="text-sm"
                />
                {doc.file && (
                  <span className="text-xs text-muted-foreground">
                    {doc.file.name}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full md:w-auto">
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Onboarding...
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" />
            Onboard Driver
          </>
        )}
      </Button>
    </form>
  );
};

export default DriverOnboardingForm;