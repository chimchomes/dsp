import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useNotifications } from '@/hooks/useNotifications';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function Inbox() {
  const { inbox, loading, markRead } = useNotifications();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [recipientRole, setRecipientRole] = useState<string>('admin');
  const [recipientId, setRecipientId] = useState<string>('');
  const [roleUsers, setRoleUsers] = useState<{ user_id: string; full_name?: string; email?: string }[]>([]);
  const [replyingTo, setReplyingTo] = useState<string>('');
  const [roles, setRoles] = useState<string[]>([]);

  // Load allowed roles dynamically based on caller role
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: myRoles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
      const my = new Set((myRoles || []).map(r => r.role as string));
      const { data: rolesList } = await supabase.from('roles_list').select('role');
      const allRoles = (rolesList || []).map(r => r.role as string);
      let allowed: string[] = [];
      if (my.has('driver')) allowed = ['admin','hr','finance'];
      else if (my.has('onboarding')) allowed = ['admin'];
      else if (my.has('hr') || my.has('finance')) allowed = ['driver','admin'];
      else if (my.has('admin')) allowed = allRoles;
      setRoles(allowed);
      if (!allowed.includes(recipientRole)) setRecipientRole(allowed[0] || 'admin');
    })();
  }, []);

  // Load recipients for selected role (optional per-user send)
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('role_profiles')
        .select('user_id, full_name, email')
        .eq('role', recipientRole)
        .limit(500);
      setRoleUsers(((data as any) || []).map((r: any) => ({ user_id: r.user_id, full_name: r.full_name, email: r.email })));
      setRecipientId('');
    })();
  }, [recipientRole]);

  const onSend = async () => {
    if (!title || !body) return;
    // Require a specific recipient
    if (!recipientId) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-notification', {
        body: { title, body, recipientRole, recipientId: recipientId || undefined }
      });
      if (error) throw error;
      setTitle(''); setBody(''); setRecipientId(''); setReplyingTo('');
    } finally { setSending(false); }
  };

  return (
    <div className="min-h-screen p-4 max-w-4xl mx-auto space-y-6">
      <div>
        <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>New Message</CardTitle>
          <CardDescription>Choose role (Admin, HR, or Finance) to message.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {replyingTo && (
            <div className="text-xs text-muted-foreground">Replying to: {replyingTo}</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
              <label className="text-sm text-muted-foreground">Specific recipient (optional)</label>
              <Select onValueChange={setRecipientId} value={recipientId}>
                <SelectTrigger><SelectValue placeholder="All in role" /></SelectTrigger>
                <SelectContent>
                  {roleUsers.map(u => (
                    <SelectItem key={u.user_id} value={u.user_id}>{u.full_name || u.email || u.user_id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
          <Textarea placeholder="Message" value={body} onChange={e => setBody(e.target.value)} />
          <Button onClick={onSend} disabled={sending || !title || !body}>Send</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inbox</CardTitle>
          <CardDescription>{loading ? 'Loading...' : `${inbox.length} messages`}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {inbox.map(n => (
            <div key={n.id} className="border rounded p-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{n.title}</div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setRecipientId(n.sender_id); setRecipientRole('admin'); setTitle(`Re: ${n.title}`); setReplyingTo(n.sender_id); }}>Reply</Button>
                  {!n.read_at && <Button size="sm" variant="outline" onClick={() => markRead(n.id)}>Mark read</Button>}
                </div>
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
