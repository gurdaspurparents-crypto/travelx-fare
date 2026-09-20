import ExcelJS from 'exceljs';
import { formatRouteName } from './airportHelper';
import { TRAVELX_LOGO_BASE64, IATA_LOGO_BASE64 } from '../assets/logoBase64';

/**
 * Professional Executive Color Palette for Corporate Travel Agency
 * Sector colors: exactly 3 soft, high-contrast corporate pastel tones
 */
const corporateHeaderNavy = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF0F172A' } // Deep Midnight Navy (#0F172A)
};

const corporateSubHeaderSlate = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1E293B' } // Slate Charcoal (#1E293B)
};

const tableHeaderBlue = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1E3A8A' } // Deep Royal Navy (#1E3A8A)
};

// Exactly 3 Sector Colors (Soft Pastel for 100% Readability and Executive Polish)
const sectorColors = [
  { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } }, // 1. Soft Ice / Sky Blue (#E0F2FE)
  { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }, // 2. Soft Mint / Emerald (#DCFCE7)
  { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }  // 3. Soft Warm Amber / Sand (#FEF3C7)
];

const thinGridBorder = {
  top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
};

const cardBorder = {
  top: { style: 'thin', color: { argb: 'FF94A3B8' } },
  left: { style: 'thin', color: { argb: 'FF94A3B8' } },
  bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
  right: { style: 'thin', color: { argb: 'FF94A3B8' } }
};

/**
 * Builds the top header banner with official IATA logo (left) and TravelX logo (right)
 */
function applyTopBanner(workbook, ws) {
  // Row 1: Merged A1:E1 with Gold 22pt Highlight, IATA Logo on Left, and TravelX Logo on Right
  ws.mergeCells('A1:E1');
  const row1 = ws.getRow(1);
  row1.height = 54;
  for (let c = 1; c <= 5; c++) {
    row1.getCell(c).fill = corporateHeaderNavy; // Deep Midnight Navy #0F172A
  }

  const cell1 = ws.getCell('A1');
  cell1.value = '✨ EXCLUSIVE SPECIAL FARES ✨';
  cell1.font = { name: 'Calibri', size: 22, bold: true, color: { argb: 'FFFBBF24' } }; // Calibri 22pt Bold Gold
  cell1.alignment = { vertical: 'middle', horizontal: 'center' };

  try {
    // 1. IATA Approved Travel Agency Logo on Left (over Column A / start of B)
    if (IATA_LOGO_BASE64) {
      const iataImgId = workbook.addImage({
        base64: IATA_LOGO_BASE64,
        extension: 'png'
      });
      ws.addImage(iataImgId, {
        tl: { col: 0.08, row: 0.14 },
        ext: { width: 148, height: 38 }
      });
    }

    // 2. TravelX Logo on Right (over Column E)
    const imgId = workbook.addImage({
      base64: TRAVELX_LOGO_BASE64,
      extension: 'png'
    });
    ws.addImage(imgId, {
      tl: { col: 4.02, row: 0.1 },
      ext: { width: 148, height: 43 }
    });
  } catch (err) {
    console.error('Failed to embed logo into Excel:', err);
  }
}

/**
 * Builds the clean, professional corporate footer card (Exact match to screenshot 4)
 */
