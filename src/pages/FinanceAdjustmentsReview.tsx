import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Search, Filter, Edit2, Save, X } from "lucide-react";
import { AuthGuard } from "@/components/AuthGuard";

interface AdjustmentDetail {
  id: string;
  invoice_number: string;
  invoice_date: string;
  period_start: string;
  period_end: string;
  adjustment_date: string;
  operator_id: string | null;
  tour: string | null;
  parcel_id: string | null;
  adjustment_type: string;
  adjustment_amount: number;
  description: string | null;
  driver_name?: string;
}

const FinanceAdjustmentsReview = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [adjustments, setAdjustments] = useState<AdjustmentDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoiceNumbers, setInvoiceNumbers] = useState<string[]>([]);
  const [drivers, setDrivers] = useState<{ id: string; name: string; operator_id: string | null }[]>([]);
  
  // Filters
  const [invoiceNumberFilter, setInvoiceNumberFilter] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [driverFilter, setDriverFilter] = useState<string>("");

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    operator_id: string;
    parcel_id: string;
  }>({ operator_id: "", parcel_id: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAdjustments();
    loadInvoiceNumbers();
    loadDrivers();
  }, []);

  const loadInvoiceNumbers = async () => {
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("invoice_number")
        .order("invoice_number", { ascending: false });

      if (error) throw error;
      setInvoiceNumbers(data?.map((inv) => inv.invoice_number) || []);
    } catch (error: any) {
      console.error("Error loading invoice numbers:", error);
    }
  };

  const loadDrivers = async () => {
    try {
      const { data, error } = await supabase
        .from("driver_profiles")
        .select("id, name, operator_id")
        .order("name", { ascending: true });

      if (error) throw error;
      setDrivers(data || []);
    } catch (error: any) {
      console.error("Error loading drivers:", error);
    }
  };

  const loadAdjustments = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("ADJUSTMENT_DETAIL")
        .select("*")
        .order("adjustment_date", { ascending: false });

      // Apply filters
      if (invoiceNumberFilter) {
        query = query.eq("invoice_number", invoiceNumberFilter);
      }

      if (dateFilter) {
        query = query.eq("adjustment_date", dateFilter);
      }

      if (driverFilter) {
        query = query.eq("operator_id", driverFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Enrich with driver names
      const adjustmentsWithDrivers = (data || []).map((adj) => {
        const driver = drivers.find((d) => d.operator_id === adj.operator_id);
        return {
          ...adj,
          driver_name: adj.operator_id 
            ? (driver?.name || "Unknown")
            : "Unknown",
        };
      });

      setAdjustments(adjustmentsWithDrivers);
    } catch (error: any) {
      toast({
        title: "Error loading adjustments",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (drivers.length > 0 || invoiceNumberFilter || dateFilter || driverFilter) {
      loadAdjustments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceNumberFilter, dateFilter, driverFilter, drivers.length]);

  const handleClearFilters = () => {
    setInvoiceNumberFilter("");
    setDateFilter("");
    setDriverFilter("");
  };

  const handleStartEdit = (adjustment: AdjustmentDetail) => {
    setEditingId(adjustment.id);
    setEditValues({
      operator_id: adjustment.operator_id || "",
      parcel_id: adjustment.parcel_id || "",
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValues({ operator_id: "", parcel_id: "" });
  };

  const handleSaveEdit = async (adjustment: AdjustmentDetail) => {
    setSaving(true);
    try {
      const updateData: { operator_id?: string | null; parcel_id?: string | null } = {};

      // Only update fields that have changed
      if (editValues.operator_id !== (adjustment.operator_id || "")) {
        updateData.operator_id = editValues.operator_id.trim() || null;
      }
      if (editValues.parcel_id !== (adjustment.parcel_id || "")) {
        updateData.parcel_id = editValues.parcel_id.trim() || null;
      }

      if (Object.keys(updateData).length === 0) {
        // No changes
        setEditingId(null);
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from("ADJUSTMENT_DETAIL")
        .update(updateData)
        .eq("id", adjustment.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Adjustment updated successfully",
      });

      setEditingId(null);
      setEditValues({ operator_id: "", parcel_id: "" });
      loadAdjustments();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getDriverNameForOperatorId = (operatorId: string | null): string => {
    if (!operatorId) return "Unknown";
    const driver = drivers.find((d) => d.operator_id === operatorId);
    return driver?.name || "Unknown";
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-GB");
  };

  const filteredAdjustments = adjustments;

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
                <h1 className="text-3xl font-bold">Adjustments Review</h1>
                <p className="text-muted-foreground mt-1">Review and filter adjustment details</p>
              </div>
            </div>
          </div>

          <Tabs defaultValue="details" className="w-full">
            <TabsList>
              <TabsTrigger value="details">Adjustment Details</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              {/* Filters */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="h-5 w-5" />
                    Filters
                  </CardTitle>
                  <CardDescription>Filter adjustments by invoice number, date, or driver</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="space-y-2">
                      <Label htmlFor="invoice-filter">Invoice Number</Label>
                      <Select 
                        value={invoiceNumberFilter || "all"} 
                        onValueChange={(value) => setInvoiceNumberFilter(value === "all" ? "" : value)}
                      >
                        <SelectTrigger id="invoice-filter">
                          <SelectValue placeholder="All invoices" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All invoices</SelectItem>
                          {invoiceNumbers.map((inv) => (
                            <SelectItem key={inv} value={inv}>
                              {inv}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="date-filter">Adjustment Date</Label>
                      <Input
                        id="date-filter"
                        type="date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        placeholder="Select date"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="driver-filter">Driver</Label>
                      <Select 
                        value={driverFilter || "all"} 
                        onValueChange={(value) => setDriverFilter(value === "all" ? "" : value)}
                      >
                        <SelectTrigger id="driver-filter">
                          <SelectValue placeholder="All drivers" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All drivers</SelectItem>
                          {drivers
                            .filter((driver) => driver.operator_id) // Only show drivers with operator_id
                            .map((driver) => (
                              <SelectItem key={driver.id} value={driver.operator_id!}>
                                {driver.name} ({driver.operator_id})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2 flex items-end">
                      <Button
                        variant="outline"
                        onClick={handleClearFilters}
                        className="w-full"
                      >
                        Clear Filters
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Adjustments Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Adjustment Details</CardTitle>
                  <CardDescription>
                    {filteredAdjustments.length} adjustment{filteredAdjustments.length !== 1 ? "s" : ""} found
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">Loading adjustments...</p>
                    </div>
                  ) : filteredAdjustments.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No adjustments found</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Invoice Number</TableHead>
                            <TableHead>Invoice Date</TableHead>
                            <TableHead>Adjustment Date</TableHead>
                            <TableHead>Driver</TableHead>
                            <TableHead>Operator ID</TableHead>
                            <TableHead>Tour</TableHead>
                            <TableHead>Parcel ID</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="w-24">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredAdjustments.map((adjustment) => {
                            const isEditing = editingId === adjustment.id;
                            const currentDriverName = isEditing 
                              ? getDriverNameForOperatorId(editValues.operator_id || null)
                              : adjustment.driver_name;

                            return (
                              <TableRow key={adjustment.id}>
                                <TableCell className="font-medium">
                                  {adjustment.invoice_number}
                                </TableCell>
                                <TableCell>{formatDate(adjustment.invoice_date)}</TableCell>
                                <TableCell>{formatDate(adjustment.adjustment_date)}</TableCell>
                                <TableCell>
                                  {isEditing ? (
                                    <div className="text-sm font-medium min-w-[120px]">
                                      {currentDriverName}
                                    </div>
                                  ) : (
                                    adjustment.driver_name
                                  )}
                                </TableCell>
                                <TableCell>
                                  {isEditing ? (
                                    <Select
                                      value={editValues.operator_id || "none"}
                                      onValueChange={(value) => {
                                        const newOpId = value === "none" ? "" : value;
                                        setEditValues({ ...editValues, operator_id: newOpId });
                                      }}
                                    >
                                      <SelectTrigger className="w-40 h-8">
                                        <SelectValue placeholder="Select operator" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        {drivers
                                          .filter((d) => d.operator_id)
                                          .map((driver) => (
                                            <SelectItem key={driver.id} value={driver.operator_id!}>
                                              {driver.operator_id} - {driver.name}
                                            </SelectItem>
                                          ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    adjustment.operator_id || "N/A"
                                  )}
                                </TableCell>
                                <TableCell>{adjustment.tour || "N/A"}</TableCell>
                                <TableCell>
                                  {isEditing ? (
                                    <Input
                                      value={editValues.parcel_id}
                                      onChange={(e) => {
                                        setEditValues({ ...editValues, parcel_id: e.target.value.toUpperCase() });
                                      }}
                                      placeholder="Enter Parcel ID"
                                      className="w-32 h-8"
                                    />
                                  ) : (
                                    adjustment.parcel_id || "N/A"
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="font-medium whitespace-nowrap">
                                    {adjustment.adjustment_type || "N/A"}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  <span className={adjustment.adjustment_amount < 0 ? "text-red-600" : "text-green-600"}>
                                    {formatCurrency(adjustment.adjustment_amount)}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <div className="text-sm text-muted-foreground whitespace-normal max-w-md">
                                    {adjustment.description || "N/A"}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {isEditing ? (
                                    <div className="flex items-center gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() => handleSaveEdit(adjustment)}
                                        disabled={saving}
                                        className="h-8 px-3"
                                      >
                                        <Save className="h-4 w-4 mr-1" />
                                        Save
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleCancelEdit}
                                        disabled={saving}
                                        className="h-8 px-3"
                                      >
                                        <X className="h-4 w-4 mr-1" />
                                        Cancel
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleStartEdit(adjustment)}
                                      className="h-8 px-3"
                                    >
                                      <Edit2 className="h-4 w-4 mr-1" />
                                      Edit
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AuthGuard>
  );
};

export default FinanceAdjustmentsReview;
