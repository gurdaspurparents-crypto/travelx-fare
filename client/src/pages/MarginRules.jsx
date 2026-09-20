import React, { useState, useEffect } from 'react';
import { 
  Sliders, Plus, Check, AlertCircle, Trash2, Edit3, Calculator, 
  ArrowRight, Zap, Sparkles, Building2, TrendingDown, TrendingUp, 
  RefreshCw, CheckCircle2, ShieldAlert, Plane, Layers, ChevronRight
} from 'lucide-react';
import { api } from '../utils/api';
import { formatRouteName } from '../utils/airportHelper';

export default function MarginRules({ masterData = {} }) {
  const { airlines = [], vendors = [] } = masterData;

  // Active top-level tab: 'vendor-rules' | 'general-margins'
  const [activeTab, setActiveTab] = useState('vendor-rules');

  // General margin rules state
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);

  // Vendor pricing rules state
  const [vendorRules, setVendorRules] = useState([]);
  const [loadingVendorRules, setLoadingVendorRules] = useState(false);
  const [applyingRules, setApplyingRules] = useState(false);
  const [applyResult, setApplyResult] = useState(null);
  const [vendorFilter, setVendorFilter] = useState('ALL');

  // New vendor rule form state
  const [showAddVendorRule, setShowAddVendorRule] = useState(false);
  const [newVendorRule, setNewVendorRule] = useState({
    vendor_name: 'Bipasha',
    airline_code: '',
    origin: '',
    destination: '',
    min_fare: 0,
    max_fare: 99999999,
    adjustment_type: 'LESS',
    adjustment_amount: 1000,
    description: ''
  });

  // Standard Airline & Sector margin presets
  const standardPresets = [
    { name: 'IndiGo (6E) Default Margin', airline_code: '6E', origin: '', destination: '', margin_amount: 300, priority: 20 },
    { name: 'SpiceJet (SG) Default Margin', airline_code: 'SG', origin: '', destination: '', margin_amount: 400, priority: 20 },
    { name: 'Air India (AI) Default Margin', airline_code: 'AI', origin: '', destination: '', margin_amount: 500, priority: 20 },
    { name: 'Air India Express (IX) Default Margin', airline_code: 'IX', origin: '', destination: '', margin_amount: 500, priority: 20 },
    { name: 'Air Arabia (G9) Default Margin', airline_code: 'G9', origin: '', destination: '', margin_amount: 500, priority: 20 },
    { name: 'ATQ → DXB Sector Margin', airline_code: '', origin: 'ATQ', destination: 'DXB', margin_amount: 600, priority: 25 },
    { name: 'ATQ → SHJ Sector Margin', airline_code: '', origin: 'ATQ', destination: 'SHJ', margin_amount: 500, priority: 25 }
  ];

  // Simulator state
  const [simInput, setSimInput] = useState({
    net_fare: 16900,
    airline_code: 'AI',
    origin: 'ATQ',
    destination: 'DXB'
  });
  const [simResult, setSimResult] = useState(null);

  useEffect(() => {
    loadGeneralRules();
    loadVendorRules();
  }, []);

  const loadGeneralRules = async () => {
    try {
      setLoading(true);
      const res = await api.getMarginRules();
      if (res.success) {
        setRules(res.rules);
      }
    } catch (err) {
      console.error('Error loading margin rules:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadVendorRules = async () => {
    try {
      setLoadingVendorRules(true);
      const res = await api.getVendorRules();
      if (res.success) {
        setVendorRules(res.rules || []);
      }
    } catch (err) {
      console.error('Error loading vendor rules:', err);
    } finally {
      setLoadingVendorRules(false);
    }
  };

  const handleApplyVendorRulesToDb = async (specificVendor = null) => {
    try {
      setApplyingRules(true);
      setStatus(null);
      setApplyResult(null);
      const payload = specificVendor ? { vendor_name: specificVendor } : {};
      const res = await api.applyVendorRulesToExisting(payload);
      if (res.success) {
        setApplyResult(res);
        setStatus({
          type: 'success',
          text: `🎉 Successfully updated ${res.updated_count} fares across ${res.total_checked} checked records in the database!`
        });
        loadVendorRules();
      } else {
        setStatus({ type: 'error', text: res.error || 'Failed to apply vendor rules.' });
      }
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', text: 'Error applying vendor rules to database fares.' });
    } finally {
      setApplyingRules(false);
    }
  };

  const handleCreateVendorRule = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...newVendorRule,
        adjustment_amount: Number(newVendorRule.adjustment_amount)
      };
      const res = await api.createVendorRule(payload);
      if (res.success) {
        setStatus({ type: 'success', text: `Vendor rule created successfully!` });
        setShowAddVendorRule(false);
        loadVendorRules();
      } else {
        setStatus({ type: 'error', text: res.error || 'Failed to create vendor rule.' });
      }
    } catch (err) {
      setStatus({ type: 'error', text: 'Network error creating vendor rule.' });
    }
  };

  const handleDeleteVendorRule = async (id) => {
    if (!window.confirm('Delete this vendor rule?')) return;
    try {
      const res = await api.deleteVendorRule(id);
      if (res.success) {
        setVendorRules(prev => prev.filter(r => r.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredVendorRules = vendorFilter === 'ALL' 
    ? vendorRules 
    : vendorRules.filter(r => (r.vendor_name || '').toLowerCase() === vendorFilter.toLowerCase());

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 bg-indigo-100 text-indigo-800 text-[11px] font-black rounded-lg uppercase tracking-wider">
              PRICING & MARGIN DESK
            </span>
            <span className="text-xs text-slate-400 font-bold">•</span>
            <span className="text-xs font-bold text-slate-500">Automated Rate Deductions & Markups</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1">Vendor & Margin Rules</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Auto-deduct vendor discounts (e.g. Bipasha) or apply sector slabs (Monga, Ghai, Kandhari, MMT, Air IQ, Bittu)
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center space-x-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('vendor-rules')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer flex items-center space-x-2 ${
              activeTab === 'vendor-rules'
                ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Vendor Pricing Rules</span>
            <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-700 text-[10px] rounded-full font-mono">
              {vendorRules.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('general-margins')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer flex items-center space-x-2 ${
              activeTab === 'general-margins'
                ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>General Margins & Slabs</span>
            <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 text-[10px] rounded-full font-mono">
              {rules.length}
            </span>
          </button>
        </div>
      </div>

      {/* Status banner */}
      {status && (
        <div className={`p-4 rounded-xl text-xs font-bold flex items-center justify-between animate-pop-in ${
          status.type === 'success' 
            ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' 
            : 'bg-rose-50 text-rose-900 border border-rose-200'
        }`}>
          <div className="flex items-center space-x-2">
            {status.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
            <span>{status.text}</span>
          </div>
          <button onClick={() => setStatus(null)} className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer">×</button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: VENDOR PRICING RULES (User's Exact Requirement)                   */}
      {/* ========================================================================= */}
      {activeTab === 'vendor-rules' && (
        <div className="space-y-6">
          {/* Main Action Bar */}
          <div className="bg-gradient-to-r from-indigo-900 via-blue-900 to-slate-900 text-white p-5 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 bg-amber-400 text-slate-950 font-black text-[10px] rounded uppercase tracking-wider">
                  ACTIVE ENGINE
                </span>
                <h2 className="text-base font-black">Vendor Rate Rules Engine Active</h2>
              </div>
              <p className="text-xs text-blue-200 max-w-2xl leading-relaxed">
                Rules automatically apply whenever new rates are uploaded (OCR flyer, Excel, or Quick Grid).
                Click below to re-calculate all existing database fares right now!
              </p>
            </div>

            <div className="flex items-center space-x-2.5 shrink-0">
              <button
                type="button"
                onClick={() => handleApplyVendorRulesToDb()}
                disabled={applyingRules}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 font-black text-xs rounded-xl shadow-lg transition flex items-center space-x-2 cursor-pointer"
              >
                <Zap className={`w-4 h-4 text-slate-950 ${applyingRules ? 'animate-spin' : ''}`} />
                <span>{applyingRules ? 'Updating Rates...' : '⚡ Apply Rules to Existing Database Rates'}</span>
              </button>
            </div>
          </div>

          {/* Results Modal / Banner if just applied */}
          {applyResult && (
            <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-sm font-black text-emerald-950">
                    Database Rates Updated Successfully ({applyResult.updated_count} Fares Adjusted)
                  </h3>
                </div>
                <button
                  onClick={() => setApplyResult(null)}
                  className="text-emerald-700 hover:text-emerald-900 font-bold text-xs"
                >
                  Dismiss
                </button>
              </div>

              {applyResult.sample_details && applyResult.sample_details.length > 0 && (
                <div className="bg-white rounded-xl border border-emerald-200 overflow-hidden text-xs max-h-48 overflow-y-auto">
                  <table className="w-full text-left">
                    <thead className="bg-emerald-100/60 text-emerald-900 font-bold border-b border-emerald-200 text-[11px]">
                      <tr>
                        <th className="py-1.5 px-3">Vendor</th>
                        <th className="py-1.5 px-3">Airline / Sector</th>
                        <th className="py-1.5 px-3">Original Fare</th>
                        <th className="py-1.5 px-3">Adjusted Fare</th>
                        <th className="py-1.5 px-3">Diff</th>
                        <th className="py-1.5 px-3">Rule Applied</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {applyResult.sample_details.map((d, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-1.5 px-3 font-bold text-slate-800 font-sans">{d.vendor}</td>
                          <td className="py-1.5 px-3 font-bold text-blue-700">{d.airline} | {d.route}</td>
                          <td className="py-1.5 px-3 text-slate-500 line-through">₹{d.old_fare}</td>
                          <td className="py-1.5 px-3 font-black text-emerald-700">₹{d.new_fare}</td>
                          <td className={`py-1.5 px-3 font-black ${d.diff < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {d.diff > 0 ? `+₹${d.diff}` : `-₹${Math.abs(d.diff)}`}
                          </td>
                          <td className="py-1.5 px-3 font-sans text-slate-600 text-[10px]">{d.rule}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TWO VISUAL CARDS: EXACT REPRESENTATION OF USER IMAGES */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* CARD 1: BIPASHA RATE DISCOUNT MATRIX */}
            <div className="bg-white rounded-2xl border-2 border-rose-200 shadow-xs overflow-hidden flex flex-col">
              <div className="bg-rose-50 px-5 py-3.5 border-b border-rose-200 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-rose-200 text-rose-800 rounded-xl">
                    <TrendingDown className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">Bipasha Rate Discount Matrix</h3>
                    <p className="text-[11px] font-bold text-rose-700">Jo Rate Ho us se LESS Karna Hai</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleApplyVendorRulesToDb('Bipasha')}
                  disabled={applyingRules}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black rounded-lg shadow-xs transition cursor-pointer"
                >
                  Apply Bipasha Rules
                </button>
              </div>

              <div className="p-5 space-y-4 flex-1">
                {/* Air India Section */}
                <div>
                  <div className="flex items-center space-x-2 mb-2 pb-1 border-b border-slate-100">
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-black rounded">
                      Air India (AI)
                    </span>
                    <span className="text-[11px] font-bold text-slate-500">Direct Route Reductions</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                      <span className="font-bold text-slate-700">Delhi ➔ Milan</span>
                      <span className="font-mono font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded">- ₹2,500</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                      <span className="font-bold text-slate-700">Milan ➔ Delhi</span>
                      <span className="font-mono font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded">- ₹2,500</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                      <span className="font-bold text-slate-700">Delhi ➔ Rome</span>
                      <span className="font-mono font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded">- ₹3,000</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                      <span className="font-bold text-slate-700">Rome ➔ Delhi</span>
                      <span className="font-mono font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded">- ₹2,500</span>
                    </div>
                  </div>
                </div>

                {/* ITA Airline Section */}
                <div>
                  <div className="flex items-center space-x-2 mb-2 pb-1 border-b border-slate-100">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-black rounded">
                      ITA Airline (AZ)
                    </span>
                    <span className="text-[11px] font-bold text-slate-500">Direct Route Reductions</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                      <span className="font-bold text-slate-700">Delhi ➔ Milan</span>
                      <span className="font-mono font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded">- ₹3,500</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                      <span className="font-bold text-slate-700">Milan ➔ Delhi</span>
                      <span className="font-mono font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded">- ₹3,000</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                      <span className="font-bold text-slate-700">Delhi ➔ Rome</span>
                      <span className="font-mono font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded">- ₹3,500</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                      <span className="font-bold text-slate-700">Rome ➔ Delhi</span>
                      <span className="font-mono font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded">- ₹3,000</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                      <span className="font-bold text-slate-700">Delhi ➔ Toronto (YYZ)</span>
                      <span className="font-mono font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded">- ₹3,000</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                      <span className="font-bold text-slate-700">Toronto (YYZ) ➔ Delhi</span>
                      <span className="font-mono font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded">- ₹3,000</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 2: GULF SECTOR SLABS */}
            <div className="bg-white rounded-2xl border-2 border-emerald-200 shadow-xs overflow-hidden flex flex-col">
              <div className="bg-emerald-50 px-5 py-3.5 border-b border-emerald-200 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-emerald-200 text-emerald-800 rounded-xl">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">Gulf Sector Slab Rules</h3>
                    <p className="text-[11px] font-bold text-emerald-700">ATQ➔DXB, ATQ➔SHJ, IXC➔AUH (ADD Karna Hai)</p>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 text-[10px] font-black rounded">
                    6 Vendors Linked
                  </span>
                </div>
              </div>

              <div className="p-5 space-y-4 flex-1">
                {/* Linked Vendors */}
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                    Vendors Included:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {['Monga', 'Ghai', 'Kandhari', 'MMT', 'Air IQ', 'Bittu'].map(v => (
                      <span key={v} className="px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-800 text-xs font-black rounded-lg">
                        {v}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Slabs Table */}
                <div className="border border-emerald-200 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-emerald-100/70 text-emerald-950 font-bold border-b border-emerald-200 text-[11px]">
                      <tr>
                        <th className="py-2 px-3">Jo Rate Ho Us Se (Fare Range)</th>
                        <th className="py-2 px-3 text-right">ADD Karna Hai</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-100">
                      <tr className="hover:bg-emerald-50/50">
                        <td className="py-2 px-3 font-mono font-bold text-slate-800">₹0 — ₹10,000</td>
                        <td className="py-2 px-3 text-right font-mono font-black text-emerald-700">+ ₹100</td>
                      </tr>
                      <tr className="hover:bg-emerald-50/50">
                        <td className="py-2 px-3 font-mono font-bold text-slate-800">₹10,001 — ₹15,000</td>
                        <td className="py-2 px-3 text-right font-mono font-black text-emerald-700">+ ₹200</td>
                      </tr>
                      <tr className="hover:bg-emerald-50/50">
                        <td className="py-2 px-3 font-mono font-bold text-slate-800">₹15,001 — ₹22,000</td>
                        <td className="py-2 px-3 text-right font-mono font-black text-emerald-700">+ ₹300</td>
                      </tr>
                      <tr className="hover:bg-emerald-50/50">
                        <td className="py-2 px-3 font-mono font-bold text-slate-800">₹22,001 — ₹30,000+</td>
                        <td className="py-2 px-3 text-right font-mono font-black text-emerald-700">+ ₹500</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p className="text-[11px] text-slate-500 italic">
                  💡 Yeh slabs Amritsar to Dubai, Amritsar to Sharjah aur Chandigarh to Abu Dhabi par automatically lagte hain.
                </p>
              </div>
            </div>
          </div>

          {/* ALL CONFIGURED VENDOR RULES TABLE */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-black text-slate-900">All Active Vendor Rules ({filteredVendorRules.length})</h3>
              </div>

              <div className="flex items-center space-x-2">
                {/* Filter by vendor */}
                <select
                  value={vendorFilter}
                  onChange={(e) => setVendorFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  <option value="ALL">All Vendors ({vendorRules.length})</option>
                  <option value="Bipasha">Bipasha</option>
                  <option value="Bittu">Bittu</option>
                  <option value="Ghai">Ghai</option>
                  <option value="Kandhari">Kandhari</option>
                  <option value="Monga">Monga</option>
                  <option value="MMT">MMT</option>
                  <option value="Air IQ">Air IQ</option>
                </select>

                <button
                  type="button"
                  onClick={() => setShowAddVendorRule(!showAddVendorRule)}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg transition flex items-center space-x-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Custom Rule</span>
                </button>
              </div>
            </div>

            {/* Custom Rule Creation Form Drawer */}
            {showAddVendorRule && (
              <form onSubmit={handleCreateVendorRule} className="p-5 bg-indigo-50/50 border-b border-indigo-100 space-y-3">
                <div className="font-bold text-xs text-indigo-950">Add New Vendor Rate Rule:</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Vendor</label>
                    <select
                      value={newVendorRule.vendor_name}
                      onChange={(e) => setNewVendorRule(prev => ({ ...prev, vendor_name: e.target.value }))}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-bold"
                    >
                      {vendors.map(v => (
                        <option key={v.id} value={v.name}>{v.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Airline (Optional)</label>
                    <select
                      value={newVendorRule.airline_code}
                      onChange={(e) => setNewVendorRule(prev => ({ ...prev, airline_code: e.target.value }))}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-bold"
                    >
                      <option value="">Any Airline</option>
                      {airlines.map(a => (
                        <option key={a.code} value={a.code}>{a.name} ({a.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Origin (e.g. DEL)</label>
                    <input
                      type="text"
                      placeholder="e.g. DEL"
                      value={newVendorRule.origin}
                      onChange={(e) => setNewVendorRule(prev => ({ ...prev, origin: e.target.value.toUpperCase() }))}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Destination (e.g. MXP)</label>
                    <input
                      type="text"
                      placeholder="e.g. MXP"
                      value={newVendorRule.destination}
                      onChange={(e) => setNewVendorRule(prev => ({ ...prev, destination: e.target.value.toUpperCase() }))}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Action Type</label>
                    <select
                      value={newVendorRule.adjustment_type}
                      onChange={(e) => setNewVendorRule(prev => ({ ...prev, adjustment_type: e.target.value }))}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-bold"
                    >
                      <option value="LESS">LESS (Deduct from Rate)</option>
                      <option value="ADD">ADD (Add markup to Rate)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Amount (₹)</label>
                    <input
                      type="number"
                      value={newVendorRule.adjustment_amount}
                      onChange={(e) => setNewVendorRule(prev => ({ ...prev, adjustment_amount: e.target.value }))}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-black text-indigo-700"
                    />
                  </div>
                  <div className="col-span-2 flex items-end space-x-2">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-xs transition cursor-pointer"
                    >
                      Save Rule
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddVendorRule(false)}
                      className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-lg transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Table */}
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-4">Vendor</th>
                    <th className="py-2.5 px-4">Airline</th>
                    <th className="py-2.5 px-4">Sector</th>
                    <th className="py-2.5 px-4">Fare Range</th>
                    <th className="py-2.5 px-4">Action</th>
                    <th className="py-2.5 px-4">Amount</th>
                    <th className="py-2.5 px-4">Description</th>
                    <th className="py-2.5 px-4 text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredVendorRules.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="py-2 px-4 font-bold text-slate-900">{r.vendor_name || 'All'}</td>
                      <td className="py-2 px-4 font-mono font-bold text-blue-700">{r.airline_code || 'Any'}</td>
                      <td className="py-2 px-4 font-bold text-slate-800">
                        {r.origin && r.destination ? `${r.origin} ➔ ${r.destination}` : 'All Routes'}
                      </td>
                      <td className="py-2 px-4 font-mono text-[11px] text-slate-600">
                        {r.max_fare > 50000000 ? `₹${r.min_fare}+` : `₹${r.min_fare} - ₹${r.max_fare}`}
                      </td>
                      <td className="py-2 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          r.adjustment_type === 'LESS' 
                            ? 'bg-rose-100 text-rose-800' 
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {r.adjustment_type}
                        </span>
                      </td>
                      <td className="py-2 px-4 font-mono font-black text-slate-900">
                        {r.adjustment_type === 'LESS' ? `- ₹${r.adjustment_amount}` : `+ ₹${r.adjustment_amount}`}
                      </td>
                      <td className="py-2 px-4 text-slate-500 text-[11px]">{r.description}</td>
                      <td className="py-2 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteVendorRule(r.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: GENERAL MARGIN RULES & SLABS                                       */}
      {/* ========================================================================= */}
      {activeTab === 'general-margins' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Rules List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900">Standard Margin Rules</h3>
                <span className="text-xs text-slate-400 font-bold">{rules.length} Rules Active</span>
              </div>
              <div className="divide-y divide-slate-100">
                {rules.map(r => (
                  <div key={r.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                    <div>
                      <strong className="text-xs font-bold text-slate-900 block">{r.rule_name}</strong>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {r.min_fare} - {r.max_fare > 50000000 ? '∞' : r.max_fare} | {r.airline_code || 'All Airlines'}
                      </span>
                    </div>
                    <span className="text-xs font-black text-emerald-700 font-mono bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                      +₹{r.margin_amount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <h3 className="text-sm font-black text-slate-900">Airline & Sector Presets</h3>
              <div className="space-y-2">
                {standardPresets.map(p => (
                  <div key={p.name} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{p.name}</span>
                    <span className="font-black text-indigo-700 font-mono">+₹{p.margin_amount}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
