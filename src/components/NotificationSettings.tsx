import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Settings } from "lucide-react";

interface NotificationPreferences {
  email_notifications: boolean;
  push_notifications: boolean;
  route_change_alerts: boolean;
  incident_alerts: boolean;
  admin_alerts: boolean;
}

export const NotificationSettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email_notifications: true,
    push_notifications: true,
    route_change_alerts: true,
    incident_alerts: true,
    admin_alerts: true,
  });

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("notification_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setPreferences({
          email_notifications: data.email_notifications,
          push_notifications: data.push_notifications,
          route_change_alerts: data.route_change_alerts,
          incident_alerts: data.incident_alerts,
          admin_alerts: data.admin_alerts,
        });
      } else {
        // Create default settings if none exist
        await supabase.from("notification_settings").insert([
          { user_id: user.id },
        ]);
      }
    } catch (error: any) {
      console.error("Error loading preferences:", error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("notification_settings")
        .update({ [key]: value })
        .eq("user_id", user.id);

      if (error) throw error;

      setPreferences((prev) => ({ ...prev, [key]: value }));

      toast({
        title: "Preferences updated",
        description: "Your notification preferences have been saved.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Notification Preferences
        </CardTitle>
        <CardDescription>
          Manage how you receive notifications and alerts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email">Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive notifications via email
              </p>
            </div>
            <Switch
              id="email"
              checked={preferences.email_notifications}
              onCheckedChange={(checked) =>
                updatePreference("email_notifications", checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="push">Push Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive push notifications in the app
              </p>
            </div>
            <Switch
              id="push"
              checked={preferences.push_notifications}
              onCheckedChange={(checked) =>
                updatePreference("push_notifications", checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="routes">Route Change Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when routes are updated
              </p>
            </div>
            <Switch
              id="routes"
              checked={preferences.route_change_alerts}
              onCheckedChange={(checked) =>
                updatePreference("route_change_alerts", checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="incidents">Incident Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Get notified about new incidents
              </p>
            </div>
            <Switch
              id="incidents"
              checked={preferences.incident_alerts}
              onCheckedChange={(checked) =>
                updatePreference("incident_alerts", checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="admin">Admin Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Get notified about admin announcements
              </p>
            </div>
            <Switch
              id="admin"
              checked={preferences.admin_alerts}
              onCheckedChange={(checked) =>
                updatePreference("admin_alerts", checked)
              }
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
