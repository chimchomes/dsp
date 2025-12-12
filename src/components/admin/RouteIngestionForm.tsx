import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileText, Loader2 } from "lucide-react";

interface RouteIngestionFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  dispatcherId?: string;
}

export const RouteIngestionForm = ({ open, onClose, onSuccess, dispatcherId }: RouteIngestionFormProps) => {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [formData, setFormData] = useState({
    customer_name: "",
    address: "",
    parcel_count_total: "",
    postcodes_covered: "",
    amazon_rate_per_parcel: "",
    scheduled_date: new Date().toISOString().split('T')[0],
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);

    // Read file content
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setFileContent(content);
    };
    reader.readAsText(file);
  };

  const handleFileUpload = async () => {
    if (!selectedFile || !fileContent || !dispatcherId) {
      toast.error("Please select a file and dispatcher");
      return;
    }

    setUploading(true);

    try {
      const fileType = selectedFile.type || (selectedFile.name.endsWith('.csv') ? 'text/csv' : 'text/csv');
      
      const { data, error } = await supabase.functions.invoke('ingest-route', {
        body: {
          dispatcher_id: dispatcherId,
          file_content: fileContent,
          file_type: fileType,
          scheduled_date: formData.scheduled_date,
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      toast.success(
        `Route imported successfully! ${data.stops_created} stops created, ${data.geocoded_count} geocoded.`
      );
      
      onSuccess();
      onClose();
      resetForm();
    } catch (error: any) {
      toast.error(error.message || "Failed to import route from file");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // If file is selected, use file upload method
    if (selectedFile && fileContent) {
      await handleFileUpload();
      return;
    }

    // Otherwise, use manual entry method
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
      resetForm();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      customer_name: "",
      address: "",
      parcel_count_total: "",
      postcodes_covered: "",
      amazon_rate_per_parcel: "",
      scheduled_date: new Date().toISOString().split('T')[0],
    });
    setSelectedFile(null);
    setFileContent("");
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) {
        resetForm();
        onClose();
      }
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Route</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* File Upload Section */}
          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              <Label className="text-base font-semibold">Upload Route File (CSV)</Label>
            </div>
            <div>
              <Input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileSelect}
                disabled={uploading}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Upload a CSV file with columns: address, customer_name (optional), package_details (optional)
              </p>
            </div>
            {selectedFile && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>{selectedFile.name}</span>
                <span className="text-xs">({(selectedFile.size / 1024).toFixed(2)} KB)</span>
              </div>
            )}
          </div>

          <div className="text-center text-sm text-muted-foreground">OR</div>

          {/* Manual Entry Section */}
          <div className="border rounded-lg p-4 space-y-4">
            <Label className="text-base font-semibold">Manual Entry</Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="customer_name">Route ID / Name</Label>
                <Input
                  id="customer_name"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
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
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => {
              resetForm();
              onClose();
            }}>
              Cancel
            </Button>
            {selectedFile && fileContent ? (
              <Button 
                type="button" 
                onClick={handleFileUpload} 
                disabled={uploading || !dispatcherId}
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Import from File
                  </>
                )}
              </Button>
            ) : (
              <Button type="submit" disabled={loading}>
                {loading ? "Importing..." : "Import Route"}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
