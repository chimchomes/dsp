import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { UserPlus } from "lucide-react";

export default function CreateTestOnboardingAccount() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("tomsmith@gmail.com");
  const [fullName, setFullName] = useState("Tom Smith");
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("create-onboarding-account", {
        body: { email, fullName }
      });

      if (error) throw error;

      if (data.exists) {
        toast({ 
          title: "Account already exists", 
          description: "This email is already registered. You can log in with password: Password123" 
        });
      } else {
        toast({ 
          title: "Account created successfully", 
          description: "Email: " + email + " | Password: Password123 (must be changed on first login)" 
        });
      }

      // Redirect to login page after a short delay
      setTimeout(() => navigate("/onboarding-login"), 2000);
    } catch (error: any) {
      console.error("Error creating account:", error);
      toast({ 
        title: "Error creating account", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="rounded-full p-3 bg-primary/10">
              <UserPlus className="w-8 h-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-center">Create Test Onboarding Account</CardTitle>
          <CardDescription className="text-center">
            Create a test account for onboarding with default password
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateAccount} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                Default password: <span className="font-mono font-semibold">Password123</span>
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                User will be prompted to change password on first login
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Account"}
            </Button>

            <Button 
              type="button" 
              variant="outline" 
              className="w-full" 
              onClick={() => navigate("/onboarding")}
            >
              Back to Onboarding
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
