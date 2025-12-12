import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PayslipViewer } from "@/components/finance/PayslipViewer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Earning {
  id: string;
  week_start_date: string;
  week_end_date: string;
  gross_amount: number;
  route_count: number;
}

interface Deduction {
  id: string;
  amount: number;
  deduction_type: string;
  reason: string;
  created_at: string;
}

export default function EarningsScreen() {
  const navigate = useNavigate();
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [totalDeductions, setTotalDeductions] = useState(0);
  const [driverId, setDriverId] = useState<string>("");
  
  // Default to last 30 days
  const getDefaultDates = () => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    };
  };
  
  const defaults = getDefaultDates();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  const filterDataByPeriod = (earningsData: Earning[], deductionsData: Deduction[]) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Set time to include full day range
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const filteredEarnings = earningsData.filter(e => {
      const date = new Date(e.week_start_date);
      return date >= start && date <= end;
    });
    
    const filteredDeductions = deductionsData.filter(d => {
      const date = new Date(d.created_at);
      return date >= start && date <= end;
    });

    const total = filteredEarnings.reduce((sum, e) => sum + Number(e.gross_amount), 0);
    const totalDed = filteredDeductions.reduce((sum, d) => sum + Number(d.amount), 0);

    setTotalEarnings(total);
    setTotalDeductions(totalDed);
  };

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: driverData } = await supabase
        .from("drivers")
        .select("id")
        .eq("email", user.email)
        .single();

      if (!driverData) return;

      setDriverId(driverData.id);

      // Load earnings
      const { data: earningsData, error: earningsError } = await supabase
        .from("earnings")
        .select("*")
        .eq("driver_id", driverData.id)
        .order("week_start_date", { ascending: false });

      if (earningsError) throw earningsError;
      setEarnings(earningsData || []);

      // Load deductions
      const { data: deductionsData, error: deductionsError } = await supabase
        .from("deductions")
        .select("*")
        .eq("driver_id", driverData.id)
        .order("created_at", { ascending: false });

      if (deductionsError) throw deductionsError;
      setDeductions(deductionsData || []);
      
      // Filter based on selected date range
      filterDataByPeriod(earningsData || [], deductionsData || []);

    } catch (error: any) {
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-primary text-primary-foreground p-4 shadow-md">
        <div className="container mx-auto flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
            className="text-primary-foreground hover:bg-primary-foreground/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Earnings & Deductions</h1>
        </div>
      </header>

      <main className="container mx-auto p-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Select Time Period</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">£{totalEarnings.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Deductions</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">£{totalDeductions.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Amount</CardTitle>
              <DollarSign className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">£{(totalEarnings - totalDeductions).toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Weekly Earnings</CardTitle>
          </CardHeader>
          <CardContent>
            {earnings.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No earnings recorded yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Week Starting</TableHead>
                    <TableHead>Week Ending</TableHead>
                    <TableHead>Routes</TableHead>
                    <TableHead className="text-right">Gross Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {earnings.map((earning) => (
                    <TableRow key={earning.id}>
                      <TableCell>{new Date(earning.week_start_date).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(earning.week_end_date).toLocaleDateString()}</TableCell>
                      <TableCell>{earning.route_count}</TableCell>
                      <TableCell className="text-right">£{Number(earning.gross_amount).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Deductions</CardTitle>
          </CardHeader>
          <CardContent>
            {deductions.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No deductions recorded</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deductions.map((deduction) => (
                    <TableRow key={deduction.id}>
                      <TableCell>{new Date(deduction.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="capitalize">{deduction.deduction_type}</TableCell>
                      <TableCell>{deduction.reason}</TableCell>
                      <TableCell className="text-right text-red-600">-£{Number(deduction.amount).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>View Payslip</CardTitle>
          </CardHeader>
          <CardContent>
            {driverId ? (
              <PayslipViewer driverId={driverId} />
            ) : (
              <p className="text-muted-foreground text-center py-4">Loading driver information...</p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
