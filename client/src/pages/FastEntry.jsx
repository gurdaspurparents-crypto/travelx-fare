import React, { useState, useEffect } from 'react';
import { Zap, Check, AlertCircle, RefreshCw, Calendar, ArrowRight, Save, Plus } from 'lucide-react';
import { api } from '../utils/api';
import { getAirlineName } from '../utils/airlineHelper';

export default function FastEntry({ masterData, onFareAdded }) {
  const { airlines = [], vendors = [], routes = [] } = masterData;

  // Initialize sticky fields from localStorage or sensible defaults
  const [formData, setFormData] = useState(() => {
    let savedVendorId = '';
    try {
      savedVendorId = localStorage.getItem('travelx_active_vendor_id') || '';
    } catch (_) {}

    const saved = localStorage.getItem('travelx_fast_entry_sticky');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          vendor_id: savedVendorId || parsed.vendor_id || (vendors[0]?.id || 1),
          airline_code: parsed.airline_code || (airlines[0]?.code || 'AI'),
          origin: parsed.origin || 'ATQ',
          destination: parsed.destination || 'DXB',
          travel_date: new Date().toISOString().slice(0, 10),
          flight_number: '',
          departure_time: parsed.departure_time || '',
          arrival_time: parsed.arrival_time || '',
          net_fare: '',
          currency: 'INR',
          cabin: parsed.cabin || 'ECONOMY',
          baggage: parsed.baggage || '30+7 KG',
          is_refundable: parsed.is_refundable || 'NON_REFUNDABLE',
          remarks: ''
        };
      } catch (e) {}
    }
    return {
      vendor_id: savedVendorId || (vendors[0]?.id || 1),
      airline_code: airlines[0]?.code || 'AI',
      origin: 'ATQ',
      destination: 'DXB',
      travel_date: new Date().toISOString().slice(0, 10),
      flight_number: '',
      departure_time: '',
      arrival_time: '',
      net_fare: '',
      currency: 'INR',
      cabin: 'ECONOMY',
      baggage: '30+7 KG',
      is_refundable: 'NON_REFUNDABLE',
      remarks: ''
    };
  });

  const [entryMode, setEntryMode] = useState('single'); // 'single' or 'range'
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().slice(0, 10);
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [sessionEntries, setSessionEntries] = useState([]);

  // Save sticky fields whenever they change
  useEffect(() => {
    localStorage.setItem('travelx_fast_entry_sticky', JSON.stringify({
      vendor_id: formData.vendor_id,
      airline_code: formData.airline_code,
      origin: formData.origin,
      destination: formData.destination,
      departure_time: formData.departure_time,
      arrival_time: formData.arrival_time,
      cabin: formData.cabin,
      baggage: formData.baggage,
      is_refundable: formData.is_refundable
    }));
  }, [formData.vendor_id, formData.airline_code, formData.origin, formData.destination, formData.departure_time, formData.arrival_time, formData.cabin, formData.baggage, formData.is_refundable]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'vendor_id' && value) {
      try {
        localStorage.setItem('travelx_active_vendor_id', String(value));
      } catch (_) {}
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRouteSelect = (orig, dest) => {
    setFormData(prev => ({ ...prev, origin: orig, destination: dest }));
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!formData.net_fare || Number(formData.net_fare) <= 0) {
      setMessage({ type: 'error', text: 'Please enter a valid net fare amount.' });
      return;
    }

    try {
      setLoading(true);
      setMessage(null);

      if (entryMode === 'range') {
        const res = await api.saveDateRange({
          ...formData,
          start_date: formData.travel_date,
          end_date: endDate,
          net_fare: formData.net_fare
        });

        if (res.success) {
          setMessage({
            type: 'success',
            text: `🎉 Date Range Saved! ${res.saved_count} consecutive days from ${res.start_date} to ${res.end_date} saved at Net ₹${Number(formData.net_fare).toLocaleString('en-IN')}!`
          });

          if (res.results && res.results.length > 0) {
            const addedItems = res.results.slice(0, 10).map(r => ({
              ...formData,
              travel_date: r.date,
              id: r.id,
              status: r.status || 'SAVED',
              message: r.message
            }));
            setSessionEntries(prev => [...addedItems, ...prev]);
          }

          setFormData(prev => ({ ...prev, net_fare: '' }));
          if (onFareAdded) onFareAdded();
        } else {
          setMessage({ type: 'error', text: res.error || 'Failed to save date range.' });
        }
      } else {
        const res = await api.createSingleFare(formData);
        if (res.success) {
          const savedItem = {
            ...formData,
            id: res.id,
            status: res.status,
            message: res.message
          };
          setSessionEntries(prev => [savedItem, ...prev]);
          setMessage({
            type: 'success',
            text: `Saved! Net: ₹${Number(formData.net_fare).toLocaleString('en-IN')} (${res.status})`
          });

          // Advance date by 1 day automatically for ultra-fast consecutive entry!
          const currentDate = new Date(formData.travel_date);
          currentDate.setDate(currentDate.getDate() + 1);
          const nextDateStr = currentDate.toISOString().slice(0, 10);

          setFormData(prev => ({
            ...prev,
            travel_date: nextDateStr,
            net_fare: ''
          }));

          if (onFareAdded) onFareAdded();

          // Refocus net fare input
          document.getElementById('fast-entry-net-fare')?.focus();
        } else {
          setMessage({ type: 'error', text: res.error || 'Failed to save fare.' });
        }
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error connecting to server.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <Zap className="w-5 h-5 text-amber-500" />
            <span>Fast Daily Fare Entry</span>
          </h1>
          <p className="text-xs text-slate-500">
            Sticky form remembers your Vendor, Airline, and Route. Press <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono text-[10px]">Enter</kbd> to save and advance date automatically.
          </p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-center space-x-3 text-sm font-medium ${
          message.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          {message.type === 'success' ? (
            <Check className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Main Entry Card */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-5">
        {/* Sticky Context Banner */}
        <div className="bg-blue-50/70 border border-blue-100 rounded-lg p-3 text-xs flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-blue-900 flex items-center space-x-1">
            <span>📌 Sticky Context:</span>
            <span className="text-blue-700 font-normal">Fields in this section will stay selected until you change them.</span>
          </span>
          <div className="flex items-center space-x-1">
            <span className="text-slate-500">Quick Routes:</span>
            {routes.filter(r => r.is_favorite).slice(0, 4).map((r, i) => (
              <button
                type="button"
                key={i}
                onClick={() => handleRouteSelect(r.origin, r.destination)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition ${
                  formData.origin === r.origin && formData.destination === r.destination
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-100'
                }`}
              >
                {r.origin}-{r.destination}
              </button>
            ))}
          </div>
        </div>

        {/* Form Grid Row 1: Vendor, Airline, Route */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Vendor / Source *
            </label>
            <select
              name="vendor_id"
              value={formData.vendor_id}
              onChange={handleChange}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
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

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Airline *
            </label>
            <select
              name="airline_code"
              value={formData.airline_code}
              onChange={handleChange}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              {airlines.map(a => (
                <option key={a.code} value={a.code}>{a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Origin (From) *
            </label>
            <input
              type="text"
              name="origin"
              value={formData.origin}
              onChange={(e) => setFormData(prev => ({ ...prev, origin: e.target.value.toUpperCase() }))}
              maxLength={3}
              placeholder="ATQ"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold tracking-widest text-slate-900 uppercase focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Destination (To) *
            </label>
            <input
              type="text"
              name="destination"
              value={formData.destination}
              onChange={(e) => setFormData(prev => ({ ...prev, destination: e.target.value.toUpperCase() }))}
              maxLength={3}
              placeholder="DXB"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold tracking-widest text-slate-900 uppercase focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
        </div>

        {/* Entry Mode Switcher: Single Date vs Date Range */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-700">Entry Mode:</span>
            <button
              type="button"
              onClick={() => setEntryMode('single')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                entryMode === 'single'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Single Date
            </button>
            <button
              type="button"
              onClick={() => setEntryMode('range')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition flex items-center space-x-1.5 ${
                entryMode === 'range'
                  ? 'bg-amber-500 text-slate-950 shadow-xs font-extrabold'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>📅 Date Range Mode (e.g. 15 Sep to 30 Sep)</span>
            </button>
          </div>
          {entryMode === 'range' && (
            <span className="text-xs text-amber-800 font-semibold bg-amber-100/60 px-2 py-0.5 rounded border border-amber-200">
              Same fare will be applied to every date in the selected range
            </span>
          )}
        </div>

        {/* Form Grid Row 2: Travel Date, Net Fare */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          {entryMode === 'single' ? (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Travel Date *
              </label>
              <input
                type="date"
                name="travel_date"
                value={formData.travel_date}
                onChange={handleChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  From Date *
                </label>
                <input
                  type="date"
                  value={formData.travel_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, travel_date: e.target.value }))}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2 py-2 text-xs font-bold text-slate-900"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  To Date *
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2 py-2 text-xs font-bold text-slate-900"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-blue-700 uppercase tracking-wider mb-1">
              Vendor Net Fare (₹) *
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold">₹</span>
              <input
                id="fast-entry-net-fare"
                type="number"
                name="net_fare"
                value={formData.net_fare}
                onChange={handleChange}
                placeholder="16900"
                autoFocus
                className="w-full pl-8 pr-3 py-2 bg-amber-50/50 border-2 border-amber-300 rounded-lg text-lg font-extrabold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          </div>
        </div>

        {/* Form Grid Row 3: Optional Conditions (Baggage, Refundable, Cabin) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Baggage Allowance</label>
            <select
              name="baggage"
              value={formData.baggage}
              onChange={handleChange}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
            >
              <option value="30+7 KG">30+7 KG (Standard)</option>
              <option value="30kg">30kg</option>
              <option value="20kg">20kg</option>
              <option value="25kg">25kg</option>
              <option value="35kg">35kg</option>
              <option value="40kg">40kg</option>
              <option value="7kg Hand Only">7kg Hand Only</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Refundability</label>
            <select
              name="is_refundable"
              value={formData.is_refundable}
              onChange={handleChange}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
            >
              <option value="NON_REFUNDABLE">Non-Refundable</option>
              <option value="REFUNDABLE">Refundable</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Cabin Class</label>
            <select
              name="cabin"
              value={formData.cabin}
              onChange={handleChange}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
            >
              <option value="ECONOMY">Economy</option>
              <option value="PREMIUM_ECONOMY">Premium Economy</option>
              <option value="BUSINESS">Business</option>
            </select>
          </div>
        </div>

        {/* Submit Button Bar */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Current Route: <strong className="text-blue-700">{formData.origin} → {formData.destination}</strong> ({getAirlineName(formData.airline_code, airlines)})
          </span>

          <div className="flex items-center space-x-3">
            <button
              type="submit"
              disabled={loading}
              className={`px-6 py-2.5 text-white font-bold text-sm rounded-lg shadow-sm transition flex items-center space-x-2 ${
                entryMode === 'range' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>
                {loading
                  ? 'Saving...'
                  : entryMode === 'range'
                  ? 'Save Date Range Fares (1 Click)'
                  : 'Save & Advance to Next Date (Enter)'}
              </span>
            </button>
          </div>
        </div>
      </form>

      {/* Session Entries Log */}
      {sessionEntries.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Fares Added in This Session ({sessionEntries.length})
            </h3>
            <span className="text-xs text-emerald-600 font-medium">All records synced to SQLite DB</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Route</th>
                  <th className="px-4 py-2 text-left">Airline</th>
                  <th className="px-4 py-2 text-right">Net Fare</th>
                  <th className="px-4 py-2 text-center">Baggage</th>
                  <th className="px-4 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessionEntries.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-semibold text-slate-900">{item.travel_date}</td>
                    <td className="px-4 py-2 font-bold text-blue-700">{item.origin} → {item.destination}</td>
                    <td className="px-4 py-2 font-medium text-slate-800">{getAirlineName(item.airline_code, airlines)}</td>
                    <td className="px-4 py-2 text-right font-semibold">₹{Number(item.net_fare).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2 text-center">{item.baggage}</td>
                    <td className="px-4 py-2 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
