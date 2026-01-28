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

const actionTypeColors: Record<string, string> = {
  login: "bg-green-500",
  logout: "bg-gray-500",
  route_created: "bg-blue-500",
  route_updated: "bg-yellow-500",
  route_deleted: "bg-red-500",
  driver_created: "bg-green-500",
  driver_updated: "bg-yellow-500",
  driver_activated: "bg-green-500",
  driver_deactivated: "bg-orange-500",
  message_sent: "bg-purple-500",
  incident_reported: "bg-red-500",
  deduction_created: "bg-orange-500",
  payout_calculated: "bg-green-500",
  payout_processed: "bg-green-600",
  training_completed: "bg-blue-500",
  document_uploaded: "bg-indigo-500",
  user_role_assigned: "bg-purple-500",
  user_role_removed: "bg-orange-500",
};

const ActivityLogsTable = () => {
  const { toast } = useToast();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");

  const fetchLogs = async () => {
    try {
      let query = supabase
        .from('activity_logs')
        .select('*')
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
              <SelectItem value="login">Login</SelectItem>
              <SelectItem value="logout">Logout</SelectItem>
              <SelectItem value="route_created">Route Created</SelectItem>
              <SelectItem value="route_updated">Route Updated</SelectItem>
              <SelectItem value="driver_created">Driver Created</SelectItem>
              <SelectItem value="incident_reported">Incident Reported</SelectItem>
              <SelectItem value="payout_processed">Payout Processed</SelectItem>
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
                    {log.user_email || 'System'}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      className={`${actionTypeColors[log.action_type] || 'bg-gray-500'} text-white`}
                    >
                      {log.action_type.replace(/_/g, ' ')}
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