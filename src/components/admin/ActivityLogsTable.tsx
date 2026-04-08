import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface ActivityLog {
  id: string;
  user_email: string | null;
  action_type: string;
  resource_type: string | null;
  resource_id: string | null;
  action_details: any;
  created_at: string;
}

const EXCLUDED_ACTIONS = [
  "route_created",
  "route_updated",
  "route_deleted",
  "dispatcher_created",
  "dispatcher_updated",
  "dispatcher_deleted",
];

const actionTypeMeta: Record<string, { label: string; color: string }> = {
  login: { label: "Login", color: "bg-green-500" },
  logout: { label: "Logout", color: "bg-gray-500" },
  driver_created: { label: "Driver Created", color: "bg-emerald-600" },
  driver_updated: { label: "Driver Updated", color: "bg-amber-500" },
  driver_activated: { label: "Driver Activated", color: "bg-green-500" },
  driver_deactivated: { label: "Driver Deactivated", color: "bg-orange-500" },
  incident_reported: { label: "Incident Reported", color: "bg-red-500" },
  user_role_assigned: { label: "Role Assigned", color: "bg-purple-500" },
  user_role_removed: { label: "Role Removed", color: "bg-fuchsia-600" },
  onboarding_submitted: { label: "Onboarding Submitted", color: "bg-sky-600" },
  onboarding_approved: { label: "Onboarding Approved", color: "bg-lime-600" },
  onboarding_rejected: { label: "Onboarding Rejected", color: "bg-rose-600" },
  staff_created: { label: "Staff Created", color: "bg-cyan-600" },
  staff_updated: { label: "Staff Updated", color: "bg-cyan-500" },
  staff_deactivated: { label: "Staff Deactivated", color: "bg-orange-600" },
  staff_reactivated: { label: "Staff Reactivated", color: "bg-green-600" },
  payout_calculated: { label: "Payout Calculated", color: "bg-green-500" },
  payout_processed: { label: "Payout Processed", color: "bg-green-700" },
  document_uploaded: { label: "Document Uploaded", color: "bg-indigo-500" },
  message_sent: { label: "Message Sent", color: "bg-violet-500" },
  deduction_created: { label: "Deduction Created", color: "bg-orange-500" },
};

const ActivityLogsTable = () => {
  const { toast } = useToast();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [actionOptions, setActionOptions] = useState<string[]>([]);

  const humanizeAction = (actionType: string) =>
    actionTypeMeta[actionType]?.label || actionType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const resolveActorEmail = (log: ActivityLog) => {
    if (log.user_email) return log.user_email;
    const details = (log.action_details || {}) as Record<string, any>;
    return (
      details.created_by_email ||
      details.actor_email ||
      details.onboarded_by_email ||
      details.created_by ||
      "System"
    );
  };

  const loadActionOptions = async () => {
    try {
      const excluded = `(${EXCLUDED_ACTIONS.join(",")})`;
      const { data, error } = await supabase
        .from("activity_logs")
        .select("action_type")
        .not("action_type", "in", excluded)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;

      const unique = Array.from(new Set((data || []).map((row: any) => row.action_type).filter(Boolean)));
      const sorted = unique.sort((a, b) => humanizeAction(a).localeCompare(humanizeAction(b)));
      setActionOptions(sorted);
    } catch (error: any) {
      toast({
        title: "Error loading action filters",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchLogs = async () => {
    try {
      const excluded = `(${EXCLUDED_ACTIONS.join(",")})`;
      let query = supabase
        .from('activity_logs')
        .select('*')
        .not("action_type", "in", excluded)
        .order('created_at', { ascending: false })
        .limit(100);

      if (searchEmail) {
        query = query.ilike('user_email', `%${searchEmail}%`);
      }

      if (filterAction !== "all") {
        query = query.eq('action_type', filterAction);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching logs",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActionOptions();
    fetchLogs();

    const channel = supabase
      .channel('activity-logs-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_logs' },
        () => fetchLogs()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [searchEmail, filterAction]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="search-email">Search by Email</Label>
          <Input
            id="search-email"
            placeholder="user@example.com"
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="filter-action">Filter by Action</Label>
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger id="filter-action">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {actionOptions.map((actionType) => (
                <SelectItem key={actionType} value={actionType}>
                  {humanizeAction(actionType)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No activity logs found
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {format(new Date(log.created_at), 'MMM d, yyyy HH:mm:ss')}
                  </TableCell>
                  <TableCell className="font-medium">
                    {resolveActorEmail(log)}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      className={`${actionTypeMeta[log.action_type]?.color || 'bg-gray-500'} text-white`}
                    >
                      {humanizeAction(log.action_type)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {log.resource_type ? (
                      <span className="text-sm">
                        {log.resource_type}
                        {log.resource_id && (
                          <span className="text-muted-foreground ml-1">
                            ({log.resource_id.slice(0, 8)}...)
                          </span>
                        )}
                      </span>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                    {log.action_details ? (
                      <pre className="text-xs">
                        {JSON.stringify(log.action_details, null, 2).slice(0, 100)}...
                      </pre>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-sm text-muted-foreground">
        Showing {logs.length} most recent logs (max 100)
      </p>
    </div>
  );
};

export default ActivityLogsTable;