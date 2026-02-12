import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, Loader2, Building2 } from "lucide-react";

interface CompanyDetails {
  id?: string;
  company_name: string;
  address: string;
  address_line_1: string;
  address_line_2: string;
  address_line_3: string;
  address_line_4: string;
  postcode: string;
  company_number: string;
  vat_registration_number: string;
}

const emptyDetails: CompanyDetails = {
  company_name: "",
  address: "",
  address_line_1: "",
  address_line_2: "",
  address_line_3: "",
  address_line_4: "",
  postcode: "",
  company_number: "",
  vat_registration_number: "",
};

const FinanceSettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [details, setDetails] = useState<CompanyDetails>(emptyDetails);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCompanyDetails();
  }, []);

  const loadCompanyDetails = async () => {
    try {
      const { data, error } = await supabase
        .from("company_details")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setDetails(data as CompanyDetails);
      }
    } catch (err: any) {
      console.error("Error loading company details:", err);
      toast({
        title: "Error loading company details",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (details.id) {
        // Update existing row
        const { error } = await supabase
          .from("company_details")
          .update({
            company_name: details.company_name,
            address: details.address,
            address_line_1: details.address_line_1,
            address_line_2: details.address_line_2,
            address_line_3: details.address_line_3,
            address_line_4: details.address_line_4,
            postcode: details.postcode,
            company_number: details.company_number,
            vat_registration_number: details.vat_registration_number,
            updated_at: new Date().toISOString(),
          })
          .eq("id", details.id);
        if (error) throw error;
      } else {
        // Insert new row
        const { data, error } = await supabase
          .from("company_details")
          .insert({
            company_name: details.company_name,
            address: details.address,
            address_line_1: details.address_line_1,
            address_line_2: details.address_line_2,
            address_line_3: details.address_line_3,
            address_line_4: details.address_line_4,
            postcode: details.postcode,
            company_number: details.company_number,
            vat_registration_number: details.vat_registration_number,
          })
          .select()
          .single();
        if (error) throw error;
        if (data) setDetails(data as CompanyDetails);
      }

      toast({
        title: "Saved",
        description: "Company details have been saved successfully.",
      });
    } catch (err: any) {
      console.error("Error saving company details:", err);
      toast({
        title: "Error saving",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof CompanyDetails, value: string) => {
    setDetails((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <AuthGuard allowedRoles={["admin", "finance"]}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard allowedRoles={["admin", "finance"]}>
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/finance")}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Finance
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Building2 className="h-8 w-8 text-primary" /> Company Details
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage company information used on reports and PDF exports
              </p>
            </div>
          </div>

          {/* Form */}
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>
                These details appear on generated PDF reports and VAT documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Company Name */}
              <div className="space-y-2">
                <Label htmlFor="company_name">Company Name</Label>
                <Input
                  id="company_name"
                  value={details.company_name}
                  onChange={(e) => handleChange("company_name", e.target.value)}
                  placeholder="e.g. First Distribution Ltd"
                />
              </div>

              {/* Address */}
              <div className="space-y-2">
                <Label htmlFor="address">Full Address</Label>
                <Input
                  id="address"
                  value={details.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  placeholder="e.g. Unit 7 Harlow Mill Bus Ctr Harlow CM20 2DW"
                />
              </div>

              {/* Address Lines */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="address_line_1">Address Line 1</Label>
                  <Input
                    id="address_line_1"
                    value={details.address_line_1}
                    onChange={(e) => handleChange("address_line_1", e.target.value)}
                    placeholder="e.g. Unit 7"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address_line_2">Address Line 2</Label>
                  <Input
                    id="address_line_2"
                    value={details.address_line_2}
                    onChange={(e) => handleChange("address_line_2", e.target.value)}
                    placeholder="e.g. Harlow Mill Bus Ctr"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address_line_3">Address Line 3</Label>
                  <Input
                    id="address_line_3"
                    value={details.address_line_3}
                    onChange={(e) => handleChange("address_line_3", e.target.value)}
                    placeholder="e.g. Harlow"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address_line_4">Address Line 4</Label>
                  <Input
                    id="address_line_4"
                    value={details.address_line_4}
                    onChange={(e) => handleChange("address_line_4", e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>

              {/* Postcode */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="postcode">Postcode</Label>
                  <Input
                    id="postcode"
                    value={details.postcode}
                    onChange={(e) => handleChange("postcode", e.target.value)}
                    placeholder="e.g. CM20 2DW"
                  />
                </div>
              </div>

              {/* Company & VAT Numbers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_number">Company Number</Label>
                  <Input
                    id="company_number"
                    value={details.company_number}
                    onChange={(e) => handleChange("company_number", e.target.value)}
                    placeholder="e.g. 12046020"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vat_registration_number">VAT Registration Number</Label>
                  <Input
                    id="vat_registration_number"
                    value={details.vat_registration_number}
                    onChange={(e) => handleChange("vat_registration_number", e.target.value)}
                    placeholder="e.g. GB331520545"
                  />
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-4">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Company Details
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AuthGuard>
  );
};

export default FinanceSettings;
