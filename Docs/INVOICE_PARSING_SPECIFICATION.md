# Invoice Parsing System - Complete Specification

## 1. Overview

The invoice parsing system extracts data from PDF invoices provided by delivery service providers (YODEL, Royal Mail, DPD, Hermes). The system parses the PDF text, extracts structured data, and stores it in database tables for payroll processing and payslip generation.

**Key Requirements:**
- Parse PDF invoices from multiple providers (YODEL, Royal Mail, DPD, Hermes)
- Extract invoice header information (number, dates, totals)
- Extract weekly pay summary data (aggregated by operator/tour)
- Extract daily pay breakdown data (day-by-day service details)
- Store PDF file in cloud storage
- Insert extracted data into PostgreSQL database tables
- Support client-side PDF parsing using PDF.js

---

## 2. PDF Format Support

### 2.1 Supported Providers
- **YODEL** (Primary)
- **Royal Mail**
- **DPD**
- **Hermes**

### 2.2 PDF Text Extraction Method
- **Library:** PDF.js (pdfjs-dist version 5.4.530)
- **Worker Configuration:** Worker file must be served from public folder at `/pdf.worker.min.mjs`
- **Extraction Method:** Text content extraction (not OCR - PDF must contain selectable text)

### 2.3 Expected PDF Structure

The system expects invoices to contain the following sections:
1. **Invoice Header** - Invoice number, date, supplier ID, provider name
2. **Payment Period** - Start and end dates for the payment period
3. **Week Summary Table** - Aggregated weekly data by operator/tour
4. **Daily Breakdown Table** - Day-by-day service details
5. **Financial Totals** - Net total, VAT, Gross total

---

## 3. Data Extraction Requirements

### 3.1 Invoice Header Data

| Field | Description | Extraction Pattern | Required | Data Type |
|-------|-------------|-------------------|----------|-----------|
| `invoice_number` | Unique invoice identifier | `/Invoice No:?\s*(\d+)/i` or `/Invoice Number:?\s*(\d+)/i` | **YES** | TEXT (digits only) |
| `invoice_date` | Date invoice was issued | `/Date:?\s*(\d{1,2}\s+(?:Jan\|Feb\|Mar\|Apr\|May\|Jun\|Jul\|Aug\|Sep\|Oct\|Nov\|Dec)\s+\d{4})/i` or `/Date:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i` | Yes | DATE (YYYY-MM-DD) |
| `supplier_id` | Supplier identifier | `/Supplier ID:?\s*(\d+)/i` | No | TEXT |
| `provider` | Provider name | `/YODEL\|ROYAL MAIL\|DPD\|HERMES/i` | Yes | TEXT (uppercase) |
| `period_start` | Payment period start date | See section 3.2 | Yes | DATE (YYYY-MM-DD) |
| `period_end` | Payment period end date | See section 3.2 | Yes | DATE (YYYY-MM-DD) |

### 3.2 Payment Period Extraction

**Pattern 1 (Preferred):**
```
/Payment Period:?\s*(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2,4})\s*-\s*(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2,4})/i
```

**Pattern 2 (Alternative):**
```
/(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2,4})\s*-\s*(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2,4})/i
```

**Pattern 3 (Slash format):**
```
/(\d{1,2}\/\d{1,2}\/\d{2,4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i
```

**Date Format Handling:**
- Text dates (e.g., "14 Dec 25"): Parse using `new Date()` constructor
- Slash dates (e.g., "14/12/2025"): Convert DD/MM/YYYY to YYYY-MM-DD
- Two-digit years: Prefix with "20" (e.g., "25" → "2025")
- Default: Use current date if parsing fails

### 3.3 Financial Totals

| Field | Description | Extraction Pattern | Required | Data Type |
|-------|-------------|-------------------|----------|-----------|
| `net_total` | Net total amount | `/Net Total[^\d]*£?\s*([\d,]+\.?\d*)/i` | No | DECIMAL(10,2) |
| `vat` | VAT amount | `/VAT\s*@?\s*[\d.]+%[^\d]*£?\s*([\d,]+\.?\d*)/i` or `/VAT[^\d]*£?\s*([\d,]+\.?\d*)/i` | No | DECIMAL(10,2) |
| `gross_total` | Gross total amount | `/Gross Total[^\d]*£?\s*([\d,]+\.?\d*)/i` | No | DECIMAL(10,2) |

**Parsing Notes:**
- Remove commas from numbers before parsing
- Handle optional £ symbol
- Default to 0 if not found

### 3.4 Weekly Pay Data Extraction

