import React, { useState, useEffect } from 'react';
import { Database, Plane, Users, MapPin, Plus, Star, Check, Trash2, Edit2 } from 'lucide-react';
import { api } from '../utils/api';

export default function MasterData({ onMasterDataChanged }) {
  const [activeSubTab, setActiveSubTab] = useState('airlines'); // 'airlines', 'vendors', 'routes'
  const [airlines, setAirlines] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);

  // Form states
  const [newAirline, setNewAirline] = useState({ code: '', name: '', country: 'India' });
  const [newVendor, setNewVendor] = useState({ name: '', phone: '', email: '', notes: '' });
  const [newRoute, setNewRoute] = useState({ origin: '', destination: '', origin_city: '', dest_city: '', is_favorite: 1 });

  const loadAllMasters = async () => {
    try {
      setLoading(true);
      const [resA, resV, resR] = await Promise.all([
        api.getAirlines(),
        api.getVendors(),
        api.getRoutes()
      ]);
      if (resA.success) setAirlines(resA.airlines);
      if (resV.success) setVendors(resV.vendors);
      if (resR.success) setRoutes(resR.routes);
    } catch (err) {
      console.error('Error loading master data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllMasters();
  }, []);

  const handleAddAirline = async (e) => {
    e.preventDefault();
    if (!newAirline.code || !newAirline.name) return;
    try {
      const res = await api.createAirline(newAirline);
      if (res.success) {
        setStatus({ type: 'success', text: `Airline ${newAirline.code} added successfully!` });
        setNewAirline({ code: '', name: '', country: 'India' });
        loadAllMasters();
        if (onMasterDataChanged) onMasterDataChanged();
      }
    } catch (err) {
      setStatus({ type: 'error', text: 'Failed to add airline.' });
    }
  };

  const handleToggleAirlineActive = async (airline) => {
    try {
      const res = await api.updateAirline(airline.code, { is_active: airline.is_active ? 0 : 1 });
      if (res.success) {
        loadAllMasters();
        if (onMasterDataChanged) onMasterDataChanged();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddVendor = async (e) => {
    e.preventDefault();
    if (!newVendor.name) return;
    try {
      const res = await api.createVendor(newVendor);
      if (res.success) {
        setStatus({ type: 'success', text: `Vendor ${newVendor.name} added successfully!` });
        setNewVendor({ name: '', phone: '', email: '', notes: '' });
        loadAllMasters();
        if (onMasterDataChanged) onMasterDataChanged();
      }
    } catch (err) {
      setStatus({ type: 'error', text: 'Failed to add vendor.' });
    }
  };

  const handleToggleVendorActive = async (vendor) => {
    try {
      const res = await api.updateVendor(vendor.id, { is_active: vendor.is_active ? 0 : 1 });
      if (res.success) {
        loadAllMasters();
        if (onMasterDataChanged) onMasterDataChanged();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddRoute = async (e) => {
    e.preventDefault();
    if (!newRoute.origin || !newRoute.destination) return;
    try {
      const res = await api.createRoute(newRoute);
      if (res.success) {
        setStatus({ type: 'success', text: `Route ${newRoute.origin}-${newRoute.destination} created!` });
        setNewRoute({ origin: '', destination: '', origin_city: '', dest_city: '', is_favorite: 1 });
        loadAllMasters();
        if (onMasterDataChanged) onMasterDataChanged();
      }
    } catch (err) {
      setStatus({ type: 'error', text: 'Failed to add route.' });
    }
  };

  const handleToggleRouteFavorite = async (route) => {
    try {
      const res = await api.updateRoute(route.id, { is_favorite: route.is_favorite ? 0 : 1 });
      if (res.success) {
        loadAllMasters();
        if (onMasterDataChanged) onMasterDataChanged();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
          <Database className="w-5 h-5 text-teal-600" />
          <span>Agency Master Data Management</span>
        </h1>
        <p className="text-xs text-slate-500">
          Manage Airlines, B2B Vendors, and Favorite Routes. Starring routes enables rapid 1-click Quick Entry across the app.
        </p>
      </div>

      {status && (
        <div className={`p-4 rounded-xl flex items-center space-x-3 text-sm font-medium ${
          status.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          <Check className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{status.text}</span>
        </div>
      )}

      {/* Sub tabs */}
      <div className="flex border-b border-slate-200 space-x-2">
        <button
          onClick={() => setActiveSubTab('airlines')}
          className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold border-b-2 transition ${
            activeSubTab === 'airlines'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Plane className="w-4 h-4" />
          <span>Airlines ({airlines.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('vendors')}
          className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold border-b-2 transition ${
            activeSubTab === 'vendors'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Vendors / Sources ({vendors.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('routes')}
          className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold border-b-2 transition ${
            activeSubTab === 'routes'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Routes & Favorites ({routes.length})</span>
        </button>
      </div>

      {/* Tab Content 1: Airlines */}
      {activeSubTab === 'airlines' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase">
                <tr>
                  <th className="px-4 py-2.5 text-left">IATA Code</th>
                  <th className="px-4 py-2.5 text-left">Airline Name</th>
                  <th className="px-4 py-2.5 text-left">Country</th>
                  <th className="px-4 py-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {airlines.map((a) => (
                  <tr key={a.code} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono font-bold text-blue-700 text-sm">{a.code}</td>
                    <td className="px-4 py-2.5 font-bold text-slate-900">{a.name}</td>
                    <td className="px-4 py-2.5 text-slate-600">{a.country}</td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        onClick={() => handleToggleAirlineActive(a)}
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          a.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {a.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:col-span-4">
            <form onSubmit={handleAddAirline} className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 pb-2 border-b border-slate-100 flex items-center space-x-1.5">
                <Plus className="w-4 h-4 text-blue-600" />
                <span>Add New Airline</span>
              </h3>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">IATA 2-Letter Code *</label>
                <input
                  type="text"
                  value={newAirline.code}
                  onChange={(e) => setNewAirline(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g. IX"
                  maxLength={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs font-bold uppercase"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">Airline Name *</label>
                <input
                  type="text"
                  value={newAirline.name}
                  onChange={(e) => setNewAirline(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Air India Express"
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">Country</label>
                <input
                  type="text"
                  value={newAirline.country}
                  onChange={(e) => setNewAirline(prev => ({ ...prev, country: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition mt-2"
              >
                Save Airline
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tab Content 2: Vendors */}
      {activeSubTab === 'vendors' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase">
                <tr>
                  <th className="px-4 py-2.5 text-left">Vendor Name</th>
                  <th className="px-4 py-2.5 text-left">Contact / WhatsApp</th>
                  <th className="px-4 py-2.5 text-left">Notes / Terms</th>
                  <th className="px-4 py-2.5 text-center">Fares</th>
                  <th className="px-4 py-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vendors.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                      No vendors registered yet. Use the form on the right to add your B2B vendors.
                    </td>
                  </tr>
                ) : (
                  vendors.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-bold text-slate-900">{v.name}</td>
                    <td className="px-4 py-2.5 text-slate-600">{v.phone || '-'}</td>
                    <td className="px-4 py-2.5 text-slate-500 text-[11px]">{v.notes || '-'}</td>
                    <td className="px-4 py-2.5 text-center font-bold text-blue-700">{v.total_fares ?? 0}</td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        onClick={() => handleToggleVendorActive(v)}
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          v.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {v.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>

          <div className="lg:col-span-4">
            <form onSubmit={handleAddVendor} className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 pb-2 border-b border-slate-100 flex items-center space-x-1.5">
                <Plus className="w-4 h-4 text-blue-600" />
                <span>Add B2B Vendor</span>
              </h3>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">Vendor / Source Name *</label>
                <input
                  type="text"
                  value={newVendor.name}
                  onChange={(e) => setNewVendor(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Akbar Travels B2B"
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">WhatsApp Phone</label>
                <input
                  type="text"
                  value={newVendor.phone}
                  onChange={(e) => setNewVendor(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+91 98765 43210"
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">Payment Terms / Notes</label>
                <textarea
                  rows={2}
                  value={newVendor.notes}
                  onChange={(e) => setNewVendor(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Credit terms or WhatsApp group notes"
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs"
                ></textarea>
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition mt-2"
              >
                Save Vendor
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tab Content 3: Routes & Favorites */}
      {activeSubTab === 'routes' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase">
                <tr>
                  <th className="px-4 py-2.5 text-center w-16">Favorite</th>
                  <th className="px-4 py-2.5 text-left">Sector (Origin → Dest)</th>
                  <th className="px-4 py-2.5 text-left">City Names</th>
                  <th className="px-4 py-2.5 text-center">Fares Recorded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {routes.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-center">
                      <button
                        onClick={() => handleToggleRouteFavorite(r)}
                        className={`p-1 rounded hover:bg-amber-50 transition ${
                          r.is_favorite ? 'text-amber-500' : 'text-slate-300'
                        }`}
                        title={r.is_favorite ? 'Starred for quick entry' : 'Click to star'}
                      >
                        <Star className={`w-4 h-4 ${r.is_favorite ? 'fill-amber-400 text-amber-500' : ''}`} />
                      </button>
                    </td>
                    <td className="px-4 py-2.5 font-mono font-black text-blue-700 text-sm">
                      {r.origin} → {r.destination}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 font-medium">
                      {r.origin_city} to {r.dest_city}
                    </td>
                    <td className="px-4 py-2.5 text-center font-bold text-slate-800">
                      {r.total_fares ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:col-span-4">
            <form onSubmit={handleAddRoute} className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 pb-2 border-b border-slate-100 flex items-center space-x-1.5">
                <Plus className="w-4 h-4 text-blue-600" />
                <span>Add Route Sector</span>
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">Origin IATA *</label>
                  <input
                    type="text"
                    value={newRoute.origin}
                    onChange={(e) => setNewRoute(prev => ({ ...prev, origin: e.target.value.toUpperCase() }))}
                    placeholder="ATQ"
                    maxLength={3}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs font-bold uppercase"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">Destination IATA *</label>
                  <input
                    type="text"
                    value={newRoute.destination}
                    onChange={(e) => setNewRoute(prev => ({ ...prev, destination: e.target.value.toUpperCase() }))}
                    placeholder="DXB"
                    maxLength={3}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs font-bold uppercase"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">Origin City</label>
                  <input
                    type="text"
                    value={newRoute.origin_city}
                    onChange={(e) => setNewRoute(prev => ({ ...prev, origin_city: e.target.value }))}
                    placeholder="Amritsar"
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">Destination City</label>
                  <input
                    type="text"
                    value={newRoute.dest_city}
                    onChange={(e) => setNewRoute(prev => ({ ...prev, dest_city: e.target.value }))}
                    placeholder="Dubai"
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="star-fav"
                  checked={newRoute.is_favorite === 1}
                  onChange={(e) => setNewRoute(prev => ({ ...prev, is_favorite: e.target.checked ? 1 : 0 }))}
                  className="rounded text-blue-600"
                />
                <label htmlFor="star-fav" className="text-xs text-slate-700 font-semibold cursor-pointer">
                  ⭐ Mark as Favorite Route
                </label>
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition mt-2"
              >
                Save Route
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