function applyBottomFooter(ws, startRow) {
  // Line 1: Desk Title (Merged A:E, Height 32pt, Calibri 14pt Bold White)
  const r1 = startRow;
  ws.mergeCells(`A${r1}:E${r1}`);
  const row1 = ws.getRow(r1);
  row1.height = 32;
  for (let c = 1; c <= 5; c++) {
    row1.getCell(c).fill = tableHeaderBlue;
    row1.getCell(c).border = cardBorder;
  }
  const cell1 = ws.getCell(`A${r1}`);
  cell1.value = '📞 24/7 RESERVATIONS & INSTANT TICKETING DESK';
  cell1.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  cell1.alignment = { vertical: 'middle', horizontal: 'center' };

  // Line 2: Contact Numbers (Merged A:E, Height 28pt, Calibri 14pt Bold Black)
  const r2 = startRow + 1;
  ws.mergeCells(`A${r2}:E${r2}`);
  const row2 = ws.getRow(r2);
  row2.height = 28;
  const lightFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  for (let c = 1; c <= 5; c++) {
    row2.getCell(c).fill = lightFill;
    row2.getCell(c).border = cardBorder;
  }
  const cell2 = ws.getCell(`A${r2}`);
  cell2.value = 'Contact / WhatsApp: +91 8146526257  |  +91 7814508351  |  Landline: 01874-501800';
  cell2.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF000000' } };
  cell2.alignment = { vertical: 'middle', horizontal: 'center' };

  // Line 3: Terms & Policies (Merged A:E, Height 26pt, Calibri 13pt Bold Italic)
  const r3 = startRow + 2;
  ws.mergeCells(`A${r3}:E${r3}`);
  const row3 = ws.getRow(r3);
  row3.height = 26;
  const policyFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  for (let c = 1; c <= 5; c++) {
    row3.getCell(c).fill = policyFill;
    row3.getCell(c).border = cardBorder;
  }
  const cell3 = ws.getCell(`A${r3}`);
  cell3.value = 'Note: Prices are subject to change without prior notice. Tickets are strictly non-refundable and non-changeable.';
  cell3.font = { name: 'Calibri', size: 13, italic: true, bold: true, color: { argb: 'FF334155' } };
  cell3.alignment = { vertical: 'middle', horizontal: 'center' };

  // Line 4: OTB & Daily Updates (Merged A:E, Height 26pt, Calibri 13pt Bold)
  const r4 = startRow + 3;
  ws.mergeCells(`A${r4}:E${r4}`);
  const row4 = ws.getRow(r4);
  row4.height = 26;
  for (let c = 1; c <= 5; c++) {
    row4.getCell(c).fill = policyFill;
    row4.getCell(c).border = cardBorder;
  }
  const cell4 = ws.getCell(`A${r4}`);
  cell4.value = 'We provide OTB service; verification is the responsibility of the agent. Please save our contact numbers for daily rate updates.';
  cell4.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF1E293B' } };
  cell4.alignment = { vertical: 'middle', horizontal: 'center' };
}

/**
 * Exports Final Special Fares to Excel with Executive Polish:
 * - Professional unified header banner (No text truncation)
 * - Deep Royal Navy table header with crisp white text
 * - Exactly 3 soft pastel sector colors (Ice Blue, Mint Green, Warm Amber)
 * - Clean corporate typography & accounting alignment (Fares formatted as #,##0.00)
 * - Elegant, polished contact & policy footer card
 */
