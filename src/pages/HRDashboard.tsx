import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, GraduationCap, ArrowLeft, UserCog, Truck } from "lucide-react";
import DriversTable from "@/components/hr/DriversTable";
import TrainingManagement from "@/components/hr/TrainingManagement";
import StaffManagement from "@/components/admin/StaffManagement";
import DriverManagement from "@/components/admin/DriverManagement";
import { AuthGuard } from "@/components/AuthGuard";
import { CreateDriverAccountDialog } from "@/components/admin/CreateDriverAccountDialog";

const HRDashboard = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const navigate = useNavigate();

  return (
    <AuthGuard allowedRoles={["admin", "hr"]}>
      <div className="min-h-screen p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 flex justify-between items-start animate-fade-in">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-foreground mb-2">HR Management Portal</h1>
                <p className="text-muted-foreground text-base font-medium">Manage drivers and training</p>
              </div>
            </div>
            <div className="flex gap-2">
              <CreateDriverAccountDialog onSuccess={() => setRefreshKey(prev => prev + 1)} />
            </div>
          </div>

          <Tabs defaultValue="staff" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 lg:w-auto bg-card border border-border rounded-lg p-1">
              <TabsTrigger value="staff" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md transition-all font-semibold">
                <UserCog className="h-4 w-4" />
                <span className="hidden sm:inline">Staff</span>
              </TabsTrigger>
              <TabsTrigger value="drivers" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md transition-all font-semibold">
                <Truck className="h-4 w-4" />
                <span className="hidden sm:inline">Drivers</span>
              </TabsTrigger>
              <TabsTrigger value="training" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md transition-all font-semibold">
                <GraduationCap className="h-4 w-4" />
                <span className="hidden sm:inline">Driver Training</span>
              </TabsTrigger>
              <TabsTrigger value="manage-training" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md transition-all font-semibold">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Training Items</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="staff" className="space-y-4 animate-fade-in">
              <Card className="border-2 shadow-modern-lg">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold">Staff Management</CardTitle>
                  <CardDescription className="text-base font-medium">Create and manage staff accounts (HR, Finance, Admin)</CardDescription>
                </CardHeader>
                <CardContent>
                  <StaffManagement />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="drivers" className="space-y-4 animate-fade-in">
              <DriverManagement />
            </TabsContent>

            <TabsContent value="training" className="space-y-4 animate-fade-in">
              <Card className="border-2 shadow-modern-lg">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold">Driver Training</CardTitle>
                  <CardDescription className="text-base font-medium">View which drivers have completed training</CardDescription>
                </CardHeader>
                <CardContent>
                  <DriversTable key={refreshKey} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="manage-training" className="space-y-4 animate-fade-in">
              <Card className="border-2 shadow-modern-lg">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold">Training Management</CardTitle>
                  <CardDescription className="text-base font-medium">Manage training items and track driver progress</CardDescription>
                </CardHeader>
                <CardContent>
                  <TrainingManagement />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AuthGuard>
  );
};

export default HRDashboard;
