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
import FinancePayroll from "./pages/FinancePayroll";
import FinanceReports from "./pages/FinanceReports";
import FinancePayRates from "./pages/FinancePayRates";
import FinanceInvoiceUpload from "./pages/FinanceInvoiceUpload";
import FinanceInvoices from "./pages/FinanceInvoices";
import FinancePayslips from "./pages/FinancePayslips";
import FinanceGeneratePayslip from "./pages/FinanceGeneratePayslip";
import FinancePayslipDetail from "./pages/FinancePayslipDetail";
import FinanceAdjustmentsReview from "./pages/FinanceAdjustmentsReview";
import DriverPayslips from "./pages/DriverPayslips";
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
import ProfileScreen from "./pages/ProfileScreen";
import EarningsScreen from "./pages/EarningsScreen";
import Inbox from "./pages/Inbox";
import AdminMessages from "./pages/AdminMessages";
import AppLayout from "@/components/AppLayout";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <NotificationProvider>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <AppLayout>
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
            <Route path="/earnings" element={<EarningsScreen />} />
            <Route path="/payslips" element={<DriverPayslips />} />
            <Route path="/profile" element={<ProfileScreen />} />
            <Route path="/dispatcher" element={<DispatcherDashboard />} />
            <Route path="/finance" element={<FinanceDashboard />} />
            <Route path="/finance/payroll" element={<FinancePayroll />} />
            <Route path="/finance/reports" element={<FinanceReports />} />
            <Route path="/finance/pay-rates" element={<FinancePayRates />} />
            <Route path="/finance/invoices/upload" element={<FinanceInvoiceUpload />} />
            <Route path="/finance/invoices" element={<FinanceInvoices />} />
            <Route path="/finance/payslips" element={<FinancePayslips />} />
            <Route path="/finance/payslips/:id" element={<FinancePayslipDetail />} />
            <Route path="/finance/generate-payslip" element={<FinanceGeneratePayslip />} />
            <Route path="/finance/adjustments" element={<FinanceAdjustmentsReview />} />
            <Route path="/hr" element={<HRDashboard />} />
            <Route path="/admin" element={<AdminSelector />} />
            <Route path="/admin/control-panel" element={<AdminDashboard />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/admin/messages" element={<AdminMessages />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </AppLayout>
        </BrowserRouter>
      </TooltipProvider>
    </NotificationProvider>
  </QueryClientProvider>
);

export default App;
