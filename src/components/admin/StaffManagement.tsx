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
import { UserPlus, Edit, Trash2, Loader2, Search, X, UserX, UserCheck } from "lucide-react";
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
  isInactive: boolean;
};

export default function StaffManagement() {
  const { toast } = useToast();
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [filteredStaff, setFilteredStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<StaffUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all"); // all, active, inactive

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
      // Get all users who have or had staff roles (admin, hr, finance, dispatcher)
      // This includes active staff and inactive staff (who have inactive role)
      const { data: allUserRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "hr", "finance", "dispatcher", "inactive"]);

      if (rolesError) throw rolesError;

      // Get unique user IDs who have or had staff roles
      const userIds = new Set<string>();
      const userRolesMap = new Map<string, string[]>();
      
      (allUserRoles || []).forEach((ur) => {
        userIds.add(ur.user_id);
        const roles = userRolesMap.get(ur.user_id) || [];
        roles.push(ur.role);
        userRolesMap.set(ur.user_id, roles);
      });

      // Get profile data for all these users
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, first_name, surname, full_name, contact_phone, address_line_1, address_line_2, address_line_3, postcode, emergency_contact_name, emergency_contact_phone, created_at")
        .in("user_id", Array.from(userIds));

      // Get all roles for each user to determine if they're inactive
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", Array.from(userIds));

      // Group roles by user_id
      const rolesByUserId = new Map<string, string[]>();
      (userRoles || []).forEach((ur) => {
        const roles = rolesByUserId.get(ur.user_id) || [];
        roles.push(ur.role);
        rolesByUserId.set(ur.user_id, roles);
      });

      // Combine data - show all users who have staff roles
      const staffMap = new Map<string, StaffUser>();
      
      (profiles || []).forEach((profile) => {
        const allRoles = rolesByUserId.get(profile.user_id) || [];
        
        // Check if user has inactive role
        const isInactive = allRoles.includes("inactive");
        
        // Get staff roles (admin, hr, finance, dispatcher)
        const staffRoles = allRoles.filter(r => ["admin", "hr", "finance", "dispatcher"].includes(r));
        
        // Show users who have staff roles (inactive users still have their staff roles)
        if (staffRoles.length > 0) {
          staffMap.set(profile.user_id, {
            user_id: profile.user_id,
            email: profile.email || "",
            first_name: profile.first_name,
            surname: profile.surname,
            full_name: profile.full_name,
            contact_phone: profile.contact_phone || null,
            address_line_1: profile.address_line_1 || null,
            address_line_2: profile.address_line_2 || null,
            address_line_3: profile.address_line_3 || null,
            postcode: profile.postcode || null,
            emergency_contact_name: profile.emergency_contact_name || null,
            emergency_contact_phone: profile.emergency_contact_phone || null,
            roles: staffRoles,
            created_at: profile.created_at || "",
            isInactive: isInactive,
          });
        }
      });

      const staffList = Array.from(staffMap.values());
      setStaff(staffList);
      applyFilters(staffList, searchQuery, roleFilter, statusFilter);
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

  // Apply filters whenever search, role, or status changes
  useEffect(() => {
    applyFilters(staff, searchQuery, roleFilter, statusFilter);
  }, [searchQuery, roleFilter, statusFilter, staff]);

  const applyFilters = (staffList: StaffUser[], search: string, role: string, status: string) => {
    let filtered = [...staffList];

    // Filter by search query (name or email)
    if (search.trim()) {
      const query = search.toLowerCase();
      filtered = filtered.filter((user) => {
        const name = formatUserName(user).toLowerCase();
        const email = user.email.toLowerCase();
        return name.includes(query) || email.includes(query);
      });
    }

    // Filter by role
    if (role !== "all") {
      filtered = filtered.filter((user) => user.roles.includes(role));
    }

    // Filter by status
    if (status === "active") {
      filtered = filtered.filter((user) => !user.isInactive);
    } else if (status === "inactive") {
      filtered = filtered.filter((user) => user.isInactive);
    }

    setFilteredStaff(filtered);
  };

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

  const handleDeactivateStaff = async (user: StaffUser) => {
    if (!confirm(`Are you sure you want to deactivate ${formatUserName(user)}? They will lose all access but their work history will be preserved.`)) {
      return;
    }

    try {
      // Assign inactive role (keep staff roles for display and reactivation purposes)
      // The inactive role will prevent login, and we filter them out of selectable lists
      const { error: assignError } = await supabase.rpc("assign_user_role", {
        p_user_id: user.user_id,
        p_role: "inactive",
      });

      if (assignError) throw assignError;

      toast({
        title: "Staff deactivated",
        description: `${formatUserName(user)} has been deactivated. They can no longer access the system, but their work history is preserved. They will not appear in selectable lists.`,
      });

      loadStaff();
    } catch (error: any) {
      toast({
        title: "Error deactivating staff",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleReactivateStaff = async (user: StaffUser) => {
    if (!confirm(`Are you sure you want to reactivate ${formatUserName(user)}?`)) {
      return;
    }

    try {
      // Remove inactive role (staff roles are already there, just hidden by inactive status)
      const { error: removeError } = await supabase.rpc("remove_user_role", {
        p_user_id: user.user_id,
        p_role: "inactive",
      });

      if (removeError) throw removeError;

      // Ensure all their staff roles are assigned (in case any were missing)
      for (const role of user.roles) {
        const { error: assignError } = await supabase.rpc("assign_user_role", {
          p_user_id: user.user_id,
          p_role: role,
        });

        if (assignError) {
          console.error(`Error ensuring ${role} role:`, assignError);
          // Continue with other roles even if one fails
        }
      }

      toast({
        title: "Staff reactivated",
        description: `${formatUserName(user)} has been reactivated and can now access the system with their roles: ${user.roles.join(", ")}.`,
      });

      loadStaff();
    } catch (error: any) {
      toast({
        title: "Error reactivating staff",
        description: error.message,
        variant: "destructive",
      });
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
          {/* Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="hr">HR</SelectItem>
                <SelectItem value="finance">Finance</SelectItem>
                <SelectItem value="dispatcher">Dispatcher</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role(s)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStaff.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No staff members found
                  </TableCell>
                </TableRow>
              ) : (
                filteredStaff.map((user) => (
                  <TableRow key={user.user_id} className={user.isInactive ? "opacity-60" : ""}>
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
                    <TableCell>
                      {user.isInactive ? (
                        <Badge variant="destructive">Inactive</Badge>
                      ) : (
                        <Badge variant="default">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell>{user.contact_phone || "-"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.created_at
                        ? format(new Date(user.created_at), "MMM d, yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditProfile(user)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        {user.isInactive ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReactivateStaff(user)}
                          >
                            <UserCheck className="h-4 w-4 mr-1" />
                            Reactivate
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeactivateStaff(user)}
                          >
                            <UserX className="h-4 w-4 mr-1" />
                            Deactivate
                          </Button>
                        )}
                      </div>
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

