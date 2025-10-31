import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthGuard } from "@/components/AuthGuard";
import { ArrowLeft, Receipt, DollarSign, FileText, TrendingUp, Users, Calculator } from "lucide-react";

const FinanceDashboard = () => {
  const navigate = useNavigate();

  const financeCards = [
    {
      title: "Expense Review",
      description: "Review and approve driver expense submissions",
      icon: Receipt,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
      route: "/finance/expenses",
      stats: "Pending review"
    },
    {
      title: "Payroll Management",
      description: "Manage driver payroll, deductions, and payouts",
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
    }
  ];

  const quickStats = [
    { label: "Active Drivers", value: "0", icon: Users, color: "text-blue-600" },
    { label: "Pending Expenses", value: "0", icon: Receipt, color: "text-orange-600" },
    { label: "This Week Payroll", value: "$0", icon: Calculator, color: "text-green-600" },
    { label: "Revenue Trend", value: "+0%", icon: TrendingUp, color: "text-purple-600" }
  ];

  return (
    <AuthGuard allowedRoles={["dispatcher", "admin", "finance"]}>
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  onClick={() => navigate("/admin")}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <div>
                  <h1 className="text-3xl font-bold">Finance Dashboard</h1>
                  <p className="text-muted-foreground mt-1">Manage payroll, expenses, and financial reports</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto p-6 space-y-6">
          {/* Quick Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {quickStats.map((stat, index) => (
              <Card key={index}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Main Finance Sections */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {financeCards.map((card, index) => (
              <Card 
                key={index} 
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(card.route)}
              >
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg ${card.bgColor} flex items-center justify-center mb-4`}>
                    <card.icon className={`h-6 w-6 ${card.color}`} />
                  </div>
                  <CardTitle className="text-xl">{card.title}</CardTitle>
                  <CardDescription className="text-base">{card.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{card.stats}</span>
                    <Button variant="ghost" size="sm">
                      View <ArrowLeft className="ml-2 h-4 w-4 rotate-180" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
};

export default FinanceDashboard;
