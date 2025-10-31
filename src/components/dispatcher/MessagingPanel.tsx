import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Send } from "lucide-react";

interface Driver {
  id: string;
  name: string;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  created_at: string;
  read: boolean;
}

interface MessagingPanelProps {
  drivers: Driver[];
}

export const MessagingPanel = ({ drivers }: MessagingPanelProps) => {
  const { toast } = useToast();
  const [selectedDriver, setSelectedDriver] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadMessages();
    setupRealtimeSubscription();
  }, []);

  const loadMessages = async () => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) setMessages(data);
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel("messages-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        loadMessages();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDriver || !message.trim()) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("messages").insert([
        {
          sender_id: user.id,
          receiver_id: selectedDriver,
          message: message.trim(),
        },
      ]);

      if (error) throw error;

      toast({
        title: "Message sent",
        description: "Your message has been delivered to the driver.",
      });

      setMessage("");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const getDriverName = (driverId: string) => {
    return drivers.find((d) => d.id === driverId)?.name || "Unknown";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Message Driver
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSendMessage} className="space-y-3">
          <Select value={selectedDriver} onValueChange={setSelectedDriver}>
            <SelectTrigger>
              <SelectValue placeholder="Select driver" />
            </SelectTrigger>
            <SelectContent>
              {drivers.map((driver) => (
                <SelectItem key={driver.id} value={driver.id}>
                  {driver.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Textarea
            placeholder="Type your message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
          />

          <Button type="submit" disabled={loading || !selectedDriver || !message.trim()} className="w-full">
            <Send className="mr-2 h-4 w-4" />
            Send Message
          </Button>
        </form>

        <div className="border-t pt-4">
          <h4 className="text-sm font-semibold mb-3">Recent Messages</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No messages yet</p>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="p-2 border rounded-lg bg-card">
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <span className="text-xs font-medium">To: {getDriverName(msg.receiver_id)}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(msg.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm">{msg.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
