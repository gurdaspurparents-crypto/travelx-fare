import React, { useState, useEffect } from 'react';
import { MessageSquare, Sparkles, Check, AlertCircle, Save, Trash2, ArrowRight, FileSpreadsheet, UploadCloud, Image as ImageIcon } from 'lucide-react';
import { api } from '../utils/api';
import { parseExcelFile, downloadExcelTemplate } from '../utils/excelParser';
import { parseImageFares } from '../utils/imageOcrParser';
import ExcelImportModal from '../components/ExcelImportModal';

export default function BulkPaste({ masterData, onFaresSaved, setActiveTab }) {
  const { airlines = [], vendors = [], routes = [] } = masterData;

  const [rawText, setRawText] = useState('');
  const [vendorId, setVendorId] = useState(() => {
    try {
      const saved = localStorage.getItem('travelx_active_vendor_id');
      if (saved) return saved;
    } catch (_) {}
    return vendors[0]?.id || 1;
  });

  const handleSelectVendor = (vId) => {
    setVendorId(vId);
    try {
      if (vId) localStorage.setItem('travelx_active_vendor_id', String(vId));
    } catch (_) {}
  };
  const [parsedData, setParsedData] = useState(null);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [parsedExcelResult, setParsedExcelResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  const sampleMessages = [
    `AI ATQ-DXB\nBaggage 30kg Non-Refundable\n\n15 SEP 17100\n16 SEP 16900\n17 SEP 17200\n18 SEP 17500`,
    `6E DEL-DXB\n\n15-Sep 15200\n16-Sep 14800\n17-Sep 15400\n18-Sep 15900`,
    `G9 ATQ to SHJ\nSpecial Series Rate 30KG\n15/09 15400\n16/09 15200\n17/09 15500\n18/09 15700`
  ];

  const handleLoadSample = (sampleText) => {
    setRawText(sampleText);
    setStatus({ type: 'info', text: 'Sample WhatsApp message loaded. Click "Parse WhatsApp Message" to review preview.' });
  };

  const handleParse = async () => {
    if (!rawText.trim()) {
      setStatus({ type: 'error', text: 'Please paste WhatsApp text in the box below.' });
      return;
    }

    try {
      setLoading(true);
      setStatus(null);
      const res = await api.parseWhatsApp(rawText);
      if (res.success) {
        setParsedData(res);
        if (res.records.length === 0) {
          setStatus({
            type: 'error',
            text: 'Could not extract date & fare rows. Please ensure lines look like "15 SEP 17100".'
          });
        } else {
          setStatus({
            type: 'info',
            text: `Successfully extracted ${res.records.length} fare records! Please review and edit in the preview table below before saving.`
          });
        }
      } else {
        setStatus({ type: 'error', text: res.error || 'Failed to parse text.' });
      }
    } catch (err) {
      setStatus({ type: 'error', text: 'Server error while parsing text.' });
    } finally {
      setLoading(false);
    }
  };

  const handleExcelUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      setStatus(null);
      const res = await parseExcelFile(file);
      if (res.success) {
        if (res.validCount === 0) {
          setStatus({
            type: 'error',
            text: `No valid date and fare rows detected in "${file.name}". Please ensure columns like "Travel Date" and "Net Fare" have values.`
          });
        } else {
          setParsedExcelResult(res);
          setIsExcelModalOpen(true);
          setStatus({
            type: 'info',
            text: `📊 Excel sheet "${file.name}" loaded (${res.validCount} fares)! Wizard opened to select vendor.`
          });
        }
      } else {
        setStatus({ type: 'error', text: res.error || 'Failed to read Excel file.' });
      }
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', text: 'Error reading Excel file.' });
    } finally {
      setLoading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleProcessImageFile = async (file) => {
    if (!file) return;
    try {
      setLoading(true);
      setStatus({ type: 'info', text: '🔍 Scanning rate card image with OCR...' });
      const res = await parseImageFares(file, { defaultOrigin: 'ATQ', defaultDestination: 'DXB' });
      if (res.success) {
        setRawText(res.rawText);
        setParsedData(res.parsed);
        if (res.records.length === 0) {
          setStatus({
            type: 'info',
            text: 'Text scanned from image, but no dates & fares could be identified. Check text in box above.'
          });
        } else {
          setStatus({
            type: 'success',
            text: `🎉 Scanned image successfully! Extracted ${res.records.length} date & fare records ready for review.`
          });
        }
      } else {
        setStatus({ type: 'error', text: res.error || 'Failed to scan image.' });
      }
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', text: 'Error scanning image OCR.' });
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessImageFile(file);
    }
    if (e.target) e.target.value = '';
  };

  // Clipboard paste listener
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            handleProcessImageFile(blob);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleRecordChange = (index, field, value) => {
    setParsedData(prev => {
      const updatedRecords = [...prev.records];
      updatedRecords[index] = { ...updatedRecords[index], [field]: value };
      return { ...prev, records: updatedRecords };
    });
  };

  const handleDeleteRecord = (index) => {
    setParsedData(prev => ({
      ...prev,
      records: prev.records.filter((_, i) => i !== index)
    }));
  };

  const handleSaveToDatabase = async () => {
    if (!parsedData || !parsedData.records || parsedData.records.length === 0) {
      setStatus({ type: 'error', text: 'No parsed fare records to save.' });
      return;
    }

    try {
      setSaving(true);
      setStatus(null);
      const res = await api.saveBulkFares(vendorId, parsedData.records, false, 'sector');
      if (res.success) {
        const delMsg = res.deleted_count > 0 ? ` (${res.deleted_count} sold-out / absent dates deleted)` : '';
        setStatus({
          type: 'success',
          text: `🎉 Successfully saved ${res.saved_count} records into the database!${delMsg} All fares are now live in the Comparison Desk.`
        });
        setRawText('');
        setParsedData(null);
        if (onFaresSaved) onFaresSaved();
      } else {
        setStatus({ type: 'error', text: res.error || 'Failed to save parsed fares.' });
      }
    } catch (err) {
      setStatus({ type: 'error', text: 'Error saving records.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
          <MessageSquare className="w-5 h-5 text-emerald-600" />
          <span>WhatsApp Bulk Paste Input</span>
        </h1>
        <p className="text-xs text-slate-500">
          Paste text messages directly copied from vendor WhatsApp groups. The engine parses airline, route, dates, and fares with an editable preview grid.
        </p>
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

      {/* Paste Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="w-full sm:w-72">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Select Vendor / Source *
            </label>
            <select
              value={vendorId}
              onChange={(e) => handleSelectVendor(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900"
            >
              {vendors.length === 0 ? (
                <option value="">-- No Vendors (Add in Master Data) --</option>
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

          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-500 font-medium">Try Sample:</span>
            {sampleMessages.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleLoadSample(s)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 text-xs font-semibold rounded border border-slate-200 transition"
              >
                Sample {idx + 1}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Paste WhatsApp Message Content *
          </label>
          <textarea
            rows={7}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="AI ATQ-DXB&#10;&#10;15 SEP 17100&#10;16 SEP 16900&#10;17 SEP 17200&#10;18 SEP 17500"
            className="w-full bg-slate-50 font-mono text-sm border border-slate-300 rounded-xl p-4 text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          ></textarea>
        </div>

        <div className="flex flex-wrap items-center justify-between pt-2 gap-2">
          <span className="text-xs text-slate-400">
            Supports AI, 6E, IX, SG, UK, G9, FZ, EK and dates like 15 Sep, 15/09, 15-09.
          </span>
          <div className="flex items-center space-x-2">
            <input
              type="file"
              id="bulkpaste-image-file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => document.getElementById('bulkpaste-image-file')?.click()}
              disabled={loading}
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-bold text-xs rounded-lg border border-indigo-300 transition flex items-center space-x-1.5 cursor-pointer"
              title="Upload rate card image or screenshot to scan with OCR"
            >
              <ImageIcon className="w-4 h-4 text-indigo-600" />
              <span>🖼️ Scan Image</span>
            </button>

            <input
              type="file"
              id="bulkpaste-excel-file"
              accept=".xlsx, .xls, .csv"
              onChange={handleExcelUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => document.getElementById('bulkpaste-excel-file')?.click()}
              disabled={loading}
              className="px-3.5 py-2 bg-slate-100 hover:bg-emerald-50 text-emerald-800 font-bold text-xs rounded-lg border border-emerald-300 transition flex items-center space-x-1.5 cursor-pointer"
              title="Upload an Excel sheet (.xlsx, .xls, .csv) directly"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Upload Excel</span>
            </button>
            <button
              type="button"
              onClick={downloadExcelTemplate}
              className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-xs rounded-lg border border-slate-200 transition"
              title="Download Sample Excel Template"
            >
              Template
            </button>
            <button
              onClick={handleParse}
              disabled={loading}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm transition flex items-center space-x-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>{loading ? 'Parsing...' : 'Parse WhatsApp Text'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Editable Preview Table before saving (Requested in Section 4) */}
      {parsedData && parsedData.records && parsedData.records.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden animate-fade-in">
          <div className="px-6 py-4 bg-emerald-50/70 border-b border-emerald-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-emerald-950 flex items-center space-x-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Parsed Preview Table ({parsedData.records.length} records detected)</span>
              </h2>
              <p className="text-xs text-emerald-800">
                Review and edit any row directly before confirming database import.
              </p>
            </div>

            <button
              onClick={handleSaveToDatabase}
              disabled={saving}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm transition flex items-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : `Confirm & Save ${parsedData.records.length} Fares`}</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase">
                <tr>
                  <th className="px-4 py-3 text-center w-10">#</th>
                  <th className="px-4 py-3 text-left w-28">Airline *</th>
                  <th className="px-4 py-3 text-left w-24">From *</th>
                  <th className="px-4 py-3 text-left w-24">To *</th>
                  <th className="px-4 py-3 text-left w-36">Travel Date *</th>
                  <th className="px-4 py-3 text-left w-36">Net Fare (₹) *</th>
                  <th className="px-4 py-3 text-left w-28">Baggage</th>
                  <th className="px-4 py-3 text-left w-32">Refundable</th>
                  <th className="px-4 py-3 text-center w-16">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsedData.records.map((rec, index) => (
                  <tr key={rec.id || `rec_${index}_${rec.travel_date || ''}_${rec.origin || ''}`} className="hover:bg-slate-50/80">
                    <td className="px-4 py-2 text-center text-slate-400 font-mono">{index + 1}</td>
                    <td className="px-4 py-2">
                      <select
                        value={rec.airline_code || ''}
                        onChange={(e) => handleRecordChange(index, 'airline_code', e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-bold text-slate-900"
                      >
                        {airlines.map(a => (
                          <option key={a.code} value={a.code}>{a.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={rec.origin || ''}
                        onChange={(e) => handleRecordChange(index, 'origin', e.target.value.toUpperCase())}
                        maxLength={3}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-bold uppercase text-slate-900 text-center"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={rec.destination || ''}
                        onChange={(e) => handleRecordChange(index, 'destination', e.target.value.toUpperCase())}
                        maxLength={3}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-bold uppercase text-slate-900 text-center"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="date"
                        value={rec.travel_date || ''}
                        onChange={(e) => handleRecordChange(index, 'travel_date', e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-semibold text-slate-900"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={rec.net_fare !== undefined && rec.net_fare !== null ? rec.net_fare : ''}
                        onChange={(e) => handleRecordChange(index, 'net_fare', e.target.value)}
                        className="w-full bg-amber-50 border border-amber-300 rounded px-2 py-1 font-extrabold text-slate-900"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={rec.baggage || '30kg'}
                        onChange={(e) => handleRecordChange(index, 'baggage', e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-700"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={rec.is_refundable || 'NON_REFUNDABLE'}
                        onChange={(e) => handleRecordChange(index, 'is_refundable', e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-700"
                      >
                        <option value="NON_REFUNDABLE">Non-Ref</option>
                        <option value="REFUNDABLE">Refundable</option>
                      </select>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => handleDeleteRecord(index)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
