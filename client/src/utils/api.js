function isPublicApiUrl(url) {
  return (
    url === '/api/health' ||
    url.startsWith('/api/public/') ||
    url === '/api/auth/admin/login'
  );
}

function withAdminAuthHeaders(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (
    typeof localStorage !== 'undefined' &&
    url.startsWith('/api/') &&
    !isPublicApiUrl(url)
  ) {
    const token = localStorage.getItem('travelx_admin_token');
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return { ...options, headers };
}

const BULK_CHUNK_SIZE = 250;

async function safeFetch(url, options = {}, retries = 2, timeoutMs = 120000, retryOnAbort = true) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const fetchOptions = withAdminAuthHeaders(url, options);
    if (controller) fetchOptions.signal = controller.signal;
    const res = await fetch(url, fetchOptions);
    // If Render is waking up from cold sleep (502 / 503 / 504), automatically retry after 2.5s
    if ((res.status === 502 || res.status === 503 || res.status === 504) && retries > 0) {
      console.warn(`Server waking up (${res.status}). Retrying in 4s... (${retries} attempts left)`);
      await new Promise(r => setTimeout(r, 4000));
      return safeFetch(url, options, retries - 1, timeoutMs, retryOnAbort);
    }

    const text = await res.text();
    if (res.status === 401 && typeof localStorage !== 'undefined') {
      localStorage.removeItem('travelx_admin_token');
      localStorage.removeItem('travelx_admin_auth');
    }

    try {
      return JSON.parse(text);
    } catch (_) {
      return {
        success: false,
        error: res.status >= 500
          ? `Server busy (${res.status}). Backend restart / deploy zaroori ho sakta hai. 10 sec wait karke dubara Save dabayein, ya RESTART_TRAVELX.bat (local).`
          : `Unexpected response (${res.status})`
      };
    }
  } catch (err) {
    const abortedNow = err && (err.name === 'AbortError' || String(err.message || '').includes('aborted'));
    if (retries > 0 && (retryOnAbort || !abortedNow)) {
      console.warn('Network connection interrupted, retrying in 2.5s...', err.message);
      await new Promise(r => setTimeout(r, 2500));
      return safeFetch(url, options, retries - 1, timeoutMs, retryOnAbort);
    }
    const aborted = err && (err.name === 'AbortError' || String(err.message || '').includes('aborted'));
    const refused = String(err.message || '').includes('Failed to fetch');
    return {
      success: false,
      error: aborted
        ? 'Request timeout — server busy ya backend slow. 10 sec wait karke dubara try karein.'
        : refused
          ? 'Backend server connect nahi ho raha. START_TRAVELX.bat chalao (port 5001) ya CMD window band to nahi ki.'
          : 'Network connection failed. Kripya page refresh karein (Ctrl + F5).'
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const api = {
  // Health
  getHealth: async () => {
    return safeFetch('/api/health');
  },

  adminLogin: async (pin) => {
    return safeFetch('/api/auth/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
  },

  verifyAdminSession: async () => {
    return safeFetch('/api/auth/admin/session');
  },

  // Dashboard
  getDashboardStats: async () => {
    return safeFetch('/api/dashboard/stats');
  },

  // Fares
  getAllFares: async (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params.append(k, v);
      }
    });
    return safeFetch(`/api/fares?${params.toString()}`);
  },

  // Public Sanitized B2B Agent Portal APIs
  getPublicFares: async (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params.append(k, v);
      }
    });
    return safeFetch(`/api/public/fares?${params.toString()}`);
  },

  getPublicConfig: async () => {
    return safeFetch('/api/public/config');
  },

  createSingleFare: async (data) => {
    return safeFetch('/api/fares/single', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
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
    return safeFetch('/api/fares/parse-whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, defaults })
    });
  },

  parseImageWithAI: async ({ imageBase64, provider = 'openai', apiKey, defaults = {} }) => {
    return safeFetch('/api/fares/parse-image-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, provider, apiKey, defaults })
    }, 1, 70000, false);
  },

  syncVendorInventory: async (vendor_id, fares, replace_mode = 'sector') => {
    return safeFetch('/api/fares/sync-inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendor_id, fares, replace_mode })
    }, 3, 180000);
  },

  saveBulkFares: async (vendor_id, fares, replace_missing_dates = true, replace_mode = 'sector', onProgress) => {
    if (!fares || fares.length === 0) {
      return { success: false, error: 'No fare records to save' };
    }

    const postChunk = (chunk, skipSync) =>
      safeFetch('/api/fares/bulk-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor_id,
          fares: chunk,
          replace_missing_dates: replace_missing_dates && !skipSync,
          replace_mode,
          skip_inventory_sync: skipSync,
          summary_only: true
        })
      }, 1, 35000, false);

    if (fares.length <= BULK_CHUNK_SIZE) {
      return safeFetch('/api/fares/bulk-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor_id,
          fares,
          replace_missing_dates,
          replace_mode,
          skip_inventory_sync: false,
          summary_only: fares.length > 15
        })
      }, 1, 35000, false);
    }

    const totalChunks = Math.ceil(fares.length / BULK_CHUNK_SIZE);
    let savedTotal = 0;
    let createdTotal = 0;
    let updatedTotal = 0;

    for (let i = 0; i < totalChunks; i++) {
      const chunk = fares.slice(i * BULK_CHUNK_SIZE, (i + 1) * BULK_CHUNK_SIZE);
      if (onProgress) {
        onProgress({ phase: 'save', current: i + 1, total: totalChunks, label: `Saving batch ${i + 1} of ${totalChunks}…` });
      }
      const res = await postChunk(chunk, true);
      if (!res?.success) {
        const savedNote = savedTotal > 0 ? ` ${savedTotal} fares pehle save ho chuke hain — dubara Save dabane se baaki add ho jayenge.` : '';
        return {
          ...res,
          partial_saved: savedTotal,
          error: `${res?.error || `Batch ${i + 1}/${totalChunks} save failed`}${savedNote}`
        };
      }
      savedTotal += res.saved_count || 0;
      createdTotal += res.created_count || 0;
      updatedTotal += res.updated_count || 0;
    }

    let deletedCount = 0;
    if (replace_missing_dates) {
      if (onProgress) {
        onProgress({ phase: 'sync', current: totalChunks, total: totalChunks, label: 'Cleaning old sold-out dates…' });
      }
      const syncRes = await safeFetch('/api/fares/sync-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor_id, fares, replace_mode })
      }, 3, 180000);
      if (!syncRes?.success) {
        return {
          success: true,
          saved_count: savedTotal,
          created_count: createdTotal,
          updated_count: updatedTotal,
          warning: syncRes?.error || 'Fares saved but inventory cleanup failed — retry Save once.',
          deleted_count: 0
        };
      }
      deletedCount = syncRes.deleted_count || 0;
    }

    return {
      success: true,
      saved_count: savedTotal,
      created_count: createdTotal,
      updated_count: updatedTotal,
      deleted_count: deletedCount,
      message: `Saved ${savedTotal} fares in ${totalChunks} batches`
    };
  },

  batchUpdateMargins: async (updates, mark_published = 1, batch_title = 'Special Fare Release') => {
    return safeFetch('/api/fares/batch-update-margins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates, mark_published, batch_title })
    });
  },

  updateFare: async (id, data) => {
    return safeFetch(`/api/fares/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  deleteFare: async (id) => {
    return safeFetch(`/api/fares/${id}`, {
      method: 'DELETE'
    });
  },

  clearAllFares: async () => {
    return safeFetch('/api/fares/clear-all', {
      method: 'POST'
    });
  },

  clearVendorFares: async (vendor_id, options = false) => {
    const payload = typeof options === 'object' && options !== null
      ? options 
      : { only_today: !!options };

    return safeFetch(`/api/fares/clear-vendor/${vendor_id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },

  batchDeleteFares: async (ids = []) => {
    return safeFetch('/api/fares/batch-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
  },

  getVendorStats: async (vendor_id) => {
    return safeFetch(`/api/fares/vendor-stats/${vendor_id}`);
  },

  getFareHistory: async (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params.append(k, v);
      }
    });
    return safeFetch(`/api/fares/history?${params.toString()}`);
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
    return safeFetch('/api/margins/rules');
  },

  createMarginRule: async (rule) => {
    return safeFetch('/api/margins/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule)
    });
  },

  updateMarginRule: async (id, rule) => {
    return safeFetch(`/api/margins/rules/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule)
    });
  },

  deleteMarginRule: async (id) => {
    return safeFetch(`/api/margins/rules/${id}`, {
      method: 'DELETE'
    });
  },

  previewMargin: async (data) => {
    return safeFetch('/api/margins/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  // Master Data
  getAirlines: async () => {
    return safeFetch('/api/masters/airlines');
  },
  createAirline: async (data) => {
    return safeFetch('/api/masters/airlines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },
  updateAirline: async (code, data) => {
    return safeFetch(`/api/masters/airlines/${code}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  getVendors: async () => {
    return safeFetch('/api/masters/vendors');
  },
  createVendor: async (data) => {
    return safeFetch('/api/masters/vendors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },
  updateVendor: async (id, data) => {
    return safeFetch(`/api/masters/vendors/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },
  deleteVendor: async (id) => {
    return safeFetch(`/api/masters/vendors/${id}`, { method: 'DELETE' });
  },

  getRoutes: async () => {
    return safeFetch('/api/masters/routes');
  },
  createRoute: async (data) => {
    return safeFetch('/api/masters/routes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },
  updateRoute: async (id, data) => {
    return safeFetch(`/api/masters/routes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },
  deleteRoute: async (id) => {
    return safeFetch(`/api/masters/routes/${id}`, { method: 'DELETE' });
  },

  // Export & Broadcast
  togglePublish: async (fare_ids, is_published, batch_title) => {
    return safeFetch('/api/export/toggle-publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fare_ids, is_published, batch_title })
    });
  },

  generateWhatsAppMessage: async (options) => {
    return safeFetch('/api/export/whatsapp-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    });
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
    return safeFetch('/api/vendor-rules');
  },
  createVendorRule: async (data) => {
    return safeFetch('/api/vendor-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },
  updateVendorRule: async (id, data) => {
    return safeFetch(`/api/vendor-rules/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },
  deleteVendorRule: async (id) => {
    return safeFetch(`/api/vendor-rules/${id}`, { method: 'DELETE' });
  },
  applyVendorRulesToExisting: async (payload = {}) => {
    return safeFetch('/api/vendor-rules/apply-existing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },

  // B2B Agent & Booking Requests
  lookupAgent: async (mobile) => {
    return safeFetch(`/api/public/agent/lookup?mobile=${encodeURIComponent(mobile)}`);
  },
  registerAgent: async (data) => {
    return safeFetch('/api/public/agent/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },
  createBookingRequest: async (data) => {
    return safeFetch('/api/public/bookings/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },
  getBookingRequests: async (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, v);
    });
    return safeFetch(`/api/bookings?${query.toString()}`);
  },
  updateBookingStatus: async (id, status, remarks = '', pnr_code = '') => {
    return safeFetch(`/api/bookings/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, remarks, pnr_code })
    });
  },
  getAgentsDirectory: async (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, v);
    });
    return safeFetch(`/api/agents?${query.toString()}`);
  },
  createAgent: async (data) => {
    return safeFetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },
  updateAgent: async (id, data) => {
    return safeFetch(`/api/agents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },
  getWhatsAppSettings: async () => {
    return safeFetch('/api/settings/whatsapp');
  },
  saveWhatsAppSettings: async (data) => {
    return safeFetch('/api/settings/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },
  testWhatsAppAlert: async (data) => {
    return safeFetch('/api/settings/whatsapp/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  publishAllFutureFares: async () => {
    return safeFetch('/api/export/publish-all-future', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
  },

  downloadDatabaseBackup: async () => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('travelx_admin_token') : '';
    const res = await fetch('/api/settings/backup/download', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!res.ok) {
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch (_) {
        return { success: false, error: text || `Download failed (${res.status})` };
      }
    }
    const blob = await res.blob();
    const stamp = new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `travelx-backup-${stamp}.db`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { success: true };
  },

  restoreDatabaseBackup: async (file) => {
    const form = new FormData();
    form.append('backup', file);
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('travelx_admin_token') : '';
    const res = await fetch('/api/settings/backup/restore', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (_) {
      return { success: false, error: text || `Restore failed (${res.status})` };
    }
  },
  trackBooking: async (ref) => {
    return safeFetch(`/api/public/bookings/track/${encodeURIComponent(ref)}`);
  },
  reviewBookingRequest: async (id, data) => {
    return safeFetch(`/api/bookings/${id}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },
  uploadPassports: async (ref, formData) => {
    return safeFetch(`/api/public/bookings/${encodeURIComponent(ref)}/passports`, {
      method: 'POST',
      body: formData
    });
  },
  respondToRevisedFare: async (ref, action) => {
    return safeFetch(`/api/public/bookings/${encodeURIComponent(ref)}/fare-response`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
  },
  uploadTicket: async (id, formData) => {
    return safeFetch(`/api/bookings/${id}/ticket`, {
      method: 'POST',
      body: formData
    });
  }
};
