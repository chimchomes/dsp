import { Link, useLocation } from "react-router-dom";
import { 
  Shield, 
  DollarSign, 
  Users, 
  Mail,
  Home,
  FileText,
  User,
  BarChart3,
  Receipt,
  Building2,
  LayoutDashboard
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";

interface NavItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  roles?: string[];
}

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

const Sidebar = ({ open, onClose }: SidebarProps) => {
  const location = useLocation();
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const { tenant, isMasterAdmin } = useTenant();

  useEffect(() => {
    const fetchUserRoles = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (roles) {
        setUserRoles(roles.map(r => r.role));
      }
    };

    fetchUserRoles();
  }, []);

  const masterAdminNavItems: NavItem[] = [
    {
      title: "Dashboard",
      icon: LayoutDashboard,
      href: "/masteradmin"
    },
    {
      title: "Tenants",
      icon: Building2,
      href: "/masteradmin/tenants"
    }
  ];

  const navItems: NavItem[] = [
    {
      title: "Admin",
      icon: Shield,
      href: "/admin",
      roles: ["admin"]
    },
    {
      title: "Finance",
      icon: DollarSign,
      href: "/finance",
      roles: ["admin", "finance"]
    },
    {
      title: "Expenses",
      icon: Receipt,
      href: "/finance/expenses",
      roles: ["admin", "finance"]
    },
    {
      title: "Insights",
      icon: BarChart3,
      href: "/finance/insights",
      roles: ["admin", "finance"]
    },
    {
      title: "HR",
      icon: Users,
      href: "/hr",
      roles: ["admin", "hr"]
    },
    {
      title: "Messages",
      icon: Mail,
      href: "/inbox"
    }
  ];

  const driverNavItems: NavItem[] = [
    {
      title: "Dashboard",
      icon: Home,
      href: "/dashboard"
    },
    {
      title: "Payslips",
      icon: FileText,
      href: "/payslips"
    },
    {
      title: "Profile",
      icon: User,
      href: "/profile"
    },
    {
      title: "Messages",
      icon: Mail,
      href: "/inbox"
    }
  ];

  const isMasterAdminRoute = location.pathname.startsWith("/masteradmin");

  let items: NavItem[];
  if (isMasterAdmin && isMasterAdminRoute) {
    items = masterAdminNavItems;
  } else {
    const isDriver = userRoles.includes("driver");
    items = isDriver ? driverNavItems : navItems.filter(item => 
      !item.roles || item.roles.some(role => userRoles.includes(role))
    );
  }

  const portalName = isMasterAdmin && isMasterAdminRoute
    ? "Master Admin"
    : tenant?.company_name || "DSP Portal";

  const logoSrc = tenant?.logo_url || "/logo.png";

  return (
    <>
      {/* Backdrop for mobile */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 h-screen w-64 bg-sidebar-background border-r border-sidebar-border flex flex-col transition-transform duration-300 ease-in-out",
          "md:translate-x-0 md:z-30",
          open ? "translate-x-0 z-50 shadow-2xl" : "-translate-x-full pointer-events-none md:pointer-events-auto"
        )}
      >
        <div className="p-4 border-b border-sidebar-border">
          <Link to={isMasterAdmin && isMasterAdminRoute ? "/masteradmin" : "/"} className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              {isMasterAdmin && isMasterAdminRoute ? (
                <Shield className="h-10 w-10 text-primary" />
              ) : (
                <img 
                  src={logoSrc}
                  alt="Logo" 
                  className="h-10 w-auto"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              )}
            </div>
            <span className="font-bold text-lg text-sidebar-foreground truncate">{portalName}</span>
          </Link>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href || 
                            location.pathname.startsWith(item.href + "/");
            
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-semibold transition-all duration-200",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-modern"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
