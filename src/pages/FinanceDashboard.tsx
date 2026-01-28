import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthGuard } from "@/components/AuthGuard";
import { ArrowLeft, DollarSign, FileText, TrendingUp, Users, Calculator, Upload, CreditCard, Settings, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const FinanceDashboard = () => {
  const navigate = useNavigate();

  const financeCards = [
    {
      title: "Payroll Management",
      description: "Manage driver payroll and payouts",
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950/30",
      route: "/finance/payroll",
      stats: "Weekly payroll"
    },
    {
      title: "Financial Reports",
      description: "View invoices, driver rates, and financial analytics",
      icon: FileText,
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950/30",
      route: "/finance/reports",
      stats: "Export & analyze"
    },
    {
      title: "Pay Rates",
      description: "Manage pay rates per provider and vehicle type",
      icon: Calculator,
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950/30",
      route: "/finance/pay-rates",
      stats: "Configure rates"
    },
    {
      title: "Upload Invoice",
      description: "Upload and process YODEL invoice PDFs",
      icon: Upload,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50 dark:bg-indigo-950/30",
      route: "/finance/invoices/upload",
      stats: "Process invoices"
    },
    {
      title: "Invoices",
      description: "View and manage uploaded invoices",
      icon: FileText,
      color: "text-cyan-600",
      bgColor: "bg-cyan-50 dark:bg-cyan-950/30",
      route: "/finance/invoices",
      stats: "View invoices"
    },
    {
      title: "Payslips",
      description: "Generate and view driver payslips",
      icon: CreditCard,
      color: "text-pink-600",
      bgColor: "bg-pink-50 dark:bg-pink-950/30",
      route: "/finance/payslips",
      stats: "Manage payslips"
    },
    {
      title: "Adjustments Review",
      description: "Review and filter adjustment details",
      icon: Settings,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
      route: "/finance/adjustments",
      stats: "View adjustments"
    },
    {
      title: "Generate Payslip",
      description: "Generate payslips per invoice for drivers",
      icon: Receipt,
      color: "text-teal-600",
      bgColor: "bg-teal-50 dark:bg-teal-950/30",
      route: "/finance/generate-payslip",
      stats: "Create payslips"
    }
  ];

  const quickStats = [
    { label: "Active Drivers", value: "0", icon: Users, color: "text-blue-600" },
    { label: "This Week Payroll", value: "$0", icon: Calculator, color: "text-green-600" },
    { label: "Revenue Trend", value: "+0%", icon: TrendingUp, color: "text-purple-600" }
  ];

  return (
    <AuthGuard allowedRoles={["admin", "finance"]}>
      <div className="min-h-screen">
        <div className="p-6">
          <div className="mb-8 animate-fade-in">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <DollarSign className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-foreground">Finance Dashboard</h1>
                <p className="text-muted-foreground mt-1 text-base font-medium">Manage payroll and financial reports</p>
              </div>
            </div>
          </div>

          <div className="space-y-6 animate-fade-in">
            {/* Quick Stats */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {quickStats.map((stat, index) => (
                <Card key={index} className="hover:shadow-modern-lg transition-all duration-300 hover:-translate-y-1 border-2 bg-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base font-semibold">{stat.label}</CardTitle>
                  <div className="p-2 rounded-lg bg-muted">
                    <stat.icon className={`h-4 w-4 text-primary`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stat.value}</div>
                </CardContent>
                </Card>
              ))}
            </div>

            {/* Main Finance Sections */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {financeCards.map((card, index) => (
                <Card 
                  key={index} 
                  className="cursor-pointer hover:shadow-modern-lg transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/50 group bg-card"
                  onClick={() => navigate(card.route)}
                >
                  <CardHeader>
                    <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-200">
                      <card.icon className="h-7 w-7 text-primary" />
                    </div>
                  <CardTitle className="text-xl font-bold mb-2">{card.title}</CardTitle>
                  <CardDescription className="text-base font-medium">{card.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-base text-muted-foreground font-semibold">{card.stats}</span>
                      <Button variant="ghost" size="sm" className="rounded-lg">
                        View <ArrowLeft className="ml-2 h-4 w-4 rotate-180" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
};

export default FinanceDashboard;
