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
import { UserPlus } from "lucide-react";

const driverSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  surname: z.string().trim().min(1, "Surname is required").max(100),
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
  contactPhone: z.string().trim().max(20).optional(),
  licenseNumber: z.string().trim().max(50).optional(),
  addressLine1: z.string().trim().max(200).optional(),
  addressLine2: z.string().trim().max(200).optional(),
  addressLine3: z.string().trim().max(200).optional(),
  postcode: z.string().trim().max(20).optional(),
  emergencyContactName: z.string().trim().max(100).optional(),
  emergencyContactPhone: z.string().trim().max(20).optional(),
  operatorId: z.string().trim().max(50).optional(),
  nationalInsurance: z.string().trim().max(20).optional(),
});

export const CreateDriverAccountDialog = ({ onSuccess }: { onSuccess: () => void }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    surname: "",
    email: "",
    password: "",
    contactPhone: "",
    licenseNumber: "",
    addressLine1: "",
    addressLine2: "",
    addressLine3: "",
    postcode: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    operatorId: "",
    nationalInsurance: "",
  });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate input
      const validated = driverSchema.parse(formData);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-driver-account`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(validated),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create driver account");
      }

      toast({
        title: "Driver account created",
        description: `Account created for ${validated.firstName} ${validated.surname}. They must change their password on first login.`,
      });

      setFormData({
        firstName: "",
        surname: "",
        email: "",
        password: "",
        contactPhone: "",
        licenseNumber: "",
        addressLine1: "",
        addressLine2: "",
        addressLine3: "",
        postcode: "",
        emergencyContactName: "",
        emergencyContactPhone: "",
        operatorId: "",
        nationalInsurance: "",
      });
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
    // Reset form when dialog closes
    if (!newOpen) {
      setFormData({
        firstName: "",
        surname: "",
        email: "",
        password: "",
        contactPhone: "",
        licenseNumber: "",
        addressLine1: "",
        addressLine2: "",
        addressLine3: "",
        postcode: "",
        emergencyContactName: "",
        emergencyContactPhone: "",
        operatorId: "",
        nationalInsurance: "",
      });
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
            Create a new driver account with login credentials and driver role
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
            <p className="text-xs text-muted-foreground">
              The driver must change this password on their first login
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contactPhone">Contact Phone</Label>
              <Input
                id="contactPhone"
                value={formData.contactPhone}
                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                maxLength={20}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="licenseNumber">License Number</Label>
              <Input
                id="licenseNumber"
                value={formData.licenseNumber}
                onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                maxLength={50}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nationalInsurance">National Insurance Number</Label>
            <Input
              id="nationalInsurance"
              value={formData.nationalInsurance}
              onChange={(e) => setFormData({ ...formData, nationalInsurance: e.target.value })}
              placeholder="e.g., AB123456C"
              maxLength={20}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="addressLine1">Address Line 1</Label>
            <Input
              id="addressLine1"
              value={formData.addressLine1}
              onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="addressLine2">Address Line 2</Label>
            <Input
              id="addressLine2"
              value={formData.addressLine2}
              onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
              maxLength={200}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="addressLine3">Address Line 3</Label>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="emergencyContactName">Emergency Contact Name</Label>
              <Input
                id="emergencyContactName"
                value={formData.emergencyContactName}
                onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergencyContactPhone">Emergency Contact Phone</Label>
              <Input
                id="emergencyContactPhone"
                value={formData.emergencyContactPhone}
                onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                maxLength={20}
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
            <p className="text-xs text-muted-foreground">Only HR and Admin can add operator ID</p>
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