**Location:** Section between "Week Summary" and "Daily Breakdown" (or "Manual Adjustments" or end of document)

**Row Pattern:**
```
/([A-Z]{2}\d{4})\s+([A-Z]{2}\d{2})\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([\d,]+\.?\d*)/
```

**Pattern Breakdown:**
- Group 1: `operator_id` - 2 uppercase letters + 4 digits (e.g., "DB6249")
- Group 2: `tour` - 2 uppercase letters + 2 digits (e.g., "WB43")
- Group 3: `delivered` - Integer (parcels delivered)
- Group 4: `collected` - Integer (parcels collected)
- Group 5: `sacks` - Integer (sacks count)
- Group 6: `packets` - Integer (packets count)
- Group 7: `total` - Decimal amount (may contain commas)

**Example Row:**
```
DB6249 WB43 64 2 0 16 102.50
```

**Extracted Data:**
```javascript
{
  operator_id: "DB6249",
  tour: "WB43",
  delivered: 64,
  collected: 2,
  sacks: 0,
  packets: 16,
  total: 102.50
}
```

**Validation:**
- Skip rows where operator_id is "Total"
- Parse all numeric fields (default to 0 if parsing fails)
- Remove commas from total amount

### 3.5 Daily Pay Data Extraction

**Location:** Section between "Daily Breakdown" and "Manual Adjustments" (or totals section or end of document)

**Day Header Pattern:**
```
/(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\s+(\d{1,2}\/\d{1,2}\/\d{4})/gi
```

**Service Row Pattern (within each day):**
```
/([A-Z]{2}\d{2})\s+([A-Z]{2}\d{4})\s+([A-Za-z\s\/]+?)\s+(\d+)\s+\d+\s*@\s*([\d.]+)\s+([\d,]+\.?\d*)/
```

**Pattern Breakdown:**
- Group 1: `tour` - 2 uppercase letters + 2 digits (e.g., "WB68")
- Group 2: `operator_id` - 2 uppercase letters + 4 digits (e.g., "DB6249")
- Group 3: `service_group` - Alphanumeric service description (e.g., "Packet", "Parcel/Signed")
- Group 4: `qty` - Integer quantity
- Group 5: `rate` - Decimal rate per unit
- Group 6: `amount` - Decimal total amount (may contain commas)

**Example Row:**
```
WB68 DB6249 Packet 17 17 @ 1.75 29.75
```

**Extracted Data:**
```javascript
{
  working_day: "2025-12-14",  // Converted from DD/MM/YYYY format
  operator_id: "DB6249",
  tour: "WB68",
  service_group: "Packet",
  qty: 17,
  rate: 1.75,
  amount: 29.75
}
```

**Date Conversion:**
- Input format: DD/MM/YYYY (e.g., "14/12/2025")
- Output format: YYYY-MM-DD (e.g., "2025-12-14")
- Two-digit years: Prefix with "20"
- Zero-pad month and day if needed

**Validation:**
- Skip rows where `qty === 0`
- Skip rows where `service_group.length < 2`
- Parse all numeric fields (default to 0 if parsing fails)
- Remove commas from amount

---

## 4. Database Schema

### 4.1 Table: `invoices`

**Purpose:** Store invoice header information and metadata

