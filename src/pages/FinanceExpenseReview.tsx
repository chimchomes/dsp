import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AuthGuard } from "@/components/AuthGuard";
import { ArrowLeft } from "lucide-react";

const FinanceExpenseReview = () => {
  const navigate = useNavigate();

  return (
    <AuthGuard allowedRoles={["route-admin", "admin", "finance"]}>
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/finance")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Finance
            </Button>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
};

export default FinanceExpenseReview;
