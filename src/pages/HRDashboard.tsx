import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, FileText, GraduationCap, ArrowLeft } from "lucide-react";
import DriverOnboardingForm from "@/components/hr/DriverOnboardingForm";
import DriversTable from "@/components/hr/DriversTable";
import TrainingManagement from "@/components/hr/TrainingManagement";
import { AuthGuard } from "@/components/AuthGuard";
import { CreateDriverAccountDialog } from "@/components/admin/CreateDriverAccountDialog";

const HRDashboard = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const navigate = useNavigate();

  return (
    <AuthGuard allowedRoles={["admin"]}>
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 flex justify-between items-start">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => navigate("/admin")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-4xl font-bold text-foreground mb-2">HR Management Portal</h1>
                <p className="text-muted-foreground">Onboard and manage delivery drivers</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => navigate('/onboarding')} size="lg">
                <FileText className="mr-2 h-4 w-4" />
                Driver Onboarding
              </Button>
              <CreateDriverAccountDialog onSuccess={() => setRefreshKey(prev => prev + 1)} />
            </div>
          </div>

          <Tabs defaultValue="drivers" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 lg:w-auto">
              <TabsTrigger value="drivers" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Drivers</span>
              </TabsTrigger>
              <TabsTrigger value="onboard" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Onboard New</span>
              </TabsTrigger>
              <TabsTrigger value="training" className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                <span className="hidden sm:inline">Training</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="drivers" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>All Drivers</CardTitle>
                  <CardDescription>Manage active and inactive drivers</CardDescription>
                </CardHeader>
                <CardContent>
                  <DriversTable key={refreshKey} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="onboard" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Onboard New Driver</CardTitle>
                  <CardDescription>Add a new driver to the system</CardDescription>
                </CardHeader>
                <CardContent>
                  <DriverOnboardingForm />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="training" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Training Management</CardTitle>
                  <CardDescription>Manage training items and track driver progress</CardDescription>
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