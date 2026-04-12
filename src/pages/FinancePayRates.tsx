import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ArrowLeft, Plus, Pencil, Trash2, AlertTriangle, ChevronsUpDown, Check } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { useListPagination } from "@/hooks/useListPagination";
import { ListPaginationBar } from "@/components/ListPaginationBar";

interface TourRate {
  id: string;
  tour_id: string;
  rate: number;
  effective_date: string;
  created_at: string;
  updated_at: string;
}

interface DriverRate {
  id: string;
  driver_id: string;
  rate_id: string;
  rate: number;
  effective_date: string;
  operator_id: string;
  created_at: string;
  updated_at: string;
}

interface Driver {
  id: string;
  name: string | null;
  email: string | null;
  operator_id: string | null;
  first_name: string | null;
  surname: string | null;
}

const FinancePayRates = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("tour-rates");

  // Tour Rates state
  const [tourRates, setTourRates] = useState<TourRate[]>([]);
  const [tourRatesLoading, setTourRatesLoading] = useState(true);
  const [isTourRateDialogOpen, setIsTourRateDialogOpen] = useState(false);
  const [editingTourRate, setEditingTourRate] = useState<TourRate | null>(null);
  const [tourRateForm, setTourRateForm] = useState({ tour_id: "", rate: "", effective_date: "" });
  const [tourComboOpen, setTourComboOpen] = useState(false);
  const [tourSearchValue, setTourSearchValue] = useState("");
  const [availableTours, setAvailableTours] = useState<string[]>([]);

  // Driver Overrides state
  const [driverRates, setDriverRates] = useState<DriverRate[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driverRatesLoading, setDriverRatesLoading] = useState(true);
  const [isDriverRateDialogOpen, setIsDriverRateDialogOpen] = useState(false);
  const [editingDriverRate, setEditingDriverRate] = useState<DriverRate | null>(null);
  const [driverRateForm, setDriverRateForm] = useState({
    driver_id: "", rate: "", effective_date: "",
  });
  const [driverComboOpen, setDriverComboOpen] = useState(false);
  const [driverSearchValue, setDriverSearchValue] = useState("");

  const tourRatesPagination = useListPagination(tourRates, String(tourRates.length));
  const driverRatesPagination = useListPagination(driverRates, String(driverRates.length));

  useEffect(() => {
    loadTourRates();
    loadDriverRates();
    loadDrivers();
    loadAvailableTours();
  }, []);

  // ── Tour Rates ────────────────────────────────────────────────────────────

  const loadTourRates = async () => {
    try {
      const { data, error } = await supabase
        .from("tour_rates")
        .select("*")
        .order("tour_id", { ascending: true })
        .order("effective_date", { ascending: false });
      if (error) throw error;
      setTourRates(data || []);
    } catch (error: any) {
      toast({ title: "Error loading tour rates", description: error.message, variant: "destructive" });
    } finally {
      setTourRatesLoading(false);
    }
  };

  const loadAvailableTours = async () => {
    try {
      const { data, error } = await supabase
        .from("WEEKLY_PAY")
        .select("tour");
      if (error) throw error;
      const tours = [...new Set((data || []).map((r: any) => r.tour).filter(Boolean))].sort();
      setAvailableTours(tours);
    } catch (error: any) {
      console.error("Error loading tours:", error);
    }
  };

  const handleOpenTourRateDialog = (rate?: TourRate) => {
    if (rate) {
      setEditingTourRate(rate);
      setTourRateForm({
        tour_id: rate.tour_id,
        rate: rate.rate.toString(),
        effective_date: rate.effective_date,
      });
      setTourSearchValue(rate.tour_id);
    } else {
      setEditingTourRate(null);
      setTourRateForm({ tour_id: "", rate: "", effective_date: new Date().toISOString().split("T")[0] });
      setTourSearchValue("");
    }
    setTourComboOpen(false);
    setIsTourRateDialogOpen(true);
  };

  const handleSubmitTourRate = async () => {
    try {
      if (!tourRateForm.tour_id || !tourRateForm.rate || !tourRateForm.effective_date) {
        toast({ title: "Validation error", description: "Please fill in all required fields", variant: "destructive" });
        return;
      }
      const rateValue = parseFloat(tourRateForm.rate);
      if (isNaN(rateValue) || rateValue < 0) {
        toast({ title: "Validation error", description: "Rate must be a valid positive number", variant: "destructive" });
        return;
      }

      if (editingTourRate) {
        const { error } = await supabase
          .from("tour_rates")
          .update({
            tour_id: tourRateForm.tour_id,
            rate: rateValue,
            effective_date: tourRateForm.effective_date,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingTourRate.id);
        if (error) throw error;
        toast({ title: "Success", description: "Tour rate updated" });
      } else {
        const { data: authData } = await supabase.auth.getUser();
        const { error } = await supabase.from("tour_rates").insert({
          tour_id: tourRateForm.tour_id,
          rate: rateValue,
          effective_date: tourRateForm.effective_date,
          created_by: authData.user?.id,
        });
        if (error) throw error;
        toast({ title: "Success", description: "Tour rate created" });
      }

      setIsTourRateDialogOpen(false);
      setEditingTourRate(null);
      loadTourRates();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteTourRate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this tour rate?")) return;
    try {
      const { error } = await supabase.from("tour_rates").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Success", description: "Tour rate deleted" });
      loadTourRates();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // ── Driver Overrides ──────────────────────────────────────────────────────

  const loadDriverRates = async () => {
    try {
      const { data, error } = await supabase
        .from("driver_rates")
        .select("*")
        .order("effective_date", { ascending: false });
      if (error) throw error;
      setDriverRates(data || []);
    } catch (error: any) {
      toast({ title: "Error loading driver overrides", description: error.message, variant: "destructive" });
    } finally {
      setDriverRatesLoading(false);
    }
  };

  const loadDrivers = async () => {
    try {
      const { data, error } = await supabase
        .from("driver_profiles")
        .select("id, name, email, operator_id, first_name, surname")
        .eq("active", true)
        .order("name", { ascending: true, nullsLast: true });
      if (error) throw error;
      setDrivers(data || []);
    } catch (error: any) {
      console.error("Error loading drivers:", error);
      setDrivers([]);
    }
  };

  const handleOpenDriverRateDialog = (rate?: DriverRate) => {
    if (rate) {
      setEditingDriverRate(rate);
      setDriverRateForm({
        driver_id: rate.driver_id,
        rate: rate.rate.toString(),
        effective_date: rate.effective_date,
      });
    } else {
      setEditingDriverRate(null);
      setDriverRateForm({
        driver_id: "",
        rate: "",
        effective_date: new Date().toISOString().split("T")[0],
      });
    }
    setDriverSearchValue("");
    setDriverComboOpen(false);
    setIsDriverRateDialogOpen(true);
  };

  const handleSubmitDriverRate = async () => {
    try {
      if (!driverRateForm.driver_id || !driverRateForm.rate || !driverRateForm.effective_date) {
        toast({ title: "Validation error", description: "Please fill in all required fields", variant: "destructive" });
        return;
      }
      const rateValue = parseFloat(driverRateForm.rate);
      if (isNaN(rateValue) || rateValue < 0) {
        toast({ title: "Validation error", description: "Rate must be a valid positive number", variant: "destructive" });
        return;
      }

      const selectedDriver = drivers.find((d) => d.id === driverRateForm.driver_id);
      const operatorId = selectedDriver?.operator_id || "";

      if (editingDriverRate) {
        const { error } = await supabase
          .from("driver_rates")
          .update({
            driver_id: driverRateForm.driver_id,
            rate: rateValue,
            operator_id: operatorId,
            effective_date: driverRateForm.effective_date,
            rate_id: "OVERRIDE",
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingDriverRate.id);
        if (error) throw error;
        toast({ title: "Success", description: "Driver override updated" });
      } else {
        const { error } = await supabase.from("driver_rates").insert({
          driver_id: driverRateForm.driver_id,
          rate: rateValue,
          operator_id: operatorId,
          effective_date: driverRateForm.effective_date,
          rate_id: "OVERRIDE",
        });
        if (error) throw error;
        toast({ title: "Success", description: "Driver override created" });
      }

      setIsDriverRateDialogOpen(false);
      setEditingDriverRate(null);
      loadDriverRates();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteDriverRate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this driver override?")) return;
    try {
      const { error } = await supabase.from("driver_rates").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Success", description: "Driver override deleted" });
      loadDriverRates();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const getDriverDisplayName = (driverId: string) => {
    const driver = drivers.find((d) => d.id === driverId);
    if (!driver) return driverId;
    if (driver.first_name && driver.surname) return `${driver.first_name} ${driver.surname}`;
    return driver.name || driver.email || driverId;
  };

  const getDriverOperatorId = (driverId: string) => {
    return drivers.find((d) => d.id === driverId)?.operator_id || "-";
  };

  return (
    <AuthGuard allowedRoles={["admin", "finance"]}>
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate("/finance")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Finance
              </Button>
              <div>
                <h1 className="text-3xl font-bold">Rates Management</h1>
                <p className="text-muted-foreground mt-1">
                  Manage tour rates (default) and driver overrides
                </p>
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="tour-rates">Tour Rates</TabsTrigger>
              <TabsTrigger value="driver-overrides">Driver Overrides</TabsTrigger>
            </TabsList>

            {/* ── Tour Rates Tab ─────────────────────────────────────────── */}
            <TabsContent value="tour-rates" className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => handleOpenTourRateDialog()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Tour Rate
                </Button>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Tour Rates</CardTitle>
                  <CardDescription>
                    Default pay rate per tour. Each driver on this tour will be paid at this rate unless a driver override exists.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {tourRatesLoading ? (
                    <p className="text-muted-foreground">Loading...</p>
                  ) : tourRates.length === 0 ? (
                    <p className="text-muted-foreground">No tour rates found. Add your first tour rate above.</p>
                  ) : (
                    <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tour</TableHead>
                          <TableHead>Rate (£)</TableHead>
                          <TableHead>Effective Date</TableHead>
                          <TableHead>Updated</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tourRatesPagination.pageItems.map((rate) => (
                          <TableRow key={rate.id}>
                            <TableCell className="font-medium">{rate.tour_id}</TableCell>
                            <TableCell>£{rate.rate.toFixed(2)}</TableCell>
                            <TableCell>{new Date(rate.effective_date).toLocaleDateString("en-GB")}</TableCell>
                            <TableCell>{new Date(rate.updated_at).toLocaleDateString("en-GB")}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="sm" onClick={() => handleOpenTourRateDialog(rate)}>
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteTourRate(rate.id)}>
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <ListPaginationBar
                      className="mt-4"
                      page={tourRatesPagination.page}
                      totalPages={tourRatesPagination.totalPages}
                      totalItems={tourRatesPagination.totalItems}
                      pageSize={tourRatesPagination.pageSize}
                      onPrev={tourRatesPagination.goPrev}
                      onNext={tourRatesPagination.goNext}
                    />
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Driver Overrides Tab ───────────────────────────────────── */}
            <TabsContent value="driver-overrides" className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Driver Overrides</AlertTitle>
                <AlertDescription>
                  Only add an override if a specific driver needs a different rate than their tour's default rate. Most drivers should not need an override.
                </AlertDescription>
              </Alert>
              <div className="flex justify-end">
                <Button onClick={() => handleOpenDriverRateDialog()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Driver Override
                </Button>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Driver Rate Overrides</CardTitle>
                  <CardDescription>
                    These rates take precedence over tour rates for the specified driver
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {driverRatesLoading ? (
                    <p className="text-muted-foreground">Loading...</p>
                  ) : driverRates.length === 0 ? (
                    <p className="text-muted-foreground">No driver overrides found. Tour rates will be used for all drivers.</p>
                  ) : (
                    <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Driver</TableHead>
                          <TableHead>Operator ID</TableHead>
                          <TableHead>Override Rate (£)</TableHead>
                          <TableHead>Effective Date</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {driverRatesPagination.pageItems.map((rate) => (
                          <TableRow key={rate.id}>
                            <TableCell className="font-medium">{getDriverDisplayName(rate.driver_id)}</TableCell>
                            <TableCell>{getDriverOperatorId(rate.driver_id)}</TableCell>
                            <TableCell>£{rate.rate.toFixed(2)}</TableCell>
                            <TableCell>{new Date(rate.effective_date).toLocaleDateString("en-GB")}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="sm" onClick={() => handleOpenDriverRateDialog(rate)}>
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteDriverRate(rate.id)}>
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <ListPaginationBar
                      className="mt-4"
                      page={driverRatesPagination.page}
                      totalPages={driverRatesPagination.totalPages}
                      totalItems={driverRatesPagination.totalItems}
                      pageSize={driverRatesPagination.pageSize}
                      onPrev={driverRatesPagination.goPrev}
                      onNext={driverRatesPagination.goNext}
                    />
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* ── Tour Rate Dialog ──────────────────────────────────────────── */}
          <Dialog open={isTourRateDialogOpen} onOpenChange={setIsTourRateDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingTourRate ? "Edit Tour Rate" : "Add New Tour Rate"}</DialogTitle>
                <DialogDescription>
                  {editingTourRate ? "Update the tour rate." : "Select an existing tour or type a new one."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Tour *</Label>
                  {editingTourRate ? (
                    <Input value={tourRateForm.tour_id} disabled className="bg-muted" />
                  ) : (
                    <Popover open={tourComboOpen} onOpenChange={setTourComboOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={tourComboOpen}
                          className="w-full justify-between font-normal"
                        >
                          {tourRateForm.tour_id || "Search or type a tour..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Type to search or add new..."
                            value={tourSearchValue}
                            onValueChange={(v) => {
                              setTourSearchValue(v);
                              setTourRateForm({ ...tourRateForm, tour_id: v });
                            }}
                          />
                          <CommandList>
                            <CommandEmpty>
                              {tourSearchValue ? (
                                <button
                                  className="w-full px-2 py-1.5 text-sm text-left hover:bg-accent rounded-sm"
                                  onClick={() => {
                                    setTourRateForm({ ...tourRateForm, tour_id: tourSearchValue });
                                    setTourComboOpen(false);
                                  }}
                                >
                                  Add new tour: <span className="font-semibold">{tourSearchValue}</span>
                                </button>
                              ) : (
                                "No tours found"
                              )}
                            </CommandEmpty>
                            <CommandGroup>
                              {availableTours
                                .filter((t) => !tourSearchValue || t.toLowerCase().includes(tourSearchValue.toLowerCase()))
                                .map((t) => (
                                  <CommandItem
                                    key={t}
                                    value={t}
                                    onSelect={() => {
                                      setTourRateForm({ ...tourRateForm, tour_id: t });
                                      setTourSearchValue(t);
                                      setTourComboOpen(false);
                                    }}
                                  >
                                    <Check className={cn("mr-2 h-4 w-4", tourRateForm.tour_id === t ? "opacity-100" : "opacity-0")} />
                                    {t}
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
                <div>
                  <Label>Rate (£) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={tourRateForm.rate}
                    onChange={(e) => setTourRateForm({ ...tourRateForm, rate: e.target.value })}
                    placeholder="e.g. 1.25"
                  />
                </div>
                <div>
                  <Label>Effective Date *</Label>
                  <Input
                    type="date"
                    value={tourRateForm.effective_date}
                    onChange={(e) => setTourRateForm({ ...tourRateForm, effective_date: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsTourRateDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSubmitTourRate}>{editingTourRate ? "Update" : "Create"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* ── Driver Override Dialog ────────────────────────────────────── */}
          <Dialog open={isDriverRateDialogOpen} onOpenChange={setIsDriverRateDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingDriverRate ? "Edit Driver Override" : "Add Driver Override"}</DialogTitle>
                <DialogDescription>
                  {editingDriverRate ? "Update the override rate." : "This rate will take precedence over the tour rate for this driver."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Driver *</Label>
                  {editingDriverRate ? (
                    <Input value={getDriverDisplayName(driverRateForm.driver_id)} disabled className="bg-muted" />
                  ) : (
                    <Popover open={driverComboOpen} onOpenChange={setDriverComboOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={driverComboOpen}
                          className="w-full justify-between font-normal"
                        >
                          {driverRateForm.driver_id
                            ? getDriverDisplayName(driverRateForm.driver_id)
                            : "Search for a driver..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Type name or operator ID..."
                            value={driverSearchValue}
                            onValueChange={setDriverSearchValue}
                          />
                          <CommandList>
                            <CommandEmpty>No driver found</CommandEmpty>
                            <CommandGroup>
                              {drivers
                                .filter((d) => {
                                  if (!driverSearchValue) return true;
                                  const term = driverSearchValue.toLowerCase();
                                  const name = (d.first_name && d.surname ? `${d.first_name} ${d.surname}` : d.name || d.email || "").toLowerCase();
                                  const opId = (d.operator_id || "").toLowerCase();
                                  return name.includes(term) || opId.includes(term);
                                })
                                .map((driver) => {
                                  const displayName = driver.first_name && driver.surname
                                    ? `${driver.first_name} ${driver.surname}`
                                    : driver.name || driver.email || driver.id;
                                  return (
                                    <CommandItem
                                      key={driver.id}
                                      value={driver.id}
                                      onSelect={() => {
                                        setDriverRateForm({ ...driverRateForm, driver_id: driver.id });
                                        setDriverComboOpen(false);
                                      }}
                                    >
                                      <Check className={cn("mr-2 h-4 w-4", driverRateForm.driver_id === driver.id ? "opacity-100" : "opacity-0")} />
                                      {displayName} {driver.operator_id ? `(${driver.operator_id})` : ""}
                                    </CommandItem>
                                  );
                                })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
                <div>
                  <Label>Override Rate (£) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={driverRateForm.rate}
                    onChange={(e) => setDriverRateForm({ ...driverRateForm, rate: e.target.value })}
                    placeholder="e.g. 1.50"
                  />
                </div>
                <div>
                  <Label>Effective Date *</Label>
                  <Input
                    type="date"
                    value={driverRateForm.effective_date}
                    onChange={(e) => setDriverRateForm({ ...driverRateForm, effective_date: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDriverRateDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSubmitDriverRate}>{editingDriverRate ? "Update" : "Create"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </AuthGuard>
  );
};

export default FinancePayRates;
