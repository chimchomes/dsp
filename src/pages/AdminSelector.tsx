import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, DollarSign, Users, Truck, LogOut } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AuthGuard } from "@/components/AuthGuard";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const AdminSelector = () => {
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

  const dashboards = [
    {
      title: "Admin Control Panel",
      description: "System management, user roles, and compliance",
      icon: Shield,
      route: "/admin/control-panel",
      color: "text-primary",
    },
    {
      title: "Finance Dashboard",
      description: "Expense review, payroll, and financial reports",
      icon: DollarSign,
      route: "/finance",
      color: "text-green-600",
    },
    {
      title: "HR Dashboard",
      description: "Driver management, onboarding, and training",
      icon: Users,
      route: "/hr",
      color: "text-blue-600",
    },
    {
      title: "Route Admin Dashboard",
      description: "Route management, drivers, and incidents",
      icon: Truck,
      route: "/dispatcher",
      color: "text-orange-600",
    },
  ];

  return (
    <AuthGuard allowedRoles={["admin"]}>
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12">
            <div className="flex items-center justify-between mb-4">
              <div className="text-center flex-1">
                <h1 className="text-4xl font-bold text-foreground mb-4">Admin Dashboard</h1>
                <p className="text-xl text-muted-foreground">Select a dashboard to manage</p>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {dashboards.map((dashboard) => {
              const Icon = dashboard.icon;
              return (
                <Card
                  key={dashboard.route}
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => navigate(dashboard.route)}
                >
                  <CardHeader>
                    <div className="flex items-center gap-4">
                      <Icon className={`h-12 w-12 ${dashboard.color}`} />
                      <div>
                        <CardTitle className="text-2xl">{dashboard.title}</CardTitle>
                        <CardDescription className="text-base mt-2">
                          {dashboard.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" variant="outline">
                      Open Dashboard
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
};

export default AdminSelector;
