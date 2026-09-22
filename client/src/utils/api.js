async function safeFetch(url, options = {}) {
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (_) {
      return {
        success: false,
        error: res.status >= 500
          ? `Server updating (${res.status}). Kripya 5 second baad dobara try karein.`
          : `Unexpected response (${res.status})`
      };
    }
  } catch (err) {
    return {
      success: false,
      error: 'Network connection failed. Kripya page refresh karein (Ctrl + F5).'
    };
  }
}

export const api = {
  // Health
  getHealth: async () => {
    return safeFetch('/api/health');
  },

  // Dashboard
  getDashboardStats: async () => {
    const res = await fetch('/api/dashboard/stats');
    return res.json();
  },

  // Fares
  getAllFares: async (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params.append(k, v);
      }
    });
    const res = await fetch(`/api/fares?${params.toString()}`);
    return res.json();
  },

  // Public Sanitized B2B Agent Portal APIs
  getPublicFares: async (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params.append(k, v);
      }
    });
    const res = await fetch(`/api/public/fares?${params.toString()}`);
    return res.json();
  },

  getPublicConfig: async () => {
    const res = await fetch('/api/public/config');
    return res.json();
  },

  createSingleFare: async (data) => {
    const res = await fetch('/api/fares/single', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  saveQuickGrid: async (data) => {
    return safeFetch('/api/fares/quick-grid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  saveDateRange: async (data) => {
    return safeFetch('/api/fares/date-range', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  parseWhatsApp: async (text, defaults = {}) => {
    const res = await fetch('/api/fares/parse-whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, defaults })
    });
    return res.json();
  },

  parseImageWithAI: async ({ imageBase64, provider = 'openai', apiKey, defaults = {} }) => {
    const res = await fetch('/api/fares/parse-image-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, provider, apiKey, defaults })
    });
    return res.json();
  },

  saveBulkFares: async (vendor_id, fares, replace_missing_dates = true, replace_mode = 'sector') => {
    return safeFetch('/api/fares/bulk-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendor_id, fares, replace_missing_dates, replace_mode })
    });
  },

  batchUpdateMargins: async (updates, mark_published = 1, batch_title = 'Special Fare Release') => {
    const res = await fetch('/api/fares/batch-update-margins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates, mark_published, batch_title })
    });
    return res.json();
  },

  updateFare: async (id, data) => {
    const res = await fetch(`/api/fares/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  deleteFare: async (id) => {
    const res = await fetch(`/api/fares/${id}`, {
      method: 'DELETE'
    });
    return res.json();
  },

  clearAllFares: async () => {
    const res = await fetch('/api/fares/clear-all', {
      method: 'POST'
    });
    return res.json();
  },

  clearVendorFares: async (vendor_id, options = false) => {
    // options can be boolean (only_today) or object { only_today, origin, destination, airline_code }
    const payload = typeof options === 'object' && options !== null
      ? options 
      : { only_today: !!options };

    const res = await fetch(`/api/fares/clear-vendor/${vendor_id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.json();
  },

  batchDeleteFares: async (ids = []) => {
    const res = await fetch('/api/fares/batch-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    return res.json();
  },

  getVendorStats: async (vendor_id) => {
    const res = await fetch(`/api/fares/vendor-stats/${vendor_id}`);
    return res.json();
  },

  getFareHistory: async (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params.append(k, v);
      }
    });
    const res = await fetch(`/api/fares/history?${params.toString()}`);
    return res.json();
  },

  // Comparisons
  getComparisons: async (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params.append(k, v);
      }
    });
    return safeFetch(`/api/compare?${params.toString()}`);
  },

  getBestFares: async (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params.append(k, v);
      }
    });
    return safeFetch(`/api/compare/best-fares?${params.toString()}`);
  },

  // Margins
  getMarginRules: async () => {
    const res = await fetch('/api/margins/rules');
    return res.json();
  },

  createMarginRule: async (rule) => {
    const res = await fetch('/api/margins/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule)
    });
    return res.json();
  },

  updateMarginRule: async (id, rule) => {
    const res = await fetch(`/api/margins/rules/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule)
    });
    return res.json();
  },

  deleteMarginRule: async (id) => {
    const res = await fetch(`/api/margins/rules/${id}`, {
      method: 'DELETE'
    });
    return res.json();
  },

  previewMargin: async (data) => {
    const res = await fetch('/api/margins/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  // Master Data
  getAirlines: async () => {
    const res = await fetch('/api/masters/airlines');
    return res.json();
  },
  createAirline: async (data) => {
    const res = await fetch('/api/masters/airlines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  updateAirline: async (code, data) => {
    const res = await fetch(`/api/masters/airlines/${code}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  getVendors: async () => {
    const res = await fetch('/api/masters/vendors');
    return res.json();
  },
  createVendor: async (data) => {
    const res = await fetch('/api/masters/vendors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  updateVendor: async (id, data) => {
    const res = await fetch(`/api/masters/vendors/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  deleteVendor: async (id) => {
    const res = await fetch(`/api/masters/vendors/${id}`, { method: 'DELETE' });
    return res.json();
  },

  getRoutes: async () => {
    const res = await fetch('/api/masters/routes');
    return res.json();
  },
  createRoute: async (data) => {
    const res = await fetch('/api/masters/routes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  updateRoute: async (id, data) => {
    const res = await fetch(`/api/masters/routes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  deleteRoute: async (id) => {
    const res = await fetch(`/api/masters/routes/${id}`, { method: 'DELETE' });
    return res.json();
  },

  // Export & Broadcast
  togglePublish: async (fare_ids, is_published, batch_title) => {
    const res = await fetch('/api/export/toggle-publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fare_ids, is_published, batch_title })
    });
    return res.json();
  },

  generateWhatsAppMessage: async (options) => {
    const res = await fetch('/api/export/whatsapp-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    });
    return res.json();
  },

  getExcelExportUrl: (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params.append(k, v);
      }
    });
    return `/api/export/excel?${params.toString()}`;
  },

  // Vendor Pricing & Discount Rules
  getVendorRules: async () => {
    const res = await fetch('/api/vendor-rules');
    return res.json();
  },
  createVendorRule: async (data) => {
    const res = await fetch('/api/vendor-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  updateVendorRule: async (id, data) => {
    const res = await fetch(`/api/vendor-rules/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  deleteVendorRule: async (id) => {
    const res = await fetch(`/api/vendor-rules/${id}`, { method: 'DELETE' });
    return res.json();
  },
  applyVendorRulesToExisting: async (payload = {}) => {
    const res = await fetch('/api/vendor-rules/apply-existing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.json();
  },

  // B2B Agent & Booking Requests
  lookupAgent: async (mobile) => {
    const res = await fetch(`/api/public/agent/lookup?mobile=${encodeURIComponent(mobile)}`);
    return res.json();
  },
  registerAgent: async (data) => {
    const res = await fetch('/api/public/agent/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  createBookingRequest: async (data) => {
    const res = await fetch('/api/public/bookings/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  getBookingRequests: async (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, v);
    });
    const res = await fetch(`/api/bookings?${query.toString()}`);
    return res.json();
  },
  updateBookingStatus: async (id, status, remarks = '', pnr_code = '') => {
    const res = await fetch(`/api/bookings/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, remarks, pnr_code })
    });
    return res.json();
  },
  getAgentsDirectory: async (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, v);
    });
    const res = await fetch(`/api/agents?${query.toString()}`);
    return res.json();
  },
  createAgent: async (data) => {
    const res = await fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  updateAgent: async (id, data) => {
    const res = await fetch(`/api/agents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  getWhatsAppSettings: async () => {
    const res = await fetch('/api/settings/whatsapp');
    return res.json();
  },
  saveWhatsAppSettings: async (data) => {
    const res = await fetch('/api/settings/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  testWhatsAppAlert: async (data) => {
    const res = await fetch('/api/settings/whatsapp/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  trackBooking: async (ref) => {
    const res = await fetch(`/api/public/bookings/track/${encodeURIComponent(ref)}`);
    return res.json();
  },
  reviewBookingRequest: async (id, data) => {
    const res = await fetch(`/api/bookings/${id}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  uploadPassports: async (ref, formData) => {
    const res = await fetch(`/api/public/bookings/${encodeURIComponent(ref)}/passports`, {
      method: 'POST',
      body: formData
    });
    return res.json();
  },
  respondToRevisedFare: async (ref, action) => {
    const res = await fetch(`/api/public/bookings/${encodeURIComponent(ref)}/fare-response`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    return res.json();
  },
  uploadTicket: async (id, formData) => {
    const res = await fetch(`/api/bookings/${id}/ticket`, {
      method: 'POST',
      body: formData
    });
    return res.json();
  }
};

