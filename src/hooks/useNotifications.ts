import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type NotificationRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  title: string;
  body: string;
  kind: 'message' | 'alert' | 'system' | string;
  read_at: string | null;
  created_at: string;
};

export function useNotifications() {
  const [inbox, setInbox] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setInbox([]); setLoading(false); return; }
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false });
    setInbox((data as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    let channel = supabase.channel('notifications-inbox');
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      channel = supabase.channel('notif-' + user.id)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` }, (payload) => {
          setInbox(prev => [payload.new as any as NotificationRow, ...prev]);
        })
        .subscribe();
    })();
    return () => { channel.unsubscribe(); };
  }, []);

  const markRead = useCallback(async (id: string) => {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    setInbox(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
  }, []);

  const sendToAdmin = useCallback(async (title: string, body: string) => {
    const { error } = await supabase.functions.invoke('send-notification', { body: { title, body, kind: 'message' } });
    if (error) throw error;
  }, []);

  const broadcastToDrivers = useCallback(async (title: string, body: string, driverIds?: string[]) => {
    const { error } = await supabase.functions.invoke('send-notification', { body: { title, body, kind: 'message', driverIds } });
    if (error) throw error;
  }, []);

  return { inbox, loading, refresh, markRead, sendToAdmin, broadcastToDrivers };
}

