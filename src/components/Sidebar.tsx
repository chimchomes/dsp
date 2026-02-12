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
  Receipt
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface NavItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  roles?: string[];
}

const Sidebar = () => {
  const location = useLocation();
  const [userRoles, setUserRoles] = useState<string[]>([]);

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

  // Driver-specific nav items
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

  const isDriver = userRoles.includes("driver");
  const items = isDriver ? driverNavItems : navItems.filter(item => 
    !item.roles || item.roles.some(role => userRoles.includes(role))
  );

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-sidebar-background border-r border-sidebar-border z-30 flex flex-col">
      <div className="p-4 border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <img 
              src="/logo.png" 
              alt="DSP Logo" 
              className="h-10 w-auto"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          </div>
          <span className="font-bold text-lg text-sidebar-foreground">DSP Portal</span>
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
  );
};

export default Sidebar;