export async function exportPublishDeskToExcel(faresList = [], consolidatedList = []) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Travelx Special Fare Manager';
  workbook.created = new Date();

  // -------------------------------------------------------------
  // Sheet 1: Consolidated Special Fares (Grouped Ranges)
  // -------------------------------------------------------------
  const wsConsolidated = workbook.addWorksheet('Special Fares', {
    views: [{ showGridLines: true }]
  });

  wsConsolidated.columns = [
    { key: 'sno', width: 11 },
    { key: 'airlines', width: 28 },
    { key: 'origin_dest', width: 34 },
    { key: 'fare', width: 22 },
    { key: 'dates', width: 48 },
    { key: 'spacer', width: 5 },
    { key: 'vendor_name', width: 26 }
  ];

  // 1. Top Unified Header Banner with TravelX Logo (Row 1)
  applyTopBanner(workbook, wsConsolidated);

  // Side Column Header: Vendor Name (Merged G1:G2, matching user screenshot)
  wsConsolidated.mergeCells('G1:G2');
  const vendorHeader1 = wsConsolidated.getCell('G1');
  vendorHeader1.value = 'Vendor Name';
  vendorHeader1.fill = tableHeaderBlue;
  vendorHeader1.font = { name: 'Calibri', size: 20, bold: true, color: { argb: 'FFFFFFFF' } };
  vendorHeader1.alignment = { vertical: 'middle', horizontal: 'center' };
  vendorHeader1.border = thinGridBorder;
  wsConsolidated.getCell('G2').border = thinGridBorder;

  // 2. Table Column Headers (Row 2, matching user screenshot: Calibri 20pt Bold White)
  const headerRow1 = wsConsolidated.getRow(2);
  headerRow1.height = 38;
  const headers1 = ['S.No', 'Airlines', 'Origin to Destination', 'Special Fare (₹)', 'Dates Available'];
  headers1.forEach((h, i) => {
    const cell = headerRow1.getCell(i + 1);
    cell.value = h;
    cell.fill = tableHeaderBlue;
    cell.font = { name: 'Calibri', size: 20, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: i === 0 ? 'center' : i === 3 ? 'right' : 'left',
      indent: i === 0 ? 0 : 1
    };
    cell.border = thinGridBorder;
  });

  // 3. Data Rows with 3 Alternating Pastel Sector Blocks (Row 3 onwards, matching user screenshot: Calibri 18pt Bold Black)
  let currentRow = 3;
  let lastSectorKey = null;
  let sectorColorIdx = 0;

  const dataFont = {
    name: 'Calibri',
    size: 18,
    bold: true,
    color: { argb: 'FF000000' }
  };

  consolidatedList.forEach((item, idx) => {
    const row = wsConsolidated.getRow(currentRow);
    row.height = 34;

    const sectorKey = item.route || `${item.origin}_${item.destination}`;
    if (lastSectorKey !== null && sectorKey !== lastSectorKey) {
      sectorColorIdx = (sectorColorIdx + 1) % 3; // Max 3 Colors!
    }
    lastSectorKey = sectorKey;
    const currentFill = sectorColors[sectorColorIdx];

    const netFare = Number(item.net_fare || item.publish_fare) || 0;
    const airline = item.airline_name || item.airline_code || '';
    const route = item.route || formatRouteName(item.origin, item.destination, 'TO');
    const dates = item.date_label || '';

    // Col A: S.No (Centered)
    const c1 = row.getCell(1);
    c1.value = idx + 1;
    c1.alignment = { vertical: 'middle', horizontal: 'center' };

    // Col B: Airlines (Left aligned with padding)
    const c2 = row.getCell(2);
    c2.value = airline;
    c2.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    // Col C: Origin to Destination (Left aligned with padding)
    const c3 = row.getCell(3);
    c3.value = route;
    c3.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    // Col D: Fare (Right aligned, accounting currency formatting)
    const c4 = row.getCell(4);
    c4.value = netFare;
    c4.numFmt = '#,##0.00';
    c4.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };

    // Col E: Dates Available (Left aligned, wrapped)
    const c5 = row.getCell(5);
    c5.value = dates;
    c5.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 };

    for (let c = 1; c <= 5; c++) {
      const cell = row.getCell(c);
      cell.font = dataFont;
      cell.fill = currentFill;
      cell.border = thinGridBorder;
    }

    // Col G: Vendor Name (Side column for internal agency identification)
    const c7 = row.getCell(7);
    c7.value = item.vendor_name || '';
    c7.font = dataFont;
    c7.fill = currentFill;
    c7.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    c7.border = thinGridBorder;

    currentRow++;
  });

  // 4. Bottom Executive Footer Card (Row space + footer)
  currentRow++; // 1 row breathing space
  applyBottomFooter(wsConsolidated, currentRow);

  // -------------------------------------------------------------
  // Sheet 2: Detailed Dates (Day by Day)
  // -------------------------------------------------------------
  const wsDetailed = workbook.addWorksheet('Detailed Dates', {
    views: [{ showGridLines: true }]
  });

  wsDetailed.columns = [
    { key: 'sno', width: 11 },
    { key: 'airlines', width: 28 },
    { key: 'origin_dest', width: 34 },
    { key: 'fare', width: 22 },
    { key: 'travel_date', width: 24 },
    { key: 'spacer', width: 5 },
    { key: 'vendor_name', width: 26 }
  ];

  // 1. Top Unified Header Banner with TravelX Logo (Row 1)
  applyTopBanner(workbook, wsDetailed);

  // Side Column Header: Vendor Name (Merged G1:G2)
  wsDetailed.mergeCells('G1:G2');
  const vendorHeader2 = wsDetailed.getCell('G1');
  vendorHeader2.value = 'Vendor Name';
  vendorHeader2.fill = tableHeaderBlue;
  vendorHeader2.font = { name: 'Calibri', size: 20, bold: true, color: { argb: 'FFFFFFFF' } };
  vendorHeader2.alignment = { vertical: 'middle', horizontal: 'center' };
  vendorHeader2.border = thinGridBorder;
  wsDetailed.getCell('G2').border = thinGridBorder;

  // 2. Table Column Headers (Row 2, matching user screenshot: Calibri 20pt Bold White)
  const headerRow2 = wsDetailed.getRow(2);
  headerRow2.height = 38;
  const headers2 = ['S.No', 'Airlines', 'Origin to Destination', 'Special Fare (₹)', 'Travel Date'];
  headers2.forEach((h, i) => {
    const cell = headerRow2.getCell(i + 1);
    cell.value = h;
    cell.fill = tableHeaderBlue;
    cell.font = { name: 'Calibri', size: 20, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: i === 0 ? 'center' : i === 3 ? 'right' : 'left',
      indent: i === 0 ? 0 : 1
    };
    cell.border = thinGridBorder;
  });

  let curDetailedRow = 3;
  let lastDetSector = null;
  let detSectorColorIdx = 0;

  faresList.forEach((f, idx) => {
    const row = wsDetailed.getRow(curDetailedRow);
    row.height = 32;

    const sectorKey = `${f.origin}_${f.destination}`;
    if (lastDetSector !== null && sectorKey !== lastDetSector) {
      detSectorColorIdx = (detSectorColorIdx + 1) % 3; // Max 3 Colors!
    }
    lastDetSector = sectorKey;
    const currentFill = sectorColors[detSectorColorIdx];

    const netFare = Number(f.net_fare || f.publish_fare) || 0;
    const airline = f.airline_name || f.airline_code || '';
    const route = formatRouteName(f.origin, f.destination, 'TO');

    row.getCell(1).value = idx + 1;
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

    row.getCell(2).value = airline;
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    row.getCell(3).value = route;
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    row.getCell(4).value = netFare;
    row.getCell(4).numFmt = '#,##0.00';
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };

    row.getCell(5).value = f.travel_date;
    row.getCell(5).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    for (let c = 1; c <= 5; c++) {
      const cell = row.getCell(c);
      cell.font = dataFont;
      cell.fill = currentFill;
      cell.border = thinGridBorder;
    }

    // Col G: Vendor Name
    const detVendor = row.getCell(7);
    detVendor.value = f.vendor_name || f['Vendor / Source'] || '';
    detVendor.font = dataFont;
    detVendor.fill = currentFill;
    detVendor.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    detVendor.border = thinGridBorder;

    curDetailedRow++;
  });

  curDetailedRow++; // 1 row breathing space
  applyBottomFooter(wsDetailed, curDetailedRow);

  // Write and trigger download in browser
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const todayStr = new Date().toISOString().slice(0, 10);
  const filename = `Travelx_Special_Fares_${todayStr}.xlsx`;

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

