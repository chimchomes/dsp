import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, Eye } from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Driver {
  id: string;
  name: string;
  first_name: string | null;
  surname: string | null;
  email: string;
  license_number: string | null;
  contact_phone: string | null;
  active: boolean | null;
  onboarded_at: string | null;
  created_at: string | null;
}

const DriversTable = () => {
  const { toast } = useToast();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [trainingProgress, setTrainingProgress] = useState<any[]>([]);
  const [showTrainingDialog, setShowTrainingDialog] = useState(false);

  const fetchDrivers = async () => {
    try {
      const { data, error } = await supabase
        .from('driver_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDrivers(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching drivers",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();

    const channel = supabase
      .channel('driver-profiles-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_profiles' },
        () => fetchDrivers()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const toggleDriverStatus = async (driverId: string, currentStatus: boolean | null) => {
    try {
      const { error } = await supabase
        .from('driver_profiles')
        .update({ active: !currentStatus })
        .eq('id', driverId);

      if (error) throw error;

      toast({
        title: "Driver status updated",
        description: `Driver ${!currentStatus ? 'activated' : 'deactivated'} successfully`,
      });
    } catch (error: any) {
      toast({
        title: "Error updating driver",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const viewTrainingProgress = async (driver: Driver) => {
    try {
      const { data, error } = await supabase
        .from('driver_training_progress')
        .select(`
          *,
          training_items (
            title,
            description,
            required
          )
        `)
        .eq('driver_id', driver.id)
        .order('training_items(item_order)');

      if (error) throw error;

      setTrainingProgress(data || []);
      setSelectedDriver(driver);
      setShowTrainingDialog(true);
    } catch (error: any) {
      toast({
        title: "Error fetching training progress",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Helper function to get full name from first_name/surname or fallback to name
  const getFullName = (driver: Driver) => {
    if (driver.first_name && driver.surname) {
      return `${driver.first_name} ${driver.surname}`;
    }
    return driver.name || 'Unknown';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>License</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Onboarded</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drivers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No drivers found
                </TableCell>
              </TableRow>
            ) : (
              drivers.map((driver) => (
                <TableRow key={driver.id}>
                  <TableCell className="font-medium">{getFullName(driver)}</TableCell>
                  <TableCell>{driver.email}</TableCell>
                  <TableCell>{driver.license_number || '-'}</TableCell>
                  <TableCell>{driver.contact_phone || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={driver.active ? "default" : "secondary"}>
                      {driver.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {driver.onboarded_at
                      ? format(new Date(driver.onboarded_at), 'MMM d, yyyy')
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => viewTrainingProgress(driver)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Training
                      </Button>
                      <Button
                        size="sm"
                        variant={driver.active ? "destructive" : "default"}
                        onClick={() => toggleDriverStatus(driver.id, driver.active)}
                      >
                        {driver.active ? (
                          <>
                            <XCircle className="h-4 w-4 mr-1" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Activate
                          </>
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showTrainingDialog} onOpenChange={setShowTrainingDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Training Progress - {selectedDriver ? getFullName(selectedDriver) : ''}</DialogTitle>
            <DialogDescription>
              View training checklist completion status
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {trainingProgress.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No training items assigned to this driver
              </p>
            ) : (
              trainingProgress.map((progress) => (
                <div
                  key={progress.id}
                  className="flex items-start gap-3 p-3 border rounded-lg"
                >
                  <div className="mt-1">
                    {progress.completed ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">{progress.training_items.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {progress.training_items.description}
                    </p>
                    {progress.completed && progress.completed_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Completed on {format(new Date(progress.completed_at), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                  {progress.training_items.required && (
                    <Badge variant="outline" className="text-xs">Required</Badge>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DriversTable;
