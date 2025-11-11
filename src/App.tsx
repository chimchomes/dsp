import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { NotificationProvider } from "@/contexts/NotificationContext";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import DispatcherLogin from "./pages/DispatcherLogin";
import DispatcherDashboard from "./pages/DispatcherDashboard";
import FinanceDashboard from "./pages/FinanceDashboard";
import FinanceExpenseReview from "./pages/FinanceExpenseReview";
import FinancePayroll from "./pages/FinancePayroll";
import FinanceReports from "./pages/FinanceReports";
import HRDashboard from "./pages/HRDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import AdminSelector from "./pages/AdminSelector";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";
import OnboardingLogin from "./pages/OnboardingLogin";
import CreateTestOnboardingAccount from "./pages/CreateTestOnboardingAccount";
import CreateOnboardingAccount from "./pages/CreateOnboardingAccount";
import RoutesScreen from "./pages/RoutesScreen";
import RouteDetailsScreen from "./pages/RouteDetailsScreen";
import ExpensesScreen from "./pages/ExpensesScreen";
import ProfileScreen from "./pages/ProfileScreen";
import EarningsScreen from "./pages/EarningsScreen";
import CostCalculatorScreen from "./pages/CostCalculatorScreen";
import VehicleManagementScreen from "./pages/VehicleManagementScreen";
import Inbox from "./pages/Inbox";
import AdminMessages from "./pages/AdminMessages";
import HeaderBar from "@/components/HeaderBar";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <NotificationProvider>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <HeaderBar />
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dispatcher-login" element={<DispatcherLogin />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/onboarding-login" element={<OnboardingLogin />} />
            <Route path="/create-test-onboarding-account" element={<CreateTestOnboardingAccount />} />
            <Route path="/create-account" element={<CreateOnboardingAccount />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/routes" element={<RoutesScreen />} />
            <Route path="/route-details/:routeId" element={<RouteDetailsScreen />} />
            <Route path="/expenses" element={<ExpensesScreen />} />
            <Route path="/earnings" element={<EarningsScreen />} />
            <Route path="/cost-calculator" element={<CostCalculatorScreen />} />
            <Route path="/vehicle" element={<VehicleManagementScreen />} />
            <Route path="/profile" element={<ProfileScreen />} />
            <Route path="/dispatcher" element={<DispatcherDashboard />} />
            <Route path="/finance" element={<FinanceDashboard />} />
            <Route path="/finance/expenses" element={<FinanceExpenseReview />} />
            <Route path="/finance/payroll" element={<FinancePayroll />} />
            <Route path="/finance/reports" element={<FinanceReports />} />
            <Route path="/hr" element={<HRDashboard />} />
            <Route path="/admin" element={<AdminSelector />} />
            <Route path="/admin/control-panel" element={<AdminDashboard />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/admin/messages" element={<AdminMessages />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </NotificationProvider>
  </QueryClientProvider>
);

export default App;
