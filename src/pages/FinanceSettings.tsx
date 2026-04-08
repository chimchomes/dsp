import { useNavigate } from "react-router-dom";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Building2, Loader2 } from "lucide-react";
import { useTenant } from "@/contexts/TenantContext";

const FinanceSettings = () => {
  const navigate = useNavigate();
  const { tenant, isLoading } = useTenant();

  if (isLoading) {
    return (
      <AuthGuard allowedRoles={["admin", "finance"]}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AuthGuard>
    );
  }

  const field = (label: string, value: string | null | undefined) => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground uppercase tracking-wide">{label}</Label>
      <div className="text-sm font-medium text-foreground min-h-[1.5rem]">
        {value || <span className="text-muted-foreground italic">Not set</span>}
      </div>
    </div>
  );

  const addressParts = [
    tenant?.address_line_1,
    tenant?.address_line_2,
    tenant?.address_line_3,
    tenant?.address_line_4,
    tenant?.city,
    tenant?.county,
    tenant?.postcode,
    tenant?.country,
  ].filter(Boolean).join(", ");

  return (
    <AuthGuard allowedRoles={["admin", "finance"]}>
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/finance")}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Finance
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Building2 className="h-8 w-8 text-primary" /> Company Details
              </h1>
              <p className="text-muted-foreground mt-1">
                Company information used on reports and PDF exports
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>
                These details are managed by the platform administrator and appear on generated reports
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                {field("Company Name", tenant?.company_name)}
                {field("Trading Name", tenant?.trading_name)}
                {field("Company Number", tenant?.company_number)}
                {field("VAT Registration Number", tenant?.vat_registration_number)}
                {field("Primary Email", tenant?.primary_email)}
                {field("Phone", tenant?.primary_phone)}
                {field("Website", tenant?.website)}
              </div>

              <div className="border-t pt-4 space-y-4">
                <Label className="text-sm font-semibold">Registered Address</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  {field("Address Line 1", tenant?.address_line_1)}
                  {field("Address Line 2", tenant?.address_line_2)}
                  {field("Address Line 3", tenant?.address_line_3)}
                  {field("Address Line 4", tenant?.address_line_4)}
                  {field("City", tenant?.city)}
                  {field("County", tenant?.county)}
                  {field("Postcode", tenant?.postcode)}
                  {field("Country", tenant?.country)}
                </div>
                {addressParts && (
                  <div className="mt-2 p-3 bg-muted/50 rounded-lg">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Full Address (as shown on reports)</Label>
                    <p className="text-sm font-medium mt-1">{addressParts}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AuthGuard>
  );
};

export default FinanceSettings;
