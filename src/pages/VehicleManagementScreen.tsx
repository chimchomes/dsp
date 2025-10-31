import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Car, AlertTriangle, Edit } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface VehicleInfo {
  ownership_type: string;
  make: string;
  model: string;
  year: number;
  registration: string;
}

export default function VehicleManagementScreen() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [vehicleInfo, setVehicleInfo] = useState<VehicleInfo>({
    ownership_type: "lease",
    make: "",
    model: "",
    year: new Date().getFullYear(),
    registration: ""
  });
  const [damageDescription, setDamageDescription] = useState("");
  const [damageLocation, setDamageLocation] = useState("");
  const [damageTime, setDamageTime] = useState(new Date().toISOString().slice(0, 16));
  const [garageEstimate, setGarageEstimate] = useState("");
  const [damagePhoto, setDamagePhoto] = useState<File | null>(null);
  const [isSubmittingDamage, setIsSubmittingDamage] = useState(false);
  const [isUpdatingVehicle, setIsUpdatingVehicle] = useState(false);
  const [showDamageDialog, setShowDamageDialog] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);

  useEffect(() => {
    loadVehicleInfo();
  }, []);

  const loadVehicleInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: sessionData } = await supabase
        .from("onboarding_sessions")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (sessionData) {
        setSessionId(sessionData.id);
        setVehicleInfo({
          ownership_type: sessionData.vehicle_ownership_type || "lease",
          make: sessionData.vehicle_make || "",
          model: sessionData.vehicle_model || "",
          year: sessionData.vehicle_year || new Date().getFullYear(),
          registration: sessionData.vehicle_registration || ""
        });
      }
    } catch (error: any) {
      toast({
        title: "Error loading vehicle info",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReportDamage = async () => {
    if (!damageDescription.trim()) {
      toast({
        title: "Error",
        description: "Please describe the damage",
        variant: "destructive",
      });
      return;
    }

    if (!damageLocation.trim()) {
      toast({
        title: "Error",
        description: "Please specify the damage location",
        variant: "destructive",
      });
      return;
    }

    setIsSubmittingDamage(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: driverData } = await supabase
        .from("drivers")
        .select("id")
        .eq("email", user.email)
        .single();

      if (!driverData) throw new Error("Driver not found");

      let photoUrl = null;

      // Upload photo if provided
      if (damagePhoto) {
        const fileExt = damagePhoto.name.split('.').pop();
        const fileName = `${driverData.id}-${Date.now()}.${fileExt}`;
        const filePath = `damage-reports/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('delivery-files')
          .upload(filePath, damagePhoto);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('delivery-files')
          .getPublicUrl(filePath);

        photoUrl = publicUrl;
      }

      // Create detailed damage report
      const detailedDescription = `
VEHICLE DAMAGE REPORT
Vehicle Type: ${vehicleInfo.ownership_type === 'own' ? 'Own Vehicle' : 'Leased Vehicle'}
Vehicle: ${vehicleInfo.make} ${vehicleInfo.model} (${vehicleInfo.year})
Registration: ${vehicleInfo.registration}

Damage Location: ${damageLocation}
Time of Incident: ${new Date(damageTime).toLocaleString()}

Description:
${damageDescription}

${garageEstimate ? `Garage Estimate: ${garageEstimate}` : ''}
      `.trim();

      const { error } = await supabase.from("incidents").insert({
        driver_id: driverData.id,
        description: detailedDescription,
        photo_url: photoUrl
      });

      if (error) throw error;

      toast({
        title: "Damage reported",
        description: "Your vehicle damage report has been submitted",
      });

      // Reset form
      setDamageDescription("");
      setDamageLocation("");
      setDamageTime(new Date().toISOString().slice(0, 16));
      setGarageEstimate("");
      setDamagePhoto(null);
      setShowDamageDialog(false);
    } catch (error: any) {
      toast({
        title: "Error reporting damage",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmittingDamage(false);
    }
  };

  const handleUpdateVehicle = async () => {
    if (!sessionId) return;

    setIsUpdatingVehicle(true);
    try {
      const { error } = await supabase
        .from("onboarding_sessions")
        .update({
          vehicle_ownership_type: vehicleInfo.ownership_type,
          vehicle_make: vehicleInfo.make,
          vehicle_model: vehicleInfo.model,
          vehicle_year: vehicleInfo.year,
          vehicle_registration: vehicleInfo.registration
        })
        .eq("id", sessionId);

      if (error) throw error;

      toast({
        title: "Vehicle updated",
        description: "Your vehicle details have been updated",
      });

      setShowUpdateDialog(false);
    } catch (error: any) {
      toast({
        title: "Error updating vehicle",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUpdatingVehicle(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-primary text-primary-foreground p-4 shadow-md">
        <div className="container mx-auto flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
            className="text-primary-foreground hover:bg-primary-foreground/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Vehicle Management</h1>
        </div>
      </header>

      <main className="container mx-auto p-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5" />
              Vehicle Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Ownership Type</Label>
                <p className="font-medium capitalize">{vehicleInfo.ownership_type}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Make</Label>
                <p className="font-medium">{vehicleInfo.make || "Not set"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Model</Label>
                <p className="font-medium">{vehicleInfo.model || "Not set"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Year</Label>
                <p className="font-medium">{vehicleInfo.year}</p>
              </div>
              <div className="col-span-2">
                <Label className="text-muted-foreground">Registration</Label>
                <p className="font-medium">{vehicleInfo.registration || "Not set"}</p>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex-1">
                    <Edit className="h-4 w-4 mr-2" />
                    Update Vehicle Details
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Update Vehicle Details</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="ownership">Ownership Type</Label>
                      <Select
                        value={vehicleInfo.ownership_type}
                        onValueChange={(value) => setVehicleInfo({ ...vehicleInfo, ownership_type: value })}
                      >
                        <SelectTrigger id="ownership">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lease">Lease</SelectItem>
                          <SelectItem value="own">Own</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="make">Make</Label>
                      <Input
                        id="make"
                        value={vehicleInfo.make}
                        onChange={(e) => setVehicleInfo({ ...vehicleInfo, make: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="model">Model</Label>
                      <Input
                        id="model"
                        value={vehicleInfo.model}
                        onChange={(e) => setVehicleInfo({ ...vehicleInfo, model: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="year">Year</Label>
                      <Input
                        id="year"
                        type="number"
                        value={vehicleInfo.year}
                        onChange={(e) => setVehicleInfo({ ...vehicleInfo, year: parseInt(e.target.value) })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="registration">Registration</Label>
                      <Input
                        id="registration"
                        value={vehicleInfo.registration}
                        onChange={(e) => setVehicleInfo({ ...vehicleInfo, registration: e.target.value })}
                      />
                    </div>

                    <Button
                      onClick={handleUpdateVehicle}
                      disabled={isUpdatingVehicle}
                      className="w-full"
                    >
                      {isUpdatingVehicle ? "Updating..." : "Save Changes"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={showDamageDialog} onOpenChange={setShowDamageDialog}>
                <DialogTrigger asChild>
                  <Button variant="destructive" className="flex-1">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Report Damage
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Report Vehicle Damage</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-muted-foreground">Vehicle Type</Label>
                      <p className="font-medium capitalize">{vehicleInfo.ownership_type === 'own' ? 'Own Vehicle' : 'Leased Vehicle'}</p>
                      <p className="text-sm text-muted-foreground">{vehicleInfo.make} {vehicleInfo.model} ({vehicleInfo.year})</p>
                    </div>

                    <div>
                      <Label htmlFor="location">Damage Location *</Label>
                      <Input
                        id="location"
                        placeholder="e.g., Front bumper, Driver side door, Rear window"
                        value={damageLocation}
                        onChange={(e) => setDamageLocation(e.target.value)}
                      />
                    </div>

                    <div>
                      <Label htmlFor="time">Time of Incident *</Label>
                      <Input
                        id="time"
                        type="datetime-local"
                        value={damageTime}
                        onChange={(e) => setDamageTime(e.target.value)}
                      />
                    </div>

                    <div>
                      <Label htmlFor="damage">Damage Description *</Label>
                      <Textarea
                        id="damage"
                        placeholder="Describe the damage in detail..."
                        value={damageDescription}
                        onChange={(e) => setDamageDescription(e.target.value)}
                        rows={4}
                      />
                    </div>

                    <div>
                      <Label htmlFor="estimate">Garage Estimate (Optional)</Label>
                      <Input
                        id="estimate"
                        placeholder="e.g., £500 - £800"
                        value={garageEstimate}
                        onChange={(e) => setGarageEstimate(e.target.value)}
                      />
                    </div>

                    <div>
                      <Label htmlFor="photo">Upload Photo (Optional)</Label>
                      <Input
                        id="photo"
                        type="file"
                        accept="image/*"
                        onChange={(e) => setDamagePhoto(e.target.files?.[0] || null)}
                      />
                      {damagePhoto && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Selected: {damagePhoto.name}
                        </p>
                      )}
                    </div>

                    <Button
                      onClick={handleReportDamage}
                      disabled={isSubmittingDamage}
                      className="w-full"
                      variant="destructive"
                    >
                      {isSubmittingDamage ? "Submitting..." : "Submit Report"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
