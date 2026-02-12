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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";

interface SupplierRate {
  id: string;
  rate_id: string;
  provider: string;
  supplier_id: string | null;
  status: string;
  rate: number;
  created_at: string;
  updated_at: string;
}

interface DriverRate {
  id: string;
  driver_id: string;
  rate_id: string;
  rate: number;
  effective_date: string;
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
  const [activeTab, setActiveTab] = useState("supplier-rates");
  
  // Internal Rates state
  const [supplierRates, setSupplierRates] = useState<SupplierRate[]>([]);
  const [supplierRatesLoading, setSupplierRatesLoading] = useState(true);
  const [isSupplierRateDialogOpen, setIsSupplierRateDialogOpen] = useState(false);
  const [editingSupplierRate, setEditingSupplierRate] = useState<SupplierRate | null>(null);
  const [supplierRateFormData, setSupplierRateFormData] = useState({
    rate_id: "",
    provider: "",
    supplier_id: "",
    status: "",
    rate: "",
  });
  
  // Driver Rates state
  const [driverRates, setDriverRates] = useState<DriverRate[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driverRatesLoading, setDriverRatesLoading] = useState(true);
  const [isDriverRateDialogOpen, setIsDriverRateDialogOpen] = useState(false);
  const [editingDriverRate, setEditingDriverRate] = useState<DriverRate | null>(null);
  const [driverRateFormData, setDriverRateFormData] = useState({
    driver_id: "",
    first_name: "",
    surname: "",
    operator_id: "",
    rate_lookup: "", // For rate lookup selection
    rate_id: "",
    rate: "",
  });

  useEffect(() => {
    loadSupplierRates();
    loadDriverRates();
    loadDrivers();
  }, []);

