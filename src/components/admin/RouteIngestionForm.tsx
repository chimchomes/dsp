import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RouteIngestionFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  dispatcherId?: string;
}

export const RouteIngestionForm = ({ open, onClose, onSuccess, dispatcherId }: RouteIngestionFormProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    customer_name: "",
    address: "",
    parcel_count_total: "",
    postcodes_covered: "",
    amazon_rate_per_parcel: "",
    scheduled_date: new Date().toISOString().split('T')[0],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Parse postcodes as array
      const postcodes = formData.postcodes_covered
        .split(',')
        .map(code => code.trim())
        .filter(code => code.length > 0);

      const { error } = await supabase.from("routes").insert({
        customer_name: formData.customer_name,
        address: formData.address,
        driver_id: "", // Will be assigned later
        dispatcher_id: dispatcherId || null,
        parcel_count_total: parseInt(formData.parcel_count_total),
        postcodes_covered: postcodes,
        amazon_rate_per_parcel: parseFloat(formData.amazon_rate_per_parcel),
        scheduled_date: formData.scheduled_date,
        status: "pending",
        time_window: "TBD",
        package_type: "Standard",
        parcels_delivered: 0,
      });

      if (error) throw error;

      toast.success("Route imported successfully");
      onSuccess();
      onClose();
      setFormData({
        customer_name: "",
        address: "",
        parcel_count_total: "",
        postcodes_covered: "",
        amazon_rate_per_parcel: "",
        scheduled_date: new Date().toISOString().split('T')[0],
      });
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Amazon Route</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="customer_name">Route ID / Name</Label>
              <Input
                id="customer_name"
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                required
                placeholder="e.g., AMZ-ROUTE-001"
              />
            </div>
            <div>
              <Label htmlFor="scheduled_date">Scheduled Date</Label>
              <Input
                id="scheduled_date"
                type="date"
                value={formData.scheduled_date}
                onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="address">Route Area / Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              required
              placeholder="e.g., North London Area"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="parcel_count_total">Total Parcels</Label>
              <Input
                id="parcel_count_total"
                type="number"
                min="1"
                value={formData.parcel_count_total}
                onChange={(e) => setFormData({ ...formData, parcel_count_total: e.target.value })}
                required
                placeholder="e.g., 150"
              />
            </div>
            <div>
              <Label htmlFor="amazon_rate_per_parcel">Amazon Rate per Parcel (£)</Label>
              <Input
                id="amazon_rate_per_parcel"
                type="number"
                step="0.01"
                min="0"
                value={formData.amazon_rate_per_parcel}
                onChange={(e) => setFormData({ ...formData, amazon_rate_per_parcel: e.target.value })}
                required
                placeholder="e.g., 2.00"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="postcodes_covered">Postcodes Covered (comma-separated)</Label>
            <Input
              id="postcodes_covered"
              value={formData.postcodes_covered}
              onChange={(e) => setFormData({ ...formData, postcodes_covered: e.target.value })}
              placeholder="e.g., N1, N2, N3, N4"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Importing..." : "Import Route"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
