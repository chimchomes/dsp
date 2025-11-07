import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { UserPlus, ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const accountSchema = z.object({
  first_name: z.string().min(2, "First name must be at least 2 characters").max(100, "First name is too long"),
  surname: z.string().min(2, "Surname must be at least 2 characters").max(100, "Surname is too long"),
  email: z.string().email("Please enter a valid email address").max(255, "Email is too long"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirm_password: z.string().min(8, "Confirm your password"),
}).refine((vals) => vals.password === vals.confirm_password, {
  path: ["confirm_password"],
  message: "Passwords do not match",
});

type AccountFormData = z.infer<typeof accountSchema>;

export default function CreateOnboardingAccount() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const vehicleType = (searchParams.get("type") || "own") as "own" | "lease";
  const [isLoading, setIsLoading] = useState(false);
  
  const { register, handleSubmit, formState: { errors } } = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
  });

  const onSubmit = async (data: AccountFormData) => {
    setIsLoading(true);

    try {
      // Direct account creation via Edge Function (no email sending)
      const fullName = `${data.first_name} ${data.surname}`.trim();
      const { data: fnData, error: fnError } = await supabase.functions.invoke("create-onboarding-account", {
        body: { email: data.email, fullName, firstName: data.first_name, surname: data.surname, password: data.password },
      });
      if (fnError) throw fnError;

      if (fnData?.exists) {
        toast({ title: "Account already exists", description: "You can log in now." });
      } else {
        toast({ title: "Account created", description: "You can log in with your password." });
      }

      navigate("/onboarding-login", { state: { email: data.email, type: vehicleType, first_name: data.first_name, surname: data.surname } });
    } catch (error: any) {
      console.error("Account creation error:", error);
      toast({ title: "Account creation failed", description: error?.message || "An error occurred. Please try again.", variant: "destructive" });
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name <span className="text-destructive">*</span></Label>
                <Input id="first_name" type="text" placeholder="John" {...register("first_name")} disabled={isLoading} />
                {errors.first_name && (<p className="text-sm text-destructive">{errors.first_name.message}</p>)}
              </div>
              <div className="space-y-2">
                <Label htmlFor="surname">Surname <span className="text-destructive">*</span></Label>
                <Input id="surname" type="text" placeholder="Doe" {...register("surname")} disabled={isLoading} />
                {errors.surname && (<p className="text-sm text-destructive">{errors.surname.message}</p>)}
              </div>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password <span className="text-destructive">*</span></Label>
                <Input id="password" type="password" placeholder="••••••••" {...register("password")} disabled={isLoading} />
                {errors.password && <p className="text-sm text-destructive">{String(errors.password.message)}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirm Password <span className="text-destructive">*</span></Label>
                <Input id="confirm_password" type="password" placeholder="••••••••" {...register("confirm_password")} disabled={isLoading} />
                {errors.confirm_password && <p className="text-sm text-destructive">{String(errors.confirm_password.message)}</p>}
              </div>
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
