import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Upload, Eye, FileText, Search, X } from "lucide-react";

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  period_start: string;
  period_end: string;
  provider: string | null;
  supplier_id: string | null;
  net_total: number | null;
  vat: number | null;
  gross_total: number | null;
  pdf_url: string | null;
  uploaded_at: string;
}

const FinanceInvoices = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, pdf_url")
        .order("invoice_date", { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading invoices",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Derive unique providers from loaded invoices for the filter dropdown
  const uniqueProviders = Array.from(
    new Set(invoices.map((inv) => inv.provider).filter(Boolean))
  ) as string[];

  // Apply client-side filters
  const filteredInvoices = invoices.filter((invoice) => {
    // Text search on invoice number
    if (searchTerm && !invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    // Provider filter
    if (providerFilter !== "all" && invoice.provider !== providerFilter) {
      return false;
    }
    // Date range filter on invoice_date
    if (dateFrom && invoice.invoice_date < dateFrom) {
      return false;
    }
    if (dateTo && invoice.invoice_date > dateTo) {
      return false;
    }
    return true;
  });

  const clearFilters = () => {
    setSearchTerm("");
    setProviderFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  const hasActiveFilters = searchTerm || providerFilter !== "all" || dateFrom || dateTo;

  const handleViewInvoice = async (pdfUrl: string | null) => {
    if (!pdfUrl) {
      toast({
        title: "Error",
        description: "Invoice PDF URL not available.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Extract the file path from the full URL if it's a Supabase public URL
      const urlParts = pdfUrl.split('/delivery-files/');
      let filePath = pdfUrl;
      if (urlParts.length > 1) {
        filePath = urlParts[1];
      }
      
      // Generate a signed URL for secure viewing
      const { data, error } = await supabase.storage
        .from('delivery-files')
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (error) throw error;
      
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      } else {
        // Fallback to direct URL if signed URL not available
        window.open(pdfUrl, "_blank");
      }
    } catch (error) {
      console.error("Error viewing invoice:", error);
      toast({
        title: "Error",
        description: "Failed to load invoice PDF.",
        variant: "destructive",
      });
    }
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
                <h1 className="text-3xl font-bold">Invoices</h1>
                <p className="text-muted-foreground mt-1">
                  View and manage uploaded invoices
                </p>
              </div>
            </div>
            <Button onClick={() => navigate("/finance/invoice-upload")}>
              <Upload className="w-4 h-4 mr-2" />
              Upload Invoice
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
              <CardDescription>
                All uploaded invoices and their details
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="space-y-1">
                  <Label htmlFor="invoice-search" className="text-xs text-muted-foreground">Search Invoice Number</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="invoice-search"
                      placeholder="Search..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Provider</Label>
                  <Select value={providerFilter} onValueChange={setProviderFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Providers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Providers</SelectItem>
                      {uniqueProviders.map((provider) => (
                        <SelectItem key={provider} value={provider}>{provider}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="date-from" className="text-xs text-muted-foreground">Date From</Label>
                  <Input
                    id="date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="date-to" className="text-xs text-muted-foreground">Date To</Label>
                  <Input
                    id="date-to"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>
              {hasActiveFilters && (
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {filteredInvoices.length} of {invoices.length} invoices
                  </p>
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="w-4 h-4 mr-1" />
                    Clear Filters
                  </Button>
                </div>
              )}

              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : filteredInvoices.length === 0 && !hasActiveFilters ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No invoices found</p>
                  <Button onClick={() => navigate("/finance/invoice-upload")}>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload First Invoice
                  </Button>
                </div>
              ) : filteredInvoices.length === 0 && hasActiveFilters ? (
                <div className="text-center py-8">
                  <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No invoices match your filters</p>
                  <Button variant="outline" onClick={clearFilters}>
                    <X className="w-4 h-4 mr-2" />
                    Clear Filters
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice Number</TableHead>
                      <TableHead>Invoice Date</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Net Total</TableHead>
                      <TableHead>VAT@20%</TableHead>
                      <TableHead>Gross Total</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">
                          {invoice.invoice_number}
                        </TableCell>
                        <TableCell>
                          {new Date(invoice.invoice_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {new Date(invoice.period_start).toLocaleDateString()} -{" "}
                          {new Date(invoice.period_end).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{invoice.provider || "N/A"}</TableCell>
                        <TableCell>
                          {invoice.net_total ? `£${invoice.net_total.toFixed(2)}` : "N/A"}
                        </TableCell>
                        <TableCell>
                          {invoice.vat != null ? `£${invoice.vat.toFixed(2)}` : "£0.00"}
                        </TableCell>
                        <TableCell>
                          {invoice.gross_total ? `£${invoice.gross_total.toFixed(2)}` : "N/A"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewInvoice(invoice.pdf_url)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AuthGuard>
  );
};

export default FinanceInvoices;
