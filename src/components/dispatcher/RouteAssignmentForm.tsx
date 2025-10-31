import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface Driver {
  id: string;
  name: string;
}

interface Dispatcher {
  id: string;
  name: string;
}

interface RouteAssignmentFormProps {
  drivers: Driver[];
  onClose: () => void;
  onSuccess: () => void;
}

export const RouteAssignmentForm = ({ drivers, onClose, onSuccess }: RouteAssignmentFormProps) => {
  const { toast } = useToast();
  const [dispatchers, setDispatchers] = useState<Dispatcher[]>([]);
  const [formData, setFormData] = useState({
    driver_id: "",
    dispatcher_id: "",
    address: "",
    time_window: "",
    customer_name: "",
    package_type: "",
    delivery_notes: "",
    scheduled_date: new Date().toISOString().split("T")[0],
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDispatchers();
  }, []);

  const loadDispatchers = async () => {
    try {
      const { data, error } = await supabase
        .from("dispatchers")
        .select("id, name")
        .eq("active", true)
        .order("name");

      if (error) throw error;
      setDispatchers(data || []);
    } catch (error) {
      console.error("Error loading dispatchers:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from("routes").insert([
        {
          ...formData,
          dispatcher_id: formData.dispatcher_id || null,
          status: "pending",
        },
      ]);

      if (error) throw error;

      toast({
        title: "Route assigned",
        description: "The route has been successfully assigned to the driver.",
      });

      onSuccess();
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

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign New Route</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="driver">Driver</Label>
            <Select
              value={formData.driver_id}
              onValueChange={(value) => setFormData({ ...formData, driver_id: value })}
              required
            >
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="dispatcher">Dispatcher (Optional)</Label>
            <Select
              value={formData.dispatcher_id}
              onValueChange={(value) => setFormData({ ...formData, dispatcher_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select dispatcher" />
              </SelectTrigger>
              <SelectContent>
                {dispatchers.map((dispatcher) => (
                  <SelectItem key={dispatcher.id} value={dispatcher.id}>
                    {dispatcher.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer_name">Customer Name</Label>
            <Input
              id="customer_name"
              value={formData.customer_name}
              onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Delivery Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="time_window">Time Window</Label>
            <Input
              id="time_window"
              placeholder="e.g., 9:00 AM - 11:00 AM"
              value={formData.time_window}
              onChange={(e) => setFormData({ ...formData, time_window: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="package_type">Package Type</Label>
            <Input
              id="package_type"
              placeholder="e.g., Standard, Fragile, Express"
              value={formData.package_type}
              onChange={(e) => setFormData({ ...formData, package_type: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="scheduled_date">Scheduled Date</Label>
            <Input
              id="scheduled_date"
              type="date"
              value={formData.scheduled_date}
              onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="delivery_notes">Delivery Notes</Label>
            <Textarea
              id="delivery_notes"
              placeholder="Special instructions..."
              value={formData.delivery_notes}
              onChange={(e) => setFormData({ ...formData, delivery_notes: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Assigning..." : "Assign Route"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