/**
 * Exports Rate Comparison Desk data to Excel (.xlsx) with clean matching format
 */
export async function exportComparisonDeskToExcel(sectorGroups = [], customFileName = null) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Travelx Special Fare Manager';
  workbook.created = new Date();

  const cyanBlueFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF00A2E8' }
  };

  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
  };

  const headerFont = {
    name: 'Calibri',
    size: 11,
    bold: false,
    color: { argb: 'FF000000' }
  };

  const dataFont = {
    name: 'Calibri',
    size: 11,
    color: { argb: 'FF000000' }
  };

  const ws = workbook.addWorksheet('Vendor Rate Comparisons', {
    views: [{ showGridLines: true }]
  });

  ws.columns = [
    { header: 'S No', key: 'sno', width: 8 },
    { header: 'Sector', key: 'sector', width: 22 },
    { header: 'Travel Date', key: 'travel_date', width: 16 },
    { header: 'Airline', key: 'airline', width: 22 },
    { header: 'Fare (₹)', key: 'fare', width: 18 },
    { header: 'Best Vendor', key: 'best_vendor', width: 22 },
    { header: 'All Vendor Quotes', key: 'quotes', width: 45 },
    { header: 'Baggage', key: 'baggage', width: 12 },
    { header: 'Refundable', key: 'refundable', width: 14 }
  ];

  let counter = 1;
  for (const sec of sectorGroups) {
    for (const group of sec.items || sec.allDateItems || []) {
      const winnerFare = group.fares?.find(f => f.is_best_net) || group.fares?.[0];
      const allQuotes = (group.fares || []).map(f => `${f.vendor_name}: ₹${f.net_fare}`).join(' | ');

      const row = ws.addRow({
        sno: counter++,
        sector: formatRouteName(group.origin, group.destination, 'TO'),
        travel_date: group.travel_date,
        airline: group.airline_name || group.airline_code,
        fare: Number(group.best_net_fare) || 0,
        best_vendor: group.best_vendor_name,
        quotes: allQuotes,
        baggage: winnerFare?.baggage || '30kg',
        refundable: winnerFare?.is_refundable === 'REFUNDABLE' ? 'Ref' : 'Non-Ref'
      });

      row.height = 22;
      row.font = dataFont;

      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell(5).alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell(5).numFmt = '#,##0.00';
      row.getCell(6).alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell(7).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      row.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(9).alignment = { vertical: 'middle', horizontal: 'center' };

      for (let c = 1; c <= 9; c++) {
        row.getCell(c).border = thinBorder;
      }
    }
  }

  const headerRow = ws.getRow(1);
  headerRow.height = 28;
  for (let c = 1; c <= 9; c++) {
    const cell = headerRow.getCell(c);
    cell.fill = cyanBlueFill;
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = thinBorder;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const todayStr = new Date().toISOString().slice(0, 10);
  
  let filename = customFileName;
  if (!filename) {
    if (sectorGroups.length === 1) {
      filename = `Travelx_Rate_Comparison_${sectorGroups[0].origin}-${sectorGroups[0].destination}_${todayStr}.xlsx`;
    } else if (sectorGroups.length > 1) {
      filename = `Travelx_Rate_Comparison_${sectorGroups.length}_Sectors_${todayStr}.xlsx`;
    } else {
      filename = `Travelx_Vendor_Rate_Comparison_${todayStr}.xlsx`;
    }
  }

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
