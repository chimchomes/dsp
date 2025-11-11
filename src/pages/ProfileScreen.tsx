import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, User, Mail, Phone, MapPin, AlertCircle } from "lucide-react";
import { NotificationSettings } from "@/components/NotificationSettings";

interface ProfileData {
  user_id: string;
  first_name: string | null;
  surname: string | null;
  full_name: string | null;
  email: string | null;
  contact_phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  address_line_3: string | null;
  postcode: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
}

interface DriverData {
  license_number: string | null;
  license_expiry: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  vehicle_registration: string | null;
}

export default function ProfileScreen() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [driverData, setDriverData] = useState<DriverData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      // Load profile data (personal information) from profiles table
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, first_name, surname, full_name, email, contact_phone, address_line_1, address_line_2, address_line_3, postcode, emergency_contact_name, emergency_contact_phone")
        .eq("user_id", user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Load driver-specific data from drivers table
      const { data: driverRecord, error: driverError } = await supabase
        .from("drivers")
        .select("license_number, license_expiry, vehicle_make, vehicle_model, vehicle_year, vehicle_registration")
        .eq("user_id", user.id)
        .maybeSingle();

      if (driverError && driverError.code !== 'PGRST116') { // PGRST116 is "not found" which is okay
        console.error("Error loading driver data:", driverError);
      } else if (driverRecord) {
        setDriverData(driverRecord);
      }
    } catch (error: any) {
      toast({
        title: "Error loading profile",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!profile) return null;

  const displayName = profile.full_name || 
    (profile.first_name && profile.surname ? `${profile.first_name} ${profile.surname}` : profile.first_name || profile.surname || profile.email || "User");

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
          <div>
            <h1 className="text-xl font-bold">My Profile</h1>
            <p className="text-sm opacity-90">{displayName}</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile.first_name && (
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">First Name</p>
                  <p className="text-muted-foreground">{profile.first_name}</p>
                </div>
              </div>
            )}

            {profile.surname && (
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Surname</p>
                  <p className="text-muted-foreground">{profile.surname}</p>
                </div>
              </div>
            )}

            {displayName && displayName !== profile.first_name && displayName !== profile.surname && (
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Full Name</p>
                  <p className="text-muted-foreground">{displayName}</p>
                </div>
              </div>
            )}

            {profile.email && (
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Email</p>
                  <p className="text-muted-foreground">{profile.email}</p>
                </div>
              </div>
            )}

            {profile.contact_phone && (
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Phone</p>
                  <p className="text-muted-foreground">{profile.contact_phone}</p>
                </div>
              </div>
            )}

            {(profile.address_line_1 || profile.address_line_2 || profile.address_line_3 || profile.postcode) && (
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Address</p>
                  <div className="text-muted-foreground">
                    {profile.address_line_1 && <p>{profile.address_line_1}</p>}
                    {profile.address_line_2 && <p>{profile.address_line_2}</p>}
                    {profile.address_line_3 && <p>{profile.address_line_3}</p>}
                    {profile.postcode && <p>{profile.postcode}</p>}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {(profile.emergency_contact_name || profile.emergency_contact_phone) && (
          <Card>
            <CardHeader>
              <CardTitle>Emergency Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {profile.emergency_contact_name && (
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Name</p>
                    <p className="text-muted-foreground">{profile.emergency_contact_name}</p>
                  </div>
                </div>
              )}

              {profile.emergency_contact_phone && (
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Phone</p>
                    <p className="text-muted-foreground">{profile.emergency_contact_phone}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {driverData && (
          <Card>
            <CardHeader>
              <CardTitle>Driver Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {driverData.license_number && (
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">License Number</p>
                    <p className="text-muted-foreground">{driverData.license_number}</p>
                  </div>
                </div>
              )}

              {driverData.license_expiry && (
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">License Expiry</p>
                    <p className="text-muted-foreground">{new Date(driverData.license_expiry).toLocaleDateString()}</p>
                  </div>
                </div>
              )}

              {(driverData.vehicle_make || driverData.vehicle_model) && (
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Vehicle</p>
                    <p className="text-muted-foreground">
                      {[driverData.vehicle_make, driverData.vehicle_model, driverData.vehicle_year].filter(Boolean).join(" ")}
                    </p>
                  </div>
                </div>
              )}

              {driverData.vehicle_registration && (
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Vehicle Registration</p>
                    <p className="text-muted-foreground">{driverData.vehicle_registration}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <NotificationSettings />
      </main>
    </div>
  );
}
