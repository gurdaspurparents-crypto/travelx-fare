const db = require('../config/database');
const XLSX = require('xlsx');
const { groupFaresByDateRanges, formatWhatsAppBroadcast } = require('../services/dateGroupingHelper');
const { formatRouteName } = require('../services/airportHelper');
const { invalidateFaresCache } = require('./publicAgentController');

/**
 * Toggle publish status of fares (batch or single)
 */
exports.togglePublishFares = (req, res) => {
  try {
    const { fare_ids = [], is_published = 1, batch_title = '' } = req.body;
    if (!fare_ids || fare_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'No fare IDs provided' });
    }

    const batchId = `BATCH-${Date.now()}`;
    const updateStmt = db.prepare('UPDATE fares SET is_published = ? WHERE id = ?');
    const insertPublished = db.prepare(`
      INSERT INTO published_specials (fare_id, batch_id, custom_title, published_at)
      VALUES (?, ?, ?, datetime('now', 'localtime'))
    `);

    const updateTx = db.transaction(() => {
      for (const id of fare_ids) {
        updateStmt.run(is_published ? 1 : 0, id);
        if (is_published) {
          insertPublished.run(id, batchId, batch_title || 'Special Fare Release');
        }
      }
    });

    updateTx();
    invalidateFaresCache();
    return res.json({
      success: true,
      updated_count: fare_ids.length,
      is_published: !!is_published,
      batch_id: batchId
    });
  } catch (err) {
    console.error('Error toggling published status:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Publish all future fares to the public B2B agent portal in one action.
 */
exports.publishAllFutureFares = (req, res) => {
  try {
    const batchId = `BATCH-ALL-${Date.now()}`;
    const ids = db.prepare(`
      SELECT id FROM fares
      WHERE travel_date >= date('now', 'localtime')
        AND COALESCE(is_published, 0) = 0
    `).all().map(r => r.id);

    if (ids.length === 0) {
      return res.json({ success: true, updated_count: 0, message: 'All future fares are already published.' });
    }

    const updateStmt = db.prepare('UPDATE fares SET is_published = 1 WHERE id = ?');
    const insertPublished = db.prepare(`
      INSERT INTO published_specials (fare_id, batch_id, custom_title, published_at)
      VALUES (?, ?, ?, datetime('now', 'localtime'))
    `);

    const tx = db.transaction(() => {
      for (const id of ids) {
        updateStmt.run(id);
        insertPublished.run(id, batchId, 'Bulk Portal Publish');
      }
    });
    tx();
    invalidateFaresCache();

    return res.json({
      success: true,
      updated_count: ids.length,
      batch_id: batchId,
      message: `${ids.length} future fare(s) are now live on the agent portal.`
    });
  } catch (err) {
    console.error('Error publishing all future fares:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Format WhatsApp Message for selected or published fares (with grouped date ranges)
 */
exports.generateWhatsAppMessage = (req, res) => {
  try {
    const {
      fare_ids = [],
      title = '✈️ TRAVELX SPECIAL FARE',
      footer = '🔥 BEST FARE GUARANTEE\n⚡ LIMITED SEATS AVAILABLE\n📞 Contact Travelx Desk for Instant Issuance',
      group_by_ranges = true
    } = req.body;

    let fares = [];
    if (fare_ids.length > 0) {
      const placeholders = fare_ids.map(() => '?').join(',');
      fares = db.prepare(`
        SELECT 
          f.*,
          v.name AS vendor_name,
          a.name AS airline_name,
          r.origin_city,
          r.dest_city
        FROM fares f
        JOIN vendors v ON f.vendor_id = v.id
        JOIN airlines a ON f.airline_code = a.code
        LEFT JOIN routes r ON f.origin = r.origin AND f.destination = r.destination
        WHERE f.id IN (${placeholders})
        ORDER BY f.origin ASC, f.destination ASC, f.airline_code ASC, f.travel_date ASC
      `).all(...fare_ids);
    } else {
      fares = db.prepare(`
        SELECT 
          f.*,
          v.name AS vendor_name,
          a.name AS airline_name,
          r.origin_city,
          r.dest_city
        FROM fares f
        JOIN vendors v ON f.vendor_id = v.id
        JOIN airlines a ON f.airline_code = a.code
        LEFT JOIN routes r ON f.origin = r.origin AND f.destination = r.destination
        WHERE f.is_published = 1
        ORDER BY f.origin ASC, f.destination ASC, f.airline_code ASC, f.travel_date ASC
      `).all();
    }

    if (fares.length === 0) {
      return res.json({
        success: true,
        formatted_text: 'No fares selected or published yet.',
        count: 0
      });
    }

    const output = formatWhatsAppBroadcast(fares, {
      title,
      footer,
      groupByRanges: group_by_ranges !== false
    });

    return res.json({
      success: true,
      formatted_text: output,
      total_fares: fares.length
    });
  } catch (err) {
    console.error('Error formatting WhatsApp message:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const corporateHeaderNavy = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF0F172A' }
};

const corporateSubHeaderSlate = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1E293B' }
};

const tableHeaderBlue = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1E3A8A' }
};

// Exactly 3 Sector Colors (Soft Pastel for 100% Readability and Executive Polish)
const sectorColors = [
  { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } }, // 1. Soft Sky Blue (#E0F2FE)
  { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }, // 2. Soft Mint Green (#DCFCE7)
  { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }  // 3. Soft Warm Amber (#FEF3C7)
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
    // 1. IATA Approved Travel Agency Logo on Left
    const iataPath = path.resolve(__dirname, '../assets/iata-transparent.png');
    if (fs.existsSync(iataPath)) {
      const iataImgId = workbook.addImage({
        filename: iataPath,
        extension: 'png'
      });
      ws.addImage(iataImgId, {
        tl: { col: 0.08, row: 0.14 },
        ext: { width: 148, height: 38 }
      });
    }

    // 2. TravelX Logo on Right
    const cardLogoPath = path.resolve(__dirname, '../assets/travelx-card-logo.png');
    const defaultLogoPath = path.resolve(__dirname, '../assets/travelx-logo.png');
    const logoPath = fs.existsSync(cardLogoPath) ? cardLogoPath : defaultLogoPath;
    if (fs.existsSync(logoPath)) {
      const imgId = workbook.addImage({
        filename: logoPath,
        extension: 'png'
      });
      // Embedded on the right side over Column E, exactly as in user screenshot!
      ws.addImage(imgId, {
        tl: { col: 4.02, row: 0.1 },
        ext: { width: 148, height: 43 }
      });
    }
  } catch (err) {
    console.error('Failed to embed logo into Excel:', err);
  }
}

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
 * Excel Export Desk (Streams native .xlsx using ExcelJS matching user screenshot)
 */
exports.exportToExcel = async (req, res) => {
  try {
    const {
      origin,
      destination,
      travel_date,
      date_from,
      date_to,
      airline_code,
      vendor_id,
      is_published,
      sectors
    } = req.query;

    let query = `
      SELECT 
        f.travel_date AS "Date",
        a.name AS "Airline Name",
        f.origin AS "Origin",
        f.destination AS "Destination",
        f.departure_time AS "Departure",
        f.arrival_time AS "Arrival",
        f.net_fare AS "Net Fare (INR)",
        f.margin_amount AS "Travelx Margin (INR)",
        f.publish_fare AS "Publish Fare (INR)",
        f.baggage AS "Baggage",
        f.cabin AS "Cabin",
        f.is_refundable AS "Refundable",
        v.name AS "Vendor / Source",
        CASE WHEN f.is_published = 1 THEN 'Yes' ELSE 'No' END AS "Published",
        f.updated_at AS "Updated Time",
        f.remarks AS "Remarks"
      FROM fares f
      JOIN vendors v ON f.vendor_id = v.id
      JOIN airlines a ON f.airline_code = a.code
      WHERE 1=1
    `;
    const params = [];

    if (origin) {
      query += ` AND f.origin = ?`;
      params.push(origin.toUpperCase());
    }
    if (destination) {
      query += ` AND f.destination = ?`;
      params.push(destination.toUpperCase());
    }
    if (travel_date) {
      query += ` AND f.travel_date = ?`;
      params.push(travel_date);
    }
    if (date_from) {
      query += ` AND f.travel_date >= ?`;
      params.push(date_from);
    }
    if (date_to) {
      query += ` AND f.travel_date <= ?`;
      params.push(date_to);
    }
    if (airline_code) {
      query += ` AND f.airline_code = ?`;
      params.push(airline_code.toUpperCase());
    }
    if (vendor_id) {
      query += ` AND f.vendor_id = ?`;
      params.push(Number(vendor_id));
    }
    if (is_published !== undefined && is_published !== '') {
      query += ` AND f.is_published = ?`;
      params.push(Number(is_published));
    }

    query += ` ORDER BY f.origin ASC, f.destination ASC, f.airline_code ASC, f.travel_date ASC`;

    let rawFares = db.prepare(query).all(...params);

    if (sectors) {
      const sectorOrderList = String(sectors).split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
      if (sectorOrderList.length > 0) {
        const orderMap = new Map();
        sectorOrderList.forEach((sec, idx) => orderMap.set(sec, idx));
        rawFares = rawFares.filter(f => orderMap.has(`${f.Origin}-${f.Destination}`));
        rawFares.sort((a, b) => {
          const keyA = `${a.Origin}-${a.Destination}`;
          const keyB = `${b.Origin}-${b.Destination}`;
          const orderA = orderMap.get(keyA) ?? 9999;
          const orderB = orderMap.get(keyB) ?? 9999;
          if (orderA !== orderB) return orderA - orderB;
          const airA = a['Airline Name'] || '';
          const airB = b['Airline Name'] || '';
          if (airA !== airB) return airA.localeCompare(airB);
          return (a.Date || '').localeCompare(b.Date || '');
        });
      }
    }

    // 1. Generate Consolidated Data (matching user's date range image)
    const consolidatedList = groupFaresByDateRanges(rawFares.map(r => ({
      ...r,
      origin: r.Origin,
      destination: r.Destination,
      travel_date: r.Date,
      airline_name: r['Airline Name'],
      airline_code: r['Airline Name'],
      publish_fare: r['Publish Fare (INR)'],
      net_fare: r['Net Fare (INR)'],
      margin_amount: r['Travelx Margin (INR)'],
      baggage: r.Baggage,
      cabin: r.Cabin,
      vendor_name: r['Vendor / Source']
    })));

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Travelx Special Fare Manager';
    workbook.created = new Date();

    // Sheet 1: Consolidated Rate Sheet
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

    // Row 2: Table Column Headers (Calibri 20pt Bold White)
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

    const dataFont = {
      name: 'Calibri',
      size: 18,
      bold: true,
      color: { argb: 'FF000000' }
    };

    let currentRow = 3;
    let lastSectorKey = null;
    let sectorColorIdx = 0;

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

      const c1 = row.getCell(1);
      c1.value = idx + 1;
      c1.alignment = { vertical: 'middle', horizontal: 'center' };

      const c2 = row.getCell(2);
      c2.value = airline;
      c2.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

      const c3 = row.getCell(3);
      c3.value = route;
      c3.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

      const c4 = row.getCell(4);
      c4.value = netFare;
      c4.numFmt = '#,##0.00';
      c4.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };

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

    currentRow++; // 1 row breathing space
    applyBottomFooter(wsConsolidated, currentRow);

    // Sheet 2: Detailed All Dates
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

    // Row 2: Table Column Headers (Calibri 20pt Bold White)
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

    rawFares.forEach((f, idx) => {
      const row = wsDetailed.getRow(curDetailedRow);
      row.height = 32;

      const sectorKey = `${f.Origin}_${f.Destination}`;
      if (lastDetSector !== null && sectorKey !== lastDetSector) {
        detSectorColorIdx = (detSectorColorIdx + 1) % 3; // Max 3 Colors!
      }
      lastDetSector = sectorKey;
      const currentFill = sectorColors[detSectorColorIdx];

      const netFare = Number(f['Publish Fare (INR)'] || f['Net Fare (INR)']) || 0;
      const airline = f['Airline Name'] || '';
      const route = formatRouteName(f.Origin, f.Destination, 'TO');

      row.getCell(1).value = idx + 1;
      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(2).value = airline;
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

      row.getCell(3).value = route;
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

      row.getCell(4).value = netFare;
      row.getCell(4).numFmt = '#,##0.00';
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };

      row.getCell(5).value = f.Date;
      row.getCell(5).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

      for (let c = 1; c <= 5; c++) {
        const cell = row.getCell(c);
        cell.font = dataFont;
        cell.fill = currentFill;
        cell.border = thinGridBorder;
      }

      // Col G: Vendor Name
      const detVendor = row.getCell(7);
      detVendor.value = f['Vendor / Source'] || f.vendor_name || '';
      detVendor.font = dataFont;
      detVendor.fill = currentFill;
      detVendor.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      detVendor.border = thinGridBorder;

      curDetailedRow++;
    });

    curDetailedRow++; // 1 row breathing space
    applyBottomFooter(wsDetailed, curDetailedRow);

    const filename = `Travelx_Special_Fares_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error exporting to Excel:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
