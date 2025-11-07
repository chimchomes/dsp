import { Link } from "react-router-dom";
import { NotificationBadge } from "@/components/NotificationBadge";
import { useNotifications as useInbox } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail } from "lucide-react";

export default function HeaderBar() {
  const { inbox } = useInbox();
  const unread = inbox.filter(n => !n.read_at).length;

  return (
    <div className="w-full flex items-center justify-end gap-2 px-3 py-2 border-b bg-background/80 sticky top-0 z-40">
      <Link to="/inbox">
        <Button variant="ghost" size="icon" className="relative" aria-label="Inbox">
          <Mail className="h-5 w-5" />
          {unread > 0 && (
            <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
              {unread}
            </Badge>
          )}
        </Button>
      </Link>
      <NotificationBadge />
    </div>
  );
}

