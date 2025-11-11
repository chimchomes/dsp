import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, FileText, Users, Activity, ClipboardCheck, ArrowLeft, Truck, LogOut } from "lucide-react";
import { AuthGuard } from "@/components/AuthGuard";
import ActivityLogsTable from "@/components/admin/ActivityLogsTable";
import UserManagement from "@/components/admin/UserManagement";
import StaffManagement from "@/components/admin/StaffManagement";
import ReportsExport from "@/components/admin/ReportsExport";
import SystemMetrics from "@/components/admin/SystemMetrics";
import { OnboardingApplications } from "@/components/admin/OnboardingApplications";
import { DispatcherManagement } from "@/components/admin/DispatcherManagement";
import DriverManagement from "@/components/admin/DriverManagement";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showExitDialog, setShowExitDialog] = useState(false);

  const handleExit = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logged out",
      description: "You have been logged out successfully",
    });
    navigate("/login");
  };

  return (
    <AuthGuard allowedRoles={["admin"]}>
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  onClick={() => navigate("/admin")}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Shield className="h-8 w-8 text-primary" />
                <div>
                  <h1 className="text-4xl font-bold text-foreground">Admin Control Panel</h1>
                  <p className="text-muted-foreground">System management and compliance</p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowExitDialog(true)}
                className="flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Exit
              </Button>
            </div>
          </div>

          <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm Exit</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to exit? You will be logged out and redirected to the login page.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleExit}>Yes, Exit</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Tabs defaultValue="staff" className="space-y-6">
            <TabsList className="grid w-full grid-cols-8 lg:w-auto">
              <TabsTrigger value="staff" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Staff</span>
              </TabsTrigger>
              <TabsTrigger value="drivers" className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                <span className="hidden sm:inline">Drivers</span>
              </TabsTrigger>
              <TabsTrigger value="metrics" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                <span className="hidden sm:inline">Metrics</span>
              </TabsTrigger>
              <TabsTrigger value="dispatchers" className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                <span className="hidden sm:inline">Dispatchers</span>
              </TabsTrigger>
              <TabsTrigger value="onboarding" className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Onboarding</span>
              </TabsTrigger>
              <TabsTrigger value="logs" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Activity Logs</span>
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">User Roles</span>
              </TabsTrigger>
              <TabsTrigger value="reports" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Reports</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="staff" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Staff Management</CardTitle>
                  <CardDescription>Create and manage staff accounts (HR, Finance, Dispatcher, Admin)</CardDescription>
                </CardHeader>
                <CardContent>
                  <StaffManagement />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="drivers" className="space-y-4">
              <DriverManagement />
            </TabsContent>

            <TabsContent value="metrics" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>System Metrics</CardTitle>
                  <CardDescription>Real-time system activity overview</CardDescription>
                </CardHeader>
                <CardContent>
                  <SystemMetrics />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="dispatchers" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Dispatcher Management</CardTitle>
                  <CardDescription>Manage dispatcher companies and commission rates</CardDescription>
                </CardHeader>
                <CardContent>
                  <DispatcherManagement />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="onboarding" className="space-y-4">
              <OnboardingApplications />
            </TabsContent>

            <TabsContent value="logs" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Activity Logs</CardTitle>
                  <CardDescription>Complete audit trail of system activities</CardDescription>
                </CardHeader>
                <CardContent>
                  <ActivityLogsTable />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="users" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>User Role Management</CardTitle>
                  <CardDescription>Assign and manage roles for existing users</CardDescription>
                </CardHeader>
                <CardContent>
                  <UserManagement />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reports" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Export Reports</CardTitle>
                  <CardDescription>Generate and download compliance reports</CardDescription>
                </CardHeader>
                <CardContent>
                  <ReportsExport />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AuthGuard>
  );
};

export default AdminDashboard;