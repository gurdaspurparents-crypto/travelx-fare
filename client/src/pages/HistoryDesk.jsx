import React, { useState, useEffect } from 'react';
import { History, TrendingDown, TrendingUp, RefreshCw, Filter, Plane, ArrowRight } from 'lucide-react';
import { api } from '../utils/api';
import { getAirlineName } from '../utils/airlineHelper';

export default function HistoryDesk({ masterData }) {
  const { airlines = [], vendors = [] } = masterData;

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    origin: '',
    destination: '',
    travel_date: '',
    airline_code: '',
    vendor_id: ''
  });

  const loadHistory = async () => {
    try {
      setLoading(true);
      const res = await api.getFareHistory(filters);
      if (res.success) {
        setHistory(res.history);
      }
    } catch (err) {
      console.error('Error loading history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [filters]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <History className="w-5 h-5 text-rose-600" />
            <span>Intraday Fare History & Audit Trail</span>
          </h1>
          <p className="text-xs text-slate-500">
            Immutable log of all price updates throughout the day. Track vendor fare hikes, drops, and time of update.
          </p>
        </div>

        <button
          onClick={loadHistory}
          className="p-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-lg transition shadow-xs self-start sm:self-auto"
          title="Refresh History"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4">
        <div className="flex items-center justify-between mb-3 text-xs font-bold text-slate-700 uppercase tracking-wider">
          <span className="flex items-center space-x-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Filter History Log</span>
          </span>
          <button
            onClick={() => setFilters({ origin: '', destination: '', travel_date: '', airline_code: '', vendor_id: '' })}
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold lowercase"
          >
            clear all
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Origin</label>
            <input
              type="text"
              name="origin"
              value={filters.origin}
              onChange={handleFilterChange}
              placeholder="e.g. ATQ"
              maxLength={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold uppercase text-slate-900"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Destination</label>
            <input
              type="text"
              name="destination"
              value={filters.destination}
              onChange={handleFilterChange}
              placeholder="e.g. DXB"
              maxLength={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold uppercase text-slate-900"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Travel Date</label>
            <input
              type="date"
              name="travel_date"
              value={filters.travel_date}
              onChange={handleFilterChange}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Airline</label>
            <select
              name="airline_code"
              value={filters.airline_code}
              onChange={handleFilterChange}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-semibold"
            >
              <option value="">All Airlines</option>
              {airlines.map(a => (
                <option key={a.code} value={a.code}>{a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Vendor</label>
            <select
              name="vendor_id"
              value={filters.vendor_id}
              onChange={handleFilterChange}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
            >
              <option value="">All Vendors</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* History Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Recorded Price Movements ({history.length} events)
          </h2>
          <span className="text-xs text-slate-500">Chronological Audit Log</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Time of Update</th>
                <th className="px-4 py-3 text-left">Sector / Route</th>
                <th className="px-4 py-3 text-left">Airline</th>
                <th className="px-4 py-3 text-left">Travel Date</th>
                <th className="px-4 py-3 text-left">Vendor / Source</th>
                <th className="px-4 py-3 text-right">Previous Fare</th>
                <th className="px-4 py-3 text-center">Movement</th>
                <th className="px-4 py-3 text-right font-bold">New Fare</th>
                <th className="px-4 py-3 text-left">Reason / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                    No price changes logged yet. Price adjustments made during the day will automatically appear here.
                  </td>
                </tr>
              ) : (
                history.map((h) => {
                  const isDrop = h.fare_diff < 0;
                  return (
                    <tr key={h.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-slate-600 whitespace-nowrap">
                        {h.recorded_at}
                      </td>
                      <td className="px-4 py-3 font-extrabold text-blue-700 whitespace-nowrap">
                        {h.origin} → {h.destination}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">
                        {getAirlineName(h.airline_code, airlines)}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">
                        {h.travel_date}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                        {h.vendor_name}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-500 whitespace-nowrap">
                        ₹{Number(h.old_fare).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          isDrop 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}>
                          {isDrop ? (
                            <>
                              <TrendingDown className="w-3 h-3 text-emerald-600" />
                              <span>-₹{Math.abs(h.fare_diff).toLocaleString('en-IN')}</span>
                            </>
                          ) : (
                            <>
                              <TrendingUp className="w-3 h-3 text-rose-600" />
                              <span>+₹{h.fare_diff.toLocaleString('en-IN')}</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-black text-slate-900 text-sm whitespace-nowrap">
                        ₹{Number(h.new_fare).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-[11px]">
                        {h.reason || 'Vendor update'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
