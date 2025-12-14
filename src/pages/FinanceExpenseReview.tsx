import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Check, X, Eye, Search, Filter } from "lucide-react";
import { AuthGuard } from "@/components/AuthGuard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Expense {
  id: string;
  driver_id: string;
  cost: number;
  reason: string;
  created_at: string;
  receipt_image_url: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_at: string | null;
  rejection_reason: string | null;
  drivers: {
    name: string;
    email: string;
  };
}

const FinanceExpenseReview = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    try {
      // Fetch all expenses
      const { data: expensesData, error: expensesError } = await supabase
        .from("expenses")
        .select("*")
        .order("created_at", { ascending: false });

      if (expensesError) throw expensesError;

      // Get unique driver IDs
      const driverIds = [...new Set((expensesData || []).map(e => e.driver_id))];
      
      // Fetch all drivers in one query
      const { data: driversData, error: driversError } = await supabase
        .from("drivers")
        .select("id, name, email")
        .in("id", driverIds);

      if (driversError) throw driversError;

      // Create a map of drivers by ID
      const driversMap = (driversData || []).reduce((acc, driver) => {
        acc[driver.id] = driver;
        return acc;
      }, {} as Record<string, { id: string; name: string; email: string }>);

      // Combine expenses with driver data
      const expensesWithDrivers = (expensesData || []).map(expense => ({
        ...expense,
        drivers: driversMap[expense.driver_id] || { name: "Unknown", email: "" }
      }));

      setExpenses(expensesWithDrivers);
    } catch (error) {
      console.error("Error loading expenses:", error);
      toast({
        title: "Error",
        description: "Failed to load expenses",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openReviewDialog = (expense: Expense, action: "approve" | "reject") => {
    setSelectedExpense(expense);
    setReviewAction(action);
    setShowReviewDialog(true);
  };

  const handleReview = async () => {
    if (!selectedExpense || !reviewAction) return;

    if (reviewAction === "reject" && !reviewComment.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      });
      return;
    }

    setProcessingId(selectedExpense.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const updateData: any = {
        status: reviewAction === "approve" ? "approved" : "rejected",
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      };

      if (reviewComment.trim()) {
        updateData.rejection_reason = reviewComment;
      }

      const { error } = await supabase
        .from("expenses")
        .update(updateData)
        .eq("id", selectedExpense.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Expense ${reviewAction === "approve" ? "approved" : "rejected"}`,
      });

      setShowReviewDialog(false);
      setReviewComment("");
      setSelectedExpense(null);
      setReviewAction(null);
      loadExpenses();
    } catch (error) {
      console.error("Error reviewing expense:", error);
      toast({
        title: "Error",
        description: "Failed to review expense",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = searchQuery === "" || 
      expense.drivers.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expense.reason.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || expense.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleViewReceipt = async (receiptUrl: string) => {
    try {
      // Extract the file path from the full URL
      const urlParts = receiptUrl.split('/delivery-files/');
      if (urlParts.length < 2) {
        window.open(receiptUrl, "_blank");
        return;
      }
      
      const filePath = urlParts[1];
      
      // Generate a signed URL for secure viewing
      const { data, error } = await supabase.storage
        .from('delivery-files')
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (error) throw error;
      
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    } catch (error) {
      console.error("Error viewing receipt:", error);
      toast({
        title: "Error",
        description: "Failed to load receipt",
        variant: "destructive",
      });
    }
  };

  const ExpenseReviewCard = ({ expense }: { expense: Expense }) => (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <CardTitle className="text-2xl">${expense.cost.toFixed(2)}</CardTitle>
              <Badge
                variant={
                  expense.status === "approved"
                    ? "default"
                    : expense.status === "rejected"
                    ? "destructive"
                    : "secondary"
                }
              >
                {expense.status.charAt(0).toUpperCase() + expense.status.slice(1)}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">{expense.drivers.name}</p>
            <p className="text-sm text-muted-foreground">{expense.drivers.email}</p>
          </div>
          {expense.receipt_image_url && 
           !expense.receipt_image_url.includes('example.com') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleViewReceipt(expense.receipt_image_url!)}
            >
              <Eye className="mr-2 h-4 w-4" />
              View Receipt
            </Button>
          )}
          {!expense.receipt_image_url && (
            <Badge variant="secondary">No Receipt</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="font-medium text-sm mb-1">Expense Reason:</p>
          <p className="text-foreground">{expense.reason}</p>
        </div>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>Submitted: {new Date(expense.created_at).toLocaleString()}</p>
          {expense.reviewed_at && (
            <p>Reviewed: {new Date(expense.reviewed_at).toLocaleString()}</p>
          )}
        </div>
        {expense.rejection_reason && (
          <div className="p-3 bg-destructive/10 rounded-md border border-destructive/20">
            <p className="text-sm font-medium text-destructive mb-1">Comment:</p>
            <p className="text-sm text-destructive">{expense.rejection_reason}</p>
          </div>
        )}
        {expense.status === "pending" && (
          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => openReviewDialog(expense, "approve")}
              disabled={processingId === expense.id}
              className="flex-1"
            >
              <Check className="mr-2 h-4 w-4" />
              Approve
            </Button>
            <Button
              onClick={() => openReviewDialog(expense, "reject")}
              disabled={processingId === expense.id}
              variant="destructive"
              className="flex-1"
            >
              <X className="mr-2 h-4 w-4" />
              Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <AuthGuard allowedRoles={["route-admin", "admin", "finance"]}>
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate("/finance")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Finance
              </Button>
              <div>
                <h1 className="text-3xl font-bold">Expense Review</h1>
                <p className="text-muted-foreground mt-1">Review and approve driver expense submissions</p>
              </div>
            </div>
          </div>

          {/* Filter Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Filter & Search
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="search">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Search by driver name or reason..."
                      className="pl-8"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="all">All Expenses</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Expenses List */}
          {loading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredExpenses.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                {statusFilter === "pending" ? "No pending expenses to review" : `No ${statusFilter === "all" ? "" : statusFilter} expenses found`}
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredExpenses.map((expense) => (
                <ExpenseReviewCard key={expense.id} expense={expense} />
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "approve" ? "Approve" : "Reject"} Expense
            </DialogTitle>
            <DialogDescription>
              {selectedExpense && (
                <div className="mt-2 space-y-1">
                  <p><strong>Driver:</strong> {selectedExpense.drivers.name}</p>
                  <p><strong>Amount:</strong> ${selectedExpense.cost.toFixed(2)}</p>
                  <p><strong>Reason:</strong> {selectedExpense.reason}</p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="comment">
              {reviewAction === "reject" ? "Rejection Reason (Required)" : "Comment (Optional)"}
            </Label>
            <Textarea
              id="comment"
              placeholder={reviewAction === "reject" 
                ? "Enter reason for rejection..." 
                : "Add any notes or comments..."}
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowReviewDialog(false);
                setReviewComment("");
                setReviewAction(null);
                setSelectedExpense(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              variant={reviewAction === "approve" ? "default" : "destructive"}
              onClick={handleReview}
              disabled={processingId !== null}
            >
              {reviewAction === "approve" ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Approve Expense
                </>
              ) : (
                <>
                  <X className="mr-2 h-4 w-4" />
                  Reject Expense
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AuthGuard>
  );
};

export default FinanceExpenseReview;
