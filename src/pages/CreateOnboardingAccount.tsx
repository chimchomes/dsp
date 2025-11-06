import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { UserPlus, Mail, ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const accountSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name is too long"),
  email: z.string().email("Please enter a valid email address").max(255, "Email is too long"),
});

type AccountFormData = z.infer<typeof accountSchema>;

export default function CreateOnboardingAccount() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const vehicleType = searchParams.get("type") || "own";
  const [isLoading, setIsLoading] = useState(false);
  
  const { register, handleSubmit, formState: { errors } } = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
  });

  const onSubmit = async (data: AccountFormData) => {
    setIsLoading(true);

    try {
      // Use signUp instead of edge function for proper email verification
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: crypto.randomUUID() + crypto.randomUUID(), // Temporary password - user will set via email
        options: {
          data: {
            full_name: data.full_name,
            requires_password_change: true,
          },
          emailRedirectTo: `${window.location.origin}/onboarding-login`,
        },
      });

      if (signUpError) throw signUpError;

      if (!signUpData.user) {
        throw new Error("Failed to create account");
      }

      // Note: Role assignment and session creation will happen after email verification
      // The user must verify their email first, then log in to complete onboarding

      toast({
        title: "Account created successfully!",
        description: "Please check your email to verify your account and set your password.",
      });

      // Redirect to login page
      navigate("/onboarding-login", {
        state: { 
          message: "Please check your email to verify your account and set your password.",
          email: data.email,
        },
      });
    } catch (error: any) {
      console.error("Account creation error:", error);
      toast({
        title: "Account creation failed",
        description: error.message || "An error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-lg shadow-xl p-8">
          <div className="flex items-center justify-center mb-6">
            <div className="rounded-full p-3 bg-primary/10">
              <UserPlus className="w-8 h-8 text-primary" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center mb-2">Create Your Account</h1>
          <p className="text-muted-foreground text-center mb-6">
            Start your driver onboarding application by creating an account.
            {vehicleType === "own" ? " (Own Vehicle)" : " (Leased Vehicle)"}
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="full_name"
                type="text"
                placeholder="John Doe"
                {...register("full_name")}
                disabled={isLoading}
              />
              {errors.full_name && (
                <p className="text-sm text-destructive">{errors.full_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                Email Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                {...register("email")}
                disabled={isLoading}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground flex items-start gap-2">
                <Mail className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>
                  We'll send a verification email to confirm your account. 
                  You'll be able to set your password after verification.
                </span>
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              <UserPlus className="mr-2 h-4 w-4" />
              {isLoading ? "Creating account..." : "Create Account"}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => navigate("/onboarding")}
              disabled={isLoading}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Onboarding
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
