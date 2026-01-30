import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { X, Upload } from "lucide-react";

interface IncidentFormProps {
  driverId: string;
  driverName?: string;
  driverEmail?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const IncidentForm = ({ driverId, driverName, driverEmail, onClose, onSuccess }: IncidentFormProps) => {
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let photoUrl = null;

      if (file) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("delivery-files")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Use private URL instead of public - file access controlled by RLS
        photoUrl = fileName;
      }

      const { error } = await supabase.from("incidents").insert({
        driver_id: driverId,
        description,
        photo_url: photoUrl,
      });

      if (error) throw error;

      toast({
        title: "Incident reported",
        description: "Your incident report has been submitted successfully.",
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      toast({
        title: "Submission failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Report Incident</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Driver Details Section */}
          {(driverName || driverEmail) && (
            <div className="p-3 bg-muted/50 rounded-lg border">
              <Label className="text-sm font-medium text-muted-foreground mb-2 block">Reporting Driver</Label>
              <div className="space-y-1">
                {driverName && (
                  <p className="text-sm font-semibold">{driverName}</p>
                )}
                {driverEmail && (
                  <p className="text-sm text-muted-foreground">{driverEmail}</p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what happened..."
              rows={4}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="photo">Photo Evidence (optional)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="photo"
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById("photo")?.click()}
                className="w-full"
              >
                <Upload className="mr-2 h-4 w-4" />
                {file ? file.name : "Upload Photo"}
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1 bg-destructive hover:bg-destructive/90">
              {isSubmitting ? "Submitting..." : "Submit Report"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
