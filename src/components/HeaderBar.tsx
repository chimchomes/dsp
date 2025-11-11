import { Link } from "react-router-dom";
import { NotificationBadge } from "@/components/NotificationBadge";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export default function HeaderBar() {
  const [unreadCount, setUnreadCount] = useState(0);

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
    <div className="w-full flex items-center justify-end gap-2 px-3 py-2 border-b bg-background/80 sticky top-0 z-40">
      <Link to="/inbox">
        <Button variant="ghost" size="icon" className="relative" aria-label="Inbox">
          <Mail className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive" />
          )}
        </Button>
      </Link>
      <NotificationBadge />
    </div>
  );
}
