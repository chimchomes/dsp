import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Edit, Trash } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface Dispatcher {
  id: string;
  name: string;
  dsp_name: string;
  contact_email: string;
  contact_phone: string | null;
  rate_per_parcel: number;
  driver_parcel_rate: number;
  default_deduction_rate: number;
  tour_id_prefix: string | null;
  admin_commission_percentage: number;
  active: boolean;
  created_at: string;
}

export const DispatcherManagement = () => {
  const { toast } = useToast();
  const [dispatchers, setDispatchers] = useState<Dispatcher[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingDispatcher, setEditingDispatcher] = useState<Dispatcher | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    dsp_name: "",
    contact_email: "",
    contact_phone: "",
    rate_per_parcel: "",
    driver_parcel_rate: "",
    default_deduction_rate: "",
    tour_id_prefix: "",
    admin_commission_percentage: "",
  });

  useEffect(() => {
    loadDispatchers();
  }, []);

  const loadDispatchers = async () => {
    try {
      const { data, error } = await supabase
        .from("dispatchers")
        .select("*")
        .order("name");

      if (error) throw error;
      setDispatchers(data || []);
    } catch (error) {
      console.error("Error loading dispatchers:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load dispatchers",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const dispatcherData = {
        name: formData.name,
        dsp_name: formData.dsp_name || formData.name,
        contact_email: formData.contact_email,
        contact_phone: formData.contact_phone || null,
        rate_per_parcel: parseFloat(formData.rate_per_parcel) || 0,
        driver_parcel_rate: parseFloat(formData.driver_parcel_rate) || 0,
        default_deduction_rate: parseFloat(formData.default_deduction_rate) || 0,
        tour_id_prefix: formData.tour_id_prefix || null,
        admin_commission_percentage: parseFloat(formData.admin_commission_percentage) || 0,
      };

      if (editingDispatcher) {
        const { error } = await supabase
          .from("dispatchers")
          .update(dispatcherData)
          .eq("id", editingDispatcher.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Dispatcher updated successfully",
        });
      } else {
        const { error } = await supabase
          .from("dispatchers")
          .insert([dispatcherData]);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Dispatcher created successfully",
        });
      }

      setShowDialog(false);
      resetForm();
      loadDispatchers();
    } catch (error) {
      console.error("Error saving dispatcher:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save dispatcher",
      });
    }
  };

  const handleToggleActive = async (dispatcher: Dispatcher) => {
    try {
      const { error } = await supabase
        .from("dispatchers")
        .update({ active: !dispatcher.active })
        .eq("id", dispatcher.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Dispatcher ${!dispatcher.active ? "activated" : "deactivated"}`,
      });

      loadDispatchers();
    } catch (error) {
      console.error("Error toggling dispatcher status:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update dispatcher status",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this dispatcher?")) return;

    try {
      const { error } = await supabase
        .from("dispatchers")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Dispatcher deleted successfully",
      });

      loadDispatchers();
    } catch (error) {
      console.error("Error deleting dispatcher:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete dispatcher",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      dsp_name: "",
      contact_email: "",
      contact_phone: "",
      rate_per_parcel: "",
      driver_parcel_rate: "",
      default_deduction_rate: "",
      tour_id_prefix: "",
      admin_commission_percentage: "",
    });
    setEditingDispatcher(null);
  };

  const openEditDialog = (dispatcher: Dispatcher) => {
    setEditingDispatcher(dispatcher);
    setFormData({
      name: dispatcher.name,
      dsp_name: dispatcher.dsp_name || dispatcher.name,
      contact_email: dispatcher.contact_email,
      contact_phone: dispatcher.contact_phone || "",
      rate_per_parcel: dispatcher.rate_per_parcel.toString(),
      // Use nullish coalescing to preserve 0 values
      driver_parcel_rate: (dispatcher.driver_parcel_rate ?? dispatcher.rate_per_parcel ?? 0).toString(),
      default_deduction_rate: (dispatcher.default_deduction_rate ?? 0).toString(),
      tour_id_prefix: dispatcher.tour_id_prefix || "",
      admin_commission_percentage: dispatcher.admin_commission_percentage.toString(),
    });
    setShowDialog(true);
  };

  if (loading) {
    return <div>Loading dispatchers...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Dispatcher Management</h2>
        <Dialog open={showDialog} onOpenChange={(open) => {
          setShowDialog(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Dispatcher
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingDispatcher ? "Edit Dispatcher" : "Add New Dispatcher"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Company Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="dsp_name">DSP Legal Name</Label>
                <Input
                  id="dsp_name"
                  value={formData.dsp_name}
                  onChange={(e) => setFormData({ ...formData, dsp_name: e.target.value })}
                  placeholder="e.g., Amazon, Velocity Logistics"
                  required
                />
              </div>
              <div>
                <Label htmlFor="contact_email">Contact Email</Label>
                <Input
                  id="contact_email"
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="contact_phone">Contact Phone (Optional)</Label>
                <Input
                  id="contact_phone"
                  type="tel"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="driver_parcel_rate">Driver Parcel Rate (£)</Label>
                <Input
                  id="driver_parcel_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.driver_parcel_rate}
                  onChange={(e) => setFormData({ ...formData, driver_parcel_rate: e.target.value })}
                  placeholder="Amount paid per completed parcel"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Fixed dollar amount paid to driver per successfully completed parcel
                </p>
              </div>
              <div>
                <Label htmlFor="default_deduction_rate">Default Deduction Rate (£)</Label>
                <Input
                  id="default_deduction_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.default_deduction_rate}
                  onChange={(e) => setFormData({ ...formData, default_deduction_rate: e.target.value })}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Fixed weekly/monthly amount for standard deductions (insurance, admin fee)
                </p>
              </div>
              <div>
                <Label htmlFor="tour_id_prefix">Tour ID Prefix</Label>
                <Input
                  id="tour_id_prefix"
                  value={formData.tour_id_prefix}
                  onChange={(e) => setFormData({ ...formData, tour_id_prefix: e.target.value })}
                  placeholder="e.g., AMZ_, VEL_"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Short unique identifier for route imports (e.g., 'AMZ_', 'VEL_')
                </p>
              </div>
              <div>
                <Label htmlFor="rate_per_parcel">Rate Per Parcel (£) - Legacy</Label>
                <Input
                  id="rate_per_parcel"
                  type="number"
                  step="0.01"
                  value={formData.rate_per_parcel}
                  onChange={(e) => setFormData({ ...formData, rate_per_parcel: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="admin_commission_percentage">Admin Commission (%)</Label>
                <Input
                  id="admin_commission_percentage"
                  type="number"
                  step="0.01"
                  value={formData.admin_commission_percentage}
                  onChange={(e) => setFormData({ ...formData, admin_commission_percentage: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => {
                  setShowDialog(false);
                  resetForm();
                }}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingDispatcher ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>DSP Name</TableHead>
              <TableHead>Contact Email</TableHead>
              <TableHead>Driver Rate</TableHead>
              <TableHead>Default Deduction</TableHead>
              <TableHead>Tour Prefix</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dispatchers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No dispatchers found. Add your first dispatcher to get started.
                </TableCell>
              </TableRow>
            ) : (
              dispatchers.map((dispatcher) => (
                <TableRow key={dispatcher.id}>
                  <TableCell className="font-medium">{dispatcher.dsp_name || dispatcher.name}</TableCell>
                  <TableCell>{dispatcher.contact_email}</TableCell>
                  <TableCell>£{(dispatcher.driver_parcel_rate ?? dispatcher.rate_per_parcel ?? 0).toFixed(2)}</TableCell>
                  <TableCell>£{(dispatcher.default_deduction_rate ?? 0).toFixed(2)}</TableCell>
                  <TableCell>{dispatcher.tour_id_prefix || "-"}</TableCell>
                  <TableCell>
                    <Switch
                      checked={dispatcher.active}
                      onCheckedChange={() => handleToggleActive(dispatcher)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(dispatcher)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(dispatcher.id)}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
