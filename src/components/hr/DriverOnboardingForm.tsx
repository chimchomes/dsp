import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload } from "lucide-react";

const onboardingSchema = z.object({
  first_name: z.string().min(2, "First name must be at least 2 characters"),
  surname: z.string().min(2, "Surname must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  license_number: z.string().min(5, "License number is required"),
  contact_phone: z.string().min(10, "Valid phone number is required"),
  address_line_1: z.string().min(1, "Address line 1 is required"),
  address_line_2: z.string().optional(),
  address_line_3: z.string().optional(),
  postcode: z.string().min(1, "Postcode is required"),
  national_insurance: z.string().optional(),
  emergency_contact_name: z.string().min(2, "Emergency contact name is required"),
  emergency_contact_phone: z.string().min(10, "Emergency contact phone is required"),
  license_expiry: z.string().optional(),
  operator_id: z.string().optional(),
  passport_number: z.string().optional(),
  passport_expiry: z.string().optional(),
  dvla_code: z.string().optional(),
  dbs_check: z.boolean().optional(),
  driver_availability: z.string().optional(),
});

type OnboardingFormData = z.infer<typeof onboardingSchema>;

function generateTempPassword(): string {
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  const buf = new Uint8Array(14);
  crypto.getRandomValues(buf);
  for (let i = 0; i < 14; i++) s += chars[buf[i]! % chars.length];
  return `${s}Aa1!`;
}

const DriverOnboardingForm = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [passportFile, setPassportFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      first_name: "",
      surname: "",
      email: "",
      license_number: "",
      contact_phone: "",
      address_line_1: "",
      address_line_2: "",
      address_line_3: "",
      postcode: "",
      national_insurance: "",
      emergency_contact_name: "",
      emergency_contact_phone: "",
      license_expiry: "",
      operator_id: "",
      passport_number: "",
      passport_expiry: "",
      dvla_code: "",
      dbs_check: false,
      driver_availability: "",
    },
  });
  const dbsCheck = watch("dbs_check");
  const driverAvailability = watch("driver_availability");

  const uploadProfileDoc = async (
    driverId: string,
    file: File | null,
    column: "license_picture" | "passport_upload" | "photo_upload"
  ): Promise<string | null> => {
    if (!file) return null;
    const ext = file.name.split(".").pop() || "bin";
    const path = `${driverId}/${column}.${ext}`;
    const { error } = await supabase.storage.from("driver-documents").upload(path, file, { upsert: true });
    if (error) throw error;
    return path;
  };

  const onSubmit = async (data: OnboardingFormData) => {
    setIsSubmitting(true);
    try {
      const fullName = `${data.first_name} ${data.surname}`.trim();
      const tempPassword = generateTempPassword();

      const { data: fnData, error: fnError } = await supabase.functions.invoke("create-driver-account", {
        body: {
          firstName: data.first_name,
          surname: data.surname,
          email: data.email,
          password: tempPassword,
          contactPhone: data.contact_phone,
          licenseNumber: data.license_number,
          licenseExpiry: data.license_expiry || undefined,
          addressLine1: data.address_line_1,
          addressLine2: data.address_line_2 || null,
          addressLine3: data.address_line_3 || null,
          postcode: data.postcode,
          emergencyContactName: data.emergency_contact_name,
          emergencyContactPhone: data.emergency_contact_phone,
          nationalInsurance: data.national_insurance || null,
          operatorId: data.operator_id || undefined,
          passportNumber: data.passport_number || undefined,
          passportExpiry: data.passport_expiry || undefined,
          dvlaCode: data.dvla_code || undefined,
          dbsCheck: data.dbs_check ?? false,
          driverAvailability:
            data.driver_availability && data.driver_availability !== "_unset_"
              ? data.driver_availability
              : undefined,
        },
      });

      if (fnError) {
        let detail = fnError.message;
        try { const b = await (fnError as any).context?.json?.(); if (b?.error) detail = b.error; } catch {}
        throw new Error(detail);
      }
      if (fnData?.error) throw new Error(fnData.error);

      // Get the created driver record to upload documents
      const { data: driver, error: driverError } = await supabase
        .from('driver_profiles')
        .select('id')
        .eq('email', data.email)
        .single();

      if (driverError) {
        console.error("Error fetching driver record:", driverError);
        // Continue even if we can't fetch the driver record - documents can be uploaded later
      } else if (driver) {
        const profileDocUpdates: Record<string, string> = {};
        const licensePath = await uploadProfileDoc(driver.id, licenseFile, "license_picture");
        const passportPath = await uploadProfileDoc(driver.id, passportFile, "passport_upload");
        const photoPath = await uploadProfileDoc(driver.id, photoFile, "photo_upload");
        if (licensePath) profileDocUpdates.license_picture = licensePath;
        if (passportPath) profileDocUpdates.passport_upload = passportPath;
        if (photoPath) profileDocUpdates.photo_upload = photoPath;

        if (Object.keys(profileDocUpdates).length > 0) {
          const { error: profErr } = await supabase
            .from("driver_profiles")
            .update({ ...profileDocUpdates, updated_at: new Date().toISOString() })
            .eq("id", driver.id);
          if (profErr) console.error("driver_profiles document paths:", profErr);
        }

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
        description: `${fullName} has been added to the system. User account created with temporary password.`,
      });

      reset();
      setDocuments(prev => prev.map(doc => ({ ...doc, file: null })));
      setPassportFile(null);
      setPhotoFile(null);
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
          <Label htmlFor="first_name">First Name *</Label>
          <Input id="first_name" {...register("first_name")} />
          {errors.first_name && <p className="text-sm text-destructive mt-1">{errors.first_name.message}</p>}
        </div>

        <div>
          <Label htmlFor="surname">Surname *</Label>
          <Input id="surname" {...register("surname")} />
          {errors.surname && <p className="text-sm text-destructive mt-1">{errors.surname.message}</p>}
        </div>

        <div>
          <Label htmlFor="email">Email *</Label>
          <Input id="email" type="email" {...register("email")} />
          {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <Label htmlFor="contact_phone">Contact Phone *</Label>
          <Input id="contact_phone" {...register("contact_phone")} />
          {errors.contact_phone && <p className="text-sm text-destructive mt-1">{errors.contact_phone.message}</p>}
        </div>

        <div>
          <Label htmlFor="license_number">License Number *</Label>
          <Input id="license_number" {...register("license_number")} />
          {errors.license_number && <p className="text-sm text-destructive mt-1">{errors.license_number.message}</p>}
        </div>

        <div>
          <Label htmlFor="national_insurance">National Insurance Number</Label>
          <Input id="national_insurance" {...register("national_insurance")} placeholder="e.g., AB123456C" />
          {errors.national_insurance && <p className="text-sm text-destructive mt-1">{errors.national_insurance.message}</p>}
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="address_line_1">Address Line 1 *</Label>
          <Input id="address_line_1" {...register("address_line_1")} />
          {errors.address_line_1 && <p className="text-sm text-destructive mt-1">{errors.address_line_1.message}</p>}
        </div>

        <div>
          <Label htmlFor="address_line_2">Address Line 2</Label>
          <Input id="address_line_2" {...register("address_line_2")} />
          {errors.address_line_2 && <p className="text-sm text-destructive mt-1">{errors.address_line_2.message}</p>}
        </div>

        <div>
          <Label htmlFor="address_line_3">Address Line 3</Label>
          <Input id="address_line_3" {...register("address_line_3")} />
          {errors.address_line_3 && <p className="text-sm text-destructive mt-1">{errors.address_line_3.message}</p>}
        </div>

        <div>
          <Label htmlFor="postcode">Postcode *</Label>
          <Input id="postcode" {...register("postcode")} />
          {errors.postcode && <p className="text-sm text-destructive mt-1">{errors.postcode.message}</p>}
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

        <div>
          <Label htmlFor="license_expiry">License expiry</Label>
          <Input id="license_expiry" type="date" {...register("license_expiry")} />
          {errors.license_expiry && <p className="text-sm text-destructive mt-1">{errors.license_expiry.message}</p>}
        </div>

        <div>
          <Label htmlFor="operator_id">Operator ID</Label>
          <Input id="operator_id" {...register("operator_id")} placeholder="e.g., DB6249" />
          {errors.operator_id && <p className="text-sm text-destructive mt-1">{errors.operator_id.message}</p>}
        </div>

        <div>
          <Label htmlFor="passport_number">Passport number</Label>
          <Input id="passport_number" {...register("passport_number")} />
          {errors.passport_number && <p className="text-sm text-destructive mt-1">{errors.passport_number.message}</p>}
        </div>

        <div>
          <Label htmlFor="passport_expiry">Passport expiry</Label>
          <Input id="passport_expiry" type="date" {...register("passport_expiry")} />
          {errors.passport_expiry && <p className="text-sm text-destructive mt-1">{errors.passport_expiry.message}</p>}
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="dvla_code">DVLA check code</Label>
          <Input id="dvla_code" {...register("dvla_code")} />
          {errors.dvla_code && <p className="text-sm text-destructive mt-1">{errors.dvla_code.message}</p>}
        </div>

        <div className="flex items-center space-x-2 md:col-span-2">
          <Checkbox
            id="dbs_check"
            checked={dbsCheck ?? false}
            onCheckedChange={(c) => setValue("dbs_check", c === true)}
          />
          <Label htmlFor="dbs_check" className="font-normal cursor-pointer">
            DBS check completed
          </Label>
        </div>

        <div className="md:col-span-2">
          <Label>Availability</Label>
          <Select
            value={driverAvailability === "" ? "_unset_" : driverAvailability}
            onValueChange={(v) => setValue("driver_availability", v === "_unset_" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Not specified" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_unset_">Not specified</SelectItem>
              <SelectItem value="Full Time">Full Time</SelectItem>
              <SelectItem value="Part Time">Part Time</SelectItem>
              <SelectItem value="Flexi (Same Day)">Flexi (Same Day)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4 border-t pt-6">
        <h3 className="font-semibold text-lg">Upload Documents</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="license_upload_hr">Licence image</Label>
            <Input
              id="license_upload_hr"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setLicenseFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
            {licenseFile && (
              <span className="text-xs text-muted-foreground">{licenseFile.name}</span>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="passport_upload_hr">Passport / right to work</Label>
            <Input
              id="passport_upload_hr"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setPassportFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
            {passportFile && (
              <span className="text-xs text-muted-foreground">{passportFile.name}</span>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="photo_upload_hr">Photo</Label>
            <Input
              id="photo_upload_hr"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
            {photoFile && (
              <span className="text-xs text-muted-foreground">{photoFile.name}</span>
            )}
          </div>
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
