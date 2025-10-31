import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface DriverPayroll {
  driver_id: string;
  driver_name: string;
  gross_earnings: number;
  total_deductions: number;
  net_payout: number;
}

interface PayrollTableProps {
  data: DriverPayroll[];
  loading: boolean;
  onTriggerPayout: (driverId: string) => void;
}

const PayrollTable: React.FC<PayrollTableProps> = ({
  data,
  loading,
  onTriggerPayout,
}) => {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No payroll data available
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Driver Name</TableHead>
          <TableHead className="text-right">Gross Earnings</TableHead>
          <TableHead className="text-right">Deductions</TableHead>
          <TableHead className="text-right">Net Payout</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((driver) => (
          <TableRow key={driver.driver_id}>
            <TableCell className="font-medium">{driver.driver_name}</TableCell>
            <TableCell className="text-right text-green-600">
              ${driver.gross_earnings.toFixed(2)}
            </TableCell>
            <TableCell className="text-right text-red-600">
              -${driver.total_deductions.toFixed(2)}
            </TableCell>
            <TableCell className="text-right font-bold">
              ${driver.net_payout.toFixed(2)}
            </TableCell>
            <TableCell className="text-right">
              <Button
                size="sm"
                onClick={() => onTriggerPayout(driver.driver_id)}
                disabled={driver.net_payout <= 0}
              >
                <DollarSign className="w-4 h-4 mr-1" />
                Process Payout
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default PayrollTable;