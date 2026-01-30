import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, FileText, Users, Activity, ClipboardCheck, LogOut } from "lucide-react";
import { AuthGuard } from "@/components/AuthGuard";
import ActivityLogsTable from "@/components/admin/ActivityLogsTable";
import UserManagement from "@/components/admin/UserManagement";
import ReportsExport from "@/components/admin/ReportsExport";
import SystemMetrics from "@/components/admin/SystemMetrics";
import { OnboardingApplications } from "@/components/admin/OnboardingApplications";
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
      <div className="min-h-screen p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 animate-fade-in">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-foreground">Admin Control Panel</h1>
                  <p className="text-muted-foreground mt-1">System management, ordering, and compliance</p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowExitDialog(true)}
                className="flex items-center gap-2 rounded-lg border-2 hover:bg-muted/50 transition-all duration-200"
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

          <Tabs defaultValue="metrics" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5 lg:w-auto bg-card border border-border rounded-lg p-1">
              <TabsTrigger value="metrics" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md transition-all">
                <Activity className="h-4 w-4" />
                <span className="hidden sm:inline">Metrics</span>
              </TabsTrigger>
              <TabsTrigger value="onboarding" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md transition-all">
                <ClipboardCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Onboarding</span>
              </TabsTrigger>
              <TabsTrigger value="logs" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md transition-all">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Activity Logs</span>
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md transition-all">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">User Roles</span>
              </TabsTrigger>
              <TabsTrigger value="reports" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md transition-all">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Reports</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="metrics" className="space-y-4 animate-fade-in">
              <Card className="border-2 shadow-modern-lg">
                <CardHeader>
                  <CardTitle className="text-2xl">System Metrics</CardTitle>
                  <CardDescription>Real-time system activity overview</CardDescription>
                </CardHeader>
                <CardContent>
                  <SystemMetrics />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="onboarding" className="space-y-4 animate-fade-in">
              <OnboardingApplications />
            </TabsContent>

            <TabsContent value="logs" className="space-y-4 animate-fade-in">
              <Card className="border-2 shadow-modern-lg">
                <CardHeader>
                  <CardTitle className="text-2xl">Activity Logs</CardTitle>
                  <CardDescription>Complete audit trail of system activities</CardDescription>
                </CardHeader>
                <CardContent>
                  <ActivityLogsTable />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="users" className="space-y-4 animate-fade-in">
              <Card className="border-2 shadow-modern-lg">
                <CardHeader>
                  <CardTitle className="text-2xl">User Role Management</CardTitle>
                  <CardDescription>Assign and manage roles for existing users</CardDescription>
                </CardHeader>
                <CardContent>
                  <UserManagement />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reports" className="space-y-4 animate-fade-in">
              <Card className="border-2 shadow-modern-lg">
                <CardHeader>
                  <CardTitle className="text-2xl">Export Reports</CardTitle>
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