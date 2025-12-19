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
      <div className="min-h-screen p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <div className="text-center flex-1">
                <h1 className="text-5xl font-bold text-foreground mb-4">Admin Dashboard</h1>
                <p className="text-xl text-muted-foreground">Select a dashboard to manage</p>
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
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm Exit</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to exit? You will be logged out and redirected to the login page.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleExit} className="rounded-lg">Yes, Exit</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {dashboards.map((dashboard, index) => {
              const Icon = dashboard.icon;
              return (
                <Card
                  key={dashboard.route}
                  className="hover:shadow-modern-lg transition-all duration-300 hover:-translate-y-2 cursor-pointer border-2 hover:border-primary/50 group animate-slide-up bg-card"
                  style={{ animationDelay: `${index * 100}ms` }}
                  onClick={() => navigate(dashboard.route)}
                >
                  <CardHeader>
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-all duration-200 group-hover:scale-110">
                        <Icon className={`h-10 w-10 text-primary`} />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-2xl mb-2">{dashboard.title}</CardTitle>
                        <CardDescription className="text-base">
                          {dashboard.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full rounded-lg font-semibold shadow-modern hover:shadow-modern-lg transition-all duration-200 bg-primary hover:bg-primary/90 text-primary-foreground" variant="default">
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