**Schema:**
```sql
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  invoice_date DATE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  supplier_id TEXT,
  provider TEXT,
  pdf_url TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  net_total DECIMAL(10, 2),
  vat DECIMAL(10, 2),
  gross_total DECIMAL(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

**Required Fields for Insert:**
- `invoice_number` (from extraction)
- `invoice_date` (from extraction)
- `period_start` (from extraction)
- `period_end` (from extraction)
- `supplier_id` (from extraction, nullable)
- `provider` (from extraction, nullable)
- `pdf_url` (from file upload)
- `uploaded_by` (current user ID)
- `net_total` (from extraction, nullable)
- `vat` (from extraction, nullable)
- `gross_total` (from extraction, nullable)

**Constraints:**
- `invoice_number` must be UNIQUE
- Foreign key to `auth.users(id)` for `uploaded_by`

### 4.2 Table: `weekly_pay`

**Purpose:** Store weekly aggregated pay data from invoice Week Summary table

**Schema:**
```sql
CREATE TABLE public.weekly_pay (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL REFERENCES public.invoices(invoice_number) ON DELETE CASCADE,
  invoice_date DATE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  operator_id TEXT NOT NULL,
  tour TEXT,
  delivered INTEGER DEFAULT 0,
  collected INTEGER DEFAULT 0,
  sacks INTEGER DEFAULT 0,
  packets INTEGER DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

**Required Fields for Insert:**
- `invoice_number` (from invoice extraction)
- `invoice_date` (from invoice extraction)
- `period_start` (from invoice extraction)
- `period_end` (from invoice extraction)
- `operator_id` (from weekly pay row extraction)
- `tour` (from weekly pay row extraction, nullable)
- `delivered` (from weekly pay row extraction, default 0)
- `collected` (from weekly pay row extraction, default 0)
- `sacks` (from weekly pay row extraction, default 0)
- `packets` (from weekly pay row extraction, default 0)
- `total` (from weekly pay row extraction)

**Constraints:**
- Foreign key to `invoices(invoice_number)` with CASCADE delete
- `total` must NOT NULL

### 4.3 Table: `daily_pay`

**Purpose:** Store daily pay breakdown data from invoice Daily Breakdown table

**Schema:**
```sql
CREATE TABLE public.daily_pay (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL REFERENCES public.invoices(invoice_number) ON DELETE CASCADE,
  invoice_date DATE NOT NULL,
  working_day DATE NOT NULL,
  operator_id TEXT NOT NULL,
  tour TEXT,
  service_group TEXT NOT NULL,
  qty INTEGER DEFAULT 0,
  rate DECIMAL(10, 2),
  amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

**Required Fields for Insert:**
- `invoice_number` (from invoice extraction)
- `invoice_date` (from invoice extraction)
- `working_day` (from daily pay row extraction, converted to YYYY-MM-DD)
- `operator_id` (from daily pay row extraction)
- `tour` (from daily pay row extraction, nullable)
- `service_group` (from daily pay row extraction)
- `qty` (from daily pay row extraction, default 0)
- `rate` (from daily pay row extraction, nullable)
- `amount` (from daily pay row extraction)

**Constraints:**
- Foreign key to `invoices(invoice_number)` with CASCADE delete
- `service_group` must NOT NULL
- `amount` must NOT NULL

---

## 5. File Storage

### 5.1 Storage Configuration

**Storage Bucket:** `delivery-files`
**Path Prefix:** `invoices/`
**File Naming:** `{invoice_number}_{timestamp}.pdf`

**Example:**
```
invoices/123456_1704067200000.pdf
```

### 5.2 Upload Process

1. Extract invoice number from PDF
2. Generate filename: `${invoiceNumber}_${Date.now()}.${fileExtension}`
3. Upload to `delivery-files/invoices/{filename}`
4. Get public URL from Supabase Storage
5. Store URL in `invoices.pdf_url`

**Storage Settings:**
- `cacheControl: "3600"` (1 hour cache)
- `upsert: false` (do not overwrite existing files)

---

## 6. Processing Workflow

### 6.1 Complete Flow

```
1. User selects PDF file
   ↓
2. Validate file is PDF
   ↓
3. Extract text from PDF using PDF.js
   ↓
4. Validate text extraction (minimum 100 characters)
   ↓
5. Extract invoice header data (invoice_number, dates, totals)
   ↓
6. Validate invoice_number is present (REQUIRED)
   ↓
7. Extract weekly pay data from "Week Summary" section
   ↓
8. Extract daily pay data from "Daily Breakdown" section
   ↓
9. Upload PDF file to storage
   ↓
10. Insert invoice record into `invoices` table
    ↓
11. If weekly pay data exists, insert into `weekly_pay` table
    ↓
12. If daily pay data exists, insert into `daily_pay` table
    ↓
13. Return success message and navigate to invoices list
```

### 6.2 Error Handling

**Critical Errors (Stop Processing):**
- PDF file not selected
- User not authenticated
- Text extraction fails (PDF may be scanned/image-based)
- Invoice number not found
- File upload fails
- Invoice insert fails (duplicate invoice_number)
- Weekly pay insert fails
- Daily pay insert fails

**Non-Critical (Continue with defaults):**
- Date parsing fails (use current date)
- Supplier ID not found (store as NULL)
- Provider not found (default to "YODEL")
- Financial totals not found (store as NULL or 0)
- Weekly pay data not found (skip insertion)
- Daily pay data not found (skip insertion)

### 6.3 Validation Rules

**Pre-Processing:**
- File must be PDF (`.pdf` extension)
- File must be selected
- User must be authenticated

**Data Validation:**
- `invoice_number` MUST be present (non-empty string)
- `invoice_date` must be valid date or current date
- `period_start` must be valid date or current date
- `period_end` must be valid date or current date
- Extracted text must be at least 100 characters

**Database Constraints:**
- `invoice_number` must be UNIQUE (database constraint)
- Foreign key relationships must be valid
- Numeric fields must be valid decimals/integers

---

## 7. Data Insertion Details

### 7.1 Invoice Insert

```javascript
{
  invoice_number: string,      // REQUIRED - from extraction
  invoice_date: string,        // REQUIRED - YYYY-MM-DD format
  period_start: string,        // REQUIRED - YYYY-MM-DD format
  period_end: string,          // REQUIRED - YYYY-MM-DD format
  supplier_id: string | null,  // Optional - from extraction
  provider: string | null,     // Optional - from extraction (uppercase)
  pdf_url: string,             // REQUIRED - from storage upload
  uploaded_by: UUID,           // REQUIRED - current user ID
  net_total: number | null,    // Optional - from extraction
  vat: number | null,          // Optional - from extraction
  gross_total: number | null   // Optional - from extraction
}
```

**Transaction:** Single insert with `.select().single()` to return inserted record

### 7.2 Weekly Pay Insert

**Batch Insert:** Insert all weekly pay rows in single operation

```javascript
weeklyPayInserts = weeklyPayData.map(wp => ({
  invoice_number: string,      // From invoice extraction
  invoice_date: string,        // From invoice extraction (YYYY-MM-DD)
  period_start: string,        // From invoice extraction (YYYY-MM-DD)
  period_end: string,          // From invoice extraction (YYYY-MM-DD)
  operator_id: string,         // From weekly pay row extraction
  tour: string | null,         // From weekly pay row extraction
  delivered: integer,          // From weekly pay row extraction (default 0)
  collected: integer,          // From weekly pay row extraction (default 0)
  sacks: integer,              // From weekly pay row extraction (default 0)
  packets: integer,            // From weekly pay row extraction (default 0)
  total: decimal               // From weekly pay row extraction
}))
```

**Condition:** Only insert if `weeklyPayData.length > 0`

### 7.3 Daily Pay Insert

**Batch Insert:** Insert all daily pay rows in single operation

```javascript
dailyPayInserts = dailyPayData.map(dp => ({
  invoice_number: string,      // From invoice extraction
  invoice_date: string,        // From invoice extraction (YYYY-MM-DD)
  working_day: string,         // From daily pay row extraction (YYYY-MM-DD)
  operator_id: string,         // From daily pay row extraction
  tour: string | null,         // From daily pay row extraction
  service_group: string,       // From daily pay row extraction
  qty: integer,                // From daily pay row extraction (default 0)
  rate: decimal | null,        // From daily pay row extraction
  amount: decimal              // From daily pay row extraction
}))
```

**Condition:** Only insert if `dailyPayData.length > 0`

---

## 8. Regex Patterns Reference

### 8.1 Invoice Header Patterns

**Invoice Number:**
```javascript
/Invoice No:?\s*(\d+)/i
/Invoice Number:?\s*(\d+)/i
```

**Invoice Date:**
```javascript
/Date:?\s*(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/i
/Date:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i
```

**Payment Period:**
```javascript
/Payment Period:?\s*(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2,4})\s*-\s*(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2,4})/i
/(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2,4})\s*-\s*(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2,4})/i
/(\d{1,2}\/\d{1,2}\/\d{2,4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i
```

**Supplier ID:**
```javascript
/Supplier ID:?\s*(\d+)/i
```

**Provider:**
```javascript
/YODEL|ROYAL MAIL|DPD|HERMES/i
```

**Financial Totals:**
```javascript
/Net Total[^\d]*£?\s*([\d,]+\.?\d*)/i
/VAT\s*@?\s*[\d.]+%[^\d]*£?\s*([\d,]+\.?\d*)/i
/VAT[^\d]*£?\s*([\d,]+\.?\d*)/i
/Gross Total[^\d]*£?\s*([\d,]+\.?\d*)/i
```

### 8.2 Weekly Pay Patterns

**Section Boundary:**
```javascript
/Week Summary[\s\S]*?(?=Daily Breakdown|Manual Adjustments|$)/i
```

**Row Pattern (Global):**
```javascript
/([A-Z]{2}\d{4})\s+([A-Z]{2}\d{2})\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([\d,]+\.?\d*)/g
```

### 8.3 Daily Pay Patterns

**Section Boundary:**
```javascript
/Daily Breakdown[\s\S]*?(?=Manual Adjustments|Total[\s\S]*?[\d,]+\.?\d*[\s\S]*?$|$)/i
```

**Day Header Pattern (Global):**
```javascript
/(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\s+(\d{1,2}\/\d{1,2}\/\d{4})/gi
```

**Service Row Pattern (Global):**
```javascript
/([A-Z]{2}\d{2})\s+([A-Z]{2}\d{4})\s+([A-Za-z\s\/]+?)\s+(\d+)\s+\d+\s*@\s*([\d.]+)\s+([\d,]+\.?\d*)/g
```

---

## 9. Implementation Notes

### 9.1 PDF.js Configuration

**Worker Setup:**
```javascript
import * as pdfjsLib from "pdfjs-dist";

// Configure worker from public folder
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    '/pdf.worker.min.mjs',
    window.location.origin
  ).href;
}
```

**Text Extraction:**
```javascript
const arrayBuffer = await file.arrayBuffer();
const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
let fullText = "";

for (let i = 1; i <= pdf.numPages; i++) {
  const page = await pdf.getPage(i);
  const textContent = await page.getTextContent();
  const pageText = textContent.items.map((item: any) => item.str).join(" ");
  fullText += pageText + "\n";
}
```

### 9.2 Date Parsing

**Text Format (e.g., "14 Dec 25"):**
```javascript
new Date("14 Dec 25").toISOString().split('T')[0]  // "2025-12-14"
```

**Slash Format (e.g., "14/12/2025"):**
```javascript
const [day, month, year] = dateStr.split('/');
const fullYear = year.length === 2 ? `20${year}` : year;
const formattedDate = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
```

### 9.3 Number Parsing

**Remove Commas:**
```javascript
const value = parseFloat(amountStr.replace(/,/g, '')) || 0;
```

### 9.4 Error Messages

**User-Facing Errors:**
- "No file selected"
- "Please select a PDF file to upload"
- "User not authenticated"
- "Failed to extract text from PDF. The PDF may be scanned or image-based."
- "Could not extract invoice number from PDF"
- "Failed to upload invoice"
- "{Error message from database/storage}"

**Success Message:**
- "Invoice {invoice_number} uploaded and processed successfully"

---

## 10. Testing Requirements

### 10.1 Unit Tests

Test each extraction function with:
- Valid invoice PDF text
- Missing fields
- Invalid date formats
- Invalid number formats
- Empty sections

### 10.2 Integration Tests

Test complete workflow:
- PDF upload → text extraction → data extraction → database insert
- Duplicate invoice number handling
- Missing weekly pay data
- Missing daily pay data
- Storage upload failures
- Database constraint violations

### 10.3 Sample Test Cases

**Test Case 1: Complete Invoice**
- All fields present
- Both weekly and daily pay data present
- Expected: All data inserted successfully

**Test Case 2: Missing Optional Fields**
- Supplier ID missing
- Financial totals missing
- Expected: Invoice created with NULL values

**Test Case 3: Invalid Invoice Number**
- Invoice number not found
- Expected: Error "Could not extract invoice number from PDF"

**Test Case 4: Scanned PDF**
- Image-based PDF (no text)
- Expected: Error "Failed to extract text from PDF. The PDF may be scanned or image-based."

**Test Case 5: Duplicate Invoice**
- Invoice number already exists
- Expected: Database constraint error

---

## 11. Related Systems

### 11.1 Payslip Generation

After invoice parsing, the `generate-payslips` edge function:
- Reads `weekly_pay` and `daily_pay` data
- Matches `operator_id` to drivers
- Calculates gross pay using driver rates from `driver_rates` table
- Creates records in `payslips` table

### 11.2 Driver Rates

The `driver_rates` table stores per-operator payment rates:
- Linked by `operator_id`
- Used for payslip calculation
- Separate from invoice rates (driver rates take precedence)

---

## 12. Appendix: Example Invoice Text Structure

```
Invoice No: 123456
Date: 29 Dec 2025
Supplier ID: 789012
YODEL

Payment Period: 14 Dec 25 - 20 Dec 25

Week Summary
Operator ID  Tour  Delivered  Collected  Sacks  Packets  Total
DB6249       WB43  64         2          0      16       102.50
...

Daily Breakdown

Sunday 14/12/2025
Tour  Operator ID  Service Group  Qty  Delivered  @ Rate  Amount
WB68  DB6249       Packet         17   17         @ 1.75  29.75
...

Manual Adjustments
...

Net Total: £1,234.56
VAT @ 20%: £246.91
Gross Total: £1,481.47
```

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-05  
**Author:** System Documentation
