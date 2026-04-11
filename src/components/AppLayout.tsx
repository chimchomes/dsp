import { useState } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import HeaderBar from "./HeaderBar";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const noLayoutPages = [
    "/",
    "/login",
    "/onboarding",
    "/onboarding-login",
    "/create-test-onboarding-account",
    "/create-account"
  ];
  
  const shouldShowLayout = !noLayoutPages.includes(location.pathname);

  if (!shouldShowLayout) {
    return <>{children}</>;
  }

  return (
    <div className={cn("flex min-h-screen bg-background", sidebarOpen && "overflow-hidden max-h-screen md:overflow-auto md:max-h-none")}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 w-full md:ml-64 flex flex-col min-w-0">
        <HeaderBar onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
        <main className="flex-1 relative">
          <div className="absolute inset-0 hex-pattern pointer-events-none"></div>
          <div className="relative z-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
