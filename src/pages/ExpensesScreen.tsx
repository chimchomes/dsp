import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ExpenseForm } from "@/components/ExpenseForm";

interface Driver {
  id: string;
  name: string;
  email: string;
}

interface Expense {
  id: string;
  cost: number;
  reason: string;
  created_at: string;
  receipt_image_url: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_at: string | null;
  rejection_reason: string | null;
}

export default function ExpensesScreen() {
  const navigate = useNavigate();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  useEffect(() => {
    loadDriverAndExpenses();
  }, []);

  const loadDriverAndExpenses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      const { data: driverData, error: driverError } = await supabase
        .from("drivers")
        .select("*")
        .eq("email", user.email)
        .single();

      if (driverError) throw driverError;
      setDriver(driverData);

      const { data: expensesData, error: expensesError } = await supabase
        .from("expenses")
        .select("*")
        .eq("driver_id", driverData.id)
        .order("created_at", { ascending: false });

      if (expensesError) throw expensesError;
      setExpenses(expensesData || []);
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

  const openExpenseModal = () => {
    setShowExpenseModal(true);
  };

  const closeExpenseModal = () => {
    setShowExpenseModal(false);
  };

  const handleExpenseSaved = () => {
    loadDriverAndExpenses();
    closeExpenseModal();
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
          <div>
            <h1 className="text-xl font-bold">My Expenses</h1>
            <p className="text-sm opacity-90">{driver?.name}</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 space-y-6">
        <Button onClick={openExpenseModal} className="w-full md:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Add New Expense
        </Button>

        <div>
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold">Submitted Expenses</h2>
          </div>

          {expenses.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No expenses submitted yet</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {expenses.map((expense) => (
                <Card key={expense.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">${expense.cost.toFixed(2)}</CardTitle>
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
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-muted-foreground">{expense.reason}</p>
                    <p className="text-sm text-muted-foreground">
                      Submitted: {new Date(expense.created_at).toLocaleDateString()}
                    </p>
                    {expense.reviewed_at && (
                      <p className="text-sm text-muted-foreground">
                        Reviewed: {new Date(expense.reviewed_at).toLocaleDateString()}
                      </p>
                    )}
                    {expense.rejection_reason && (
                      <div className="mt-2 p-2 bg-destructive/10 rounded-md">
                        <p className="text-sm text-destructive font-medium">Rejection Reason:</p>
                        <p className="text-sm text-destructive">{expense.rejection_reason}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {showExpenseModal && driver && (
        <ExpenseForm
          driverId={driver.id}
          onClose={closeExpenseModal}
          onSuccess={handleExpenseSaved}
        />
      )}
    </div>
  );
}
