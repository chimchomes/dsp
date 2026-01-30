import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus, UserMinus, Shield, Search, X } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { Label } from "@/components/ui/label";

interface UserWithRoles {
  id: string;
  email: string;
  created_at: string;
  roles: string[];
}

const UserManagement = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("driver");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const fetchUsers = async () => {
    try {
      // Fetch all users with their roles using the admin RPC function
      const { data, error } = await supabase.rpc('get_users_with_roles');

      if (error) throw error;

      const usersWithRoles = (data || []).map(user => ({
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        roles: user.roles || [],
      }));

      setUsers(usersWithRoles);
    } catch (error: any) {
      toast({
        title: "Error fetching users",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableRoles = async () => {
    try {
      const { data, error } = await supabase.rpc('get_available_roles');
      
      if (error) throw error;
      
      setAvailableRoles(data?.map((r: any) => r.role_name) || []);
    } catch (error: any) {
      toast({
        title: "Error fetching roles",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchAvailableRoles();
  }, []);

  // Filter users based on search query and role filter
  const filteredUsers = useMemo(() => {
    let filtered = [...users];

    // Filter by search query (email)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((user) => 
        user.email.toLowerCase().includes(query)
      );
    }

    // Filter by role
    if (roleFilter !== "all") {
      if (roleFilter === "no-roles") {
        filtered = filtered.filter((user) => user.roles.length === 0);
      } else {
        filtered = filtered.filter((user) => user.roles.includes(roleFilter));
      }
    }

    return filtered;
  }, [users, searchQuery, roleFilter]);

  const assignRole = async () => {
    if (!selectedUser) return;

    try {
      const { error } = await supabase.rpc('assign_user_role', {
        p_user_id: selectedUser.id,
        p_role: selectedRole as 'admin' | 'route-admin' | 'driver' | 'hr' | 'finance' | 'onboarding' | 'inactive',
      });

      if (error) throw error;

      toast({
        title: "Role assigned",
        description: `${selectedRole} role assigned to ${selectedUser.email}`,
      });

      fetchUsers();
      setIsDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Error assigning role",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const removeRole = async (userId: string, role: string, userEmail: string) => {
    try {
      const { error } = await supabase.rpc('remove_user_role', {
        p_user_id: userId,
        p_role: role as 'admin' | 'route-admin' | 'driver' | 'hr' | 'finance' | 'onboarding' | 'inactive',
      });

      if (error) throw error;

      toast({
        title: "Role removed",
        description: `${role} role removed from ${userEmail}`,
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error removing role",
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
      {/* Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email..."
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
            <SelectItem value="no-roles">No Roles</SelectItem>
            {availableRoles.map((role) => (
              <SelectItem key={role} value={role}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  {users.length === 0 ? "No users found" : "No users match the current filters"}
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>
                    <div className="flex gap-2 flex-wrap">
                      {user.roles.length === 0 ? (
                        <Badge variant="outline">No roles</Badge>
                      ) : (
                        user.roles.map((role) => (
                          <Badge
                            key={role}
                            variant={
                              role === 'admin'
                                ? 'default'
                                : role === 'route-admin'
                                ? 'secondary'
                                : 'outline'
                            }
                            className="flex items-center gap-1"
                          >
                            <Shield className="h-3 w-3" />
                            {role}
                            <button
                              onClick={() => removeRole(user.id, role, user.email)}
                              className="ml-1 hover:text-destructive"
                            >
                              ×
                            </button>
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.created_at ? format(new Date(user.created_at), 'MMM d, yyyy') : '-'}
                  </TableCell>
                  <TableCell>
                    <Dialog open={isDialogOpen && selectedUser?.id === user.id} onOpenChange={setIsDialogOpen}>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedUser(user)}
                        >
                          <UserPlus className="h-4 w-4 mr-1" />
                          Assign Role
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Assign Role to {user.email}</DialogTitle>
                          <DialogDescription>
                            Select a role to assign to this user
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="role-select">Role</Label>
                            <Select value={selectedRole} onValueChange={setSelectedRole}>
                              <SelectTrigger id="role-select">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {availableRoles.map((role) => (
                                  <SelectItem key={role} value={role}>
                                    {role.charAt(0).toUpperCase() + role.slice(1)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button onClick={assignRole} className="w-full">
                            Assign Role
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default UserManagement;