import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileText, Loader2 } from "lucide-react";
import { format, subDays } from "date-fns";

const ReportsExport = () => {
  const { toast } = useToast();
  const [exporting, setExporting] = useState<string | null>(null);

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      toast({
        title: "No data to export",
        description: "There is no data available for the selected report",
        variant: "destructive",
      });
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header => {
          const value = row[header];
          if (value === null || value === undefined) return '';
          if (typeof value === 'object') return JSON.stringify(value);
          return `"${value.toString().replace(/"/g, '""')}"`;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const exportActivityLogs = async () => {
    setExporting('activity');
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      exportToCSV(data || [], 'activity_logs');

      toast({
        title: "Export successful",
        description: `Exported ${data?.length || 0} activity logs`,
      });
    } catch (error: any) {
      toast({
        title: "Export failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setExporting(null);
    }
  };

  const exportWeeklyIncidents = async () => {
    setExporting('incidents');
    try {
      const weekAgo = subDays(new Date(), 7).toISOString();
      const { data: incidents, error } = await supabase
        .from('incidents')
        .select('*')
        .gte('created_at', weekAgo)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch driver info separately from driver_profiles
      const driverIds = [...new Set(incidents?.map(i => i.driver_id) || [])];
      const { data: drivers } = await supabase
        .from('driver_profiles')
        .select('id, name, email')
        .in('id', driverIds);

      const driversMap = new Map(drivers?.map(d => [d.id, d]) || []);

      const flattenedData = (incidents || []).map(incident => ({
        id: incident.id,
        driver_name: driversMap.get(incident.driver_id)?.name || 'Unknown',
        driver_email: driversMap.get(incident.driver_id)?.email || 'Unknown',
        description: incident.description,
        photo_url: incident.photo_url,
        created_at: incident.created_at,
      }));

      exportToCSV(flattenedData, 'weekly_incidents');

      toast({
        title: "Export successful",
        description: `Exported ${incidents?.length || 0} incidents from the past week`,
      });
    } catch (error: any) {
      toast({
        title: "Export failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setExporting(null);
    }
  };

  const exportPayoutSummary = async () => {
    setExporting('payouts');
    try {
      const { data: statements, error } = await supabase
        .from('pay_statements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Fetch driver info separately from driver_profiles
      const driverIds = [...new Set(statements?.map(s => s.driver_id) || [])];
      const { data: drivers } = await supabase
        .from('driver_profiles')
        .select('id, name, email')
        .in('id', driverIds);

      const driversMap = new Map(drivers?.map(d => [d.id, d]) || []);

      const flattenedData = (statements || []).map(statement => ({
        id: statement.id,
        driver_name: driversMap.get(statement.driver_id)?.name || 'Unknown',
        driver_email: driversMap.get(statement.driver_id)?.email || 'Unknown',
        period_start: statement.period_start,
        period_end: statement.period_end,
        gross_earnings: statement.gross_earnings,
        total_deductions: statement.total_deductions,
        net_payout: statement.net_payout,
        status: statement.status,
        paid_at: statement.paid_at,
        payment_reference: statement.payment_reference,
      }));

      exportToCSV(flattenedData, 'payout_summary');

      toast({
        title: "Export successful",
        description: `Exported ${statements?.length || 0} payout records`,
      });
    } catch (error: any) {
      toast({
        title: "Export failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setExporting(null);
    }
  };

  const exportDriversList = async () => {
    setExporting('drivers');
    try {
      const { data, error } = await supabase
        .from('driver_profiles')
        .select('*')
        .order('name');

      if (error) throw error;

      exportToCSV(data || [], 'drivers_list');

      toast({
        title: "Export successful",
        description: `Exported ${data?.length || 0} drivers`,
      });
    } catch (error: any) {
      toast({
        title: "Export failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Activity Logs
          </CardTitle>
          <CardDescription>Export complete system activity logs (last 1000)</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={exportActivityLogs}
            disabled={exporting === 'activity'}
            className="w-full"
          >
            {exporting === 'activity' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export Activity Logs
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Weekly Incidents
          </CardTitle>
          <CardDescription>Export incidents from the past 7 days</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={exportWeeklyIncidents}
            disabled={exporting === 'incidents'}
            className="w-full"
          >
            {exporting === 'incidents' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export Weekly Incidents
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Payout Summary
          </CardTitle>
          <CardDescription>Export payout statements (last 100)</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={exportPayoutSummary}
            disabled={exporting === 'payouts'}
            className="w-full"
          >
            {exporting === 'payouts' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export Payout Summary
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Drivers List
          </CardTitle>
          <CardDescription>Export complete drivers database</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={exportDriversList}
            disabled={exporting === 'drivers'}
            className="w-full"
          >
            {exporting === 'drivers' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export Drivers List
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsExport;