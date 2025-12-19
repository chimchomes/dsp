import { Link, useNavigate } from "react-router-dom";
import { NotificationBadge } from "@/components/NotificationBadge";
import { Button } from "@/components/ui/button";
import { Mail, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export default function HeaderBar() {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let isMounted = true;

    const checkUnreadMessages = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !isMounted) {
          setUnreadCount(0);
          return;
        }

        // Check for unread notifications in the notifications table (what the inbox uses)
        const { data, error } = await supabase
          .from("notifications")
          .select("id")
          .eq("recipient_id", user.id)
          .is("read_at", null);

        if (error) {
          console.error("Error checking unread messages:", error);
          return;
        }

        if (isMounted) {
          setUnreadCount(data?.length || 0);
        }
      } catch (error) {
        console.error("Error checking unread messages:", error);
      }
    };

    const init = async () => {
      await checkUnreadMessages();
      
      if (!isMounted) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Set up realtime subscription for notifications
      channel = supabase
        .channel(`header-notifications-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `recipient_id=eq.${user.id}`,
          },
          () => {
            checkUnreadMessages();
          }
        )
        .subscribe();
    };

    init();

    return () => {
      isMounted = false;
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, []);

  return (
    <div className="w-full flex items-center justify-between px-6 py-4 border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-40 shadow-modern">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <img 
            src="/logo.png" 
            alt="DSP Logo" 
            className="h-8 w-auto"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        </div>
        <span className="font-bold text-xl text-foreground">DSP Portal</span>
      </div>
      <div className="flex items-center gap-2">
        <Link to="/inbox">
        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-lg hover:bg-muted/80 transition-all duration-200" aria-label="Inbox">
          <Mail className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-destructive border-2 border-card animate-pulse" />
          )}
        </Button>
        </Link>
        <NotificationBadge />
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleLogout}
          className="h-9 w-9 rounded-lg hover:bg-muted/80 transition-all duration-200" 
          aria-label="Logout"
          title="Logout"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
