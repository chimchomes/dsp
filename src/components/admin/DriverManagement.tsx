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
  operator_id: string | null;
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
    operator_id: "",
    active: true,
  });

  useEffect(() => {
    loadDrivers();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('drivers-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drivers' },
        () => {
          loadDrivers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Diagnostic function to check data sources
  useEffect(() => {
    const runDiagnostics = async () => {
      try {
        // Check admin role
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id);
          console.log("Current user roles:", roles?.map(r => r.role) || []);
        }

        // Check total drivers count (bypass RLS with service role would be ideal, but we can't)
        const { count } = await supabase
          .from("drivers")
          .select("*", { count: "exact", head: true });
        console.log("Total drivers in database (visible to current user):", count);

        // Check drivers with user_id
        const { data: driversWithUserId } = await supabase
          .from("drivers")
          .select("id, email, name, user_id")
          .not("user_id", "is", null);
        console.log("Drivers with user_id:", driversWithUserId?.length || 0);

        // Check drivers without user_id
        const { data: driversWithoutUserId } = await supabase
          .from("drivers")
          .select("id, email, name, user_id")
          .is("user_id", null);
        console.log("Drivers without user_id:", driversWithoutUserId?.length || 0);
      } catch (error) {
        console.error("Diagnostic error:", error);
      }
    };

    // Run diagnostics in development
    if (import.meta.env.DEV) {
      runDiagnostics();
    }
  }, []);

  const loadDrivers = async () => {
    setLoading(true);
    try {
      // Get all drivers - select all columns including name and operator_id
      const { data: driversData, error: driversError } = await supabase
        .from("drivers")
        .select("id, user_id, email, name, license_number, license_expiry, operator_id, active, onboarded_at")
        .order("onboarded_at", { ascending: false, nullsLast: true });
      
      if (driversError) {
        console.error("Drivers query error:", driversError);
        console.error("Full error details:", JSON.stringify(driversError, null, 2));
        // Show more detailed error
        toast({
          title: "Error loading drivers",
          description: `Failed to load drivers: ${driversError.message}. Please ensure you have admin role and the RLS policy allows admin to read drivers.`,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      console.log("Drivers loaded from database:", driversData?.length || 0, "drivers");
      if (driversData && driversData.length > 0) {
        console.log("Sample driver data:", driversData[0]);
      }

      if (!driversData || driversData.length === 0) {
        console.warn("No drivers found in database. This could be due to:");
        console.warn("1. RLS policies blocking access");
        console.warn("2. No drivers exist in the database");
        console.warn("3. Admin role not properly assigned");
        setDrivers([]);
        setLoading(false);
        return;
      }

      // Get profiles for all drivers (optional - drivers table has name field as fallback)
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
      // Use profile data when available, fallback to drivers.name field
      const combined = driversData.map((driver) => {
        const profile = profilesData.find((p) => p.user_id === driver.user_id);
        
        // Determine name: prefer profile full_name, then profile first_name + surname, then drivers.name, then email
        const fullName = profile?.full_name || 
                        (profile?.first_name && profile?.surname ? `${profile.first_name} ${profile.surname}` : null) ||
                        driver.name || 
                        driver.email;
        
        // Split full name into first_name and surname if not in profile
        const firstName = profile?.first_name || (fullName ? fullName.split(' ')[0] : null);
        const surname = profile?.surname || (fullName && fullName.includes(' ') ? fullName.split(' ').slice(1).join(' ') : null);
        
        return {
          driver_id: driver.id,
          user_id: driver.user_id || "",
          email: driver.email || "",
          first_name: firstName,
          surname: surname,
          full_name: fullName,
          contact_phone: profile?.contact_phone || null,
          address_line_1: profile?.address_line_1 || null,
          address_line_2: profile?.address_line_2 || null,
          address_line_3: profile?.address_line_3 || null,
          postcode: profile?.postcode || null,
          emergency_contact_name: profile?.emergency_contact_name || null,
          emergency_contact_phone: profile?.emergency_contact_phone || null,
          license_number: driver.license_number || null,
          license_expiry: driver.license_expiry || null,
          operator_id: driver.operator_id || null,
          active: driver.active ?? true,
          onboarded_at: driver.onboarded_at || null,
        };
      });

      // Sort by name, then email
      combined.sort((a, b) => {
        const nameA = a.full_name || a.email || "";
        const nameB = b.full_name || b.email || "";
        return nameA.localeCompare(nameB);
      });

      console.log("Combined drivers data:", combined.length, "drivers ready to display");
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
      operator_id: driver.operator_id || "",
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

      // If activating the driver, ensure the user has the driver role first
      // The trigger enforce_driver_role() requires the user to have the driver role
      if (formData.active && selectedDriver.user_id) {
        const { error: roleError } = await supabase.rpc('assign_user_role', {
          p_user_id: selectedDriver.user_id,
          p_role: 'driver',
        });

        if (roleError) {
          // assign_user_role uses ON CONFLICT DO NOTHING, so errors here are real issues
          throw new Error(`Failed to assign driver role: ${roleError.message}`);
        }
      }

      // Update driver record (driver-specific information)
      const { error: driverError } = await supabase
        .from("drivers")
        .update({
          license_number: formData.license_number.trim() || null,
          license_expiry: formData.license_expiry || null,
          operator_id: formData.operator_id.trim() || null,
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
                <TableHead>Operator ID</TableHead>
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
                    <TableCell>{driver.operator_id || "-"}</TableCell>
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

              <div className="space-y-2">
                <Label htmlFor="edit_operator_id">Operator ID</Label>
                <Input
                  id="edit_operator_id"
                  value={formData.operator_id}
                  onChange={(e) => setFormData({ ...formData, operator_id: e.target.value })}
                  placeholder="e.g., 0074666"
                  maxLength={50}
                />
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

