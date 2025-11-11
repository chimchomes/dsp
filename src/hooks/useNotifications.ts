import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { RealtimeChannel } from '@supabase/supabase-js';

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
  const { toast } = useToast();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setInbox([]);
        return;
      }

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load notifications', error);
        return;
      }

      setInbox((data as NotificationRow[]) || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let isMounted = true;

    const subscribe = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !isMounted) {
        return;
      }

      channel = supabase
        .channel(`notif-${user.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` },
          (payload) => {
            const newNotification = payload.new as NotificationRow;
            setInbox(prev => {
              const filtered = prev.filter(n => n.id !== newNotification.id);
              return [newNotification, ...filtered];
            });

            if (!newNotification.read_at) {
              const preview =
                newNotification.body?.slice(0, 120) ?? 'Open your inbox to read the message.';
              toast({
                title: newNotification.title || 'New message received',
                description: newNotification.body ? (newNotification.body.length > 120 ? `${preview}...` : preview) : preview,
              });
            }
          },
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` },
          (payload) => {
            const updatedNotification = payload.new as NotificationRow;
            setInbox(prev => prev.map(item => (item.id === updatedNotification.id ? updatedNotification : item)));
          },
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` },
          (payload) => {
            const removedId = (payload.old as { id?: string } | undefined)?.id;
            if (removedId) {
              setInbox(prev => prev.filter(item => item.id !== removedId));
            }
          },
        )
        .subscribe();
    };

    subscribe();

    return () => {
      isMounted = false;
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, [toast]);

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
