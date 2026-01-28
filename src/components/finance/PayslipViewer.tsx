import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Download, FileText } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PayslipData {
  driver_details: {
    id: string;
    name: string;
    email: string;
  };
  period: {
    start: string;
    end: string;
  };
  performance: {
    total_packages_completed: number;
    applied_rate: number;
  };
  financial: {
    gross_pay: number;
    total_deductions: number;
    net_pay: number;
  };
  breakdown: {
    earnings_from_parcels: number;
    default_deductions: number;
  };
  generated_at: string;
}

interface PayslipViewerProps {
  driverId?: string;
  driverName?: string;
}

export const PayslipViewer = ({ driverId, driverName }: PayslipViewerProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [payslip, setPayslip] = useState<PayslipData | null>(null);
  const [periodStart, setPeriodStart] = useState(() => {
    const date = new Date();
    date.setDate(1); // First day of current month
    return date.toISOString().split('T')[0];
  });
  const [periodEnd, setPeriodEnd] = useState(() => {
    const date = new Date();
    return date.toISOString().split('T')[0];
  });
  const [selectedDriverId, setSelectedDriverId] = useState<string>(driverId || "");
  const [drivers, setDrivers] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (!driverId) {
      loadDrivers();
    }
  }, [driverId]);

  const loadDrivers = async () => {
    try {
      const { data, error } = await supabase
        .from("drivers")
        .select("id, name")
        .eq("active", true)
        .order("name");

      if (error) throw error;
      setDrivers(data || []);
    } catch (error: any) {
      console.error("Error loading drivers:", error);
    }
  };

  const generatePayslip = async () => {
    const targetDriverId = driverId || selectedDriverId;
    if (!targetDriverId) {
      toast({
        title: "Error",
        description: "Please select a driver",
        variant: "destructive",
      });
      return;
    }

    if (!periodStart || !periodEnd) {
      toast({
        title: "Error",
        description: "Please select a date range",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-payslip", {
        body: {
          driver_id: targetDriverId,
          period_start_date: periodStart,
          period_end_date: periodEnd,
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setPayslip(data);
      toast({
        title: "Success",
        description: "Payslip generated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to generate payslip",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Generate Payslip</CardTitle>
          <CardDescription>
            Generate a payslip for a driver based on completed parcels and deductions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!driverId && (
            <div>
              <Label htmlFor="driver">Select Driver</Label>
              <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a driver" />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="period_start">Period Start</Label>
              <Input
                id="period_start"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="period_end">Period End</Label>
              <Input
                id="period_end"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
          </div>

          <Button onClick={generatePayslip} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Generate Payslip
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {payslip && (
        <Card className="print:shadow-none">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>Payslip</CardTitle>
                <CardDescription>
                  {formatDate(payslip.period.start)} - {formatDate(payslip.period.end)}
                </CardDescription>
              </div>
              <div className="flex gap-2 print:hidden">
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Download className="mr-2 h-4 w-4" />
                  Print
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Driver Details */}
            <div>
              <h3 className="font-semibold text-lg mb-2">Driver Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span>
                  <p className="font-medium">{payslip.driver_details.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Email:</span>
                  <p className="font-medium">{payslip.driver_details.email}</p>
                </div>
              </div>
            </div>

            {/* Performance Summary */}
            <div>
              <h3 className="font-semibold text-lg mb-2">Performance Summary</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Total Packages Completed:</span>
                  <p className="font-medium text-lg">{payslip.performance.total_packages_completed}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Rate per Parcel:</span>
                  <p className="font-medium text-lg">{formatCurrency(payslip.performance.applied_rate)}</p>
                </div>
              </div>
            </div>

            {/* Financial Breakdown */}
            <div>
              <h3 className="font-semibold text-lg mb-4">Financial Breakdown</h3>
              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Earnings from Parcels:</span>
                  <span className="font-medium">{formatCurrency(payslip.breakdown.earnings_from_parcels)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Default Deductions:</span>
                  <span className="font-medium text-red-600">
                    -{formatCurrency(payslip.breakdown.default_deductions)}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b-2 border-primary">
                  <span className="text-muted-foreground">Gross Pay:</span>
                  <span className="font-semibold">{formatCurrency(payslip.financial.gross_pay)}</span>
                </div>
                <div className="flex justify-between py-3 bg-muted rounded-lg px-4">
                  <span className="font-bold text-lg">Net Pay:</span>
                  <span className="font-bold text-lg text-primary">
                    {formatCurrency(payslip.financial.net_pay)}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="text-xs text-muted-foreground text-center pt-4 border-t">
              <p>Generated on {formatDate(payslip.generated_at)}</p>
              <p className="mt-1">This is a computer-generated document.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

