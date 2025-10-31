import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

export default function CreateOnboardingAccount() {
  const [isCreating, setIsCreating] = useState(false);
  const [role, setRole] = useState<string>("");
  const [password, setPassword] = useState("Password123");
  const [createdAccount, setCreatedAccount] = useState<{ email: string; password: string; role: string } | null>(null);

  const createAccount = async () => {
    if (!role) {
      toast({
        title: "Error",
        description: "Please select a role",
        variant: "destructive"
      });
      return;
    }

    if (!password || password.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive"
      });
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-onboarding-account', {
        body: {
          role,
          password
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Account created! Email: ${data.email}, Password: ${password}`
      });
      
      console.log('Account created:', data);
      
      // Store created account details
      setCreatedAccount({
        email: data.email,
        password: password,
        role: role
      });
      
      // Reset form
      setRole("");
      setPassword("Password123");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
      console.error('Error creating account:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold mb-6">Create Account</h1>
        
        {createdAccount && (
          <div className="mb-6 p-4 bg-primary/10 border border-primary rounded-md">
            <h2 className="font-semibold text-lg mb-2">Account Created Successfully!</h2>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Email:</span> <span className="text-primary">{createdAccount.email}</span>
              </div>
              <div>
                <span className="font-medium">Password:</span> <span className="text-primary">{createdAccount.password}</span>
              </div>
              <div>
                <span className="font-medium">Role:</span> <span className="text-primary capitalize">{createdAccount.role}</span>
              </div>
            </div>
          </div>
        )}
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="role">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="driver">Driver</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="dispatcher">Dispatcher</SelectItem>
                <SelectItem value="finance">Finance</SelectItem>
                <SelectItem value="hr">HR</SelectItem>
                <SelectItem value="onboarding">Onboarding</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
            />
          </div>

          <Button onClick={createAccount} disabled={isCreating} className="w-full">
            {isCreating ? "Creating..." : "Create Account"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
