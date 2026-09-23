import React, { useState, useEffect } from 'react';
import { 
  Table, Plus, Trash2, Save, Calendar, Check, AlertCircle, 
  Sparkles, ArrowRight, Zap, FileSpreadsheet, UploadCloud, Download, ExternalLink, ArrowUpDown, RefreshCw 
} from 'lucide-react';
import { api } from '../utils/api';
import { parseExcelFile, parseMultipleExcelFiles, downloadExcelTemplate } from '../utils/excelParser';
import { getAirlineName } from '../utils/airlineHelper';
import ExcelImportModal from '../components/ExcelImportModal';

export default function QuickGrid({ masterData, onFaresSaved, setActiveTab }) {
  const { airlines = [], vendors = [], routes = [] } = masterData;

  const [vendorId, setVendorId] = useState(() => {
    try {
      const saved = localStorage.getItem('travelx_active_vendor_id');
      if (saved) return saved;
    } catch (_) {}
    return vendors[0]?.id || '';
  });

  const handleSelectVendor = (vId) => {
    if (!vId) return;
    const idStr = String(vId);
    setVendorId(idStr);
    try {
      localStorage.setItem('travelx_active_vendor_id', idStr);
    } catch (_) {}
  };

  const [airlineCode, setAirlineCode] = useState(airlines[0]?.code || 'AI');
  const [origin, setOrigin] = useState('ATQ');
  const [destination, setDestination] = useState('DXB');
  const [baggage, setBaggage] = useState('30+7 KG');
  const [isRefundable, setIsRefundable] = useState('NON_REFUNDABLE');
  const [cabin, setCabin] = useState('ECONOMY');

  // Auto-sync vendorId and airlineCode when masterData loads
  useEffect(() => {
    if (vendors && vendors.length > 0) {
      let saved = '';
      try {
        saved = localStorage.getItem('travelx_active_vendor_id') || '';
      } catch (_) {}
      const target = vendorId || saved;
      const exists = vendors.some(v => String(v.id) === String(target));
      if (exists) {
        if (String(vendorId) !== String(target)) setVendorId(String(target));
      } else if (vendors[0]?.id) {
        setVendorId(String(vendors[0].id));
      }
    }
  }, [vendors, vendorId]);

  useEffect(() => {
    if (airlines && airlines.length > 0) {
      const exists = airlines.some(a => a.code === airlineCode);
      if (!exists) {
        setAirlineCode(airlines[0].code);
      }
    }
  }, [airlines, airlineCode]);

  // Active Tool Selection: 'excel' or 'date-range'
  const [activeBatchTool, setActiveBatchTool] = useState('excel');

  // Excel Import & Wizard State
  const [excelLoading, setExcelLoading] = useState(false);
  const [excelSummary, setExcelSummary] = useState(null);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [parsedExcelResult, setParsedExcelResult] = useState(null);

  // Date Range Quick Filler State (e.g. 15 Sep to 30 Sep at same fare)
  const todayStr = new Date().toISOString().slice(0, 10);
  const defaultEnd = new Date();
  defaultEnd.setDate(defaultEnd.getDate() + 15);
  const defaultEndStr = defaultEnd.toISOString().slice(0, 10);

  const [rangeStart, setRangeStart] = useState(todayStr);
  const [rangeEnd, setRangeEnd] = useState(defaultEndStr);
  const [rangeFare, setRangeFare] = useState('');
  const [rangeSaving, setRangeSaving] = useState(false);

  // Initial grid rows
  const [rows, setRows] = useState(() => {
    const today = new Date();
    const initial = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      initial.push({
        id: i + 1,
        travel_date: d.toISOString().slice(0, 10),
        net_fare: ''
      });
    }
    return initial;
  });

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const handleRowChange = (index, field, value) => {
    setRows(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddRow = () => {
    const lastRow = rows[rows.length - 1];
    let nextDateStr = new Date().toISOString().slice(0, 10);
    if (lastRow && lastRow.travel_date) {
      const d = new Date(lastRow.travel_date);
      d.setDate(d.getDate() + 1);
      nextDateStr = d.toISOString().slice(0, 10);
    }
    setRows(prev => [
      ...prev,
      { id: Date.now(), travel_date: nextDateStr, net_fare: '' }
    ]);
  };

  const handleDeleteRow = (index) => {
    setRows(prev => prev.filter((_, i) => i !== index));
  };

  const generateDays = (count) => {
    const today = new Date();
    const newRows = [];
    for (let i = 0; i < count; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      newRows.push({
        id: i + 1,
        travel_date: d.toISOString().slice(0, 10),
        net_fare: ''
      });
    }
    setRows(newRows);
    setStatus({ type: 'info', text: `Generated ${count} consecutive dates starting today.` });
  };

  // Helper: calculate number of days between rangeStart and rangeEnd
  const calculateRangeDays = () => {
    if (!rangeStart || !rangeEnd) return 0;
    const s = new Date(rangeStart);
    const e = new Date(rangeEnd);
    if (s > e) return 0;
    const diffTime = Math.abs(e - s);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  // Helper: Clear all rows in grid
  const handleClearGrid = () => {
    setRows([]);
    setStatus({ type: 'info', text: 'Grid cleared. You can add single rows or auto-fill date ranges.' });
  };

  // Helper: Sort rows chronologically by travel date
  const handleSortByDate = () => {
    setRows(prev => {
      const sorted = [...prev].sort((a, b) => String(a.travel_date).localeCompare(String(b.travel_date)));
      return sorted.map((r, i) => ({ ...r, id: i + 1 }));
    });
    setStatus({ type: 'info', text: 'Grid rows sorted chronologically by travel date.' });
  };

  // Feature 1: Populate Grid with Date Range (Preserves manual single entries & appends range next)
  const handlePopulateDateRangeToGrid = () => {
    if (!rangeStart || !rangeEnd) {
      setStatus({ type: 'error', text: 'Please select both start date and end date.' });
      return;
    }
    const s = new Date(rangeStart);
    const e = new Date(rangeEnd);
    if (s > e) {
      setStatus({ type: 'error', text: 'Start date cannot be after end date.' });
      return;
    }

    // Generate date range rows
    const rangeRows = [];
    let curr = new Date(s);
    while (curr <= e) {
      rangeRows.push({
        travel_date: curr.toISOString().slice(0, 10),
        net_fare: rangeFare || ''
      });
      curr.setDate(curr.getDate() + 1);
    }

    // Filter existing rows that user manually entered (has a non-empty fare)
    const existingManualRows = rows.filter(r => 
      r.net_fare !== '' && 
      r.net_fare !== null && 
      r.net_fare !== undefined && 
      String(r.net_fare).trim() !== ''
    );

    let combined = [];
    if (existingManualRows.length > 0) {
      // Keep existing manual single entries!
      // If a date from the range already exists in manual rows, keep the manual entry so it's not overwritten
      const existingDateSet = new Set(existingManualRows.map(r => r.travel_date));
      const newRangeRows = rangeRows.filter(r => !existingDateSet.has(r.travel_date));

      // Append new date range entries next, sorted chronologically by date
      combined = [...existingManualRows, ...newRangeRows].sort((a, b) => 
        String(a.travel_date).localeCompare(String(b.travel_date))
      );
    } else {
      combined = rangeRows;
    }

    // Re-index all IDs sequentially so # column displays 1, 2, 3...
    const finalRows = combined.map((r, i) => ({
      ...r,
      id: i + 1
    }));

    setRows(finalRows);

    if (existingManualRows.length > 0) {
      setStatus({
        type: 'success',
        text: `✅ Manual single entry (${existingManualRows.length} row${existingManualRows.length > 1 ? 's' : ''}) preserved! Added ${rangeRows.length} date range rows next. Total: ${finalRows.length} rows in grid.`
      });
    } else {
      setStatus({
        type: 'info',
        text: `Populated ${finalRows.length} rows for date range (${rangeStart} to ${rangeEnd}) with rate ₹${rangeFare || '0'}. You can review or edit below.`
      });
    }
  };

  // Feature 2: Instant 1-Click Save Date Range directly to DB
  const handleInstantSaveDateRange = async () => {
    if (!rangeStart || !rangeEnd) {
      setStatus({ type: 'error', text: 'Please select both start date and end date.' });
      return;
    }
    if (!rangeFare || Number(rangeFare) <= 0) {
      setStatus({ type: 'error', text: 'Please enter a valid Net Fare for the date range.' });
      return;
    }
    const s = new Date(rangeStart);
    const e = new Date(rangeEnd);
    if (s > e) {
      setStatus({ type: 'error', text: 'Start date cannot be after end date.' });
      return;
    }

    const activeVendor = vendors.find(v => v.id === Number(vendorId)) || vendors[0];
    if (!activeVendor) {
      setStatus({ type: 'error', text: '⚠️ Please select a Vendor before saving.' });
      return;
    }

    const activeAirline = airlines.find(a => a.code === airlineCode) || airlines[0];
    if (!activeAirline) {
      setStatus({ type: 'error', text: '⚠️ Please select an Airline before saving.' });
      return;
    }

    try {
      setRangeSaving(true);
      setStatus(null);
      const payload = {
        vendor_id: Number(activeVendor.id),
        airline_code: activeAirline.code,
        origin: (origin || 'ATQ').toUpperCase(),
        destination: (destination || 'DXB').toUpperCase(),
        start_date: rangeStart,
        end_date: rangeEnd,
        net_fare: Number(rangeFare),
        flight_number: '',
        cabin,
        baggage,
        is_refundable: isRefundable,
        remarks: `Date range batch (${rangeStart} to ${rangeEnd})`
      };

      const res = await api.saveDateRange(payload);
      if (res.success && res.saved_count > 0) {
        setStatus({
          type: 'success',
          text: `🎉 Successfully saved all ${res.saved_count} days for ${activeVendor.name} (${activeAirline.name}: ${origin} → ${destination}) from ${res.start_date} to ${res.end_date} at ₹${Number(res.net_fare).toLocaleString('en-IN')}! Database updated.`
        });
        if (onFaresSaved) onFaresSaved();
      } else {
        const errDetail = res.errors?.[0]?.error || res.error || 'Failed to save date range.';
        setStatus({ type: 'error', text: `❌ Save failed: ${errDetail}` });
      }
    } catch (err) {
      setStatus({ type: 'error', text: '❌ Error saving date range: ' + (err.message || err) });
    } finally {
      setRangeSaving(false);
    }
  };

  // Feature 3: Excel File (.xlsx, .xls, .csv) Upload & Multi-Route/Vendor Wizard (Multi-File Support)
  const handleExcelUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    try {
      setExcelLoading(true);
      setStatus(null);
      const res = await parseMultipleExcelFiles(files, {
        defaultOrigin: origin,
        defaultDestination: destination,
        defaultAirline: airlineCode
      });

      if (res.success) {
        if (res.validCount === 0) {
          setStatus({
            type: 'error',
            text: `No valid date and fare rows detected in selected files. Please ensure columns like "Travel Date" and "Net Fare" have values.`
          });
        } else {
          // Store result and immediately open Wizard Modal to prompt "Kis Vendor ki Excel hai?"
          setParsedExcelResult(res);
          setExcelSummary(res);
          setIsExcelModalOpen(true);

          // Also populate grid rows for live backup/review
          const gridRows = res.rows.map((r, i) => ({
            id: i + 1,
            travel_date: r.travel_date,
            net_fare: r.net_fare
          }));
          setRows(gridRows);

          // Update context fields if detected
          if (res.distinctRoutes && res.distinctRoutes.length > 0) {
            const [firstOrig, firstDest] = res.distinctRoutes[0].split('-');
            if (firstOrig && firstDest) {
              setOrigin(firstOrig);
              setDestination(firstDest);
            }
          }
          if (res.distinctAirlines && res.distinctAirlines.length > 0) {
            setAirlineCode(res.distinctAirlines[0]);
          }

          const fileTxt = files.length > 1 ? `${files.length} Excel files` : `"${files[0].name}"`;
          setStatus({
            type: 'info',
            text: `📊 ${fileTxt} loaded: ${res.validCount} fares across ${res.groups?.length || 1} routes! Wizard opened to assign vendor.`
          });
        }
      } else {
        setStatus({ type: 'error', text: res.error || 'Failed to read Excel files.' });
      }
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', text: 'Error reading Excel file(s).' });
    } finally {
      setExcelLoading(false);
      if (e.target) e.target.value = '';
    }
  };

  // Feature 4: Direct Instant Save of Imported Excel to Database
  const handleDirectSaveExcel = async () => {
    if (!excelSummary || !excelSummary.rows || excelSummary.rows.length === 0) {
      setStatus({ type: 'error', text: 'Please import an Excel file first.' });
      return;
    }

    const activeVendor = vendors.find(v => v.id === Number(vendorId)) || vendors[0];
    if (!activeVendor) {
      setStatus({ type: 'error', text: '⚠️ Please select a Vendor before saving!' });
      return;
    }

    const activeAirline = airlines.find(a => a.code === airlineCode) || airlines[0];
    if (!activeAirline) {
      setStatus({ type: 'error', text: '⚠️ Please select an Airline before saving!' });
      return;
    }

    try {
      setLoading(true);
      setStatus(null);
      const payload = {
        vendor_id: Number(activeVendor.id),
        airline_code: activeAirline.code,
        origin: (origin || 'ATQ').toUpperCase(),
        destination: (destination || 'DXB').toUpperCase(),
        flight_number: '',
        cabin,
        baggage,
        is_refundable: isRefundable,
        entries: excelSummary.rows.map(r => ({
          travel_date: r.travel_date,
          net_fare: Number(r.net_fare),
          flight_number: ''
        }))
      };

      const res = await api.saveQuickGrid(payload);
      if (res.success && res.saved_count > 0) {
        setStatus({
          type: 'success',
          text: `🎉 Direct Save Success! All ${res.saved_count} fares from "${excelSummary.fileName}" saved for vendor "${activeVendor.name}"!`
        });
        if (onFaresSaved) onFaresSaved();
      } else {
        const errMsg = res.error || (res.errors && res.errors[0]?.error) || 'Failed to save imported fares.';
        setStatus({ type: 'error', text: `❌ Save failed: ${errMsg}` });
      }
    } catch (err) {
      setStatus({ type: 'error', text: 'Error saving imported Excel fares: ' + (err.message || err) });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAllGrid = async () => {
    const validEntries = rows.filter(r => r.travel_date && Number(r.net_fare) > 0);
    if (validEntries.length === 0) {
      setStatus({ type: 'error', text: '⚠️ Please enter at least one valid date and net fare (₹) in the grid.' });
      return;
    }

    const activeVendor = vendors.find(v => v.id === Number(vendorId)) || vendors[0];
    if (!activeVendor) {
      setStatus({ type: 'error', text: '⚠️ Please select a Vendor before saving!' });
      return;
    }

    const activeAirline = airlines.find(a => a.code === airlineCode) || airlines[0];
    if (!activeAirline) {
      setStatus({ type: 'error', text: '⚠️ Please select an Airline before saving!' });
      return;
    }

    try {
      setLoading(true);
      setStatus(null);
      const payload = {
        vendor_id: Number(activeVendor.id),
        airline_code: activeAirline.code,
        origin: (origin || 'ATQ').toUpperCase(),
        destination: (destination || 'DXB').toUpperCase(),
        flight_number: '',
        cabin,
        baggage,
        is_refundable: isRefundable,
        entries: validEntries.map(r => ({
          travel_date: r.travel_date,
          net_fare: Number(r.net_fare),
          flight_number: ''
        }))
      };

      const res = await api.saveQuickGrid(payload);
      if (res.success && res.saved_count > 0) {
        setStatus({
          type: 'success',
          text: `🎉 Successfully saved ${res.saved_count} fares for vendor "${activeVendor.name}" (${activeAirline.name}: ${origin} → ${destination})! SQLite database updated.`
        });
        if (onFaresSaved) onFaresSaved();
      } else {
        const errMsg = res.error || (res.errors && res.errors[0]?.error) || 'Failed to save batch fares.';
        setStatus({ type: 'error', text: `❌ Save failed: ${errMsg}` });
      }
    } catch (err) {
      console.error('Error saving grid fares:', err);
      setStatus({ type: 'error', text: `❌ Error saving grid fares: ${err.message || err}` });
    } finally {
      setLoading(false);
    }
  };

  const rangeDaysCount = calculateRangeDays();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <Table className="w-5 h-5 text-blue-600" />
            <span>Quick Grid & Date Range Fare Entry</span>
          </h1>
          <p className="text-xs text-slate-500">
            Select Vendor, Airline, and Route once. Then enter a date range (e.g. 15 Sep to 30 Sep) or enter dates in the grid with 1-click save!
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => generateDays(7)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
          >
            + 7 Days
          </button>
          <button
            onClick={() => generateDays(14)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
          >
            + 14 Days
          </button>
          <button
            onClick={() => generateDays(30)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
          >
            + 30 Days
          </button>
        </div>
      </div>

      {status && (
        <div className={`p-4 rounded-xl flex items-center space-x-3 text-sm font-medium ${
          status.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
            : status.type === 'error'
            ? 'bg-rose-50 text-rose-800 border border-rose-200'
            : 'bg-blue-50 text-blue-800 border border-blue-200'
        }`}>
          {status.type === 'success' ? (
            <Check className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{status.text}</span>
        </div>
      )}

      {/* Static Context Selector (Selected Once) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
            1. Master Context (Applied to all dates)
          </span>
          <span className="text-xs text-blue-600 font-medium">Selected once for whole batch</span>
        </div>

        {/* Quick Vendor Heads Selector */}
        {vendors.length > 0 && (
          <div className="mb-4 pb-3 border-b border-slate-100">
            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Vendor Heads (Click to switch vendor):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {vendors.map(v => {
                const isSelected = Number(vendorId) === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleSelectVendor(v.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                      isSelected
                        ? 'bg-slate-900 text-white shadow-xs ring-2 ring-emerald-500'
                        : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800'
                    }`}
                  >
                    <span>🏢 {v.name}</span>
                    {isSelected && <Check className="w-3 h-3 text-emerald-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-bold text-slate-700 mb-1">Vendor *</label>
            <select
              value={vendorId}
              onChange={(e) => handleSelectVendor(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900"
            >
              {vendors.length === 0 ? (
                <option value="">-- No Vendors Found --</option>
              ) : (
                <>
                  <option value="">Select Vendor...</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </>
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Airline *</label>
            <select
              value={airlineCode}
              onChange={(e) => setAirlineCode(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900"
            >
              {airlines.map(a => (
                <option key={a.code} value={a.code}>{a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">From *</label>
            <input
              type="text"
              value={origin}
              onChange={(e) => setOrigin(e.target.value.toUpperCase())}
              maxLength={3}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold uppercase text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">To *</label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value.toUpperCase())}
              maxLength={3}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold uppercase text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Baggage</label>
            <select
              value={baggage}
              onChange={(e) => setBaggage(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
            >
              <option value="30+7 KG">30+7 KG</option>
              <option value="30kg">30kg</option>
              <option value="20kg">20kg</option>
              <option value="25kg">25kg</option>
              <option value="35kg">35kg</option>
              <option value="40kg">40kg</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Refundable</label>
            <select
              value={isRefundable}
              onChange={(e) => setIsRefundable(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
            >
              <option value="NON_REFUNDABLE">Non-Refundable</option>
              <option value="REFUNDABLE">Refundable</option>
            </select>
          </div>
        </div>
      </div>

      {/* Batch Entry Options Toolbar: Excel Import vs Date Range */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-2 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-700 px-2">Fast Input Mode:</span>
            <button
              type="button"
              onClick={() => setActiveBatchTool('excel')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition flex items-center space-x-1.5 ${
                activeBatchTool === 'excel'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>📊 Excel / CSV File Import</span>
              <span className="px-1.5 py-0.2 bg-emerald-800 text-[10px] text-emerald-100 rounded font-black">NEW</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveBatchTool('date-range')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition flex items-center space-x-1.5 ${
                activeBatchTool === 'date-range'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>📅 Date Range Auto-Fill (e.g. 15 to 30 Sep)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={downloadExcelTemplate}
            className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 text-xs font-bold rounded-lg border border-emerald-300 shadow-xs transition flex items-center space-x-1.5 self-start sm:self-auto"
            title="Download sample Excel template (.xlsx)"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Download Excel Template</span>
          </button>
        </div>

        {/* TOOL 1: EXCEL / CSV SPREADSHEET IMPORT CARD */}
        {activeBatchTool === 'excel' && (
          <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 rounded-xl p-5 text-white shadow-sm border border-emerald-800/60">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-emerald-800/80 mb-4 gap-3">
              <div className="flex items-center space-x-2.5">
                <span className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <FileSpreadsheet className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-white tracking-wide flex items-center space-x-2">
                    <span>Excel / Spreadsheet Fare Import</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30 font-mono">
                      .xlsx, .xls, .csv
                    </span>
                  </h2>
                  <p className="text-[11px] text-emerald-200">
                    Upload any vendor Excel rate sheet. Dates and net fares will be extracted and populated into the grid automatically!
                  </p>
                </div>
              </div>
            </div>

            {/* Upload Area */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              <div className="md:col-span-8">
                <input
                  type="file"
                  id="quickgrid-excel-file"
                  accept=".xlsx, .xls, .csv"
                  multiple
                  onChange={handleExcelUpload}
                  className="hidden"
                />
                <label
                  htmlFor="quickgrid-excel-file"
                  className="cursor-pointer flex flex-col items-center justify-center border-2 border-dashed border-emerald-500/60 hover:border-emerald-400 bg-slate-800/70 hover:bg-slate-800 rounded-xl p-5 transition group text-center"
                >
                  <UploadCloud className="w-8 h-8 text-emerald-400 group-hover:scale-110 transition-transform mb-1.5" />
                  <span className="text-xs font-bold text-white flex items-center justify-center space-x-1.5">
                    <span>{excelLoading ? 'Reading & Merging Excel Files...' : 'Click to Browse or Drag & Drop Multiple Excel Files Here'}</span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">MULTI</span>
                  </span>
                  <span className="text-[11px] text-slate-300 mt-1">
                    Select 1 or multiple .xlsx, .xls, .csv files at once. All dates and fares are merged automatically.
                  </span>
                </label>
              </div>

              <div className="md:col-span-4 space-y-2">
                {excelSummary ? (
                  <div className="bg-slate-800/90 border border-emerald-500/40 rounded-xl p-3.5 text-xs space-y-2">
                    <div className="flex items-center space-x-1.5 text-emerald-300 font-bold">
                      <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                      <span className="truncate">{excelSummary.fileName}</span>
                    </div>
                    <div className="text-[11px] text-slate-300">
                      Found <strong className="text-white font-bold">{excelSummary.validCount}</strong> fare dates in sheet <em>"{excelSummary.sheetName}"</em>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Detected Date: {excelSummary.detectedDateColumn} | Fare: {excelSummary.detectedFareColumn}
                    </div>
                    <div className="pt-1 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => setIsExcelModalOpen(true)}
                        className="w-full py-2 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs rounded-lg shadow-sm transition flex items-center justify-center space-x-1.5"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-950" />
                        <span>🧙‍♂️ Open Vendor & Route Wizard</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDirectSaveExcel}
                        disabled={loading}
                        className="w-full py-1.5 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs rounded-lg shadow-xs transition flex items-center justify-center space-x-1"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-300" />
                        <span>{loading ? 'Saving...' : '1-Click Direct Save to DB'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-3 text-xs text-slate-300 space-y-1.5">
                    <span className="font-bold text-emerald-300 block text-[11px] uppercase tracking-wider">
                      How Excel Import Works:
                    </span>
                    <p className="text-[11px] text-slate-300">
                      1. Upload vendor's rate sheet (.xlsx / .csv).
                    </p>
                    <p className="text-[11px] text-slate-300">
                      2. Dates & net fares populate into the grid below.
                    </p>
                    <p className="text-[11px] text-slate-300">
                      3. Review or edit, then click Save!
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TOOL 2: DATE RANGE AUTO-ENTRY TOOLBAR */}
        {activeBatchTool === 'date-range' && (
          <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 rounded-xl p-5 text-white shadow-sm border border-blue-800/60">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-blue-800/80 mb-3 gap-2">
              <div className="flex items-center space-x-2">
                <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <Calendar className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-white tracking-wide">
                    Quick Date Range Auto-Entry (e.g. 15 Sep to 30 Sep Same Fare)
                  </h2>
                  <p className="text-[11px] text-blue-200">
                    If the vendor offers the same rate across multiple consecutive dates, set the range once to save or populate.
                  </p>
                </div>
              </div>
              {rangeDaysCount > 0 && (
                <span className="text-xs bg-blue-800/80 px-2.5 py-1 rounded-full font-semibold text-blue-200 border border-blue-700">
                  {rangeDaysCount} Days Selected
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-[11px] font-semibold text-blue-200 mb-1">From Date *</label>
                <input
                  type="date"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-white focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-blue-200 mb-1">To Date *</label>
                <input
                  type="date"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-white focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-amber-300 mb-1">Same Net Fare (₹) *</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    value={rangeFare}
                    onChange={(e) => setRangeFare(e.target.value)}
                    placeholder="e.g. 17100"
                    className="w-full pl-7 pr-3 py-2 bg-slate-800 border-2 border-amber-400/80 rounded-lg text-sm font-black text-amber-300 focus:bg-slate-750 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handlePopulateDateRangeToGrid}
                  className="flex-1 py-2 px-2 bg-slate-800 hover:bg-slate-700 text-blue-200 hover:text-white rounded-lg text-xs font-bold border border-slate-600 transition flex items-center justify-center space-x-1 cursor-pointer"
                  title="Populate dates into grid below (preserves existing manual single entries & adds range next)"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>⚡ Fill Grid (Add Next)</span>
                </button>
                <button
                  type="button"
                  onClick={handleInstantSaveDateRange}
                  disabled={rangeSaving}
                  className="flex-1 py-2 px-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-lg shadow-sm transition flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>{rangeSaving ? 'Saving...' : 'Instant Save'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Grid Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              2. Daily Dates & Fares Grid ({rows.length} rows)
            </span>
            {excelSummary && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                Excel: {excelSummary.validCount} Fares
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => document.getElementById('quickgrid-excel-file')?.click()}
              className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-md border border-emerald-300 transition flex items-center space-x-1 cursor-pointer"
              title="Upload Excel sheet directly"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Import Excel</span>
            </button>
            <button
              type="button"
              onClick={downloadExcelTemplate}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-md border border-slate-200 transition flex items-center space-x-1 cursor-pointer"
              title="Download Excel template"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Template</span>
            </button>
            <button
              type="button"
              onClick={handleAddRow}
              className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-md border border-blue-200 transition flex items-center space-x-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Single Row</span>
            </button>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={handleSortByDate}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-md border border-slate-200 transition flex items-center space-x-1 cursor-pointer"
                title="Sort all rows chronologically by travel date"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                <span>Sort Dates</span>
              </button>
            )}
            {rows.length > 0 && (
              <button
                type="button"
                onClick={handleClearGrid}
                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-md border border-rose-200 transition flex items-center space-x-1 cursor-pointer"
                title="Clear all rows in grid"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Clear Grid</span>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto max-h-[480px]">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-600 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-2.5 text-center w-12">#</th>
                <th className="px-6 py-2.5 text-left w-64">Travel Date *</th>
                <th className="px-6 py-2.5 text-left w-72">Vendor Net Fare (₹) *</th>
                <th className="px-4 py-2.5 text-center w-20">Remove</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                    <p className="font-semibold text-slate-600 mb-1">No rows in grid.</p>
                    <p className="text-xs mb-3">Click "Add Single Row" above or use "Date Range Auto-Fill" to add dates.</p>
                    <button
                      type="button"
                      onClick={handleAddRow}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition inline-flex items-center space-x-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Single Row</span>
                    </button>
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => {
                return (
                  <tr key={row.id || index} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-center text-slate-400 font-mono">{index + 1}</td>
                    <td className="px-6 py-2">
                      <input
                        type="date"
                        value={row.travel_date}
                        onChange={(e) => handleRowChange(index, 'travel_date', e.target.value)}
                        className="w-full max-w-xs bg-white border border-slate-300 rounded px-3 py-1.5 text-xs font-semibold text-slate-900"
                      />
                    </td>
                    <td className="px-6 py-2">
                      <div className="relative max-w-xs">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold">₹</span>
                        <input
                          type="number"
                          value={row.net_fare}
                          onChange={(e) => handleRowChange(index, 'net_fare', e.target.value)}
                          placeholder="e.g. 17100"
                          className="w-full pl-7 pr-3 py-1.5 bg-amber-50/50 border border-amber-300 rounded text-xs font-black text-slate-900 focus:bg-white focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => handleDeleteRow(index)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 transition rounded"
                        title="Remove row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>

        {/* Bottom Save Bar */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1 max-w-2xl">
            <div className="text-xs text-slate-600 flex flex-wrap items-center gap-2">
              <span>Ready to save: <strong className="text-slate-900 font-black">{rows.filter(r => Number(r.net_fare) > 0).length}</strong> fares</span>
              <span className="text-slate-300">•</span>
              <span>Sector: <strong className="text-blue-700 font-bold">{origin} → {destination}</strong></span>
              <span className="text-slate-300">•</span>
              <span>Airline: <strong className="text-slate-700 font-semibold">{getAirlineName(airlineCode, airlines)}</strong></span>
              <span className="text-slate-300">•</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                🏢 Vendor: {vendors.find(v => v.id === Number(vendorId))?.name || (vendors[0]?.name ?? 'Select Vendor')}
              </span>
            </div>
            {status && (
              <div className={`p-2.5 rounded-lg flex items-center space-x-2 text-xs font-semibold ${
                status.type === 'success'
                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  : status.type === 'error'
                  ? 'bg-rose-100 text-rose-900 border border-rose-300'
                  : 'bg-blue-100 text-blue-900 border border-blue-300'
              }`}>
                {status.type === 'success' ? (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span className="flex-1">{status.text}</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleSaveAllGrid}
            disabled={loading || rows.filter(r => Number(r.net_fare) > 0).length === 0}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm rounded-lg shadow-sm transition flex items-center justify-center space-x-2 shrink-0 cursor-pointer"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                <span>Saving Fares...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save All Grid Rows (1 Click)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Excel Import & Multi-Route Vendor Assignment Wizard Modal */}
      <ExcelImportModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        parsedResult={parsedExcelResult}
        masterData={masterData}
        onFaresSaved={onFaresSaved}
        onNavigateToCompare={() => setActiveTab && setActiveTab('compare')}
      />
    </div>
  );
}