  const loadSupplierRates = async () => {
    try {
      const { data, error } = await supabase
        .from("supplier_rates")
        .select("*")
        .order("provider", { ascending: true })
        .order("rate_id", { ascending: true });

      if (error) throw error;
      setSupplierRates(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading internal rates",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSupplierRatesLoading(false);
    }
  };

  const loadDriverRates = async () => {
    try {
      const { data, error } = await supabase
        .from("driver_rates")
        .select("*")
        .order("effective_date", { ascending: false });

      if (error) throw error;
      setDriverRates(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading driver rates",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDriverRatesLoading(false);
    }
  };

  const loadDrivers = async () => {
    try {
      // Load all drivers from driver_profiles (single source of truth)
      const { data: driversData, error: driversError } = await supabase
        .from("driver_profiles")
        .select("id, name, email, operator_id, user_id, active, first_name, surname")
        .order("name", { ascending: true, nullsLast: true });

      if (driversError) {
        console.error("Error loading drivers:", driversError);
        toast({
          title: "Error loading drivers",
          description: driversError.message,
          variant: "destructive",
        });
        setDrivers([]);
        return;
      }

      if (!driversData || driversData.length === 0) {
        setDrivers([]);
        return;
      }

      // Filter for active drivers client-side
      const activeDrivers = driversData.filter(d => d.active !== false);

      // driver_profiles already contains first_name and surname, no need for separate profile lookup
      const driversWithProfiles = activeDrivers.map(driver => {
        // Get first_name and surname from driver_profiles, or try to parse from name
        let firstName = driver.first_name || null;
        let surname = driver.surname || null;
        
        // Fallback: try to parse from name field
        if ((!firstName || !surname) && driver.name) {
          const nameParts = driver.name.trim().split(/\s+/);
          if (nameParts.length >= 2) {
            firstName = firstName || nameParts[0];
            surname = surname || nameParts.slice(1).join(" ");
          } else if (nameParts.length === 1 && !firstName) {
            firstName = nameParts[0];
          }
        }
        
        return {
          ...driver,
          first_name: firstName,
          surname: surname,
        };
      });

      setDrivers(driversWithProfiles);
    } catch (error: any) {
      console.error("Error in loadDrivers:", error);
      toast({
        title: "Error loading drivers",
        description: error.message || "Failed to load drivers",
        variant: "destructive",
      });
      setDrivers([]);
    }
  };

  // Internal Rates handlers
  const handleOpenSupplierRateDialog = (rate?: SupplierRate) => {
    if (rate) {
      setEditingSupplierRate(rate);
      setSupplierRateFormData({
        rate_id: rate.rate_id,
        provider: rate.provider,
        supplier_id: rate.supplier_id || "",
        status: rate.status,
        rate: rate.rate.toString(),
      });
    } else {
      setEditingSupplierRate(null);
      setSupplierRateFormData({
        rate_id: "",
        provider: "",
        supplier_id: "",
        status: "",
        rate: "",
      });
    }
    setIsSupplierRateDialogOpen(true);
  };

  const handleSubmitSupplierRate = async () => {
    try {
      if (!supplierRateFormData.rate_id || !supplierRateFormData.provider || !supplierRateFormData.status || !supplierRateFormData.rate) {
        toast({
          title: "Validation error",
          description: "Please fill in all required fields including Status",
          variant: "destructive",
        });
        return;
      }

      const rateValue = parseFloat(supplierRateFormData.rate);
      if (isNaN(rateValue) || rateValue < 0) {
        toast({
          title: "Validation error",
          description: "Rate must be a valid positive number",
          variant: "destructive",
        });
        return;
      }

      // Check for duplicate rate_id (skip if editing and rate_id hasn't changed)
      if (!editingSupplierRate || editingSupplierRate.rate_id !== supplierRateFormData.rate_id) {
        const { data: existingRate } = await supabase
          .from("supplier_rates")
          .select("id")
          .eq("rate_id", supplierRateFormData.rate_id)
          .maybeSingle();

        if (existingRate) {
          toast({
            title: "Duplicate Rate ID",
            description: `A rate with ID "${supplierRateFormData.rate_id}" already exists. Rate IDs must be unique.`,
            variant: "destructive",
          });
          return;
        }
      }

      if (editingSupplierRate) {
        const { error } = await supabase
          .from("supplier_rates")
          .update({
            rate_id: supplierRateFormData.rate_id,
            provider: supplierRateFormData.provider,
            supplier_id: supplierRateFormData.supplier_id || null,
            status: supplierRateFormData.status,
            rate: rateValue,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingSupplierRate.id);

        if (error) throw error;

        // Cascade update to driver_rates table
        // This ensures that all drivers linked to this rate_id get the updated rate value
        // which is critical for correct payslip generation.
        const { error: cascadeError } = await supabase
          .from("driver_rates")
          .update({ 
            rate: rateValue,
            updated_at: new Date().toISOString()
          })
          .eq("rate_id", editingSupplierRate.rate_id);

        if (cascadeError) {
          console.error("Error cascading rate update to driver_rates:", cascadeError);
          toast({
            title: "Partial Success",
            description: "Internal rate updated, but failed to sync driver rates. Please check driver rates manually.",
            variant: "destructive",
          });
        } else {
          toast({ title: "Success", description: "Internal rate and linked driver rates updated successfully" });
        }
      } else {
        const { error } = await supabase
          .from("supplier_rates")
          .insert({
            rate_id: supplierRateFormData.rate_id,
            provider: supplierRateFormData.provider,
            supplier_id: supplierRateFormData.supplier_id || null,
            status: supplierRateFormData.status,
            rate: rateValue,
          });

        if (error) throw error;
        toast({ title: "Success", description: "Internal rate created successfully" });
      }

      setIsSupplierRateDialogOpen(false);
      setEditingSupplierRate(null);
      loadSupplierRates();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteSupplierRate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this internal rate?")) return;
    try {
      const { error } = await supabase.from("supplier_rates").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Success", description: "Internal rate deleted successfully" });
      loadSupplierRates();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // Driver Rates handlers
  const handleOpenDriverRateDialog = (rate?: DriverRate) => {
    if (rate) {
      setEditingDriverRate(rate);
      const driver = drivers.find(d => d.id === rate.driver_id);
      // Always use the current internal rate value so that updates to supplier_rates are reflected
      const supplierRate = supplierRates.find(r => r.rate_id === rate.rate_id);
      const currentRate = supplierRate ? supplierRate.rate.toString() : rate.rate.toString();
      setDriverRateFormData({
        driver_id: rate.driver_id,
        first_name: driver?.first_name || "",
        surname: driver?.surname || "",
        operator_id: driver?.operator_id || "",
        rate_lookup: rate.rate_id, // Set rate lookup to rate_id for display
        rate_id: rate.rate_id,
        rate: currentRate,
      });
    } else {
      setEditingDriverRate(null);
      setDriverRateFormData({
        driver_id: "",
        first_name: "",
        surname: "",
        operator_id: "",
        rate_lookup: "",
        rate_id: "",
        rate: "",
      });
    }
    setIsDriverRateDialogOpen(true);
  };

  const handleDriverSelect = async (driverId: string) => {
    const driver = drivers.find(d => d.id === driverId);
    
    // If driver found but first_name/surname missing, try to load profile
    let firstName = driver?.first_name || "";
    let surname = driver?.surname || "";
    
    if ((!firstName || !surname) && driver?.user_id) {
      // Try to load from driver_profiles if missing
      const { data: profile } = await supabase
        .from("driver_profiles")
        .select("first_name, surname")
        .eq("user_id", driver.user_id)
        .single();
      
      if (profile) {
        firstName = profile.first_name || "";
        surname = profile.surname || "";
        
        // Update driver in state for future use
        const updatedDrivers = drivers.map(d => 
          d.id === driverId 
            ? { ...d, first_name: firstName, surname: surname }
            : d
        );
        setDrivers(updatedDrivers);
      }
    }
    
    // Fallback: try to parse from name field if still empty
    if ((!firstName || !surname) && driver?.name) {
      const nameParts = driver.name.trim().split(/\s+/);
      if (nameParts.length >= 2) {
        firstName = nameParts[0];
        surname = nameParts.slice(1).join(" ");
      } else if (nameParts.length === 1) {
        firstName = nameParts[0];
      }
    }
    
    setDriverRateFormData({
      ...driverRateFormData,
      driver_id: driverId,
      first_name: firstName,
      surname: surname,
      operator_id: driver?.operator_id || "",
    });
  };

  const handleRateLookupSelect = (rateId: string) => {
    const supplierRate = supplierRates.find(r => r.rate_id === rateId);
    setDriverRateFormData({
      ...driverRateFormData,
      rate_lookup: rateId,
      rate_id: rateId,
      rate: supplierRate ? supplierRate.rate.toString() : "",
    });
  };

  const handleSubmitDriverRate = async () => {
    try {
      if (!driverRateFormData.driver_id || !driverRateFormData.rate_id || !driverRateFormData.rate) {
        toast({
          title: "Validation error",
          description: "Please fill in all required fields",
          variant: "destructive",
        });
        return;
      }

      const rateValue = parseFloat(driverRateFormData.rate);
      if (isNaN(rateValue) || rateValue < 0) {
        toast({
          title: "Validation error",
          description: "Rate must be a valid positive number",
          variant: "destructive",
        });
        return;
      }

      // Get operator_id from the selected driver
      const selectedDriver = drivers.find(d => d.id === driverRateFormData.driver_id);
      const operatorId = selectedDriver?.operator_id || "";

      if (editingDriverRate) {
        const { error } = await supabase
          .from("driver_rates")
          .update({
            driver_id: driverRateFormData.driver_id,
            rate_id: driverRateFormData.rate_id,
            rate: rateValue,
            operator_id: operatorId,
            effective_date: new Date().toISOString().split('T')[0], // Default to today
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingDriverRate.id);

        if (error) throw error;
        toast({ title: "Success", description: "Driver rate updated successfully" });
      } else {
        const { error } = await supabase
          .from("driver_rates")
          .insert({
            driver_id: driverRateFormData.driver_id,
            rate_id: driverRateFormData.rate_id,
            rate: rateValue,
            operator_id: operatorId,
            effective_date: new Date().toISOString().split('T')[0], // Default to today
          });

        if (error) throw error;
        toast({ title: "Success", description: "Driver rate created successfully" });
      }

      setIsDriverRateDialogOpen(false);
      setEditingDriverRate(null);
      loadDriverRates();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteDriverRate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this driver rate?")) return;
    try {
      const { error } = await supabase.from("driver_rates").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Success", description: "Driver rate deleted successfully" });
      loadDriverRates();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const getDriverName = (driverId: string) => {
    const driver = drivers.find(d => d.id === driverId);
    return driver?.name || driver?.email || driverId;
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
                  Manage internal rates and driver rates
                </p>
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="supplier-rates">Internal Rates</TabsTrigger>
              <TabsTrigger value="driver-rates">Driver Rates</TabsTrigger>
            </TabsList>

            {/* Internal Rates Tab */}
            <TabsContent value="supplier-rates" className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => handleOpenSupplierRateDialog()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Internal Rate
                </Button>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Internal Rates</CardTitle>
                  <CardDescription>
                    Manage internal rates by provider and supplier ID
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {supplierRatesLoading ? (
                    <p className="text-muted-foreground">Loading...</p>
                  ) : supplierRates.length === 0 ? (
                    <p className="text-muted-foreground">No internal rates found. Add your first rate above.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Rate ID</TableHead>
                          <TableHead>Provider</TableHead>
                          <TableHead>Supplier ID</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Rate</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {supplierRates.map((rate) => (
                          <TableRow key={rate.id}>
                            <TableCell className="font-medium">{rate.rate_id}</TableCell>
                            <TableCell>{rate.provider}</TableCell>
                            <TableCell>{rate.supplier_id || "-"}</TableCell>
                            <TableCell>{rate.status}</TableCell>
                            <TableCell>£{rate.rate.toFixed(2)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="sm" onClick={() => handleOpenSupplierRateDialog(rate)}>
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteSupplierRate(rate.id)}>
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Driver Rates Tab */}
            <TabsContent value="driver-rates" className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => handleOpenDriverRateDialog()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Driver Rate
                </Button>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Driver Rates</CardTitle>
                  <CardDescription>
                    Manage driver-specific rates linked to rate IDs
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {driverRatesLoading ? (
                    <p className="text-muted-foreground">Loading...</p>
                  ) : driverRates.length === 0 ? (
                    <p className="text-muted-foreground">No driver rates found. Add your first rate above.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>First Name</TableHead>
                          <TableHead>Surname</TableHead>
                          <TableHead>Operator ID</TableHead>
                          <TableHead>Rate ID</TableHead>
                          <TableHead>Rate</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {driverRates.map((rate) => {
                          const driver = drivers.find(d => d.id === rate.driver_id);
                          // Show the current internal rate if available, otherwise fall back to stored rate
                          const currentSupplierRate = supplierRates.find(r => r.rate_id === rate.rate_id);
                          const displayRate = currentSupplierRate ? currentSupplierRate.rate : rate.rate;
                          return (
                            <TableRow key={rate.id}>
                              <TableCell className="font-medium">{driver?.first_name || "-"}</TableCell>
                              <TableCell>{driver?.surname || "-"}</TableCell>
                              <TableCell>{driver?.operator_id || "-"}</TableCell>
                              <TableCell>{rate.rate_id}</TableCell>
                              <TableCell>£{displayRate.toFixed(2)}</TableCell>
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
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Internal Rate Dialog */}
          <Dialog open={isSupplierRateDialogOpen} onOpenChange={setIsSupplierRateDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingSupplierRate ? "Edit Internal Rate" : "Add New Internal Rate"}</DialogTitle>
                <DialogDescription>
                  {editingSupplierRate ? "Update the internal rate information below." : "Enter the details for the new internal rate."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="sr_rate_id">Rate ID *</Label>
                  <Input
                    id="sr_rate_id"
                    value={supplierRateFormData.rate_id}
                    onChange={(e) => setSupplierRateFormData({ ...supplierRateFormData, rate_id: e.target.value })}
                    placeholder="e.g., SUP001"
                    disabled={!!editingSupplierRate}
                  />
                </div>
                <div>
                  <Label htmlFor="sr_provider">Provider *</Label>
                  <Input
                    id="sr_provider"
                    value={supplierRateFormData.provider}
                    onChange={(e) => setSupplierRateFormData({ ...supplierRateFormData, provider: e.target.value })}
                    placeholder="e.g., YODEL"
                  />
                </div>
                <div>
                  <Label htmlFor="sr_supplier_id">Supplier ID</Label>
                  <Input
                    id="sr_supplier_id"
                    value={supplierRateFormData.supplier_id}
                    onChange={(e) => setSupplierRateFormData({ ...supplierRateFormData, supplier_id: e.target.value })}
                    placeholder="Optional supplier identifier"
                  />
                </div>
                <div>
                  <Label htmlFor="sr_status">Status *</Label>
                  <Input
                    id="sr_status"
                    value={supplierRateFormData.status}
                    onChange={(e) => setSupplierRateFormData({ ...supplierRateFormData, status: e.target.value })}
                    placeholder="e.g., Weekday Rate"
                  />
                </div>
                <div>
                  <Label htmlFor="sr_rate">Rate (£) *</Label>
                  <Input
                    id="sr_rate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={supplierRateFormData.rate}
                    onChange={(e) => setSupplierRateFormData({ ...supplierRateFormData, rate: e.target.value })}
                    placeholder="e.g., 2.50"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsSupplierRateDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSubmitSupplierRate}>{editingSupplierRate ? "Update" : "Create"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Driver Rate Dialog */}
          <Dialog open={isDriverRateDialogOpen} onOpenChange={setIsDriverRateDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingDriverRate ? "Edit Driver Rate" : "Add New Driver Rate"}</DialogTitle>
                <DialogDescription>
                  {editingDriverRate ? "Update the driver rate information below." : "Enter the details for the new driver rate."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="dr_driver">Driver Lookup</Label>
                  <Select
                    value={driverRateFormData.driver_id}
                    onValueChange={handleDriverSelect}
                    disabled={!!editingDriverRate}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Search and select a driver" />
                    </SelectTrigger>
                    <SelectContent>
                      {drivers.map((driver) => {
                        const displayName = driver.first_name && driver.surname 
                          ? `${driver.first_name} ${driver.surname}`
                          : driver.name || driver.email;
                        return (
                          <SelectItem key={driver.id} value={driver.id}>
                            {displayName} {driver.operator_id ? `(${driver.operator_id})` : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="dr_first_name">First Name</Label>
                    <Input
                      id="dr_first_name"
                      value={driverRateFormData.first_name}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div>
                    <Label htmlFor="dr_surname">Surname</Label>
                    <Input
                      id="dr_surname"
                      value={driverRateFormData.surname}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="dr_operator_id">Operator ID</Label>
                  <Input
                    id="dr_operator_id"
                    value={driverRateFormData.operator_id}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div>
                  <Label htmlFor="dr_rate_lookup">Rate Lookup</Label>
                  <Select
                    value={driverRateFormData.rate_lookup}
                    onValueChange={handleRateLookupSelect}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Search and select a rate" />
                    </SelectTrigger>
                    <SelectContent>
                      {supplierRates.map((rate) => (
                        <SelectItem key={rate.id} value={rate.rate_id}>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold">{rate.rate_id}</span>
                            <span className="text-xs text-muted-foreground">
                              Provider: {rate.provider} | Supplier: {rate.supplier_id || 'N/A'} | Status: {rate.status} | Rate: £{rate.rate.toFixed(2)}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="dr_rate_id">Rate ID</Label>
                  <Input
                    id="dr_rate_id"
                    value={driverRateFormData.rate_id}
                    disabled
                    className="bg-muted"
                    placeholder="Auto-populated from Rate Lookup"
                  />
                </div>
                <div>
                  <Label htmlFor="dr_rate">Rate (£)</Label>
                  <Input
                    id="dr_rate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={driverRateFormData.rate}
                    disabled
                    className="bg-muted"
                    placeholder="Auto-populated from Rate Lookup"
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
