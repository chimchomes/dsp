import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface TrainingItem {
  id: string;
  title: string;
  description: string | null;
  item_order: number;
  required: boolean | null;
}

const TrainingManagement = () => {
  const { toast } = useToast();
  const [trainingItems, setTrainingItems] = useState<TrainingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState({
    title: "",
    description: "",
    required: true,
  });
  const [isAdding, setIsAdding] = useState(false);

  const fetchTrainingItems = async () => {
    try {
      const { data, error } = await supabase
        .from('training_items')
        .select('*')
        .order('item_order');

      if (error) throw error;
      setTrainingItems(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching training items",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrainingItems();

    const channel = supabase
      .channel('training-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'training_items' },
        () => fetchTrainingItems()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const addTrainingItem = async () => {
    if (!newItem.title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a title for the training item",
        variant: "destructive",
      });
      return;
    }

    setIsAdding(true);
    try {
      const maxOrder = trainingItems.length > 0
        ? Math.max(...trainingItems.map(item => item.item_order))
        : 0;

      const { error } = await supabase
        .from('training_items')
        .insert({
          title: newItem.title,
          description: newItem.description,
          required: newItem.required,
          item_order: maxOrder + 1,
        });

      if (error) throw error;

      toast({
        title: "Training item added",
        description: "New training item has been created successfully",
      });

      setNewItem({ title: "", description: "", required: true });
    } catch (error: any) {
      toast({
        title: "Error adding training item",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  const deleteTrainingItem = async (id: string) => {
    try {
      const { error } = await supabase
        .from('training_items')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Training item deleted",
        description: "Training item has been removed",
      });
    } catch (error: any) {
      toast({
        title: "Error deleting training item",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add New Training Item</CardTitle>
          <CardDescription>Create a new training checklist item for drivers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={newItem.title}
              onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
              placeholder="e.g., Watch Safety Training Video"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={newItem.description}
              onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
              placeholder="Detailed description of the training item"
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="required"
              checked={newItem.required}
              onCheckedChange={(checked) => 
                setNewItem({ ...newItem, required: checked as boolean })
              }
            />
            <Label htmlFor="required" className="cursor-pointer">
              Required for onboarding
            </Label>
          </div>

          <Button onClick={addTrainingItem} disabled={isAdding}>
            {isAdding ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Add Training Item
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Training Items</CardTitle>
          <CardDescription>Manage existing training checklist items</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {trainingItems.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No training items found
              </p>
            ) : (
              trainingItems.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">{item.title}</h4>
                    {item.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {item.description}
                      </p>
                    )}
                    {item.required && (
                      <span className="text-xs text-primary mt-1 inline-block">
                        Required
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteTrainingItem(item.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TrainingManagement;