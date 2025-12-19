import { useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import HeaderBar from "./HeaderBar";

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const location = useLocation();
  
  // Pages that should not show sidebar/header
  const noLayoutPages = [
    "/",
    "/login",
    "/dispatcher-login",
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
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col">
        <HeaderBar />
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

