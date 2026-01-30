import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Notification {
  id: string;
  type: "message" | "route_change" | "incident" | "admin_alert";
  title: string;
  message: string;
  created_at: string;
  read: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    };
    getUser();
  }, []);

  useEffect(() => {
    if (!userId) return;

    // Subscribe to new messages
    const messagesChannel = supabase
      .channel("messages-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${userId}`,
        },
        (payload) => {
          const newNotification: Notification = {
            id: payload.new.id,
            type: "message",
            title: "New Message",
            message: "You have a new message",
            created_at: payload.new.created_at,
            read: false,
          };
          
          setNotifications((prev) => [newNotification, ...prev]);
          
          toast({
            title: "New Message",
            description: "You have a new message",
          });
        }
      )
      .subscribe();

    // Subscribe to route changes
    const routesChannel = supabase
      .channel("routes-notifications")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "routes",
        },
        async (payload) => {
          // Check if this route belongs to the current user
          const { data: driver } = await supabase
            .from("driver_profiles")
            .select("id")
            .eq("email", (await supabase.auth.getUser()).data.user?.email)
            .single();

          if (driver && payload.new.driver_id === driver.id) {
            const newNotification: Notification = {
              id: `route-${payload.new.id}`,
              type: "route_change",
              title: "Route Updated",
              message: `Route status changed to ${payload.new.status}`,
              created_at: new Date().toISOString(),
              read: false,
            };
            
            setNotifications((prev) => [newNotification, ...prev]);
            
            toast({
              title: "Route Updated",
              description: `Route status changed to ${payload.new.status}`,
            });
          }
        }
      )
      .subscribe();

    // Subscribe to incidents
    const incidentsChannel = supabase
      .channel("incidents-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "incidents",
        },
        (payload) => {
          const newNotification: Notification = {
            id: `incident-${payload.new.id}`,
            type: "incident",
            title: "New Incident Reported",
            message: "A new incident has been reported",
            created_at: payload.new.created_at,
            read: false,
          };
          
          setNotifications((prev) => [newNotification, ...prev]);
          
          toast({
            title: "New Incident",
            description: "A new incident has been reported",
            variant: "destructive",
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(routesChannel);
      supabase.removeChannel(incidentsChannel);
    };
  }, [userId, toast]);

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, markAsRead, clearAll }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
};
