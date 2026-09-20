import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, FileSpreadsheet, Plus, Check, AlertCircle, X,
  Plane, ArrowRight, Save, Zap, Trash2, Calendar, Download, 
  MessageSquare, Sparkles, Filter, RefreshCw, UploadCloud, ChevronRight, Layers,
  Image as ImageIcon
} from 'lucide-react';
import { api } from '../utils/api';
import { parseExcelFile, parseMultipleExcelFiles, buildGroupsFromRows, downloadExcelTemplate, downloadKandhariTemplate, downloadBittuTemplate, downloadMongaTemplate } from '../utils/excelParser';
import { getAirlineName } from '../utils/airlineHelper';
import ImageOcrUploader from '../components/ImageOcrUploader';
import ClearRatesModal from '../components/ClearRatesModal';

export default function VendorFaresDesk({ masterData = {}, onFaresSaved, setActiveTab }) {
  const { vendors = [], airlines = [], routes = [] } = masterData;

  // Selected Vendor Head
  const [selectedVendorId, setSelectedVendorId] = useState(vendors[0]?.id || '');
  const [activeVendorTab, setActiveVendorTab] = useState('image'); // 'image' (Tareeqa 1), 'excel', 'grid', 'range', 'whatsapp', 'saved'

  // New Vendor creation modal / form
  const [isAddingVendor, setIsAddingVendor] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorPhone, setNewVendorPhone] = useState('');
  const [addingVendorLoading, setAddingVendorLoading] = useState(false);

  // Status message
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);

  // Vendor's active fares list from DB
  const [vendorFares, setVendorFares] = useState([]);
  const [loadingFares, setLoadingFares] = useState(false);

  // ====================== TAB 1: EXCEL UPLOAD STATE ======================
  const [excelLoading, setExcelLoading] = useState(false);
  const [excelParsed, setExcelParsed] = useState(null);
  const [excelRows, setExcelRows] = useState([]);
  const [uploadedFilesList, setUploadedFilesList] = useState([]);
  const [selectedExcelFilter, setSelectedExcelFilter] = useState('ALL');

  // ====================== TAB 2: MANUAL GRID STATE ======================
  const [gridOrigin, setGridOrigin] = useState('ATQ');
  const [gridDestination, setGridDestination] = useState('DXB');
  const [gridAirline, setGridAirline] = useState('AI');
  const [gridBaggage, setGridBaggage] = useState('30+7 KG');
  const [gridRows, setGridRows] = useState(() => {
    const today = new Date();
    const rowsArr = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      rowsArr.push({
        id: i + 1,
        travel_date: d.toISOString().slice(0, 10),
        net_fare: ''
      });
    }
    return rowsArr;
  });

  // ====================== TAB 3: DATE RANGE STATE ======================
  const todayStr = new Date().toISOString().slice(0, 10);
  const defaultEnd = new Date();
  defaultEnd.setDate(defaultEnd.getDate() + 15);
  const [rangeStart, setRangeStart] = useState(todayStr);
  const [rangeEnd, setRangeEnd] = useState(defaultEnd.toISOString().slice(0, 10));
  const [rangeFare, setRangeFare] = useState('');
  const [rangeOrigin, setRangeOrigin] = useState('ATQ');
  const [rangeDestination, setRangeDestination] = useState('DXB');
  const [rangeAirline, setRangeAirline] = useState('AI');

  // ====================== TAB 4: WHATSAPP TEXT STATE ======================
  const [rawWhatsApp, setRawWhatsApp] = useState('');
  const [parsedWhatsApp, setParsedWhatsApp] = useState(null);
  const [whatsappParsing, setWhatsappParsing] = useState(false);

  // Auto-select first vendor if none selected
  useEffect(() => {
    if (vendors.length > 0 && !selectedVendorId) {
      setSelectedVendorId(vendors[0].id);
    }
  }, [vendors, selectedVendorId]);

  // Load saved fares for active vendor
  const loadActiveVendorFares = async (vId) => {
    if (!vId) return;
    try {
      setLoadingFares(true);
      const res = await api.getAllFares({ vendor_id: vId });
      if (res.success) {
        setVendorFares(res.fares || []);
      }
    } catch (err) {
      console.error('Error fetching vendor fares:', err);
    } finally {
      setLoadingFares(false);
    }
  };

  useEffect(() => {
    if (selectedVendorId) {
      loadActiveVendorFares(selectedVendorId);
      setStatus(null);
      setExcelParsed(null);
      setExcelRows([]);
      setUploadedFilesList([]);
      setParsedWhatsApp(null);
    }
  }, [selectedVendorId]);

  const selectedVendor = vendors.find(v => v.id === Number(selectedVendorId));

  // Handle Quick Add Vendor
  const handleCreateVendor = async (e) => {
    e.preventDefault();
    if (!newVendorName.trim()) {
      setStatus({ type: 'error', text: 'Please enter a vendor name.' });
      return;
    }
    try {
      setAddingVendorLoading(true);
      const res = await api.createVendor({
        name: newVendorName.trim(),
        phone: newVendorPhone.trim(),
        is_active: 1
      });
      if (res.success && res.vendor) {
        if (masterData.vendors) {
          masterData.vendors.push(res.vendor);
        }
        setSelectedVendorId(res.vendor.id);
        setIsAddingVendor(false);
        setNewVendorName('');
        setNewVendorPhone('');
        setStatus({
          type: 'success',
          text: `🎉 New Vendor "${res.vendor.name}" created! You are now inside ${res.vendor.name}'s workspace.`
        });
      } else {
        setStatus({ type: 'error', text: res.error || 'Failed to create vendor.' });
      }
    } catch (err) {
      setStatus({ type: 'error', text: 'Error creating vendor.' });
    } finally {
      setAddingVendorLoading(false);
    }
  };

  // ====================== EXCEL HANDLERS (MULTI-FILE SUPPORT) ======================
  const handleExcelUpload = async (e, isAppend = false) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    try {
      setExcelLoading(true);
      setStatus(null);

      const res = await parseMultipleExcelFiles(files, {
        defaultOrigin: 'ATQ',
        defaultDestination: 'DXB',
        defaultAirline: 'AI'
      });

      if (res.success) {
        let newRows = res.rows;
        let newFileList = res.fileResults;

        if (isAppend && excelRows.length > 0) {
          // Append new rows to existing rows
          newRows = [...excelRows, ...res.rows];
          newFileList = [...uploadedFilesList, ...res.fileResults];
        }

        // Sort chronologically
        newRows.sort((a, b) => new Date(a.travel_date) - new Date(b.travel_date));

        const groups = buildGroupsFromRows(newRows);
        const distinctRoutes = Array.from(new Set(newRows.map(r => `${r.origin}-${r.destination}`)));
        const distinctAirlines = Array.from(new Set(newRows.map(r => r.airline_code)));

        const combinedParsed = {
          success: true,
          fileCount: newFileList.length,
          fileName: newFileList.map(f => f.fileName).join(', '),
          fileResults: newFileList,
          validCount: newRows.length,
          detectedSupplier: res.detectedSupplier || excelParsed?.detectedSupplier || null,
          distinctRoutes,
          distinctAirlines,
          groups,
          rows: newRows
        };

        setExcelParsed(combinedParsed);
        setExcelRows(newRows);
        setUploadedFilesList(newFileList);
        setSelectedExcelFilter('ALL');

        const fileMsg = newFileList.length > 1
          ? `📊 Loaded ${newFileList.length} Excel files for ${selectedVendor?.name}! Total ${newRows.length} fares found across ${groups.length} routes.`
          : `📊 Loaded "${files[0].name}" for ${selectedVendor?.name}! Found ${res.validCount} fares across ${groups.length} routes.`;

        setStatus({
          type: 'info',
          text: `${fileMsg} Review below and click Save.`
        });
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

  // Remove a single file from the loaded batch
  const handleRemoveFileFromBatch = (fileNameToRemove) => {
    const updatedFileList = uploadedFilesList.filter(f => f.fileName !== fileNameToRemove);
    const remainingRows = excelRows.filter(r => r.sourceFile !== fileNameToRemove);

    if (remainingRows.length === 0 || updatedFileList.length === 0) {
      setExcelParsed(null);
      setExcelRows([]);
      setUploadedFilesList([]);
      setStatus({ type: 'info', text: 'All loaded Excel files cleared.' });
      return;
    }

    const groups = buildGroupsFromRows(remainingRows);
    const distinctRoutes = Array.from(new Set(remainingRows.map(r => `${r.origin}-${r.destination}`)));
    const distinctAirlines = Array.from(new Set(remainingRows.map(r => r.airline_code)));

    const updatedParsed = {
      ...excelParsed,
      fileCount: updatedFileList.length,
      fileName: updatedFileList.map(f => f.fileName).join(', '),
      fileResults: updatedFileList,
      validCount: remainingRows.length,
      groups,
      distinctRoutes,
      distinctAirlines,
      rows: remainingRows
    };

    setExcelParsed(updatedParsed);
    setExcelRows(remainingRows);
    setUploadedFilesList(updatedFileList);
    setStatus({
      type: 'info',
      text: `Removed "${fileNameToRemove}". ${remainingRows.length} fares remaining across ${updatedFileList.length} file(s).`
    });
  };

  const handleClearExcelBatch = () => {
    setExcelParsed(null);
    setExcelRows([]);
    setUploadedFilesList([]);
    setStatus({ type: 'info', text: 'Cleared Excel files.' });
  };

  const handleSaveExcelToVendor = async (andSort = false) => {
    if (!selectedVendorId) {
      setStatus({ type: 'error', text: 'Please select a vendor first.' });
      return;
    }
    if (!excelRows || excelRows.length === 0) {
      setStatus({ type: 'error', text: 'No Excel rows to save.' });
      return;
    }

    try {
      setLoading(true);
      setStatus(null);
      const formattedFares = excelRows.map(r => {
        let airCode = r.airline_code || 'AI';
        const fltClean = String(r.flight_number || '').trim().replace(/[^0-9]/g, '');
        if (['191', '192', '137', '138'].includes(fltClean) || /^(IX|AIX)[\s\-_]?(191|192|137|138)$/i.test(String(r.flight_number || '').trim())) {
          airCode = 'IX';
        }
        return {
          airline_code: airCode,
          origin: r.origin || 'ATQ',
          destination: r.destination || 'DXB',
          flight_number: r.flight_number || '',
          travel_date: r.travel_date,
          net_fare: Number(r.net_fare),
          cabin: r.cabin || 'ECONOMY',
          baggage: r.baggage || '30kg',
          is_refundable: r.is_refundable || 'NON_REFUNDABLE',
          remarks: r.departure_time ? `Dep: ${r.departure_time} | ${r.sourceFile || ''}` : `Excel: ${r.sourceFile || excelParsed?.fileName || ''}`
        };
      });

      const res = await api.saveBulkFares(Number(selectedVendorId), formattedFares, true, 'sector');
      if (res.success) {
        const delMsg = res.deleted_count > 0 ? ` (${res.deleted_count} missing/sold-out dates removed)` : '';
        setStatus({
          type: 'success',
          text: `🎉 Successfully updated ${res.saved_count} fares across ${uploadedFilesList.length || 1} Excel file(s) in ${selectedVendor?.name}'s account!${delMsg}`
        });
        setExcelParsed(null);
        setExcelRows([]);
        setUploadedFilesList([]);
        loadActiveVendorFares(selectedVendorId);
        if (onFaresSaved) onFaresSaved();

        if (andSort && setActiveTab) {
          setTimeout(() => setActiveTab('compare'), 500);
        }
      } else {
        setStatus({ type: 'error', text: res.error || 'Failed to save fares.' });
      }
    } catch (err) {
      setStatus({ type: 'error', text: 'Error saving fares to database.' });
    } finally {
      setLoading(false);
    }
  };

  // Filtered rows for Excel preview
  const displayedExcelRows = useMemo(() => {
    if (selectedExcelFilter === 'ALL') return excelRows;
    return excelRows.filter(r => `${r.origin}-${r.destination}_${r.airline_code}` === selectedExcelFilter);
  }, [excelRows, selectedExcelFilter]);

  // ====================== IMAGE OCR HANDLERS ======================
  const handleSaveImageFaresToVendor = async (formattedFares, andSort = false, autoDeleteMissing = true) => {
    try {
      setLoading(true);
      const res = await api.saveBulkFares(Number(selectedVendorId), formattedFares, autoDeleteMissing, 'sector');
      if (res.success) {
        const delMsg = res.deleted_count > 0 ? ` (${res.deleted_count} missing/sold-out dates removed)` : '';
        setStatus({
          type: 'success',
          text: `🎉 Successfully saved ${res.saved_count} fares in ${selectedVendor?.name}'s account!${delMsg}`
        });
        loadActiveVendorFares(selectedVendorId);
        if (onFaresSaved) onFaresSaved();
        if (andSort && setActiveTab) {
          setTimeout(() => setActiveTab('compare'), 500);
        }
        return true;
      } else {
        setStatus({ type: 'error', text: res.error || 'Failed to save fares.' });
        return false;
      }
    } catch (err) {
      setStatus({ type: 'error', text: 'Error saving image fares to database.' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // ====================== MANUAL GRID HANDLERS ======================
  const handleSaveGridToVendor = async (andSort = false) => {
    const validRows = gridRows.filter(r => r.travel_date && Number(r.net_fare) > 0);
    if (validRows.length === 0) {
      setStatus({ type: 'error', text: 'Please enter at least one valid date and fare in the grid.' });
      return;
    }

    try {
      setLoading(true);
      setStatus(null);
      const formattedFares = validRows.map(r => ({
        airline_code: gridAirline.toUpperCase(),
        origin: gridOrigin.toUpperCase(),
        destination: gridDestination.toUpperCase(),
        flight_number: '',
        travel_date: r.travel_date,
        net_fare: Number(r.net_fare),
        cabin: 'ECONOMY',
        baggage: gridBaggage,
        is_refundable: 'NON_REFUNDABLE',
        remarks: `Manual Grid for ${selectedVendor?.name}`
      }));

      const res = await api.saveBulkFares(Number(selectedVendorId), formattedFares, true, 'sector');
      if (res.success) {
        const delMsg = res.deleted_count > 0 ? ` (${res.deleted_count} sold-out / absent dates removed)` : '';
        setStatus({
          type: 'success',
          text: `🎉 Successfully saved ${res.saved_count} fares for ${gridOrigin}-${gridDestination} in ${selectedVendor?.name}'s account!${delMsg}`
        });
        loadActiveVendorFares(selectedVendorId);
        if (onFaresSaved) onFaresSaved();

        if (andSort && setActiveTab) {
          setTimeout(() => setActiveTab('compare'), 500);
        }
      } else {
        setStatus({ type: 'error', text: res.error || 'Failed to save grid.' });
      }
    } catch (err) {
      setStatus({ type: 'error', text: 'Error saving grid fares.' });
    } finally {
      setLoading(false);
    }
  };

  // ====================== DATE RANGE HANDLERS ======================
  const handleSaveRangeToVendor = async (andSort = false) => {
    if (!rangeStart || !rangeEnd || !rangeFare || Number(rangeFare) <= 0) {
      setStatus({ type: 'error', text: 'Please enter valid start date, end date, and net fare.' });
      return;
    }

    try {
      setLoading(true);
      setStatus(null);
      const payload = {
        vendor_id: Number(selectedVendorId),
        airline_code: rangeAirline.toUpperCase(),
        origin: rangeOrigin.toUpperCase(),
        destination: rangeDestination.toUpperCase(),
        start_date: rangeStart,
        end_date: rangeEnd,
        net_fare: Number(rangeFare),
        flight_number: '',
        cabin: 'ECONOMY',
        baggage: '30kg',
        is_refundable: 'NON_REFUNDABLE',
        remarks: `Date range (${rangeStart} to ${rangeEnd}) for ${selectedVendor?.name}`
      };

      const res = await api.saveDateRange(payload);
      if (res.success) {
        setStatus({
          type: 'success',
          text: `🎉 Successfully saved all ${res.saved_count} days (${rangeStart} to ${rangeEnd}) at ₹${Number(rangeFare).toLocaleString('en-IN')} in ${selectedVendor?.name}!`
        });
        loadActiveVendorFares(selectedVendorId);
        if (onFaresSaved) onFaresSaved();

        if (andSort && setActiveTab) {
          setTimeout(() => setActiveTab('compare'), 500);
        }
      } else {
        setStatus({ type: 'error', text: res.error || 'Failed to save date range.' });
      }
    } catch (err) {
      setStatus({ type: 'error', text: 'Error saving date range.' });
    } finally {
      setLoading(false);
    }
  };

  // ====================== WHATSAPP PARSE HANDLERS ======================
  const handleParseWhatsApp = async () => {
    if (!rawWhatsApp.trim()) {
      setStatus({ type: 'error', text: 'Please paste WhatsApp message text.' });
      return;
    }
    try {
      setWhatsappParsing(true);
      setStatus(null);
      const res = await api.parseWhatsApp(rawWhatsApp);
      if (res.success && res.records && res.records.length > 0) {
        setParsedWhatsApp(res.records);
        setStatus({
          type: 'info',
          text: `Parsed ${res.records.length} fares from ${selectedVendor?.name}'s WhatsApp message. Review and click Save.`
        });
      } else {
        setStatus({ type: 'error', text: 'No dates and fares found. Ensure lines look like "15 SEP 17100".' });
      }
    } catch (err) {
      setStatus({ type: 'error', text: 'Error parsing WhatsApp text.' });
    } finally {
      setWhatsappParsing(false);
    }
  };

  const handleSaveWhatsAppToVendor = async (andSort = false) => {
    if (!parsedWhatsApp || parsedWhatsApp.length === 0) return;
    try {
      setLoading(true);
      setStatus(null);
      const res = await api.saveBulkFares(Number(selectedVendorId), parsedWhatsApp, true, 'sector');
      if (res.success) {
        const delMsg = res.deleted_count > 0 ? ` (${res.deleted_count} missing dates removed)` : '';
        setStatus({
          type: 'success',
          text: `🎉 Successfully saved ${res.saved_count} WhatsApp fares in ${selectedVendor?.name}!${delMsg}`
        });
        setParsedWhatsApp(null);
        setRawWhatsApp('');
        loadActiveVendorFares(selectedVendorId);
        if (onFaresSaved) onFaresSaved();

        if (andSort && setActiveTab) {
          setTimeout(() => setActiveTab('compare'), 500);
        }
      } else {
        setStatus({ type: 'error', text: res.error || 'Failed to save parsed fares.' });
      }
    } catch (err) {
      setStatus({ type: 'error', text: 'Error saving WhatsApp fares.' });
    } finally {
      setLoading(false);
    }
  };

  // Delete individual fare
  const handleDeleteFare = async (fareId) => {
    try {
      const res = await api.deleteFare(fareId);
      if (res.success) {
        setVendorFares(prev => prev.filter(f => f.id !== fareId));
        if (onFaresSaved) onFaresSaved();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Sort CTA */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <span className="p-2 bg-blue-500/20 text-blue-300 rounded-xl border border-blue-500/30">
              <Building2 className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center space-x-2">
                <span>Vendor Heads Hub</span>
                <span className="px-2 py-0.5 text-[10px] uppercase font-mono tracking-wider bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30 font-bold">
                  Vendor-Wise Input
                </span>
              </h1>
              <p className="text-xs text-slate-300 mt-0.5">
                Har vendor ka apna head hai. Vendor chunein, uski Excel ya manual rates dalein, fir 1-click se sab sort karein!
              </p>
            </div>
          </div>
        </div>

        {/* Global Action: Jump to Compare & Sort */}
        <button
          type="button"
          onClick={() => setActiveTab && setActiveTab('compare')}
          className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg transition-all transform hover:scale-[1.02] flex items-center justify-center space-x-2 self-start md:self-auto shrink-0"
          title="Compare all vendors date-wise & sector-wise"
        >
          <Zap className="w-5 h-5 fill-slate-950" />
          <span>🚀 SORT & COMPARE ALL VENDORS</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ============================================================ */}
      {/* SECTION 1: VENDOR HEADS BAR (Interactive Tabs) */}
      {/* ============================================================ */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-700">
              1. Choose Vendor Head ({vendors.length} Vendors Registered)
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setShowClearModal(true)}
              className="text-xs font-bold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg border border-rose-300 transition flex items-center space-x-1 cursor-pointer"
              title="Clear rates for this vendor or all vendors"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              <span>Clear Rates</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddingVendor(prev => !prev)}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-300 transition flex items-center space-x-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add New Vendor Head</span>
            </button>
          </div>
        </div>

        {/* Inline Add Vendor Form */}
        {isAddingVendor && (
          <form onSubmit={handleCreateVendor} className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 animate-fade-in space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                Create New Vendor Head
              </span>
              <button
                type="button"
                onClick={() => setIsAddingVendor(false)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Cancel
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Vendor Name *</label>
                <input
                  type="text"
                  value={newVendorName}
                  onChange={(e) => setNewVendorName(e.target.value)}
                  placeholder="e.g. Akbar, AIr IQ, Kandhari, MMT"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Phone / WhatsApp (Optional)</label>
                <input
                  type="text"
                  value={newVendorPhone}
                  onChange={(e) => setNewVendorPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsAddingVendor(false)}
                className="px-3 py-1.5 bg-white text-slate-600 text-xs font-bold rounded-lg border border-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addingVendorLoading}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm"
              >
                {addingVendorLoading ? 'Creating...' : 'Create Vendor Head'}
              </button>
            </div>
          </form>
        )}

        {/* Vendor Heads Grid / Chips */}
        <div className="flex flex-wrap gap-2.5 pt-1">
          {vendors.map(v => {
            const isSelected = Number(selectedVendorId) === v.id;
            const fareCount = v.total_fares !== undefined ? v.total_fares : (isSelected ? vendorFares.length : 0);

            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedVendorId(v.id)}
                className={`group relative px-4 py-2.5 rounded-xl text-left transition-all flex items-center space-x-2.5 ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-md ring-2 ring-emerald-500 scale-[1.02]'
                    : 'bg-slate-50 text-slate-800 border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40'
                }`}
              >
                <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-emerald-500 text-slate-950' : 'bg-slate-200 text-slate-700'}`}>
                  <Building2 className="w-4 h-4" />
                </div>

                <div>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-black tracking-tight">{v.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                  <div className={`text-[10px] font-mono ${isSelected ? 'text-emerald-300 font-bold' : 'text-slate-400'}`}>
                    {fareCount} active fares
                  </div>
                </div>

                {isSelected && (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Status Banner */}
      {status && (
        <div className={`p-4 rounded-xl flex items-center space-x-3 text-xs font-bold animate-fade-in ${
          status.type === 'success' 
            ? 'bg-emerald-50 text-emerald-900 border border-emerald-300' 
            : status.type === 'error'
            ? 'bg-rose-50 text-rose-900 border border-rose-300'
            : 'bg-blue-50 text-blue-900 border border-blue-300'
        }`}>
          {status.type === 'success' ? (
            <Check className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{status.text}</span>
        </div>
      )}

      {/* ============================================================ */}
      {/* SECTION 2: INSIDE ACTIVE VENDOR HEAD WORKSPACE */}
      {/* ============================================================ */}
      {selectedVendor && (
        <div className="bg-white rounded-2xl border-2 border-slate-300 shadow-sm overflow-hidden">
          
          {/* Active Vendor Banner Header */}
          <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-base shadow-sm">
                {selectedVendor.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-base font-black text-white">
                    🏢 {selectedVendor.name} Fares Workspace
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    ACTIVE HEAD
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Jo bhi rate yahan daalenge woh <strong>{selectedVendor.name}</strong> ke account mein save honge.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-xs">
              <span className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                {vendorFares.length} Live Fares in DB
              </span>
              <button
                type="button"
                onClick={() => downloadExcelTemplate(selectedVendor?.name)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-lg border border-slate-700 transition flex items-center space-x-1"
                title="Download Excel Template"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Template</span>
              </button>
            </div>
          </div>

          {/* Sub-Tabs Selector inside Vendor Head */}
          <div className="px-6 pt-3 bg-slate-100 border-b border-slate-200 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setActiveVendorTab('image')}
              className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                activeVendorTab === 'image'
                  ? 'bg-white text-indigo-700 border-t-2 border-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              <ImageIcon className="w-4 h-4 text-indigo-600" />
              <span>🖼️ Upload Rate Image / Screenshot</span>
              <span className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] rounded font-black shadow-xs">AI OCR (RECOMMENDED)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveVendorTab('excel')}
              className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                activeVendorTab === 'excel'
                  ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>📊 Upload {selectedVendor.name}'s Excel Sheet</span>
              <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] rounded font-bold">EXCEL</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveVendorTab('grid')}
              className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                activeVendorTab === 'grid'
                  ? 'bg-white text-blue-700 border-t-2 border-blue-600 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              <Layers className="w-4 h-4 text-blue-600" />
              <span>⌨️ Manual Grid for {selectedVendor.name}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveVendorTab('range')}
              className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                activeVendorTab === 'range'
                  ? 'bg-white text-amber-700 border-t-2 border-amber-600 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              <Calendar className="w-4 h-4 text-amber-600" />
              <span>📅 Date Range Auto-Fill (15 to 30 Sep)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveVendorTab('whatsapp')}
              className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                activeVendorTab === 'whatsapp'
                  ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <span>💬 WhatsApp Paste for {selectedVendor.name}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveVendorTab('saved')}
              className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                activeVendorTab === 'saved'
                  ? 'bg-white text-slate-900 border-t-2 border-slate-900 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              <Check className="w-4 h-4 text-slate-600" />
              <span>📋 View Active Rates ({vendorFares.length})</span>
            </button>
          </div>

          {/* Workspace Body */}
          <div className="p-6">
            
            {/* ============================================================ */}
            {/* TAB 1: UPLOAD EXCEL FOR THIS VENDOR */}
            {/* ============================================================ */}
            {activeVendorTab === 'excel' && (
              <div className="space-y-5">
                <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 rounded-xl p-5 text-white border border-emerald-800/60 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-emerald-800/80 mb-4 gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center space-x-2 flex-wrap gap-1.5">
                        <span>Drop {selectedVendor.name}'s Excel Sheets Here</span>
                        <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30 font-bold">
                          Multi-File .xlsx, .xls, .csv
                        </span>
                        <span className="text-[10px] font-mono bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30 font-bold flex items-center space-x-1">
                          <Sparkles className="w-3 h-3 text-indigo-300" />
                          <span>Monga/MMT, Kandhari & Bittu Formats Supported</span>
                        </span>
                      </h3>
                      <p className="text-[11px] text-emerald-200">
                        Supports <strong>Monga / MMT / Air IQ 4-column format</strong> (<em>Flight, Sector, Date, Fare</em>), <strong>Kandhari rate list blocks</strong> (<em>SG ATQ → DXB</em>), aur <strong>Bittu tabular series</strong>. 1 ya multiple sheets drop karein.
                      </p>
                    </div>

                    <div className="flex items-center space-x-2 self-start sm:self-auto flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => downloadMongaTemplate(selectedVendor?.name || 'Monga')}
                        className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition flex items-center space-x-1.5 ${
                          selectedVendor?.name && /monga|mmt|air\s*iq|airiq/i.test(selectedVendor.name)
                            ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/20'
                            : 'bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 hover:text-white border-blue-500/40'
                        }`}
                        title="Download 4-Column Template (Flight, Sector, Date, Fare) for Monga, MMT, Air IQ"
                      >
                        <Download className="w-3.5 h-3.5 text-blue-300" />
                        <span>Monga / MMT / Air IQ</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadKandhariTemplate()}
                        className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition flex items-center space-x-1.5 ${
                          selectedVendor?.name && /kandhari/i.test(selectedVendor.name)
                            ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-500/20'
                            : 'bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 hover:text-white border-emerald-500/40'
                        }`}
                        title="Download Kandhari Rate List Excel (SG ATQ → DXB format)"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Kandhari Template</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadBittuTemplate(selectedVendor?.name)}
                        className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition flex items-center space-x-1.5 ${
                          selectedVendor?.name && /bittu/i.test(selectedVendor.name)
                            ? 'bg-amber-600 text-white border-amber-400 shadow-md shadow-amber-500/20'
                            : 'bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white border-slate-600/50'
                        }`}
                        title="Download standard tabular series report template"
                      >
                        <Download className="w-3.5 h-3.5 text-amber-400" />
                        <span>Bittu Series Template</span>
                      </button>
                    </div>
                  </div>

                  {/* Multi-File Loaded Panel */}
                  {uploadedFilesList.length > 0 && (
                    <div className="mb-4 bg-slate-900/90 border border-emerald-500/50 rounded-xl p-4 shadow-inner space-y-3 text-white">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <span className="text-xs font-black text-emerald-400 flex items-center space-x-1.5">
                            <Check className="w-4 h-4 text-emerald-400" />
                            <span>{uploadedFilesList.length} Excel File{uploadedFilesList.length > 1 ? 's' : ''} Loaded</span>
                          </span>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold font-mono text-[11px] border border-emerald-500/30">
                            {excelRows.length} Total Fares
                          </span>
                          {excelParsed?.formatDetected === 'KANDHARI_RATE_LIST' && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold flex items-center space-x-1">
                              <Sparkles className="w-3 h-3 text-indigo-300" />
                              <span>Format: Kandhari Rate List</span>
                            </span>
                          )}
                          {excelParsed?.detectedSupplier && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                              Supplier: {excelParsed.detectedSupplier}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-2">
                          <label
                            htmlFor="vendorhead-excel-file-append"
                            className="cursor-pointer px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center space-x-1"
                            title="Add more Excel files to this batch"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ Add More Files</span>
                          </label>
                          <button
                            type="button"
                            onClick={handleClearExcelBatch}
                            className="px-2.5 py-1 bg-red-950/70 hover:bg-red-900 text-red-300 hover:text-white text-xs font-bold rounded-lg border border-red-800/60 transition"
                          >
                            Clear All
                          </button>
                        </div>
                      </div>

                      {/* File Badges Chips */}
                      <div className="flex flex-wrap gap-1.5">
                        {uploadedFilesList.map((f, fIdx) => (
                          <span
                            key={fIdx}
                            className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs font-mono group"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="font-semibold text-white max-w-[200px] truncate" title={f.fileName}>
                              {f.fileName}
                            </span>
                            <span className="text-emerald-400 font-bold">({f.validCount})</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveFileFromBatch(f.fileName)}
                              className="text-slate-400 hover:text-red-400 p-0.5 rounded hover:bg-slate-700 transition"
                              title={`Remove ${f.fileName}`}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        ))}
                      </div>

                      {/* Quick Save CTA Row */}
                      <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-300">
                          Review detected routes below or save all directly into <strong>{selectedVendor.name}</strong>:
                        </span>
                        <div className="flex items-center space-x-2 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => handleSaveExcelToVendor(false)}
                            disabled={loading}
                            className="px-4 py-1.5 bg-white text-slate-900 font-bold text-xs rounded-lg shadow-sm hover:bg-slate-100 transition flex items-center space-x-1.5"
                          >
                            <Save className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{loading ? 'Saving...' : `Save All ${excelRows.length} to ${selectedVendor.name}`}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveExcelToVendor(true)}
                            disabled={loading}
                            className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-lg shadow-sm transition flex items-center space-x-1"
                          >
                            <Zap className="w-3.5 h-3.5 text-slate-950" />
                            <span>⚡ Save & Sort</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Primary File Input (Multi-File enabled) */}
                  <input
                    type="file"
                    id="vendorhead-excel-file"
                    accept=".xlsx, .xls, .csv"
                    multiple
                    onChange={(e) => handleExcelUpload(e, false)}
                    className="hidden"
                  />
                  {/* Append File Input */}
                  <input
                    type="file"
                    id="vendorhead-excel-file-append"
                    accept=".xlsx, .xls, .csv"
                    multiple
                    onChange={(e) => handleExcelUpload(e, true)}
                    className="hidden"
                  />

                  <label
                    htmlFor="vendorhead-excel-file"
                    className="cursor-pointer flex flex-col items-center justify-center border-2 border-dashed border-emerald-500/60 hover:border-emerald-400 bg-slate-800/70 hover:bg-slate-800 rounded-xl p-6 transition group text-center"
                  >
                    <UploadCloud className="w-10 h-10 text-emerald-400 group-hover:scale-110 transition-transform mb-2" />
                    <span className="text-sm font-bold text-white flex items-center space-x-2">
                      <span>
                        {excelLoading
                          ? 'Reading & Merging Excel files...'
                          : `Click to Browse or Drag & Drop Multiple Excel Files for ${selectedVendor.name}`}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                        MULTIPLE FILES
                      </span>
                    </span>
                    <span className="text-xs text-slate-300 mt-1">
                      Hold Ctrl or Shift to select multiple Excel files at once (.xlsx, .xls, .csv).
                    </span>
                    <span className="text-[11px] text-emerald-300/80 mt-0.5">
                      Multiple series calendar reports will be auto-merged into {selectedVendor.name}'s account.
                    </span>
                  </label>
                </div>

                {/* Detected Breakdown Preview */}
                {excelParsed && excelParsed.groups && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-black text-slate-900">
                          Detected Sectors & Airlines for {selectedVendor.name} ({excelParsed.groups.length} Groups)
                        </h4>
                        <p className="text-xs text-slate-500">
                          File: <strong>{excelParsed.fileName}</strong> | Total Valid Fares: <strong className="text-emerald-700">{excelRows.length}</strong>
                        </p>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => handleSaveExcelToVendor(false)}
                          disabled={loading}
                          className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center space-x-1.5"
                        >
                          <Save className="w-4 h-4 text-emerald-400" />
                          <span>{loading ? 'Saving...' : `Save All to ${selectedVendor.name}`}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveExcelToVendor(true)}
                          disabled={loading}
                          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-sm transition flex items-center space-x-2"
                        >
                          <Zap className="w-4 h-4 text-amber-300" />
                          <span>⚡ Save & Sort All Vendors</span>
                        </button>
                      </div>
                    </div>

                    {/* Breakdown Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {excelParsed.groups.map(g => {
                        const isSel = selectedExcelFilter === g.key;
                        return (
                          <button
                            key={g.key}
                            type="button"
                            onClick={() => setSelectedExcelFilter(isSel ? 'ALL' : g.key)}
                            className={`p-3.5 rounded-xl border text-left transition ${
                              isSel
                                ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-400 shadow-xs'
                                : 'bg-white border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-xs text-slate-900 flex items-center space-x-1.5">
                                <Plane className="w-3.5 h-3.5 text-blue-600" />
                                <span>{g.origin} ➔ {g.destination}</span>
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                                {getAirlineName(g.airline_code, airlines)}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-600 flex items-center justify-between">
                              <span>{g.count} Dates</span>
                              <span className="font-black text-emerald-700">
                                ₹{g.minFare.toLocaleString('en-IN')} - ₹{g.maxFare.toLocaleString('en-IN')}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1 truncate">
                              📅 {g.minDate} to {g.maxDate}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Preview Table */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px] sticky top-0 border-b border-slate-200">
                          <tr>
                            <th className="px-3 py-2">#</th>
                            <th className="px-3 py-2">Date</th>
                            <th className="px-3 py-2">Sector</th>
                            <th className="px-3 py-2">Airline</th>
                            <th className="px-3 py-2">Flight No</th>
                            <th className="px-3 py-2">Dep Time</th>
                            <th className="px-3 py-2">Fare (₹)</th>
                            <th className="px-3 py-2">Source File</th>
                            <th className="px-3 py-2">Supplier</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {displayedExcelRows.map((r, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="px-3 py-1.5 text-slate-400 font-mono">{i + 1}</td>
                              <td className="px-3 py-1.5 font-medium text-slate-900">{r.travel_date}</td>
                              <td className="px-3 py-1.5 font-bold uppercase text-blue-700">{r.origin} ➔ {r.destination}</td>
                              <td className="px-3 py-1.5 font-bold text-slate-800">
                                <span className="inline-flex items-center space-x-1">
                                  <span className="px-1 py-0.2 rounded bg-slate-900 text-white font-mono text-[9px]">{r.airline_code}</span>
                                  <span>{getAirlineName(r.airline_code, airlines)}</span>
                                </span>
                              </td>
                              <td className="px-3 py-1.5 font-mono font-bold text-slate-800">{r.flight_number || '-'}</td>
                              <td className="px-3 py-1.5 font-mono text-slate-600">{r.departure_time || '-'}</td>
                              <td className="px-3 py-1.5 font-black text-slate-900">₹{Number(r.net_fare).toLocaleString('en-IN')}</td>
                              <td className="px-3 py-1.5 font-mono text-[11px] text-slate-500 truncate max-w-[140px]" title={r.sourceFile}>{r.sourceFile || '-'}</td>
                              <td className="px-3 py-1.5 text-slate-500 text-[11px] truncate max-w-[150px]">{r.supplier_name || selectedVendor.name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================ */}
            {/* TAB 1.5: IMAGE / SCREENSHOT UPLOAD (OCR) FOR THIS VENDOR */}
            {/* ============================================================ */}
            {activeVendorTab === 'image' && (
              <ImageOcrUploader
                vendorName={selectedVendor.name}
                vendorId={selectedVendorId}
                masterData={masterData}
                onFaresSaved={handleSaveImageFaresToVendor}
                setActiveTab={setActiveTab}
              />
            )}

            {/* ============================================================ */}
            {/* TAB 2: MANUAL QUICK GRID FOR THIS VENDOR */}
            {/* ============================================================ */}
            {activeVendorTab === 'grid' && (
              <div className="space-y-4">
                {/* Sector & Airline Selector */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">From *</label>
                    <input
                      type="text"
                      value={gridOrigin}
                      onChange={(e) => setGridOrigin(e.target.value.toUpperCase())}
                      maxLength={3}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold uppercase text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">To *</label>
                    <input
                      type="text"
                      value={gridDestination}
                      onChange={(e) => setGridDestination(e.target.value.toUpperCase())}
                      maxLength={3}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold uppercase text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Airline *</label>
                    <select
                      value={gridAirline}
                      onChange={(e) => setGridAirline(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900"
                    >
                      {airlines.map(a => (
                        <option key={a.code} value={a.code}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Baggage</label>
                    <select
                      value={gridBaggage}
                      onChange={(e) => setGridBaggage(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                    >
                      <option value="30+7 KG">30+7 KG</option>
                      <option value="30kg">30kg</option>
                      <option value="20kg">20kg</option>
                      <option value="25kg">25kg</option>
                      <option value="35kg">35kg</option>
                      <option value="40kg">40kg</option>
                    </select>
                  </div>
                </div>

                {/* Grid Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2">#</th>
                        <th className="px-4 py-2">Travel Date</th>
                        <th className="px-4 py-2">Net Fare for {selectedVendor.name} (₹) *</th>
                        <th className="px-4 py-2 text-right">Remove</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {gridRows.map((r, i) => (
                        <tr key={r.id}>
                          <td className="px-4 py-2 text-slate-400 font-mono">{i + 1}</td>
                          <td className="px-4 py-2">
                            <input
                              type="date"
                              value={r.travel_date}
                              onChange={(e) => {
                                const val = e.target.value;
                                setGridRows(prev => prev.map(row => row.id === r.id ? { ...row, travel_date: val } : row));
                              }}
                              className="bg-slate-50 border border-slate-300 rounded px-2 py-1 font-bold text-slate-900"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <div className="relative max-w-xs flex items-center">
                              <span className="text-slate-400 font-bold mr-1">₹</span>
                              <input
                                type="number"
                                value={r.net_fare}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setGridRows(prev => prev.map(row => row.id === r.id ? { ...row, net_fare: val } : row));
                                }}
                                placeholder="e.g. 17100"
                                className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-xs font-black text-slate-900 focus:bg-white focus:border-blue-500"
                              />
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => setGridRows(prev => prev.filter(row => row.id !== r.id))}
                              className="p-1 text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const lastDate = gridRows.length > 0 ? new Date(gridRows[gridRows.length - 1].travel_date) : new Date();
                      lastDate.setDate(lastDate.getDate() + 1);
                      setGridRows(prev => [
                        ...prev,
                        { id: Date.now(), travel_date: lastDate.toISOString().slice(0, 10), net_fare: '' }
                      ]);
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Row</span>
                  </button>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleSaveGridToVendor(false)}
                      disabled={loading}
                      className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center space-x-1.5"
                    >
                      <Save className="w-4 h-4 text-emerald-400" />
                      <span>{loading ? 'Saving...' : `Save Grid to ${selectedVendor.name}`}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveGridToVendor(true)}
                      disabled={loading}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-sm transition flex items-center space-x-2"
                    >
                      <Zap className="w-4 h-4 text-amber-300" />
                      <span>⚡ Save & Sort All Vendors</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* TAB 3: DATE RANGE FOR THIS VENDOR */}
            {/* ============================================================ */}
            {activeVendorTab === 'range' && (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 rounded-xl p-5 text-white border border-blue-800/60 shadow-xs">
                  <div className="pb-3 border-b border-blue-800/80 mb-4">
                    <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-amber-400" />
                      <span>Date Range Rate for {selectedVendor.name} (e.g. 15 Sep to 30 Sep Same Fare)</span>
                    </h3>
                    <p className="text-[11px] text-blue-200">
                      Agar {selectedVendor.name} ne lagataar kayi dinon ke liye same rate diya hai, to range bhar kar 1-click se save karein.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs text-slate-300 font-medium mb-1">Route & Airline</label>
                      <div className="flex items-center space-x-1">
                        <input
                          type="text"
                          value={rangeOrigin}
                          onChange={(e) => setRangeOrigin(e.target.value.toUpperCase())}
                          className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold text-white text-center"
                          maxLength={3}
                        />
                        <span className="text-slate-400 text-xs">➔</span>
                        <input
                          type="text"
                          value={rangeDestination}
                          onChange={(e) => setRangeDestination(e.target.value.toUpperCase())}
                          className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold text-white text-center"
                          maxLength={3}
                        />
                        <select
                          value={rangeAirline}
                          onChange={(e) => setRangeAirline(e.target.value)}
                          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold text-white"
                        >
                          {airlines.map(a => (
                            <option key={a.code} value={a.code}>{a.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-300 font-medium mb-1">Start Date</label>
                      <input
                        type="date"
                        value={rangeStart}
                        onChange={(e) => setRangeStart(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-slate-300 font-medium mb-1">End Date</label>
                      <input
                        type="date"
                        value={rangeEnd}
                        onChange={(e) => setRangeEnd(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-amber-300 font-bold mb-1">Net Fare (₹)</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 font-bold">₹</span>
                        <input
                          type="number"
                          value={rangeFare}
                          onChange={(e) => setRangeFare(e.target.value)}
                          placeholder="e.g. 17100"
                          className="w-full pl-6 pr-3 py-1.5 bg-slate-800 border-2 border-amber-400 rounded-lg text-sm font-black text-amber-300"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-4 mt-2 border-t border-blue-800/60">
                    <button
                      type="button"
                      onClick={() => handleSaveRangeToVendor(false)}
                      disabled={loading}
                      className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-600 transition flex items-center space-x-1.5"
                    >
                      <Save className="w-4 h-4 text-emerald-400" />
                      <span>Save Range to {selectedVendor.name}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveRangeToVendor(true)}
                      disabled={loading}
                      className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-sm transition flex items-center space-x-2"
                    >
                      <Zap className="w-4 h-4" />
                      <span>⚡ Save & Sort All Vendors</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* TAB 4: WHATSAPP PASTE FOR THIS VENDOR */}
            {/* ============================================================ */}
            {activeVendorTab === 'whatsapp' && (
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Paste {selectedVendor.name}'s WhatsApp Message:
                  </label>
                  <textarea
                    rows={6}
                    value={rawWhatsApp}
                    onChange={(e) => setRawWhatsApp(e.target.value)}
                    placeholder="AI ATQ-DXB&#10;15 SEP 17100&#10;16 SEP 16900&#10;17 SEP 17200"
                    className="w-full bg-white font-mono text-xs border border-slate-300 rounded-xl p-3 text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  ></textarea>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-400">
                      Supports AI, 6E, IX, SG, G9, FZ and dates like 15 Sep, 15/09.
                    </span>
                    <button
                      type="button"
                      onClick={handleParseWhatsApp}
                      disabled={whatsappParsing}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm transition flex items-center space-x-1.5"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>{whatsappParsing ? 'Parsing...' : `Parse ${selectedVendor.name}'s Text`}</span>
                    </button>
                  </div>
                </div>

                {parsedWhatsApp && parsedWhatsApp.length > 0 && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-950">
                        Parsed {parsedWhatsApp.length} fares for {selectedVendor.name}
                      </span>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => handleSaveWhatsAppToVendor(false)}
                          disabled={loading}
                          className="px-4 py-1.5 bg-slate-900 text-white font-bold text-xs rounded-lg shadow-xs"
                        >
                          Save to {selectedVendor.name}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveWhatsAppToVendor(true)}
                          disabled={loading}
                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-lg shadow-sm"
                        >
                          ⚡ Save & Sort All Vendors
                        </button>
                      </div>
                    </div>

                    <div className="max-h-48 overflow-y-auto border border-emerald-200 rounded-lg bg-white">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-emerald-100 text-emerald-900 uppercase font-bold text-[10px]">
                          <tr>
                            <th className="px-3 py-1.5">Date</th>
                            <th className="px-3 py-1.5">Route</th>
                            <th className="px-3 py-1.5">Airline</th>
                            <th className="px-3 py-1.5">Fare</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {parsedWhatsApp.map((p, i) => (
                            <tr key={i}>
                              <td className="px-3 py-1 font-medium">{p.travel_date}</td>
                              <td className="px-3 py-1 font-bold text-blue-700">{p.origin}-{p.destination}</td>
                              <td className="px-3 py-1 font-bold text-slate-800">{getAirlineName(p.airline_code, airlines)}</td>
                              <td className="px-3 py-1 font-black text-slate-900">₹{p.net_fare}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================ */}
            {/* TAB 5: ACTIVE FARES TABLE FOR THIS VENDOR */}
            {/* ============================================================ */}
            {activeVendorTab === 'saved' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    Active Fares currently stored for <strong>{selectedVendor.name}</strong> ({vendorFares.length} total)
                  </span>

                  <button
                    type="button"
                    onClick={() => loadActiveVendorFares(selectedVendor.id)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Refresh</span>
                  </button>
                </div>

                {loadingFares ? (
                  <div className="py-8 text-center text-xs text-slate-400">Loading fares for {selectedVendor.name}...</div>
                ) : vendorFares.length === 0 ? (
                  <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-xs text-slate-500">
                    No fares recorded yet for <strong>{selectedVendor.name}</strong>. Use Excel Upload or Manual Grid above to add rates!
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px] sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2">#</th>
                          <th className="px-3 py-2">Travel Date</th>
                          <th className="px-3 py-2">Route</th>
                          <th className="px-3 py-2">Airline</th>
                          <th className="px-3 py-2">Net Fare (₹)</th>
                          <th className="px-3 py-2">Baggage</th>
                          <th className="px-3 py-2">Last Updated</th>
                          <th className="px-3 py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {vendorFares.map((f, i) => (
                          <tr key={f.id} className="hover:bg-slate-50">
                            <td className="px-3 py-1.5 text-slate-400 font-mono">{i + 1}</td>
                            <td className="px-3 py-1.5 font-medium text-slate-900">{f.travel_date}</td>
                            <td className="px-3 py-1.5 font-bold uppercase text-blue-700">{f.origin} ➔ {f.destination}</td>
                            <td className="px-3 py-1.5 font-bold text-slate-900">{getAirlineName(f.airline_code, airlines)}</td>
                            <td className="px-3 py-1.5 font-black text-slate-900">₹{Number(f.net_fare).toLocaleString('en-IN')}</td>
                            <td className="px-3 py-1.5 text-slate-500 text-[11px]">{f.baggage || '30kg'}</td>
                            <td className="px-3 py-1.5 text-slate-400 text-[10px]">{f.updated_at ? f.updated_at.slice(0, 16) : '-'}</td>
                            <td className="px-3 py-1.5 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteFare(f.id)}
                                className="text-slate-400 hover:text-rose-600 p-1"
                                title="Delete fare"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Bottom Action Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-600">
              Active Head: <strong className="text-slate-900">{selectedVendor.name}</strong> | Once you have added fares for your vendors, click Sort & Compare to find the lowest rate!
            </div>

            <button
              type="button"
              onClick={() => setActiveTab && setActiveTab('compare')}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm rounded-xl shadow-sm transition flex items-center justify-center space-x-2"
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>🚀 Sort & Compare All Vendors (#1 Lowest)</span>
            </button>
          </div>

        </div>
      )}

      {/* Clear Rates Modal */}
      <ClearRatesModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        vendors={vendors}
        defaultVendorId={selectedVendorId}
        onRatesCleared={(clearedVendorId) => {
          if (selectedVendorId) {
            loadActiveVendorFares(selectedVendorId);
          }
          if (onFaresSaved) onFaresSaved();
          setStatus({ type: 'success', text: 'Rates cleared successfully.' });
        }}
      />
    </div>
  );
}
