import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useNotifications } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type DriverLite = { user_id: string; name?: string | null; email?: string | null };

export default function AdminMessages() {
  const { inbox, loading, markRead, broadcastToDrivers } = useNotifications();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targets, setTargets] = useState<string>('');
  const [driverList, setDriverList] = useState<DriverLite[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<string>('');
  const [recipientRole, setRecipientRole] = useState<string>('driver');
  const [roles, setRoles] = useState<string[]>([]);
  const [countDrivers, setCountDrivers] = useState<number>(0);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      // Load roles centrally
      const { data: rolesList } = await supabase.from('roles_list').select('role');
      let allRoles = (rolesList || []).map(r => r.role as string);
      // Filter out 'dispatcher', 'route-admin', and 'inactive' roles
      allRoles = allRoles.filter(role => role !== 'dispatcher' && role !== 'route-admin' && role !== 'inactive');
      // Admin can message any of the remaining roles
      setRoles(allRoles);

      // Get active drivers only (exclude inactive)
      const { data: activeDriverRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'driver');
      
      // Get inactive user IDs to exclude
      const { data: inactiveUsers } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'inactive');
      
      const inactiveUserIds = new Set((inactiveUsers || []).map(u => u.user_id));
      const activeDriverIds = (activeDriverRoles || [])
        .filter(ur => !inactiveUserIds.has(ur.user_id))
        .map(ur => ur.user_id);
      
      setCountDrivers(activeDriverIds.length);
      
      // Prefill list for default role (drivers) via role_profiles for names/emails
      // Filter out inactive users
      const { data: drivers } = await supabase
        .from('role_profiles')
        .select('user_id, full_name, email')
        .eq('role', 'driver')
        .limit(500);
      
      const activeDrivers = (drivers || []).filter((d: any) => !inactiveUserIds.has(d.user_id));
      setDriverList(activeDrivers.map((d: any) => ({ user_id: d.user_id, name: d.full_name, email: d.email })));
    })();
  }, []);

  // When role changes, reload candidates if driver or admin
  useEffect(() => {
    (async () => {
      setSelectedDriver('');
      setTargets('');
      
      // Get inactive user IDs to exclude
      const { data: inactiveUsers } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'inactive');
      
      const inactiveUserIds = new Set((inactiveUsers || []).map(u => u.user_id));
      
      const { data } = await supabase
        .from('role_profiles')
        .select('user_id, full_name, email')
        .eq('role', recipientRole)
        .limit(500);
      
      // Filter out inactive users
      const activeUsers = ((data as any) || []).filter((r: any) => !inactiveUserIds.has(r.user_id));
      setDriverList(activeUsers.map((r: any) => ({ user_id: r.user_id, name: r.full_name, email: r.email })));
    })();
  }, [recipientRole]);

  const onSend = async () => {
    if (!title || !body) return;
    // Require a specific recipient
    const ids = targets.trim() ? targets.split(',').map(s => s.trim()).filter(Boolean) : (selectedDriver ? [selectedDriver] : []);
    if (ids.length === 0) return;
    setSending(true);
    try {
      // Call edge function directly to support roles
      const { error } = await supabase.functions.invoke('send-notification', {
        body: { title, body, recipientIds: ids, recipientRole }
      });
      if (error) throw error;
      setTitle(''); setBody(''); setTargets('');
      setSelectedDriver('');
    } finally { setSending(false); }
  };

  return (
    <div className="min-h-screen p-4 max-w-5xl mx-auto space-y-6">
      <div>
        <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Message Drivers</CardTitle>
          <CardDescription>Send to all drivers ({countDrivers}), pick a driver, or specify user IDs (comma separated).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-sm text-muted-foreground">Recipient role</label>
              <Select onValueChange={(v) => setRecipientRole(v)} value={recipientRole}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  {roles.map(r => (
                    <SelectItem key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Pick Driver (optional)</label>
              <Select onValueChange={setSelectedDriver} value={selectedDriver}>
                <SelectTrigger><SelectValue placeholder="Select a driver" /></SelectTrigger>
                <SelectContent>
                  {driverList.map(d => (
                    <SelectItem key={d.user_id} value={d.user_id}>
                      {(d.name || d.email || d.user_id).toString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Or driver IDs (comma-separated)</label>
              <Input placeholder="Target driver IDs" value={targets} onChange={e => setTargets(e.target.value)} />
            </div>
          </div>
          <Input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
          <Textarea placeholder="Message" value={body} onChange={e => setBody(e.target.value)} />
          <Button onClick={onSend} disabled={sending || !title || !body || (!selectedDriver && !targets.trim())}>Send</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Admin Inbox</CardTitle>
          <CardDescription>{loading ? 'Loading...' : `${inbox.length} messages`}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {inbox.map(n => (
            <div key={n.id} className="border rounded p-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{n.title}</div>
                {!n.read_at && <Button size="sm" variant="outline" onClick={() => markRead(n.id)}>Mark read</Button>}
              </div>
              <div className="text-sm text-muted-foreground">{new Date(n.created_at).toLocaleString()}</div>
              <div className="mt-2">{n.body}</div>
            </div>
          ))}
          {inbox.length === 0 && !loading && <div className="text-sm text-muted-foreground">No messages</div>}
        </CardContent>
      </Card>
    </div>
  );
}
