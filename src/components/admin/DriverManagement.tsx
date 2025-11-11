import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Edit, Truck } from "lucide-react";
import { format } from "date-fns";

type DriverProfile = {
  driver_id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  surname: string | null;
  full_name: string | null;
  contact_phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  address_line_3: string | null;
  postcode: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  license_number: string | null;
  license_expiry: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  vehicle_registration: string | null;
  active: boolean;
  onboarded_at: string | null;
};

export default function DriverManagement() {
  const { toast } = useToast();
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState<DriverProfile | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    first_name: "",
    surname: "",
    contact_phone: "",
    address_line_1: "",
    address_line_2: "",
    address_line_3: "",
    postcode: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    license_number: "",
    license_expiry: "",
    vehicle_make: "",
    vehicle_model: "",
    vehicle_year: "",
    vehicle_registration: "",
    active: true,
  });

  useEffect(() => {
    loadDrivers();
  }, []);

  const loadDrivers = async () => {
    setLoading(true);
    try {
      // Get all drivers - select all columns including vehicle fields
      // Migration 20251108030000_add_vehicle_fields_to_drivers.sql must be applied first
      const { data: driversData, error: driversError } = await supabase
        .from("drivers")
        .select("id, user_id, email, license_number, license_expiry, vehicle_make, vehicle_model, vehicle_year, vehicle_registration, active, onboarded_at");
      
      if (driversError) {
        console.error("Drivers query error:", driversError);
        // Show more detailed error
        toast({
          title: "Error loading drivers",
          description: `Failed to load drivers: ${driversError.message}. Please ensure you have admin role and the RLS policy allows admin to read drivers.`,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (!driversData || driversData.length === 0) {
        setDrivers([]);
        setLoading(false);
        return;
      }

      // Get profiles for all drivers
      const userIds = driversData.map((d) => d.user_id).filter(Boolean);
      
      let profilesData: any[] = [];
      if (userIds.length > 0) {
        const { data, error: profilesError } = await supabase
          .from("profiles")
          .select("user_id, first_name, surname, full_name, contact_phone, address_line_1, address_line_2, address_line_3, postcode, emergency_contact_name, emergency_contact_phone")
          .in("user_id", userIds);

        if (profilesError) {
          console.error("Error loading profiles:", profilesError);
          // Continue without profiles - drivers will show with limited info
        } else {
          profilesData = data || [];
        }
      }

      // Combine driver and profile data
      const combined = driversData.map((driver) => {
        const profile = profilesData.find((p) => p.user_id === driver.user_id);
        return {
          driver_id: driver.id,
          user_id: driver.user_id || "",
          email: driver.email || "",
          first_name: profile?.first_name || null,
          surname: profile?.surname || null,
          full_name: profile?.full_name || null,
          contact_phone: profile?.contact_phone || null,
          address_line_1: profile?.address_line_1 || null,
          address_line_2: profile?.address_line_2 || null,
          address_line_3: profile?.address_line_3 || null,
          postcode: profile?.postcode || null,
          emergency_contact_name: profile?.emergency_contact_name || null,
          emergency_contact_phone: profile?.emergency_contact_phone || null,
          license_number: driver.license_number || null,
          license_expiry: driver.license_expiry || null,
          vehicle_make: driver.vehicle_make || null,
          vehicle_model: driver.vehicle_model || null,
          vehicle_year: driver.vehicle_year || null,
          vehicle_registration: driver.vehicle_registration || null,
          active: driver.active ?? true,
          onboarded_at: driver.onboarded_at || null,
        };
      });

      // Sort by email (since we can't reliably sort by created_at)
      combined.sort((a, b) => (a.email || "").localeCompare(b.email || ""));

      setDrivers(combined);
    } catch (error: any) {
      toast({
        title: "Error loading drivers",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditDriver = (driver: DriverProfile) => {
    setSelectedDriver(driver);
    setFormData({
      first_name: driver.first_name || "",
      surname: driver.surname || "",
      contact_phone: driver.contact_phone || "",
      address_line_1: driver.address_line_1 || "",
      address_line_2: driver.address_line_2 || "",
      address_line_3: driver.address_line_3 || "",
      postcode: driver.postcode || "",
      emergency_contact_name: driver.emergency_contact_name || "",
      emergency_contact_phone: driver.emergency_contact_phone || "",
      license_number: driver.license_number || "",
      license_expiry: driver.license_expiry ? format(new Date(driver.license_expiry), "yyyy-MM-dd") : "",
      vehicle_make: driver.vehicle_make || "",
      vehicle_model: driver.vehicle_model || "",
      vehicle_year: driver.vehicle_year?.toString() || "",
      vehicle_registration: driver.vehicle_registration || "",
      active: driver.active,
    });
    setEditDialogOpen(true);
  };

  const handleUpdateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDriver) return;

    setIsSubmitting(true);
    try {
      // Update profile (personal information)
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          first_name: formData.first_name.trim() || null,
          surname: formData.surname.trim() || null,
          full_name: `${formData.first_name.trim()} ${formData.surname.trim()}`.trim() || null,
          contact_phone: formData.contact_phone.trim() || null,
          address_line_1: formData.address_line_1.trim() || null,
          address_line_2: formData.address_line_2.trim() || null,
          address_line_3: formData.address_line_3.trim() || null,
          postcode: formData.postcode.trim() || null,
          emergency_contact_name: formData.emergency_contact_name.trim() || null,
          emergency_contact_phone: formData.emergency_contact_phone.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", selectedDriver.user_id);

      if (profileError) throw profileError;

      // Update driver record (driver-specific information)
      // Note: The trigger will automatically manage roles based on active status
      const { error: driverError } = await supabase
        .from("drivers")
        .update({
          license_number: formData.license_number.trim() || null,
          license_expiry: formData.license_expiry || null,
          vehicle_make: formData.vehicle_make.trim() || null,
          vehicle_model: formData.vehicle_model.trim() || null,
          vehicle_year: formData.vehicle_year ? parseInt(formData.vehicle_year) : null,
          vehicle_registration: formData.vehicle_registration.trim() || null,
          active: formData.active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedDriver.driver_id);

      if (driverError) throw driverError;

      // Wait a bit for the trigger to process
      await new Promise(resolve => setTimeout(resolve, 500));

      toast({
        title: "Driver profile updated",
        description: formData.active 
          ? "Driver profile updated. Driver is now active and can use the system." 
          : "Driver profile updated. Driver is now inactive and can only message admin.",
      });

      setEditDialogOpen(false);
      setSelectedDriver(null);
      loadDrivers();
    } catch (error: any) {
      toast({
        title: "Error updating driver",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Driver Management
              </CardTitle>
              <CardDescription>
                Edit existing driver profiles. Drivers can only be created through the onboarding process.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>License</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Onboarded</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drivers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No drivers found
                  </TableCell>
                </TableRow>
              ) : (
                drivers.map((driver) => (
                  <TableRow key={driver.driver_id}>
                    <TableCell className="font-medium">
                      {driver.full_name || `${driver.first_name || ""} ${driver.surname || ""}`.trim() || driver.email}
                    </TableCell>
                    <TableCell>{driver.email}</TableCell>
                    <TableCell>{driver.contact_phone || "-"}</TableCell>
                    <TableCell>{driver.license_number || "-"}</TableCell>
                    <TableCell>
                      {driver.vehicle_make && driver.vehicle_model
                        ? `${driver.vehicle_make} ${driver.vehicle_model}${driver.vehicle_year ? ` (${driver.vehicle_year})` : ""}`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={driver.active ? "default" : "secondary"}>
                        {driver.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {driver.onboarded_at
                        ? format(new Date(driver.onboarded_at), "MMM d, yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditDriver(driver)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Driver Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Driver Profile</DialogTitle>
            <DialogDescription>
              Update driver personal information and driver-specific details
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateDriver} className="space-y-4">
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Personal Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_first_name">First Name</Label>
                  <Input
                    id="edit_first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_surname">Surname</Label>
                  <Input
                    id="edit_surname"
                    value={formData.surname}
                    onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_email">Email</Label>
                <Input id="edit_email" value={selectedDriver?.email || ""} disabled />
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_contact_phone">Contact Phone</Label>
                <Input
                  id="edit_contact_phone"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  maxLength={20}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_address_line_1">Address Line 1</Label>
                <Input
                  id="edit_address_line_1"
                  value={formData.address_line_1}
                  onChange={(e) => setFormData({ ...formData, address_line_1: e.target.value })}
                  maxLength={200}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_address_line_2">Address Line 2</Label>
                <Input
                  id="edit_address_line_2"
                  value={formData.address_line_2}
                  onChange={(e) => setFormData({ ...formData, address_line_2: e.target.value })}
                  maxLength={200}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_address_line_3">Address Line 3</Label>
                <Input
                  id="edit_address_line_3"
                  value={formData.address_line_3}
                  onChange={(e) => setFormData({ ...formData, address_line_3: e.target.value })}
                  maxLength={200}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_postcode">Postcode</Label>
                <Input
                  id="edit_postcode"
                  value={formData.postcode}
                  onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                  maxLength={20}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_emergency_contact_name">Emergency Contact Name</Label>
                  <Input
                    id="edit_emergency_contact_name"
                    value={formData.emergency_contact_name}
                    onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_emergency_contact_phone">Emergency Contact Phone</Label>
                  <Input
                    id="edit_emergency_contact_phone"
                    value={formData.emergency_contact_phone}
                    onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                    maxLength={20}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold text-sm">Driver-Specific Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_license_number">License Number</Label>
                  <Input
                    id="edit_license_number"
                    value={formData.license_number}
                    onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                    maxLength={50}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_license_expiry">License Expiry</Label>
                  <Input
                    id="edit_license_expiry"
                    type="date"
                    value={formData.license_expiry}
                    onChange={(e) => setFormData({ ...formData, license_expiry: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_vehicle_make">Vehicle Make</Label>
                  <Input
                    id="edit_vehicle_make"
                    value={formData.vehicle_make}
                    onChange={(e) => setFormData({ ...formData, vehicle_make: e.target.value })}
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_vehicle_model">Vehicle Model</Label>
                  <Input
                    id="edit_vehicle_model"
                    value={formData.vehicle_model}
                    onChange={(e) => setFormData({ ...formData, vehicle_model: e.target.value })}
                    maxLength={100}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_vehicle_year">Vehicle Year</Label>
                  <Input
                    id="edit_vehicle_year"
                    type="number"
                    min="1900"
                    max="2100"
                    value={formData.vehicle_year}
                    onChange={(e) => setFormData({ ...formData, vehicle_year: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_vehicle_registration">Vehicle Registration</Label>
                  <Input
                    id="edit_vehicle_registration"
                    value={formData.vehicle_registration}
                    onChange={(e) => setFormData({ ...formData, vehicle_registration: e.target.value })}
                    maxLength={20}
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t">
                <Label htmlFor="edit_active" className="flex items-center gap-2 cursor-pointer">
                  <input
                    id="edit_active"
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="rounded w-4 h-4"
                  />
                  <span className="font-medium">Active Driver</span>
                </Label>
                <p className="text-xs text-muted-foreground ml-6">
                  {formData.active 
                    ? "Driver can use the system normally. Driver role will be assigned automatically." 
                    : "Driver will be marked inactive. Driver role will be removed and inactive role assigned. Driver can only login to message admin."}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditDialogOpen(false);
                  setSelectedDriver(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Updating..." : "Update Driver Profile"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

