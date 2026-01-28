import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Car, PlayCircle, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import OnboardingFormOwn from "@/components/onboarding/OnboardingFormOwn";

type VehicleType = "own" | "lease" | null;

const Onboarding = () => {
  const [selectedType, setSelectedType] = useState<VehicleType>(null);
  const [existingSession, setExistingSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    checkExistingSession();
  }, []);

  useEffect(() => {
    // If URL has ?type=own|lease, open the form directly
    const qpType = (searchParams.get("type") as VehicleType) || null;
    if (qpType === "own" || qpType === "lease") {
      setSelectedType(qpType);
    }

    if (searchParams.get("reset") === "true") {
      setSelectedType(null);
      setExistingSession(null);
      navigate("/onboarding", { replace: true });
    }
  }, [searchParams, navigate]);

  const checkExistingSession = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user || null;
      
      // If user is logged in, check for any existing onboarding session (any status)
      if (user) {
        const { data, error } = await supabase
          .from("onboarding_sessions")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        setExistingSession(data);
        
        // Auto-load form if autoload param is present and session exists
        if (searchParams.get("autoload") === "true" && data) {
          if (data.status === 'accepted') {
            toast({
              title: "Application Accepted",
              description: "Your application has been approved!",
            });
          } else if (data.status === 'rejected') {
            toast({
              title: "Application Rejected",
              description: "Please contact HR for more information.",
              variant: "destructive"
            });
          } else {
            // Auto-load the form for in_progress or submitted
            setSelectedType(data.vehicle_ownership_type as VehicleType);
          }
        }
      }
    } catch (error) {
      console.error("Error checking session:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleContinueSession = () => {
    navigate("/onboarding-login");
  };

  const handleStartNew = async (type: VehicleType) => {
    // Go to account creation with selected type
    navigate(`/create-account?type=${type}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Forms should only be accessible after login
  // Now we use a single unified form regardless of selectedType
  if (selectedType) {
    return <OnboardingFormOwn existingSession={existingSession} />;
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate("/login")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Login
        </Button>
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-foreground mb-2">Driver Onboarding</h1>
          <p className="text-muted-foreground">Let's get you set up for deliveries</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardHeader>
              <div className="flex justify-center mb-4">
                <Car className="h-12 w-12 text-primary" />
              </div>
              <CardTitle className="text-center text-xl">NEW ONBOARDING</CardTitle>
              <CardDescription className="text-center">
                Start your driver onboarding application
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => handleStartNew("own")} className="w-full" size="lg">
                Get Started
              </Button>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>• Complete personal information</li>
                <li>• Upload required documents</li>
                <li>• Complete driver verification</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardHeader>
              <div className="flex justify-center mb-4">
                <PlayCircle className="h-12 w-12 text-primary" />
              </div>
              <CardTitle className="text-center text-xl">Continue Application</CardTitle>
              <CardDescription className="text-center">
                Log in to continue your saved application
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleContinueSession} 
                className="w-full" 
                size="lg"
              >
                Continue
              </Button>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>• Pick up where you left off</li>
                <li>• All progress saved</li>
                <li>• Complete at your own pace</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
