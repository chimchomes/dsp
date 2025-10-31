import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, Trash2, Calculator } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CostItem {
  id: string;
  description: string;
  amount: number;
  type: "add" | "subtract";
}

export default function CostCalculatorScreen() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CostItem[]>([
    { id: "1", description: "Base Earnings", amount: 0, type: "add" }
  ]);

  const addItem = () => {
    const newItem: CostItem = {
      id: Date.now().toString(),
      description: "",
      amount: 0,
      type: "subtract"
    };
    setItems([...items, newItem]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: keyof CostItem, value: any) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const calculateTotal = () => {
    return items.reduce((total, item) => {
      const amount = Number(item.amount) || 0;
      return item.type === "add" ? total + amount : total - amount;
    }, 0);
  };

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
          <h1 className="text-xl font-bold">Cost Calculator</h1>
        </div>
      </header>

      <main className="container mx-auto p-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Calculate Your Work Costs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item, index) => (
              <div key={item.id} className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label htmlFor={`desc-${item.id}`}>Description</Label>
                  <Input
                    id={`desc-${item.id}`}
                    placeholder="e.g., Fuel, Parking, Maintenance"
                    value={item.description}
                    onChange={(e) => updateItem(item.id, "description", e.target.value)}
                  />
                </div>

                <div className="w-32">
                  <Label htmlFor={`amount-${item.id}`}>Amount (£)</Label>
                  <Input
                    id={`amount-${item.id}`}
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={item.amount || ""}
                    onChange={(e) => updateItem(item.id, "amount", parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="w-32">
                  <Label htmlFor={`type-${item.id}`}>Type</Label>
                  <Select
                    value={item.type}
                    onValueChange={(value) => updateItem(item.id, "type", value)}
                    disabled={index === 0}
                  >
                    <SelectTrigger id={`type-${item.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="add">+ Add</SelectItem>
                      <SelectItem value="subtract">- Subtract</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {index !== 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(item.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}

            <Button onClick={addItem} variant="outline" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Cost Item
            </Button>

            <div className="border-t pt-4 mt-6">
              <div className="flex justify-between items-center text-lg font-semibold">
                <span>Total:</span>
                <span className={calculateTotal() >= 0 ? "text-green-600" : "text-red-600"}>
                  £{calculateTotal().toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cost Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {item.description || "Unnamed item"}
                  </span>
                  <span className={item.type === "add" ? "text-green-600" : "text-red-600"}>
                    {item.type === "add" ? "+" : "-"}£{(item.amount || 0).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
