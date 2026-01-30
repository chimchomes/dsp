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
  operator_id: string | null;
  national_insurance: string | null;
}

export default function ProfileScreen() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [driverData, setDriverData] = useState<DriverData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDriver, setIsDriver] = useState(false);

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

      // Check user role to determine which table to query
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (rolesError) throw rolesError;

      const userRoles = roles?.map(r => r.role) || [];
      const userIsDriver = userRoles.includes("driver");
      setIsDriver(userIsDriver);

      if (userIsDriver) {
        // For drivers: driver_profiles is the single source of truth for all data
        const { data: driverProfile, error: driverError } = await supabase
          .from("driver_profiles")
          .select("user_id, first_name, surname, name, email, contact_phone, address_line_1, address_line_2, address_line_3, postcode, emergency_contact_name, emergency_contact_phone, license_number, license_expiry, operator_id, national_insurance")
          .eq("user_id", user.id)
          .single();

        if (driverError) throw driverError;

        // Map driver_profiles data to ProfileData interface
        setProfile({
          user_id: driverProfile.user_id,
          first_name: driverProfile.first_name,
          surname: driverProfile.surname,
          full_name: driverProfile.name || (driverProfile.first_name && driverProfile.surname ? `${driverProfile.first_name} ${driverProfile.surname}` : null),
          email: driverProfile.email,
          contact_phone: driverProfile.contact_phone,
          address_line_1: driverProfile.address_line_1,
          address_line_2: driverProfile.address_line_2,
          address_line_3: driverProfile.address_line_3,
          postcode: driverProfile.postcode,
          emergency_contact_name: driverProfile.emergency_contact_name,
          emergency_contact_phone: driverProfile.emergency_contact_phone,
        });

        // Set driver-specific data
        setDriverData({
          license_number: driverProfile.license_number,
          license_expiry: driverProfile.license_expiry,
          operator_id: driverProfile.operator_id,
          national_insurance: driverProfile.national_insurance,
        });
      } else {
        // For staff (admin, hr, finance): use staff_profiles
        const { data: profileData, error: profileError } = await supabase
          .from("staff_profiles")
          .select("user_id, first_name, surname, full_name, email, contact_phone, address_line_1, address_line_2, address_line_3, postcode, emergency_contact_name, emergency_contact_phone")
          .eq("user_id", user.id)
          .single();

        if (profileError) throw profileError;
        setProfile(profileData);
        setDriverData(null); // Staff don't have driver data
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

              {driverData.national_insurance && (
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">National Insurance</p>
                    <p className="text-muted-foreground">{driverData.national_insurance}</p>
                  </div>
                </div>
              )}

              {driverData.operator_id && (
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Operator ID</p>
                    <p className="text-muted-foreground">{driverData.operator_id}</p>
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
