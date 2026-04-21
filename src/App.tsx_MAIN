import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { TenantProvider } from "@/contexts/TenantContext";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import FinanceDashboard from "./pages/FinanceDashboard";
import FinancePayroll from "./pages/FinancePayroll";
import FinanceReports from "./pages/FinanceReports";
import FinancePayRates from "./pages/FinancePayRates";
import FinanceInvoiceUpload from "./pages/FinanceInvoiceUpload";
import FinanceInvoices from "./pages/FinanceInvoices";
import FinancePayslips from "./pages/FinancePayslips";
import FinancePayslipDetail from "./pages/FinancePayslipDetail";
import FinanceAdjustmentsReview from "./pages/FinanceAdjustmentsReview";
import FinanceInsights from "./pages/FinanceInsights";
import FinanceExpenses from "./pages/FinanceExpenses";
import FinanceSettings from "./pages/FinanceSettings";
import DriverPayslips from "./pages/DriverPayslips";
import HRDashboard from "./pages/HRDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import AdminSelector from "./pages/AdminSelector";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";
import OnboardingLogin from "./pages/OnboardingLogin";
import CreateTestOnboardingAccount from "./pages/CreateTestOnboardingAccount";
import CreateOnboardingAccount from "./pages/CreateOnboardingAccount";
import ProfileScreen from "./pages/ProfileScreen";
import EarningsScreen from "./pages/EarningsScreen";
import Inbox from "./pages/Inbox";
import AdminMessages from "./pages/AdminMessages";
import DriverIncidents from "./pages/DriverIncidents";
import AppLayout from "@/components/AppLayout";
import MasterAdminDashboard from "./pages/masteradmin/MasterAdminDashboard";
import TenantList from "./pages/masteradmin/TenantList";
import CreateTenant from "./pages/masteradmin/CreateTenant";
import TenantDetail from "./pages/masteradmin/TenantDetail";


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TenantProvider>
      <NotificationProvider>
        <TooltipProvider>
          <Toaster />
          <BrowserRouter>
            <AppLayout>
              <Routes>
              <Route path="/" element={<Login />} />
              <Route path="/login" element={<Login />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/onboarding-login" element={<OnboardingLogin />} />
              <Route path="/create-test-onboarding-account" element={<CreateTestOnboardingAccount />} />
              <Route path="/create-account" element={<CreateOnboardingAccount />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/my-incidents" element={<DriverIncidents />} />
              <Route path="/earnings" element={<EarningsScreen />} />
              <Route path="/payslips" element={<DriverPayslips />} />
              <Route path="/payslips/:id" element={<FinancePayslipDetail />} />
              <Route path="/profile" element={<ProfileScreen />} />
              <Route path="/finance" element={<FinanceDashboard />} />
              <Route path="/finance/payroll" element={<FinancePayroll />} />
              <Route path="/finance/reports" element={<FinanceReports />} />
              <Route path="/finance/pay-rates" element={<FinancePayRates />} />
              <Route path="/finance/invoices/upload" element={<FinanceInvoiceUpload />} />
              <Route path="/finance/invoices" element={<FinanceInvoices />} />
              <Route path="/finance/payslips" element={<FinancePayslips />} />
              <Route path="/finance/payslips/:id" element={<FinancePayslipDetail />} />
              <Route path="/finance/adjustments" element={<FinanceAdjustmentsReview />} />
              <Route path="/finance/insights" element={<FinanceInsights />} />
              <Route path="/finance/expenses" element={<FinanceExpenses />} />
              <Route path="/finance/settings" element={<FinanceSettings />} />
              <Route path="/hr" element={<HRDashboard />} />
              <Route path="/admin" element={<AdminSelector />} />
              <Route path="/admin/control-panel" element={<AdminDashboard />} />
              <Route path="/inbox" element={<Inbox />} />
              <Route path="/admin/messages" element={<AdminMessages />} />
              {/* Master Admin Routes */}
              <Route path="/masteradmin" element={<MasterAdminDashboard />} />
              <Route path="/masteradmin/tenants" element={<TenantList />} />
              <Route path="/masteradmin/tenants/new" element={<CreateTenant />} />
              <Route path="/masteradmin/tenants/:id" element={<TenantDetail />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </AppLayout>
          </BrowserRouter>
        </TooltipProvider>
      </NotificationProvider>
    </TenantProvider>
  </QueryClientProvider>
);

export default App;
