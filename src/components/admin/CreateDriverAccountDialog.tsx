import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { UserPlus } from "lucide-react";

const driverSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  surname: z.string().trim().min(1, "Surname is required").max(100),
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
  contactPhone: z.string().trim().max(30).optional().or(z.literal("")),
  licenseNumber: z.string().trim().max(50).optional().or(z.literal("")),
  licenseExpiry: z.string().optional().or(z.literal("")),
  addressLine1: z.string().trim().max(200).optional().or(z.literal("")),
  addressLine2: z.string().trim().max(200).optional().or(z.literal("")),
  addressLine3: z.string().trim().max(200).optional().or(z.literal("")),
  postcode: z.string().trim().max(20).optional().or(z.literal("")),
  emergencyContactName: z.string().trim().max(100).optional().or(z.literal("")),
  emergencyContactPhone: z.string().trim().max(30).optional().or(z.literal("")),
  operatorId: z.string().trim().max(50).optional().or(z.literal("")),
  nationalInsurance: z.string().trim().max(20).optional().or(z.literal("")),
  passportNumber: z.string().trim().max(30).optional().or(z.literal("")),
  passportExpiry: z.string().optional().or(z.literal("")),
  dvlaCode: z.string().trim().max(20).optional().or(z.literal("")),
  dbsCheck: z.boolean().optional(),
  driverAvailability: z.string().max(80).optional().or(z.literal("")),
});

const emptyForm = {
  firstName: "",
  surname: "",
  email: "",
  password: "",
  contactPhone: "",
  licenseNumber: "",
  licenseExpiry: "",
  addressLine1: "",
  addressLine2: "",
  addressLine3: "",
  postcode: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  operatorId: "",
  nationalInsurance: "",
  passportNumber: "",
  passportExpiry: "",
  dvlaCode: "",
  dbsCheck: false,
  driverAvailability: "",
};

