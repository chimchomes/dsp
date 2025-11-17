import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const AuthGuard = ({ children, allowedRoles }: AuthGuardProps) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      checkAuth();
    });

    return () => subscription.unsubscribe();
  }, [navigate, allowedRoles]);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/login");
        return;
      }

      // If no specific roles required, allow access
      if (!allowedRoles || allowedRoles.length === 0) {
        setHasAccess(true);
        setIsLoading(false);
        return;
      }

      // Check if user has any of the allowed roles
      const { data: userRoles, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id);

      // If roles query succeeded, check access
      if (!error && userRoles) {
        const hasAllowedRole = userRoles.some(ur => 
          allowedRoles.includes(ur.role)
        );

        if (hasAllowedRole) {
          setHasAccess(true);
          setIsLoading(false);
          return;
        }
      }

      // If roles query failed, try alternative method via role_profiles
      if (error) {
        console.error("Error checking roles, trying alternative method:", error);
        try {
          const { data: roleProfiles } = await supabase
            .from('role_profiles')
            .select('role')
            .eq('user_id', session.user.id)
            .in('role', allowedRoles)
            .limit(1);

          if (roleProfiles && roleProfiles.length > 0) {
            // User has one of the allowed roles via role_profiles
            setHasAccess(true);
            setIsLoading(false);
            return;
          }
        } catch (altError) {
          console.error("Alternative role check also failed:", altError);
        }
      }

      // If we get here, user doesn't have required role
      console.warn("Access denied. User roles:", userRoles?.map(r => r.role) || "unknown", "Required:", allowedRoles);
      navigate("/login");
    } catch (error) {
      console.error("Auth check error:", error);
      navigate("/login");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hasAccess) {
    return null;
  }

  return <>{children}</>;
};
