import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthGuard } from "@/components/AuthGuard";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Building2, User, MapPin } from "lucide-react";

export default function CreateTenant() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    company_name: "",
    trading_name: "",
    company_number: "",
    vat_registration_number: "",
    primary_email: "",
    primary_phone: "",
    website: "",
    address_line_1: "",
    address_line_2: "",
    address_line_3: "",
    address_line_4: "",
    city: "",
    county: "",
    postcode: "",
    country: "United Kingdom",
    admin_first_name: "",
    admin_surname: "",
    admin_email: "",
    admin_password: "",
  });

  const update = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company_name || !form.primary_email) {
      toast({ title: "Validation", description: "Company name and primary email are required.", variant: "destructive" });
      return;
    }
    if (!form.admin_email || !form.admin_password || !form.admin_first_name || !form.admin_surname) {
      toast({ title: "Validation", description: "Initial admin details are required.", variant: "destructive" });
      return;
    }
    if (form.admin_password.length < 8) {
      toast({ title: "Validation", description: "Admin password must be at least 8 characters.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .insert({
          company_name: form.company_name,
          trading_name: form.trading_name || null,
          company_number: form.company_number || null,
          vat_registration_number: form.vat_registration_number || null,
          primary_email: form.primary_email,
          primary_phone: form.primary_phone || null,
          website: form.website || null,
          address_line_1: form.address_line_1 || null,
          address_line_2: form.address_line_2 || null,
          address_line_3: form.address_line_3 || null,
          address_line_4: form.address_line_4 || null,
          city: form.city || null,
          county: form.county || null,
          postcode: form.postcode || null,
          country: form.country,
          status: "active",
        })
        .select()
        .single();

      if (tenantError) throw tenantError;

      const { data: fnData, error: fnError } = await supabase.functions.invoke("create-staff-account", {
        body: {
          email: form.admin_email,
          password: form.admin_password,
          first_name: form.admin_first_name,
          surname: form.admin_surname,
          role: "admin",
          tenant_id: tenant.id,
        },
      });

      if (fnError) {
        let detail = fnError.message;
        try { const body = await (fnError as any).context?.json?.(); if (body?.error) detail = body.error; } catch {}
        toast({
          title: "Tenant created, but admin account failed",
          description: detail || "Could not create initial admin. You can add one later.",
          variant: "destructive",
        });
      } else if (fnData?.error) {
        toast({
          title: "Tenant created, but admin account failed",
          description: fnData.error,
          variant: "destructive",
        });
      } else {
        toast({ title: "Success", description: `${form.company_name} created with initial admin account.` });
      }

      navigate(`/masteradmin/tenants/${tenant.id}`);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthGuard requireMasterAdmin>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/masteradmin/tenants")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Add New Tenant</h1>
            <p className="text-muted-foreground mt-1">Register a new company on the platform</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" /> Company Identity
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Company Name *</Label>
                <Input value={form.company_name} onChange={e => update("company_name", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Trading Name</Label>
                <Input value={form.trading_name} onChange={e => update("trading_name", e.target.value)} placeholder="If different from company name" />
              </div>
              <div className="space-y-2">
                <Label>Company Number</Label>
                <Input value={form.company_number} onChange={e => update("company_number", e.target.value)} placeholder="Companies House number" />
              </div>
              <div className="space-y-2">
                <Label>VAT Registration Number</Label>
                <Input value={form.vat_registration_number} onChange={e => update("vat_registration_number", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Primary Email *</Label>
                <Input type="email" value={form.primary_email} onChange={e => update("primary_email", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Primary Phone</Label>
                <Input value={form.primary_phone} onChange={e => update("primary_phone", e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Website</Label>
                <Input value={form.website} onChange={e => update("website", e.target.value)} placeholder="https://" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" /> Address
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Address Line 1</Label>
                <Input value={form.address_line_1} onChange={e => update("address_line_1", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Address Line 2</Label>
                <Input value={form.address_line_2} onChange={e => update("address_line_2", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Address Line 3</Label>
                <Input value={form.address_line_3} onChange={e => update("address_line_3", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={form.city} onChange={e => update("city", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>County</Label>
                <Input value={form.county} onChange={e => update("county", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Postcode</Label>
                <Input value={form.postcode} onChange={e => update("postcode", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Input value={form.country} onChange={e => update("country", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" /> Initial Admin Account
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input value={form.admin_first_name} onChange={e => update("admin_first_name", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Surname *</Label>
                <Input value={form.admin_surname} onChange={e => update("admin_surname", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" value={form.admin_email} onChange={e => update("admin_email", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Temporary Password *</Label>
                <Input type="password" value={form.admin_password} onChange={e => update("admin_password", e.target.value)} required minLength={8} placeholder="Min 8 characters" />
              </div>
              <p className="text-sm text-muted-foreground md:col-span-2">
                This admin will be required to change their password on first login.
              </p>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate("/masteradmin/tenants")}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Tenant"}
            </Button>
          </div>
        </form>
      </div>
    </AuthGuard>
  );
}