export const CreateDriverAccountDialog = ({ onSuccess }: { onSuccess: () => void }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [passportFile, setPassportFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const { toast } = useToast();

  const uploadDocPaths = async (driverProfileId: string) => {
    const updates: Record<string, string> = {};
    const run = async (file: File | null, column: "license_picture" | "passport_upload" | "photo_upload", base: string) => {
      if (!file) return;
      const ext = file.name.split(".").pop() || "bin";
      const path = `${driverProfileId}/${base}.${ext}`;
      const { error } = await supabase.storage.from("driver-documents").upload(path, file, { upsert: true });
      if (error) throw error;
      updates[column] = path;
    };
    await run(licenseFile, "license_picture", "license_picture");
    await run(passportFile, "passport_upload", "passport_upload");
    await run(photoFile, "photo_upload", "photo");
    if (Object.keys(updates).length === 0) return;
    const { error } = await supabase
      .from("driver_profiles")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", driverProfileId);
    if (error) throw error;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = driverSchema.parse(formData);

      const { data: fnData, error: fnError } = await supabase.functions.invoke("create-driver-account", {
        body: {
          firstName: validated.firstName,
          surname: validated.surname,
          email: validated.email,
          password: validated.password,
          contactPhone: validated.contactPhone || undefined,
          licenseNumber: validated.licenseNumber || undefined,
          licenseExpiry: validated.licenseExpiry || undefined,
          addressLine1: validated.addressLine1 || undefined,
          addressLine2: validated.addressLine2 || undefined,
          addressLine3: validated.addressLine3 || undefined,
          postcode: validated.postcode || undefined,
          emergencyContactName: validated.emergencyContactName || undefined,
          emergencyContactPhone: validated.emergencyContactPhone || undefined,
          operatorId: validated.operatorId || undefined,
          nationalInsurance: validated.nationalInsurance || undefined,
          passportNumber: validated.passportNumber || undefined,
          passportExpiry: validated.passportExpiry || undefined,
          dvlaCode: validated.dvlaCode || undefined,
          dbsCheck: validated.dbsCheck ?? false,
          driverAvailability:
            validated.driverAvailability && validated.driverAvailability !== "_unset_"
              ? validated.driverAvailability
              : undefined,
        },
      });

      if (fnError) {
        let detail = fnError.message;
        try {
          const b = await (fnError as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.();
          if (b?.error) detail = b.error;
        } catch {
          /* ignore */
        }
        throw new Error(detail);
      }
      if (fnData?.error) throw new Error(fnData.error);

      const userId = (fnData as { userId?: string })?.userId;
      if (userId && (licenseFile || passportFile || photoFile)) {
        const { data: row } = await supabase.from("driver_profiles").select("id").eq("user_id", userId).maybeSingle();
        if (row?.id) {
          await uploadDocPaths(row.id);
        }
      }

      toast({
        title: "Driver account created",
        description: `Account created for ${validated.firstName} ${validated.surname}. They must change their password on first login.`,
      });

      setFormData({ ...emptyForm });
      setLicenseFile(null);
      setPassportFile(null);
      setPhotoFile(null);
      setOpen(false);
      onSuccess();
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to create driver account",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setFormData({ ...emptyForm });
      setLicenseFile(null);
      setPassportFile(null);
      setPhotoFile(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Create Driver Account
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Driver Account</DialogTitle>
          <DialogDescription>
            Create a driver login and profile with the same fields as driver onboarding. Upload document images after account
            creation (stored securely).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="surname">Surname *</Label>
              <Input
                id="surname"
                value={formData.surname}
                onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
                required
                maxLength={100}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              maxLength={255}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Temporary Password *</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              minLength={8}
              maxLength={100}
              placeholder="Min 8 characters"
            />
            <p className="text-xs text-muted-foreground">The driver must change this password on their first login</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contactPhone">Contact Phone</Label>
              <Input
                id="contactPhone"
                value={formData.contactPhone}
                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                maxLength={30}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="driverAvailability">Work availability</Label>
              <Select
                value={formData.driverAvailability || "_unset_"}
                onValueChange={(v) => setFormData({ ...formData, driverAvailability: v === "_unset_" ? "" : v })}
              >
                <SelectTrigger id="driverAvailability">
                  <SelectValue placeholder="Select availability" />
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="licenseNumber">Licence number</Label>
              <Input
                id="licenseNumber"
                value={formData.licenseNumber}
                onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="licenseExpiry">Licence expiry</Label>
              <Input
                id="licenseExpiry"
                type="date"
                value={formData.licenseExpiry}
                onChange={(e) => setFormData({ ...formData, licenseExpiry: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="passportNumber">Passport number</Label>
              <Input
                id="passportNumber"
                value={formData.passportNumber}
                onChange={(e) => setFormData({ ...formData, passportNumber: e.target.value })}
                maxLength={30}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="passportExpiry">Passport expiry</Label>
              <Input
                id="passportExpiry"
                type="date"
                value={formData.passportExpiry}
                onChange={(e) => setFormData({ ...formData, passportExpiry: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dvlaCode">DVLA check code</Label>
              <Input
                id="dvlaCode"
                value={formData.dvlaCode}
                onChange={(e) => setFormData({ ...formData, dvlaCode: e.target.value })}
                maxLength={20}
                placeholder="8 characters from DVLA"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nationalInsurance">National Insurance</Label>
              <Input
                id="nationalInsurance"
                value={formData.nationalInsurance}
                onChange={(e) => setFormData({ ...formData, nationalInsurance: e.target.value })}
                placeholder="e.g., AB123456C"
                maxLength={20}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="dbsCheck"
              checked={formData.dbsCheck}
              onCheckedChange={(c) => setFormData({ ...formData, dbsCheck: c === true })}
            />
            <Label htmlFor="dbsCheck" className="font-normal cursor-pointer">
              DBS check completed / required (record only)
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="addressLine1">Address line 1</Label>
            <Input
              id="addressLine1"
              value={formData.addressLine1}
              onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="addressLine2">Address line 2</Label>
            <Input
              id="addressLine2"
              value={formData.addressLine2}
              onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
              maxLength={200}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="addressLine3">Address line 3</Label>
              <Input
                id="addressLine3"
                value={formData.addressLine3}
                onChange={(e) => setFormData({ ...formData, addressLine3: e.target.value })}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postcode">Postcode</Label>
              <Input
                id="postcode"
                value={formData.postcode}
                onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                maxLength={20}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="emergencyContactName">Emergency contact name</Label>
              <Input
                id="emergencyContactName"
                value={formData.emergencyContactName}
                onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergencyContactPhone">Emergency contact phone</Label>
              <Input
                id="emergencyContactPhone"
                value={formData.emergencyContactPhone}
                onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                maxLength={30}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="operatorId">Operator ID</Label>
            <Input
              id="operatorId"
              value={formData.operatorId}
              onChange={(e) => setFormData({ ...formData, operatorId: e.target.value })}
              placeholder="e.g., 0074666"
              maxLength={50}
            />
          </div>

          <div className="space-y-2 border-t pt-4">
            <p className="text-sm font-medium">Document images (optional)</p>
            <p className="text-xs text-muted-foreground">Uploaded after the account is created to your driver-documents storage.</p>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label htmlFor="fLicense">Licence image</Label>
                <Input
                  id="fLicense"
                  type="file"
                  accept="image/*,.pdf"
                  className="mt-1"
                  onChange={(e) => setLicenseFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div>
                <Label htmlFor="fPassport">Passport image</Label>
                <Input
                  id="fPassport"
                  type="file"
                  accept="image/*,.pdf"
                  className="mt-1"
                  onChange={(e) => setPassportFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div>
                <Label htmlFor="fPhoto">Photo ID / headshot</Label>
                <Input
                  id="fPhoto"
                  type="file"
                  accept="image/*,.pdf"
                  className="mt-1"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Driver"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
