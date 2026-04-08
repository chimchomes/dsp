import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AuthGuard } from "@/components/AuthGuard";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Building2 } from "lucide-react";
import type { Tenant } from "@/contexts/TenantContext";

export default function TenantDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tenant, setTenantData] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});

  useEffect(() => {
    if (id) loadTenantDetail();
  }, [id]);

  const loadTenantDetail = async () => {
    try {
      const { data: t, error } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setTenantData(t as Tenant);
      setEditForm(t);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const saveDetails = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("tenants")
        .update({
          company_name: editForm.company_name,
          trading_name: editForm.trading_name,
          company_number: editForm.company_number,
          vat_registration_number: editForm.vat_registration_number,
          primary_email: editForm.primary_email,
          primary_phone: editForm.primary_phone,
          website: editForm.website,
          address_line_1: editForm.address_line_1,
          address_line_2: editForm.address_line_2,
          address_line_3: editForm.address_line_3,
          address_line_4: editForm.address_line_4,
          city: editForm.city,
          county: editForm.county,
          postcode: editForm.postcode,
          country: editForm.country,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Saved", description: "Tenant details updated." });
      loadTenantDetail();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStatus = async (newStatus: string) => {
    const { error } = await supabase
      .from("tenants")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Updated", description: `Tenant status changed to ${newStatus}.` });
    loadTenantDetail();
  };

  const updateField = (field: string, value: any) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800";
      case "suspended": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (isLoading) {
    return (
      <AuthGuard requireMasterAdmin>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </AuthGuard>
    );
  }

  if (!tenant) {
    return (
      <AuthGuard requireMasterAdmin>
        <div className="p-6 text-center">
          <p className="text-muted-foreground">Tenant not found.</p>
          <Button className="mt-4" onClick={() => navigate("/masteradmin/tenants")}>Back to Tenants</Button>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard requireMasterAdmin>
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/masteradmin/tenants")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">{tenant.company_name}</h1>
                <Badge variant="outline" className={statusColor(tenant.status)}>
                  {tenant.status}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1">{tenant.primary_email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {tenant.status === "active" ? (
              <Button variant="outline" className="border-amber-500 text-amber-700 hover:bg-amber-100" onClick={() => toggleStatus("suspended")}>
                Suspend
              </Button>
            ) : (
              <Button variant="outline" className="border-green-500 text-green-700 hover:bg-green-100" onClick={() => toggleStatus("active")}>
                Activate
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" /> Company Details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input value={editForm.company_name || ""} onChange={e => updateField("company_name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Trading Name</Label>
              <Input value={editForm.trading_name || ""} onChange={e => updateField("trading_name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Company Number</Label>
              <Input value={editForm.company_number || ""} onChange={e => updateField("company_number", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>VAT Number</Label>
              <Input value={editForm.vat_registration_number || ""} onChange={e => updateField("vat_registration_number", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Primary Email</Label>
              <Input value={editForm.primary_email || ""} onChange={e => updateField("primary_email", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={editForm.primary_phone || ""} onChange={e => updateField("primary_phone", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input value={editForm.website || ""} onChange={e => updateField("website", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Address Line 1</Label>
              <Input value={editForm.address_line_1 || ""} onChange={e => updateField("address_line_1", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Address Line 2</Label>
              <Input value={editForm.address_line_2 || ""} onChange={e => updateField("address_line_2", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={editForm.city || ""} onChange={e => updateField("city", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>County</Label>
              <Input value={editForm.county || ""} onChange={e => updateField("county", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Postcode</Label>
              <Input value={editForm.postcode || ""} onChange={e => updateField("postcode", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={saveDetails} disabled={isSaving} className="gap-2">
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </AuthGuard>
  );
}
