import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Plus, Loader2, Receipt, Upload, ExternalLink, PoundSterling,
} from "lucide-react";
import { format } from "date-fns";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string;
  reclaimable_vat: boolean;
  vat_amount: number;
  date: string;
  receipt_url: string | null;
  status: string;
  created_at: string;
}

const EXPENSE_CATEGORIES = [
  "Driver Fuel",
  "Vehicle Maintenance",
  "Insurance",
  "Office Supplies",
  "Rent",
  "Utilities",
  "Equipment",
  "Software",
  "Travel",
  "Marketing",
  "Legal",
  "Accounting",
  "Other",
];

const fmt = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

// ─── Component ──────────────────────────────────────────────────────────────

const FinanceExpenses = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // State
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formCategory, setFormCategory] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formReclaimable, setFormReclaimable] = useState(false);
  const [formDate, setFormDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [formFile, setFormFile] = useState<File | null>(null);

  // Filter state
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from("internal_expenses")
        .select("*")
        .order("date", { ascending: false });

      if (error) throw error;
      setExpenses((data as Expense[]) || []);
    } catch (err: any) {
      console.error("Error loading expenses:", err);
      toast({
        title: "Error loading expenses",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormCategory("");
    setFormAmount("");
    setFormDescription("");
    setFormReclaimable(false);
    setFormDate(format(new Date(), "yyyy-MM-dd"));
    setFormFile(null);
  };

  const handleAddExpense = async () => {
    if (!formCategory || !formAmount || !formDate) {
      toast({
        title: "Missing fields",
        description: "Please fill in Category, Amount, and Date.",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(formAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid positive amount.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!user) throw new Error("User not authenticated");

      // Calculate VAT (20%) if reclaimable
      const vatAmount = formReclaimable ? parseFloat((amount * 0.2).toFixed(2)) : 0;

      // Upload receipt if provided
      let receiptUrl: string | null = null;
      if (formFile) {
        const fileExt = formFile.name.split(".").pop() || "pdf";
        const fileName = `expenses/${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("delivery-files")
          .upload(fileName, formFile, { cacheControl: "3600", upsert: true });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("delivery-files")
          .getPublicUrl(fileName);
        receiptUrl = urlData.publicUrl;
      }

      // Insert expense
      const { error: insertError } = await supabase
        .from("internal_expenses")
        .insert({
          category: formCategory,
          amount,
          description: formDescription,
          reclaimable_vat: formReclaimable,
          vat_amount: vatAmount,
          date: formDate,
          receipt_url: receiptUrl,
          status: "Submitted",
          created_by: user.id,
        });

      if (insertError) throw insertError;

      toast({ title: "Expense added", description: "The expense has been recorded." });
      setDialogOpen(false);
      resetForm();
      await loadExpenses();
    } catch (err: any) {
      console.error("Error adding expense:", err);
      toast({
        title: "Error adding expense",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (expense: Expense) => {
    const newStatus = expense.status === "Submitted" ? "Claimed" : "Submitted";
    try {
      const { error } = await supabase
        .from("internal_expenses")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", expense.id);

      if (error) throw error;

      setExpenses((prev) =>
        prev.map((e) => (e.id === expense.id ? { ...e, status: newStatus } : e))
      );

      toast({
        title: "Status updated",
        description: `Expense marked as ${newStatus}.`,
      });
    } catch (err: any) {
      toast({
        title: "Error updating status",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  // Filter expenses
  const filteredExpenses =
    filterStatus === "all"
      ? expenses
      : expenses.filter((e) => e.status === filterStatus);

  // Summary calculations
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalReclaimable = expenses
    .filter((e) => e.reclaimable_vat)
    .reduce((s, e) => s + Number(e.vat_amount), 0);
  const totalNonReclaimable = expenses
    .filter((e) => !e.reclaimable_vat)
    .reduce((s, e) => s + Number(e.amount), 0);

  return (
    <AuthGuard allowedRoles={["admin", "finance"]}>
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate("/finance")}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Finance
              </Button>
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-3">
                  <Receipt className="h-8 w-8 text-primary" /> Internal Expenses
                </h1>
                <p className="text-muted-foreground mt-1">
                  Track expenses, manage VAT reclaims, and upload receipts
                </p>
              </div>
            </div>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add Expense
            </Button>
          </div>

          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Expenses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fmt(totalExpenses)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Reclaimable VAT
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {fmt(totalReclaimable)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Non-Reclaimable Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-muted-foreground">
                  {fmt(totalNonReclaimable)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-4">
            <Label className="text-sm font-medium">Filter by Status:</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Submitted">Submitted</SelectItem>
                <SelectItem value="Claimed">Claimed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Expenses Table */}
          <Card>
            <CardHeader>
              <CardTitle>Expenses</CardTitle>
              <CardDescription>
                {filteredExpenses.length} expense{filteredExpenses.length !== 1 ? "s" : ""} found
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredExpenses.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Receipt className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-semibold">No expenses found</p>
                  <p className="text-sm mt-1">Click "Add Expense" to record your first expense.</p>
                </div>
              ) : (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Reclaimable VAT</TableHead>
                        <TableHead className="text-right">VAT Amount</TableHead>
                        <TableHead>Receipt</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredExpenses.map((expense) => (
                        <TableRow key={expense.id}>
                          <TableCell className="font-medium">
                            {new Date(expense.date).toLocaleDateString("en-GB")}
                          </TableCell>
                          <TableCell>{expense.category}</TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {expense.description || "-"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {fmt(Number(expense.amount))}
                          </TableCell>
                          <TableCell>
                            {expense.reclaimable_vat ? (
                              <Badge variant="default" className="bg-green-600">
                                Yes 20%
                              </Badge>
                            ) : (
                              <Badge variant="secondary">No (0%)</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {fmt(Number(expense.vat_amount))}
                          </TableCell>
                          <TableCell>
                            {expense.receipt_url ? (
                              <a
                                href={expense.receipt_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline inline-flex items-center gap-1"
                              >
                                View <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={expense.status === "Claimed" ? "default" : "outline"}
                              className={expense.status === "Claimed" ? "bg-blue-600" : ""}
                            >
                              {expense.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleStatus(expense)}
                            >
                              {expense.status === "Submitted"
                                ? "Mark Claimed"
                                : "Mark Submitted"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add Expense Dialog */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New Expense</DialogTitle>
                <DialogDescription>
                  Record a new internal expense. If reclaimable, VAT is auto-calculated at 20%.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Category */}
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select value={formCategory} onValueChange={setFormCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Amount */}
                <div className="space-y-2">
                  <Label>Amount (GBP) *</Label>
                  <div className="relative">
                    <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      placeholder="0.00"
                      className="pl-9"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="e.g. Driver fuel for Ahmed"
                    rows={2}
                  />
                </div>

                {/* Reclaimable VAT */}
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <Label className="text-base">Reclaimable VAT</Label>
                    <p className="text-sm text-muted-foreground">
                      Auto-calculates 20% VAT if enabled
                    </p>
                  </div>
                  <Switch
                    checked={formReclaimable}
                    onCheckedChange={setFormReclaimable}
                  />
                </div>

                {/* VAT Preview */}
                {formReclaimable && formAmount && !isNaN(parseFloat(formAmount)) && (
                  <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-3">
                    <p className="text-sm text-green-700 dark:text-green-400">
                      VAT Amount (20%): <strong>{fmt(parseFloat(formAmount) * 0.2)}</strong>
                    </p>
                  </div>
                )}

                {/* Date */}
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                  />
                </div>

                {/* Receipt Upload */}
                <div className="space-y-2">
                  <Label>Receipt Upload</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                      onChange={(e) =>
                        setFormFile(e.target.files?.[0] || null)
                      }
                      className="flex-1"
                    />
                    {formFile && (
                      <Badge variant="outline">
                        <Upload className="h-3 w-3 mr-1" />
                        {formFile.name}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleAddExpense} disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Add Expense
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </AuthGuard>
  );
};

export default FinanceExpenses;
