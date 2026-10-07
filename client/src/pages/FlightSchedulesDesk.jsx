import React, { useState, useEffect } from 'react';
import { 
  Clock, Plane, RefreshCw, Plus, Edit2, Trash2, CheckCircle2, AlertCircle, 
  Sparkles, ClipboardPaste, ArrowRight, Calendar, Info, ShieldCheck, MapPin
} from 'lucide-react';
import { api } from '../utils/api';
import { getAirlineName } from '../utils/airlineHelper';

export default function FlightSchedulesDesk() {
  const [schedules, setSchedules] = useState([]);
  const [operatingFlights, setOperatingFlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Filter States
  const [selectedSector, setSelectedSector] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal States
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [parsedItems, setParsedItems] = useState([]);
  const [parsing, setParsing] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    flight_number: '',
    origin: 'ATQ',
    destination: 'DXB',
    airline_code: 'IX',
    airline_name: 'Air India Express',
    departure_time: '',
    arrival_time: '',
    origin_terminal: 'T1',
    destination_terminal: 'T2',
    aircraft: 'Boeing 737-800',
    stops: 'Non Stop',
    day_of_week: '',
    travel_date: '',
    remarks: ''
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.getFlightSchedules();
      if (res && res.success) {
        setSchedules(res.schedules || []);
        setOperatingFlights(res.operatingFlights || []);
      }
    } catch (err) {
      console.error('Error loading flight schedules:', err);
      setStatusMessage({ type: 'error', text: 'Failed to load flight schedules.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showNotification = (type, text) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  const handleSyncLive = async () => {
    try {
      setSyncing(true);
      const res = await api.syncLiveAirlineSchedules();
      if (res && res.success) {
        showNotification('success', `Live airline schedules refreshed! Synced ${res.schedules_synced || 0} schedules and updated ${res.fares_updated || 0} active fares.`);
        await loadData();
      } else {
        showNotification('error', res?.error || 'Live sync failed.');
      }
    } catch (err) {
      console.error('Sync error:', err);
      showNotification('error', 'Network error during live airline sync.');
    } finally {
      setSyncing(false);
    }
  };

  const handleApplyToFares = async () => {
    try {
      setSyncing(true);
      const res = await api.applySchedulesToFares();
      if (res && res.success) {
        showNotification('success', res.message || 'Updated fares with latest airline schedules.');
        await loadData();
      } else {
        showNotification('error', res?.error || 'Failed to update fares.');
      }
    } catch (err) {
      showNotification('error', 'Network error updating fares.');
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenAdd = (preset = {}) => {
    setEditingItem(null);
    setFormData({
      flight_number: preset.flight_number || '',
      origin: preset.origin || 'ATQ',
      destination: preset.destination || 'DXB',
      airline_code: preset.airline_code || preset.flight_number?.split(' ')[0] || 'IX',
      airline_name: preset.airline_name || getAirlineName(preset.airline_code || 'IX'),
      departure_time: preset.departure_time || '00:15',
      arrival_time: preset.arrival_time || '02:55',
      origin_terminal: preset.origin_terminal || 'T1',
      destination_terminal: preset.destination_terminal || 'T2',
      aircraft: preset.aircraft || 'Boeing 737-800',
      stops: preset.stops || 'Non Stop',
      day_of_week: preset.day_of_week !== undefined && preset.day_of_week !== null ? String(preset.day_of_week) : '',
      travel_date: preset.travel_date || '',
      remarks: preset.remarks || 'Airline Schedule'
    });
    setShowEditModal(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({
      id: item.id,
      flight_number: item.flight_number,
      origin: item.origin,
      destination: item.destination,
      airline_code: item.airline_code,
      airline_name: item.airline_name || getAirlineName(item.airline_code),
      departure_time: item.departure_time,
      arrival_time: item.arrival_time,
      origin_terminal: item.origin_terminal || 'T1',
      destination_terminal: item.destination_terminal || 'T2',
      aircraft: item.aircraft || 'Boeing 737-800',
      stops: item.stops || 'Non Stop',
      day_of_week: item.day_of_week !== null && item.day_of_week !== undefined ? String(item.day_of_week) : '',
      travel_date: item.travel_date || '',
      remarks: item.remarks || ''
    });
    setShowEditModal(true);
  };

  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    if (!formData.flight_number || !formData.origin || !formData.destination || !formData.departure_time || !formData.arrival_time) {
      alert('Please fill flight number, sector, and departure/arrival times.');
      return;
    }

    try {
      const payload = {
        ...formData,
        id: editingItem?.id,
        airline_code: formData.airline_code || formData.flight_number.split(' ')[0],
        airline_name: formData.airline_name || getAirlineName(formData.airline_code || formData.flight_number.split(' ')[0]),
        day_of_week: formData.day_of_week !== '' ? Number(formData.day_of_week) : null,
        travel_date: formData.travel_date || null
      };
      const res = await api.upsertFlightSchedule(payload);
      if (res && res.success) {
        showNotification('success', `Flight timing for ${payload.flight_number} saved and synchronized with B2B portal!`);
        setShowEditModal(false);
        await loadData();
      } else {
        alert(res?.error || 'Failed to save schedule');
      }
    } catch (err) {
      console.error('Error saving schedule:', err);
      alert('Error saving schedule');
    }
  };

  const handleDeleteSchedule = async (id, flt) => {
    if (!window.confirm(`Are you sure you want to delete the schedule entry for ${flt}?`)) return;
    try {
      const res = await api.deleteFlightSchedule(id);
      if (res && res.success) {
        showNotification('success', `Schedule deleted.`);
        await loadData();
      } else {
        alert(res?.error || 'Failed to delete schedule');
      }
    } catch (err) {
      alert('Error deleting schedule');
    }
  };

  const handleParsePaste = async () => {
    if (!pasteText.trim()) return;
    try {
      setParsing(true);
      const res = await api.parseScheduleText(pasteText);
      if (res && res.success && res.parsed) {
        setParsedItems(res.parsed);
        if (res.parsed.length === 0) {
          alert('No flight schedules recognized in pasted text. Format example: IX 191 ATQ DXB 00:15 02:55');
        }
      } else {
        alert(res?.error || 'Failed to parse text');
      }
    } catch (err) {
      alert('Error parsing schedule text');
    } finally {
      setParsing(false);
    }
  };

  const handleSaveParsedList = async () => {
    if (!parsedItems.length) return;
    try {
      setParsing(true);
      const res = await api.bulkSaveFlightSchedules(parsedItems);
      if (res && res.success) {
        showNotification('success', res.message || `Saved ${parsedItems.length} schedules to database and live portal!`);
        setShowPasteModal(false);
        setPasteText('');
        setParsedItems([]);
        await loadData();
      } else {
        alert(res?.error || 'Failed to save parsed schedules');
      }
    } catch (err) {
      alert('Error saving parsed schedules');
    } finally {
      setParsing(false);
    }
  };

  // Filtered schedules list
  const filteredSchedules = schedules.filter(s => {
    const sSector = `${s.origin}-${s.destination}`;
    if (selectedSector !== 'ALL' && sSector !== selectedSector) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchFlt = s.flight_number.toLowerCase().includes(q);
      const matchAir = (s.airline_name || '').toLowerCase().includes(q) || (s.airline_code || '').toLowerCase().includes(q);
      const matchCity = (s.origin || '').toLowerCase().includes(q) || (s.destination || '').toLowerCase().includes(q);
      if (!matchFlt && !matchAir && !matchCity) return false;
    }
    return true;
  });

  const uniqueSectors = Array.from(new Set(schedules.map(s => `${s.origin}-${s.destination}`)));

  const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* Top Banner & Control Deck */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-400">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center space-x-2">
                  <span>Flight Timings & Live Airline Sync</span>
                  <span className="bg-emerald-500/20 text-emerald-300 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                    B2B Portal Live
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-300">
                  Update departure & arrival timings directly from airline portals. Updates reflect live on B2B Agent Portal and Booking Requests.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSyncLive}
              disabled={syncing}
              className="flex items-center space-x-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm px-3.5 py-2 rounded-xl shadow-md cursor-pointer disabled:opacity-50 transition-all"
              title="Sync baseline airline schedules and update all portal fares"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing...' : 'Live Sync Airlines'}</span>
            </button>

            <button
              onClick={handleApplyToFares}
              disabled={syncing}
              className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs sm:text-sm px-3.5 py-2 rounded-xl cursor-pointer disabled:opacity-50 transition-colors"
              title="Re-apply latest schedules to all active database fares"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Apply to Active Fares</span>
            </button>

            <button
              onClick={() => {
                setShowPasteModal(true);
                setParsedItems([]);
                setPasteText('');
              }}
              className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs sm:text-sm px-3.5 py-2 rounded-xl cursor-pointer transition-colors"
              title="Paste text copied from airline timetable or portal"
            >
              <ClipboardPaste className="w-4 h-4 text-emerald-400" />
              <span>Quick Paste Timetable</span>
            </button>

            <button
              onClick={() => handleOpenAdd()}
              className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm px-3.5 py-2 rounded-xl shadow-md cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Schedule</span>
            </button>
          </div>
        </div>

        {/* Status Notification Toast */}
        {statusMessage && (
          <div className={`mt-4 p-3 rounded-xl flex items-center space-x-2 text-xs sm:text-sm font-semibold border ${
            statusMessage.type === 'success' 
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200' 
              : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
          }`}>
            {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />}
            <span>{statusMessage.text}</span>
          </div>
        )}
      </div>

      {/* Operating Flights Quick-Status Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="text-sm font-black text-slate-900 tracking-tight flex items-center space-x-1.5">
              <Plane className="w-4 h-4 text-blue-600" />
              <span>Active Flights in Inventory ({operatingFlights.length} Operating)</span>
            </h2>
            <p className="text-xs text-slate-500">
              Live flight numbers detected across your upcoming vendor fares. Ensure each has up-to-date timings.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {operatingFlights.map((of, idx) => (
            <div 
              key={idx} 
              className="border border-slate-200 bg-slate-50/70 hover:bg-blue-50/40 rounded-xl p-3 flex flex-col justify-between transition-colors"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-black text-slate-900 text-sm">{of.flight_number}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                    {of.origin} ➔ {of.destination}
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700 mt-1.5">
                  <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[11px] font-mono font-bold text-slate-900">
                    Dep: {of.departure_time || '--'}
                  </span>
                  <span>➔</span>
                  <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[11px] font-mono font-bold text-slate-900">
                    Arr: {of.arrival_time || '--'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5">
                  <span>{of.aircraft || 'Commercial Jet'}</span>
                  <span>{of.duration}</span>
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-medium">{of.fare_count} Fares in DB</span>
                <button
                  onClick={() => handleOpenAdd(of)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                >
                  Edit / Override →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Schedules Table with Sector Filter & Search */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {/* Table Filter Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sector:</span>
            <button
              onClick={() => setSelectedSector('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                selectedSector === 'ALL' ? 'bg-slate-900 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              All Sectors
            </button>
            {uniqueSectors.map(sec => (
              <button
                key={sec}
                onClick={() => setSelectedSector(sec)}
                className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  selectedSector === sec ? 'bg-blue-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {sec}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Search flight, airline, or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs w-56 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-black uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Flight</th>
                <th className="py-3 px-3">Sector</th>
                <th className="py-3 px-3">Departure</th>
                <th className="py-3 px-3">Arrival</th>
                <th className="py-3 px-3">Duration</th>
                <th className="py-3 px-3">Terminals</th>
                <th className="py-3 px-3">Aircraft</th>
                <th className="py-3 px-3">Schedule Rule</th>
                <th className="py-3 px-3">Source</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSchedules.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400 font-medium">
                    {loading ? 'Loading schedules...' : 'No flight schedules found matching your filter.'}
                  </td>
                </tr>
              ) : (
                filteredSchedules.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-black text-slate-900 text-sm">{s.flight_number}</span>
                      </div>
                      <div className="text-[10px] text-slate-500">{s.airline_name || s.airline_code}</div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center space-x-1 font-bold text-slate-800">
                        <span>{s.origin}</span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span>{s.destination}</span>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span className="bg-blue-50 border border-blue-200 text-blue-900 font-mono font-black text-xs px-2 py-0.5 rounded">
                        {s.departure_time}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span className="bg-indigo-50 border border-indigo-200 text-indigo-900 font-mono font-black text-xs px-2 py-0.5 rounded">
                        {s.arrival_time}
                      </span>
                    </td>

                    <td className="py-3 px-3 font-semibold text-slate-700">
                      {s.duration}
                    </td>

                    <td className="py-3 px-3 text-slate-600">
                      <span className="text-[11px] font-mono">{s.origin_terminal || 'T1'} / {s.destination_terminal || 'T2'}</span>
                    </td>

                    <td className="py-3 px-3 text-slate-600 text-[11px]">
                      {s.aircraft || 'Commercial Jet'}
                    </td>

                    <td className="py-3 px-3">
                      {s.travel_date ? (
                        <span className="bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded">
                          Date: {s.travel_date}
                        </span>
                      ) : s.day_of_week !== null && s.day_of_week !== undefined ? (
                        <span className="bg-purple-100 text-purple-900 border border-purple-200 text-[10px] font-bold px-2 py-0.5 rounded">
                          {DAY_LABELS[s.day_of_week] || `Day ${s.day_of_week}`}
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-semibold px-2 py-0.5 rounded">
                          All Dates (Daily)
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <span className="text-[10px] font-medium text-slate-500 uppercase">
                        {s.source || 'SCHEDULE'}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => handleOpenEdit(s)}
                          className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded cursor-pointer"
                          title="Edit Schedule"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteSchedule(s.id, s.flight_number)}
                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded cursor-pointer"
                          title="Delete Schedule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit / Add Schedule Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-black text-slate-900 flex items-center space-x-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <span>{editingItem ? 'Edit Flight Timing' : 'Add Flight Schedule'}</span>
              </h3>
              <button 
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Flight Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. IX 191, 6E 1427"
                    value={formData.flight_number}
                    onChange={(e) => setFormData({ ...formData, flight_number: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Airline</label>
                  <input
                    type="text"
                    placeholder="e.g. Air India Express"
                    value={formData.airline_name}
                    onChange={(e) => setFormData({ ...formData, airline_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Origin (Airport Code) *</label>
                  <input
                    type="text"
                    required
                    maxLength={3}
                    placeholder="e.g. ATQ, DEL, IXC"
                    value={formData.origin}
                    onChange={(e) => setFormData({ ...formData, origin: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Destination (Airport Code) *</label>
                  <input
                    type="text"
                    required
                    maxLength={3}
                    placeholder="e.g. DXB, SHJ, AUH"
                    value={formData.destination}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                <div>
                  <label className="block font-black text-blue-950 mb-1">Departure Time (24h) *</label>
                  <input
                    type="text"
                    required
                    placeholder="00:15 or 13:15"
                    value={formData.departure_time}
                    onChange={(e) => setFormData({ ...formData, departure_time: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg font-mono font-black text-sm text-blue-950"
                  />
                </div>
                <div>
                  <label className="block font-black text-blue-950 mb-1">Arrival Time (24h) *</label>
                  <input
                    type="text"
                    required
                    placeholder="02:55 or 16:05"
                    value={formData.arrival_time}
                    onChange={(e) => setFormData({ ...formData, arrival_time: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg font-mono font-black text-sm text-blue-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Origin Terminal</label>
                  <input
                    type="text"
                    placeholder="e.g. T1, T3"
                    value={formData.origin_terminal}
                    onChange={(e) => setFormData({ ...formData, origin_terminal: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Destination Terminal</label>
                  <input
                    type="text"
                    placeholder="e.g. T2, Terminal A, Main"
                    value={formData.destination_terminal}
                    onChange={(e) => setFormData({ ...formData, destination_terminal: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Aircraft</label>
                  <input
                    type="text"
                    placeholder="e.g. Boeing 737-800, Airbus A320neo"
                    value={formData.aircraft}
                    onChange={(e) => setFormData({ ...formData, aircraft: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Flight Type / Stops</label>
                  <select
                    value={formData.stops}
                    onChange={(e) => setFormData({ ...formData, stops: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    <option value="Non Stop">Non Stop</option>
                    <option value="1 Stop (SIN)">1 Stop (SIN)</option>
                    <option value="1 Stop">1 Stop</option>
                  </select>
                </div>
              </div>

              {/* Day / Date Specific Rules */}
              <div className="border-t border-slate-100 pt-3">
                <div className="text-xs font-black text-slate-800 mb-2 flex items-center space-x-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>Date or Day-of-Week Specific Rule (Optional)</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Specific Travel Date (YYYY-MM-DD)</label>
                    <input
                      type="date"
                      value={formData.travel_date}
                      onChange={(e) => setFormData({ ...formData, travel_date: e.target.value, day_of_week: '' })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                    />
                    <span className="text-[10px] text-slate-400">Leave blank for all dates</span>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Day of Week Override</label>
                    <select
                      value={formData.day_of_week}
                      onChange={(e) => setFormData({ ...formData, day_of_week: e.target.value, travel_date: '' })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                    >
                      <option value="">All Days (Daily Schedule)</option>
                      <option value="0">Sunday</option>
                      <option value="1">Monday</option>
                      <option value="2">Tuesday</option>
                      <option value="3">Wednesday</option>
                      <option value="4">Thursday</option>
                      <option value="5">Friday</option>
                      <option value="6">Saturday</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 cursor-pointer font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold cursor-pointer shadow-md"
                >
                  Save & Apply Live
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Paste Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-black text-slate-900 flex items-center space-x-2">
                <ClipboardPaste className="w-5 h-5 text-emerald-600" />
                <span>Quick Paste Airline Timetable</span>
              </h3>
              <button 
                onClick={() => setShowPasteModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-2">
              Copy and paste text directly from Air India Express, IndiGo, SpiceJet, or Air Arabia schedule pages. The smart parser automatically extracts flight numbers, routes, and timings.
            </p>

            <textarea
              rows={6}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={`Example lines:\nIX 191 ATQ DXB 00:15 02:55\n6E 1427 ATQ SHJ 12:15 14:40\nSG 5155 ATQ DXB 08:40 11:25`}
              className="w-full p-3 border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden mb-3"
            />

            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={handleParsePaste}
                disabled={parsing || !pasteText.trim()}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl cursor-pointer disabled:opacity-50 text-xs shadow-md"
              >
                {parsing ? 'Parsing...' : 'Analyze & Extract Schedules'}
              </button>

              {parsedItems.length > 0 && (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                  {parsedItems.length} Schedules Detected
                </span>
              )}
            </div>

            {/* Parsed Preview Table */}
            {parsedItems.length > 0 && (
              <div className="border border-slate-200 rounded-xl max-h-56 overflow-y-auto mb-4">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700 text-[11px]">
                    <tr>
                      <th className="p-2">Flight</th>
                      <th className="p-2">Route</th>
                      <th className="p-2">Dep</th>
                      <th className="p-2">Arr</th>
                      <th className="p-2">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedItems.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2 font-mono font-bold text-slate-900">{p.flight_number}</td>
                        <td className="p-2 font-bold text-slate-700">{p.origin} ➔ {p.destination}</td>
                        <td className="p-2 font-mono text-blue-700">{p.departure_time}</td>
                        <td className="p-2 font-mono text-indigo-700">{p.arrival_time}</td>
                        <td className="p-2 text-slate-500">{p.duration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 cursor-pointer font-bold text-xs"
              >
                Close
              </button>
              {parsedItems.length > 0 && (
                <button
                  type="button"
                  onClick={handleSaveParsedList}
                  disabled={parsing}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold cursor-pointer shadow-md text-xs"
                >
                  Save & Apply {parsedItems.length} Schedules
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
