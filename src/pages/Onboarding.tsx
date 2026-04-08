import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Car, PlayCircle, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import OnboardingFormOwn from "@/components/onboarding/OnboardingFormOwn";

const Onboarding = () => {
  const [showForm, setShowForm] = useState(false);
  const [existingSession, setExistingSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    checkExistingSession();
  }, []);

  useEffect(() => {
    if (searchParams.get("reset") === "true") {
      setShowForm(false);
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
        
        // Auto-load form if requested.
        if (searchParams.get("autoload") === "true" && data) {
          if (data.status === 'accepted') {
            toast({
              title: "Application Accepted",
              description: "Your application has been approved!",
            });
            setShowForm(false);
          } else if (data.status === 'rejected') {
            toast({
              title: "Application Rejected",
              description: "Please review the rejection comments and resubmit your application.",
              variant: "destructive"
            });
            setShowForm(true);
          } else {
            // Auto-load the form for in_progress or submitted
            setShowForm(true);
          }
        } else if (searchParams.get("autoload") === "true" && !data) {
          // Allow starting form even if no persisted session exists yet.
          setShowForm(true);
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

  const handleStartNew = async () => {
    navigate("/create-account");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (showForm) {
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
              <Button onClick={handleStartNew} className="w-full" size="lg">
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
