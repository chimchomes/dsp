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
  const [firstName, setFirstName] = useState("Tom");
  const [surname, setSurname] = useState("Smith");
  const [password, setPassword] = useState("Password123!");
  const [confirmPassword, setConfirmPassword] = useState("Password123!");
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (password !== confirmPassword) {
        throw new Error("Passwords do not match");
      }

      const fullName = `${firstName} ${surname}`.trim();
      const { data, error } = await supabase.functions.invoke("create-onboarding-account", {
        body: { email, fullName, firstName, surname, password }
      });

      if (error) throw error;

      if (data?.exists) {
        toast({ 
          title: "Account already exists", 
          description: "This email is already registered. You can log in now." 
        });
      } else {
        toast({ 
          title: "Account created successfully", 
          description: "You can log in with your password." 
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="surname">Surname</Label>
                  <Input id="surname" type="text" value={surname} onChange={(e) => setSurname(e.target.value)} required />
                </div>
              </div>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
              </div>
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
