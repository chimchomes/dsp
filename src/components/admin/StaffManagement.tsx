import { useState, useEffect } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, Edit, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { z } from "zod";

const staffRoleSchema = z.object({
  first_name: z.string().min(2, "First name must be at least 2 characters").max(100),
  surname: z.string().min(2, "Surname must be at least 2 characters").max(100),
  email: z.string().email("Invalid email address").max(255),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["admin", "hr", "finance", "dispatcher"], {
    errorMap: () => ({ message: "Invalid role selected" }),
  }),
  contact_phone: z.string().max(20).optional().or(z.literal("")),
});

type StaffUser = {
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
  roles: string[];
  created_at: string;
};

export default function StaffManagement() {
  const { toast } = useToast();
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<StaffUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    first_name: "",
    surname: "",
    email: "",
    password: "",
    role: "hr" as "admin" | "hr" | "finance" | "dispatcher",
    contact_phone: "",
    address_line_1: "",
    address_line_2: "",
    address_line_3: "",
    postcode: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const loadStaff = async () => {
    setLoading(true);
    try {
      // Get all users with staff roles (admin, hr, finance, dispatcher)
      const { data: roleProfiles, error } = await supabase
        .from("role_profiles")
        .select("user_id, email, first_name, surname, full_name")
        .in("role", ["admin", "hr", "finance", "dispatcher"]);

      if (error) throw error;

      // Get full profile data from profiles table
      const userIds = (roleProfiles || []).map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, contact_phone, address_line_1, address_line_2, address_line_3, postcode, emergency_contact_name, emergency_contact_phone, created_at")
        .in("user_id", userIds);

      // Get roles for each user
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds)
        .in("role", ["admin", "hr", "finance", "dispatcher"]);

      // Group roles by user_id
      const rolesByUserId = new Map<string, string[]>();
      (userRoles || []).forEach((ur) => {
        const roles = rolesByUserId.get(ur.user_id) || [];
        roles.push(ur.role);
        rolesByUserId.set(ur.user_id, roles);
      });

      // Combine data
      const staffMap = new Map<string, StaffUser>();
      (roleProfiles || []).forEach((rp) => {
        const profile = (profiles || []).find((p) => p.user_id === rp.user_id);
        const roles = rolesByUserId.get(rp.user_id) || [];
        
        // Only show users with staff roles (exclude drivers and onboarding)
        if (roles.some(r => ["admin", "hr", "finance", "dispatcher"].includes(r))) {
          staffMap.set(rp.user_id, {
            user_id: rp.user_id,
            email: rp.email || "",
            first_name: rp.first_name,
            surname: rp.surname,
            full_name: rp.full_name,
            contact_phone: profile?.contact_phone || null,
            address_line_1: profile?.address_line_1 || null,
            address_line_2: profile?.address_line_2 || null,
            address_line_3: profile?.address_line_3 || null,
            postcode: profile?.postcode || null,
            emergency_contact_name: profile?.emergency_contact_name || null,
            emergency_contact_phone: profile?.emergency_contact_phone || null,
            roles: roles,
            created_at: profile?.created_at || "",
          });
        }
      });

      setStaff(Array.from(staffMap.values()));
    } catch (error: any) {
      toast({
        title: "Error loading staff",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const resetForm = () => {
    setFormData({
      first_name: "",
      surname: "",
      email: "",
      password: "",
      role: "hr",
      contact_phone: "",
      address_line_1: "",
      address_line_2: "",
      address_line_3: "",
      postcode: "",
      emergency_contact_name: "",
      emergency_contact_phone: "",
    });
    setFormErrors({});
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setIsSubmitting(true);

    try {
      // Validate form
      const validated = staffRoleSchema.parse(formData);

      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase.functions.invoke("create-staff-account", {
        body: {
          email: validated.email,
          password: validated.password,
          first_name: validated.first_name,
          surname: validated.surname,
          role: validated.role,
          contact_phone: validated.contact_phone || null,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Staff account created",
        description: `${validated.first_name} ${validated.surname} has been created with ${validated.role} role. They must change their password on first login.`,
      });

      resetForm();
      setCreateDialogOpen(false);
      loadStaff();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            errors[err.path[0].toString()] = err.message;
          }
        });
        setFormErrors(errors);
      } else {
        toast({
          title: "Error creating staff",
          description: error.message || "Failed to create staff account",
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditProfile = async (user: StaffUser) => {
    setSelectedUser(user);
    
    // Fetch full profile data including address and emergency contact
    const { data: profileData } = await supabase
      .from("profiles")
      .select("first_name, surname, email, contact_phone, address_line_1, address_line_2, address_line_3, postcode, emergency_contact_name, emergency_contact_phone")
      .eq("user_id", user.user_id)
      .single();
    
    // Get user roles to display primary role
    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.user_id)
      .in("role", ["admin", "hr", "finance", "dispatcher"])
      .order("role", { ascending: true })
      .limit(1);
    
    const primaryRole = userRoles?.[0]?.role || user.roles[0] || "hr";
    
    setFormData({
      first_name: profileData?.first_name || user.first_name || "",
      surname: profileData?.surname || user.surname || "",
      email: user.email,
      password: "", // Don't show password
      role: primaryRole as "admin" | "hr" | "finance" | "dispatcher",
      contact_phone: profileData?.contact_phone || user.contact_phone || "",
      address_line_1: profileData?.address_line_1 || user.address_line_1 || "",
      address_line_2: profileData?.address_line_2 || user.address_line_2 || "",
      address_line_3: profileData?.address_line_3 || user.address_line_3 || "",
      postcode: profileData?.postcode || user.postcode || "",
      emergency_contact_name: profileData?.emergency_contact_name || "",
      emergency_contact_phone: profileData?.emergency_contact_phone || "",
    });
    setEditDialogOpen(true);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setIsSubmitting(true);
    try {
      // Update profile with all personal information fields
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
        .eq("user_id", selectedUser.user_id);

      if (profileError) throw profileError;

      toast({
        title: "Profile updated",
        description: "User profile has been updated successfully",
      });

      setEditDialogOpen(false);
      setSelectedUser(null);
      loadStaff();
    } catch (error: any) {
      toast({
        title: "Error updating profile",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatUserName = (user: StaffUser) => {
    if (user.first_name && user.surname) {
      return `${user.first_name} ${user.surname}`;
    }
    if (user.full_name) {
      return user.full_name;
    }
    return user.email;
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
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Staff Management</h3>
          <p className="text-sm text-muted-foreground">
            Create and manage staff accounts (HR, Finance, Dispatcher, Admin)
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <UserPlus className="h-4 w-4 mr-2" />
              Create Staff Account
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Staff Account</DialogTitle>
              <DialogDescription>
                Create a new staff account. The user must change their password on first login.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateStaff} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    required
                  />
                  {formErrors.first_name && (
                    <p className="text-sm text-destructive">{formErrors.first_name}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="surname">Surname *</Label>
                  <Input
                    id="surname"
                    value={formData.surname}
                    onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
                    required
                  />
                  {formErrors.surname && (
                    <p className="text-sm text-destructive">{formErrors.surname}</p>
                  )}
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
                />
                {formErrors.email && (
                  <p className="text-sm text-destructive">{formErrors.email}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Role *</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: any) => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger id="role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hr">HR</SelectItem>
                      <SelectItem value="finance">Finance</SelectItem>
                      <SelectItem value="dispatcher">Dispatcher</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  {formErrors.role && (
                    <p className="text-sm text-destructive">{formErrors.role}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_phone">Contact Phone</Label>
                  <Input
                    id="contact_phone"
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={8}
                  placeholder="Minimum 8 characters"
                />
                {formErrors.password && (
                  <p className="text-sm text-destructive">{formErrors.password}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  User must change this password on first login
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCreateDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Create Staff Account"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Staff List</CardTitle>
          <CardDescription>
            All staff members with roles: Admin, HR, Finance, Dispatcher
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role(s)</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No staff members found
                  </TableCell>
                </TableRow>
              ) : (
                staff.map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell className="font-medium">{formatUserName(user)}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <div className="flex gap-2 flex-wrap">
                        {user.roles.map((role) => (
                          <Badge key={role} variant="secondary">
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{user.contact_phone || "-"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.created_at
                        ? format(new Date(user.created_at), "MMM d, yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditProfile(user)}
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

      {/* Edit Profile Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>Update user profile information</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
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
              <Input id="edit_email" value={formData.email} disabled />
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_role">Role</Label>
              <Input 
                id="edit_role" 
                value={formData.role.charAt(0).toUpperCase() + formData.role.slice(1)} 
                disabled 
              />
              <p className="text-xs text-muted-foreground">Role cannot be changed. Managed through User Roles tab.</p>
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

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditDialogOpen(false);
                  setSelectedUser(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Updating..." : "Update Profile"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

