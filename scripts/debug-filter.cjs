// Filtered aggregation for a specific operator/tour/date from the Yodel invoice
const fs = require("fs");
const path = require("path");

let pdfjsLib;

const normalizeText = (text) =>
  text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .trim();

const parseDate = (dateStr) => {
  if (!dateStr) return "";
  const textMatch = dateStr.match(
    /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{2,4})$/i
  );
  if (textMatch) {
    const day = textMatch[1].padStart(2, "0");
    const monthNames = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
    const month = (monthNames.indexOf(textMatch[2].toLowerCase()) + 1).toString().padStart(2, "0");
    const year = textMatch[3].length === 2 ? `20${textMatch[3]}` : textMatch[3];
    return `${year}-${month}-${day}`;
  }
  const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, "0");
    const month = slashMatch[2].padStart(2, "0");
    const year = slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3];
    return `${year}-${month}-${day}`;
  }
  return "";
};

const extractTextFromPDF = async (filePath) => {
  if (!pdfjsLib) {
    pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  }
  const data = new Uint8Array(fs.readFileSync(filePath));
  const loadingTask = pdfjsLib.getDocument({ data, useWorkerFetch: false, disableWorker: true });
  const pdf = await loadingTask.promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(" ");
    fullText += pageText + "\n";
  }
  return fullText;
};

const extractDaily = (normalizedText) => {
  const results = [];
  const dailySectionMatch = normalizedText.match(/Daily\s+Breakdown[\s\S]*$/i);
  const dailyText = dailySectionMatch ? dailySectionMatch[0] : normalizedText;
  const dayPatterns = [
    /(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)[\s,]+(\d{1,2}\/\d{1,2}\/\d{2,4})/gi,
    /(Sun|Mon|Tue|Wed|Thu|Fri|Sat)[\s,]+(\d{1,2}\/\d{1,2}\/\d{2,4})/gi,
    /(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)[\s,]+(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2,4})/gi,
    /(Sun|Mon|Tue|Wed|Thu|Fri|Sat)[\s,]+(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2,4})/gi,
    /(\d{1,2}\/\d{1,2}\/\d{2,4})/gi,
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2,4})/gi,
    /(\d{1,2}(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\d{2})/gi,
  ];
  const dayMatches = [];
  for (const pattern of dayPatterns) {
    pattern.lastIndex = 0;
    let m;
    while ((m = pattern.exec(dailyText)) !== null) {
      const dateVal = m[2] || m[1] || "";
      dayMatches.push({ label: m[0], date: dateVal, index: m.index, length: m[0].length });
    }
  }
  dayMatches.sort((a, b) => a.index - b.index);
  const uniqueDays = dayMatches.filter((d, i, arr) => i === 0 || d.index !== arr[i - 1].index);

  const serviceRowPatterns = [
    {
      regex: /([A-Z]{2,3}\d{1,3})(?:\s+(\d))?\s+\d+\s+([A-Z]{2,3}\d{3,6})\s+([A-Za-z\s\/\-]{2,40}?)\s+((?:\d+\s+)*\d+)\s*@\s*([\d.]+)\s+([\d.,]+)/g,
      tourBaseIdx: 1, tourSplitIdx: 2, operatorIdx: 3, serviceIdx: 4, numbersIdx: 5, rateIdx: 6, amountIdx: 7,
    },
    {
      regex: /([A-Z]{2,3}\d{1,3})(?:\s+(\d))?\s+([A-Z]{2,3}\d{3,6})\s+([A-Za-z\s\/\-]{2,40}?)\s+((?:\d+\s+)*\d+)\s*@\s*([\d.]+)\s+([\d.,]+)/g,
      tourBaseIdx: 1, tourSplitIdx: 2, operatorIdx: 3, serviceIdx: 4, numbersIdx: 5, rateIdx: 6, amountIdx: 7,
    },
    {
      regex: /([A-Z]{2,3}\d{3,6})\s+([A-Z]{2,3}\d{1,3})(?:\s+(\d))?\s+([A-Za-z\s\/\-]{2,40}?)\s+((?:\d+\s+)*\d+)\s*@\s*([\d.]+)\s+([\d.,]+)/g,
      operatorIdx: 1, tourBaseIdx: 2, tourSplitIdx: 3, serviceIdx: 4, numbersIdx: 5, rateIdx: 6, amountIdx: 7,
    },
  ];

  for (let i = 0; i < uniqueDays.length; i++) {
    const dayMatch = uniqueDays[i];
    const workingDay = parseDate(dayMatch.date);
    const lineStartIdx = dailyText.lastIndexOf("\n", dayMatch.index);
    const startIdx = lineStartIdx >= 0 ? lineStartIdx : dayMatch.index;
    const endIdx = i < uniqueDays.length - 1 ? uniqueDays[i + 1].index : dailyText.length;
    const dayTextBlock = dailyText.substring(startIdx, endIdx);

    for (const p of serviceRowPatterns) {
      p.regex.lastIndex = 0;
      let sm;
      while ((sm = p.regex.exec(dayTextBlock)) !== null) {
        const rawMatch = sm[0] || "";
        const tourBase = sm[p.tourBaseIdx]?.trim().toUpperCase() || "";
        const tourSplit = p.tourSplitIdx ? sm[p.tourSplitIdx]?.trim().toUpperCase() || "" : "";
        let tour = (tourBase + tourSplit).replace(/\s+/g, "");
        if (/^[A-Z]{2,3}\d{1,3}$/.test(tour)) {
          const trailing = rawMatch.match(/([A-Z]{2,3}\d{1,3})\s+(\d)\b/);
          if (trailing && trailing[2] && tour === trailing[1].replace(/\s+/g, "")) {
            tour = tour + trailing[2];
          }
        }
        const operatorId = (sm[p.operatorIdx]?.trim().toUpperCase() || "").replace(/\s+/g, "");
        let serviceGroup = sm[p.serviceIdx]?.trim() || "";
        serviceGroup = serviceGroup.replace(/\s+/g, " ").trim();
        const numbersBlock = sm[p.numbersIdx] || "";
        const nums = numbersBlock.split(/\s+/).filter(Boolean);
        const qtyNum = nums.length > 0 ? parseInt(nums[nums.length - 1].replace(/[^\d]/g, ""), 10) || 0 : 0;
        results.push({ workingDay, tour, operatorId, serviceGroup, qty: qtyNum });
      }
    }
  }
  return results;
};

const targetDate = "2025-12-19";
const targetOperator = "DA9881";
const targetTour = "WB66";

const run = async () => {
  const pdfPath = path.join(process.cwd(), "Docs", "YODEL INVOICE.pdf");
  if (!fs.existsSync(pdfPath)) {
    console.error("PDF not found at", pdfPath);
    process.exit(1);
  }
  const raw = await extractTextFromPDF(pdfPath);
  const norm = normalizeText(raw);
  const daily = extractDaily(norm);
  const filtered = daily.filter(
    (r) => r.workingDay === targetDate && r.operatorId === targetOperator && r.tour === targetTour
  );
  const agg = { adhoc: 0, packet: 0, regular: 0, locker: 0, total: 0 };
  for (const r of filtered) {
    const sg = r.serviceGroup.toLowerCase();
    if (sg.includes("adhoc") || sg.includes("scheduled")) agg.adhoc += r.qty;
    else if (sg.includes("packet")) agg.packet += r.qty;
    else if (sg.includes("regular")) agg.regular += r.qty;
    else if (sg.includes("locker")) agg.locker += r.qty;
    agg.total += r.qty;
  }
  console.log("Filtered rows:", filtered);
  console.log("Aggregated:", agg);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
