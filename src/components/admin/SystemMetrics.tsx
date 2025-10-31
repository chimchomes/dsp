import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, TrendingUp, Users, Package, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Metrics {
  totalDrivers: number;
  activeDrivers: number;
  todayRoutes: number;
  todayIncidents: number;
  weeklyLogins: number;
}

const SystemMetrics = () => {
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<Metrics>({
    totalDrivers: 0,
    activeDrivers: 0,
    todayRoutes: 0,
    todayIncidents: 0,
    weeklyLogins: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [driversRes, activeDriversRes, routesRes, incidentsRes, loginsRes] = await Promise.all([
        supabase.from('drivers').select('id', { count: 'exact', head: true }),
        supabase.from('drivers').select('id', { count: 'exact', head: true }).eq('active', true),
        supabase.from('routes').select('id', { count: 'exact', head: true }).eq('scheduled_date', today),
        supabase.from('incidents').select('id', { count: 'exact', head: true }).gte('created_at', today),
        supabase
          .from('activity_logs')
          .select('id', { count: 'exact', head: true })
          .eq('action_type', 'login')
          .gte('created_at', weekAgo),
      ]);

      setMetrics({
        totalDrivers: driversRes.count || 0,
        activeDrivers: activeDriversRes.count || 0,
        todayRoutes: routesRes.count || 0,
        todayIncidents: incidentsRes.count || 0,
        weeklyLogins: loginsRes.count || 0,
      });
    } catch (error: any) {
      toast({
        title: "Error fetching metrics",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();

    // Refresh metrics every minute
    const interval = setInterval(fetchMetrics, 60000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Drivers</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.totalDrivers}</div>
          <p className="text-xs text-muted-foreground">
            {metrics.activeDrivers} active
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Today's Routes</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.todayRoutes}</div>
          <p className="text-xs text-muted-foreground">
            Scheduled for today
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Today's Incidents</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.todayIncidents}</div>
          <p className="text-xs text-muted-foreground">
            Reported today
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Weekly Logins</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.weeklyLogins}</div>
          <p className="text-xs text-muted-foreground">
            Past 7 days
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemMetrics;