import React, { useState, useEffect, useRef } from 'react';
import { 
  Inbox, Phone, MessageSquare, CheckCircle2, Clock, 
  XCircle, Search, RefreshCw, Filter, Users, Calendar, 
  Plane, AlertCircle, ArrowRight, ExternalLink, Volume2, 
  VolumeX, Check, Building2, MapPin, Tag, Plus, Edit, X, Loader2,
  Settings, Send, Sparkles, ShieldCheck, CheckCheck,
  FileText, Upload, Download, Eye, Ticket, Bell
} from 'lucide-react';
import { api } from '../utils/api';

const INDIAN_STATES = [
  'Punjab', 'Delhi NCR', 'Haryana', 'Chandigarh UT', 'Rajasthan', 
  'Uttar Pradesh', 'Himachal Pradesh', 'Jammu & Kashmir', 'Uttarakhand', 
  'Maharashtra', 'Gujarat', 'West Bengal', 'Karnataka', 'Telangana', 
  'Tamil Nadu', 'Kerala', 'Bihar', 'Madhya Pradesh', 'Other'
];

export default function BookingRequestsDesk({ onSwitchToEnquiries }) {
  const [activeSubTab, setActiveSubTab] = useState('requests'); // 'requests' | 'directory'
  const [bookings, setBookings] = useState([]);
  const [agents, setAgents] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, available: 0, docs_submitted: 0, confirmed: 0, today: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [selectedBookingForRemark, setSelectedBookingForRemark] = useState(null);
  const [remarkInput, setRemarkInput] = useState('');

  // Add / Edit Agent Modal States
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [agentForm, setAgentForm] = useState({
    mobile: '',
    agency_name: '',
    agent_name: '',
    email: '',
    address: '',
    city: '',
    state: 'Punjab',
    pincode: ''
  });
  const [agentFormLoading, setAgentFormLoading] = useState(false);

  // WhatsApp Alert & Automation Settings Modal States
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsData, setSettingsData] = useState({
    admin_whatsapp_phone: '919888888888',
    callmebot_api_key: '',
    whatsapp_alerts_enabled: false,
    auto_expiry_enabled: true
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [testAlertLoading, setTestAlertLoading] = useState(false);
  const [testAlertStatus, setTestAlertStatus] = useState(null);

  // Confirm with PNR Modal States
  const [confirmingBooking, setConfirmingBooking] = useState(null);
  const [pnrCodeInput, setPnrCodeInput] = useState('');
  const [confirmRemarksInput, setConfirmRemarksInput] = useState('');
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);

  // 1. Review & Availability Reply Modal States
  const [reviewingBooking, setReviewingBooking] = useState(null);
  const [reviewStatus, setReviewStatus] = useState('AVAILABLE'); // 'AVAILABLE' | 'FARE_REVISED' | 'SOLD_OUT'
  const [revisedFareInput, setRevisedFareInput] = useState('');
  const [reviewInfantFareInput, setReviewInfantFareInput] = useState('');
  const [adminNotesInput, setAdminNotesInput] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSuccessBooking, setReviewSuccessBooking] = useState(null);

  // 2. Passports Viewer Modal States
  const [viewingPassportsBooking, setViewingPassportsBooking] = useState(null);

  // 3. E-Ticket Upload Modal States
  const [ticketUploadBooking, setTicketUploadBooking] = useState(null);
  const [ticketFileInput, setTicketFileInput] = useState(null);
  const [ticketPnrInput, setTicketPnrInput] = useState('');
  const [ticketSubmitting, setTicketSubmitting] = useState(false);

  // 4. Admin Real-Time Event Notification Modal (Passports submitted, Ticket Issued, etc.)
  const [adminEventModal, setAdminEventModal] = useState(null);
  const previousBookingsStatusMapRef = useRef({});
  const previousPendingCountRef = useRef(0);
  const autoOpenedPendingIdsRef = useRef(new Set());
  const titleFlashIntervalRef = useRef(null);

  // Desktop Push Notifications state
  const [desktopNotifsEnabled, setDesktopNotifsEnabled] = useState(() => {
    return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
  });

  // Unlock AudioContext on first user interaction so background sound plays reliably
  useEffect(() => {
    const unlockAudio = () => {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
      } catch (e) {}
      window.removeEventListener('click', unlockAudio);
    };
    window.addEventListener('click', unlockAudio);
    return () => window.removeEventListener('click', unlockAudio);
  }, []);

  // Request browser desktop notification permission
  const requestDesktopPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('Desktop notifications are not supported in this browser.');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        setDesktopNotifsEnabled(true);
        new Notification('🔔 TravelX Desktop Notifications Active!', {
          body: 'You will receive instant pop-up alerts on your Windows screen even when minimized.',
          icon: '/favicon.ico'
        });
      } else {
        setDesktopNotifsEnabled(false);
      }
    } catch (e) {
      console.warn('Permission error:', e);
    }
  };

  // Show native OS desktop notification (pops up on Windows even when browser is minimized!)
  const showDesktopNotification = (b) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(perm => {
        if (perm === 'granted') {
          setDesktopNotifsEnabled(true);
          showDesktopNotification(b);
        }
      });
      return;
    }

    if (Notification.permission === 'granted') {
      try {
        const notif = new Notification(`⚡ New Booking Query! #${b.request_ref}`, {
          body: `${b.agency_name} • ${b.origin} ➔ ${b.destination} (${b.travel_date})\n${formatPaxBreakdown(b)} • Quoted: ₹${Number(b.quoted_rate).toLocaleString('en-IN')}\n👉 Click to review & reply now!`,
          icon: '/favicon.ico',
          tag: `booking-new-${b.id}`,
          requireInteraction: true // Stays visible on Windows screen until clicked!
        });

        notif.onclick = () => {
          window.focus();
          if (onSwitchToEnquiries) onSwitchToEnquiries();
          setActiveSubTab('requests');
          handleOpenReviewModal(b);
          notif.close();
        };
      } catch (e) {
        console.warn('Desktop notification show error:', e);
      }
    }
  };

  // Flashes browser tab title when a new query arrives while tab is in background
  const startTitleFlashing = (refId) => {
    if (typeof document === 'undefined') return;
    if (titleFlashIntervalRef.current) clearInterval(titleFlashIntervalRef.current);
    let isAlt = false;
    const origTitle = 'TravelX Special Fare Desk';
    titleFlashIntervalRef.current = setInterval(() => {
      document.title = isAlt ? `🚨 (1) NEW QUERY #${refId}!` : `⚡ Seat Available??? • TravelX`;
      isAlt = !isAlt;
    }, 850);

    const handleFocus = () => {
      if (titleFlashIntervalRef.current) {
        clearInterval(titleFlashIntervalRef.current);
        titleFlashIntervalRef.current = null;
      }
      document.title = origTitle;
      window.removeEventListener('focus', handleFocus);
    };
    window.addEventListener('focus', handleFocus);
  };

  // Play attention-grabbing double chime when a new query arrives
  const playNotificationChime = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const now = audioCtx.currentTime;

      const playTone = (startTime, freq, duration) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.35, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      // Tone 1: Ding-Dong (D5 -> A5)
      playTone(now, 587.33, 0.25);
      playTone(now + 0.15, 880.00, 0.35);

      // Tone 2: Echo Ding-Dong for attention even if minimized (E5 -> C6)
      playTone(now + 0.55, 659.25, 0.25);
      playTone(now + 0.70, 1046.50, 0.45);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  };

  const loadBookings = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await api.getBookingRequests({
        status: statusFilter === 'ALL' ? '' : statusFilter,
        search: searchQuery
      });
      if (res && res.success) {
        const fetchedBookings = res.bookings || [];
        setBookings(fetchedBookings);

        // 1. Check for brand-new incoming PENDING inquiries -> AUTO-OPEN ON SCREEN!
        for (const b of fetchedBookings) {
          if (b.status === 'PENDING' && !autoOpenedPendingIdsRef.current.has(b.id)) {
            autoOpenedPendingIdsRef.current.add(b.id);

            // Audio chime
            playNotificationChime();

            // Windows Desktop Notification (pops up even when minimized!)
            showDesktopNotification(b);

            // Flash browser tab title
            startTitleFlashing(b.request_ref);

            // Switch to requests desk & tab
            if (onSwitchToEnquiries) onSwitchToEnquiries();
            setActiveSubTab('requests');

            // AUTOMATICALLY POP UP THE REVIEW MODAL RIGHT ON ADMIN SCREEN!
            handleOpenReviewModal(b);
            break;
          }
        }

        // 2. Check for real-time status changes (e.g. Passports Uploaded / Ticket Issued)
        if (Object.keys(previousBookingsStatusMapRef.current).length > 0) {
          for (const b of fetchedBookings) {
            const prevStatus = previousBookingsStatusMapRef.current[b.id];
            
            // Event A: Agent uploaded passports (DOCS_SUBMITTED)
            if (prevStatus && prevStatus !== 'DOCS_SUBMITTED' && b.status === 'DOCS_SUBMITTED') {
              playNotificationChime();
              if (Notification.permission === 'granted') {
                const notif = new Notification(`🚨 Passports Received! #${b.request_ref}`, {
                  body: `${b.agency_name} submitted passenger passports for ${b.origin} ➔ ${b.destination}. Click to view & issue ticket!`,
                  icon: '/favicon.ico',
                  tag: `passports-${b.id}`,
                  requireInteraction: true
                });
                notif.onclick = () => {
                  window.focus();
                  if (onSwitchToEnquiries) onSwitchToEnquiries();
                  setActiveSubTab('requests');
                  setViewingPassportsBooking(b);
                  notif.close();
                };
              }
              startTitleFlashing(b.request_ref);
              if (onSwitchToEnquiries) onSwitchToEnquiries();
              setActiveSubTab('requests');
              setViewingPassportsBooking(b);
              break;
            }
            // Event B: Ticket confirmed
            else if (prevStatus && prevStatus !== 'CONFIRMED' && b.status === 'CONFIRMED') {
              playNotificationChime();
              setAdminEventModal({
                type: 'CONFIRMED',
                booking: b,
                title: '🎉 Booking Confirmed & Ticket Issued!',
                subtitle: `E-Ticket for #${b.request_ref} (${b.agency_name}) has been confirmed. You can send the WhatsApp link to the agent.`
              });
              break;
            }
          }
        }

        // Save status map
        const newMap = {};
        fetchedBookings.forEach(b => {
          newMap[b.id] = b.status;
        });
        previousBookingsStatusMapRef.current = newMap;

        if (res.stats) {
          if (res.stats.pending > previousPendingCountRef.current && previousPendingCountRef.current > 0) {
            playNotificationChime();
          }
          previousPendingCountRef.current = res.stats.pending;
          setStats(res.stats);
        }
      }
    } catch (err) {
      console.error('Error loading bookings:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadAgents = async () => {
    try {
      const res = await api.getAgentsDirectory({ search: searchQuery });
      if (res && res.success) {
        setAgents(res.agents || []);
      }
    } catch (err) {
      console.error('Error loading agents:', err);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'requests') {
      loadBookings();
    } else {
      loadAgents();
    }
  }, [activeSubTab, statusFilter, searchQuery]);

  // Auto-polling every 3 seconds for instant desk notifications across all tabs
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadBookings(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, statusFilter, searchQuery]);

  const handleUpdateStatus = async (id, newStatus, customRemark = '') => {
    try {
      setActionLoadingId(id);
      const res = await api.updateBookingStatus(id, newStatus, customRemark);
      if (res && res.success) {
        setBookings(prev => prev.map(b => b.id === id ? { ...b, status: newStatus, remarks: customRemark || b.remarks } : b));
        // Refresh counts
        loadBookings(true);
        setSelectedBookingForRemark(null);
        setRemarkInput('');
      } else {
        alert(res?.error || 'Failed to update status');
      }
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Error updating booking status');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Agent Management Handlers
  const handleOpenAddAgentModal = () => {
    setEditingAgent(null);
    setAgentForm({
      mobile: '',
      agency_name: '',
      agent_name: '',
      email: '',
      address: '',
      city: '',
      state: 'Punjab',
      pincode: ''
    });
    setShowAgentModal(true);
  };

  const handleOpenEditAgentModal = (agent) => {
    setEditingAgent(agent);
    setAgentForm({
      mobile: agent.mobile || '',
      agency_name: agent.agency_name || '',
      agent_name: agent.agent_name || '',
      email: agent.email || '',
      address: agent.address || '',
      city: agent.city || '',
      state: agent.state || 'Punjab',
      pincode: agent.pincode || ''
    });
    setShowAgentModal(true);
  };

  const handleSaveAgent = async (e) => {
    if (e) e.preventDefault();
    const cleanMob = String(agentForm.mobile).replace(/\D/g, '').slice(-10);
    if (!cleanMob || cleanMob.length < 10) {
      alert('Please enter a valid 10-digit mobile number');
      return;
    }
    if (!agentForm.agency_name || !agentForm.agency_name.trim()) {
      alert('Please enter Agency Name');
      return;
    }

    try {
      setAgentFormLoading(true);
      const payload = {
        ...agentForm,
        mobile: cleanMob,
        agency_name: agentForm.agency_name.trim(),
        agent_name: agentForm.agent_name ? agentForm.agent_name.trim() : '',
        email: agentForm.email ? agentForm.email.trim() : '',
        address: agentForm.address ? agentForm.address.trim() : '',
        city: agentForm.city ? agentForm.city.trim() : '',
        state: agentForm.state ? agentForm.state.trim() : '',
        pincode: agentForm.pincode ? agentForm.pincode.trim() : ''
      };

      let res;
      if (editingAgent && editingAgent.id) {
        res = await api.updateAgent(editingAgent.id, payload);
      } else {
        res = await api.createAgent(payload);
      }

      if (res && res.success) {
        setShowAgentModal(false);
        loadAgents();
      } else {
        alert(res?.error || 'Failed to save agent profile');
      }
    } catch (err) {
      console.error(err);
      alert('Connection error. Please try again.');
    } finally {
      setAgentFormLoading(false);
    }
  };

  // Load WhatsApp Settings on mount
  const loadSettings = async () => {
    try {
      const res = await api.getWhatsAppSettings();
      if (res && res.success && res.settings) {
        setSettingsData(res.settings);
      }
    } catch (e) {
      console.warn('Error loading settings:', e);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // PNR Confirmation Handlers
  const handleOpenConfirmModal = (b) => {
    setConfirmingBooking(b);
    setPnrCodeInput(b.pnr_code || '');
    setConfirmRemarksInput(b.remarks || '');
  };

  const handleConfirmWithPnr = async (e) => {
    if (e) e.preventDefault();
    if (!confirmingBooking) return;
    try {
      setConfirmSubmitting(true);
      const res = await api.updateBookingStatus(
        confirmingBooking.id, 
        'CONFIRMED', 
        confirmRemarksInput.trim(), 
        pnrCodeInput.trim().toUpperCase()
      );
      if (res && res.success) {
        setBookings(prev => prev.map(item => item.id === confirmingBooking.id ? res.booking : item));
        setStats(prev => ({
          ...prev,
          pending: Math.max(0, prev.pending - 1),
          confirmed: prev.confirmed + 1
        }));
        setConfirmingBooking(null);
        setPnrCodeInput('');
        setConfirmRemarksInput('');
      } else {
        alert(res?.error || 'Failed to confirm booking');
      }
    } catch (err) {
      console.error('Error confirming booking:', err);
      alert('Error confirming booking');
    } finally {
      setConfirmSubmitting(false);
    }
  };

  // WhatsApp Alert Settings Handlers
  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();
    try {
      setSavingSettings(true);
      const res = await api.saveWhatsAppSettings(settingsData);
      if (res && res.success) {
        alert('WhatsApp alert & automation settings saved successfully!');
        setShowSettingsModal(false);
      } else {
        alert(res?.error || 'Failed to save settings');
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      alert('Error saving settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTestWhatsAppAlert = async () => {
    try {
      setTestAlertLoading(true);
      setTestAlertStatus(null);
      const res = await api.testWhatsAppAlert({
        phone: settingsData.admin_whatsapp_phone,
        api_key: settingsData.callmebot_api_key
      });
      if (res && res.success) {
        setTestAlertStatus({ success: true, message: res.message });
      } else {
        setTestAlertStatus({ success: false, message: res?.error || 'Failed to send test alert' });
      }
    } catch (err) {
      setTestAlertStatus({ success: false, message: err.message || 'Connection error' });
    } finally {
      setTestAlertLoading(false);
    }
  };

  // Passenger breakdown helper
  const formatPaxBreakdown = (b) => {
    if (!b) return '';
    const parts = [];
    if (b.pax_adults) parts.push(`${b.pax_adults} Adult${b.pax_adults > 1 ? 's' : ''}`);
    if (b.pax_children) parts.push(`${b.pax_children} Child${b.pax_children > 1 ? 'ren' : ''}`);
    if (b.pax_infants) parts.push(`${b.pax_infants} Infant${b.pax_infants > 1 ? 's' : ''}`);
    if (parts.length > 0) return `${b.pax_count} Pax (${parts.join(', ')})`;
    return `${b.pax_count} Pax`;
  };

  // 1-Click WhatsApp Hand-off URLs
  const getVendorWhatsAppUrl = (b) => {
    const phone = String(b.vendor_phone || '').replace(/\D/g, '');
    const cleanPhone = phone.length === 10 ? `91${phone}` : phone;
    const vendorName = b.vendor_name || 'Partner';
    const text = `Hi ${vendorName}, please hold seats for ${b.origin} ➔ ${b.destination} (${b.airline_name || b.airline_code} ${b.flight_number || ''}) on ${b.travel_date} (${b.departure_time || 'Non-Stop'}) @ Net ₹${Number(b.net_fare || b.quoted_rate).toLocaleString('en-IN')}/-. Pax: ${formatPaxBreakdown(b)}. Ref: #${b.request_ref}.`;
    if (cleanPhone) {
      return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    }
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  const getAgentPnrWhatsAppUrl = (b) => {
    const phone = String(b.agent_mobile || '').replace(/\D/g, '');
    const cleanPhone = phone.length === 10 ? `91${phone}` : phone;
    const text = `🎉 *BOOKING CONFIRMED — TRAVELX SPECIAL FARES*
━━━━━━━━━━━━━━━━━━━━━━━━━━
Ref ID: *#${b.request_ref}*
Dear *${b.agency_name}*,

Your booking has been ticketed and confirmed!

• *PNR / Ticket:* *${b.pnr_code || b.remarks || 'CONFIRMED'}*
• *Booking Ref:* #${b.request_ref}
• *Sector:* ${b.origin} ➔ ${b.destination}
• *Flight:* ${b.airline_name || b.airline_code} ${b.flight_number || ''}
• *Travel Date:* ${b.travel_date} (${b.departure_time || ''} ➔ ${b.arrival_time || ''})
• *Passengers:* ${formatPaxBreakdown(b)}
• *Baggage:* ${b.baggage || '30+7 KG'}
• *Total Rate:* ₹${Number(b.total_amount).toLocaleString('en-IN')}/- Net

Thank you for choosing TravelX!`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  };

  // WhatsApp quick reply generator
  const getWhatsAppReplyUrl = (b) => {
    const phone = String(b.agent_mobile).replace(/\D/g, '');
    const cleanPhone = phone.length === 10 ? `91${phone}` : phone;
    const msg = `✈️ *TRAVELX B2B DESK — BOOKING HOLD UPDATE*
━━━━━━━━━━━━━━━━━━━━━━━━━━
Ref ID: *#${b.request_ref}*
Dear *${b.agency_name}*,

Regarding your seat hold request:
• *Sector:* ${b.route_label}
• *Flight:* ${b.airline_name} (${b.flight_number})
• *Travel Date:* ${b.travel_date} (${b.departure_time} - ${b.arrival_time})
• *Passengers:* ${formatPaxBreakdown(b)}
• *Quoted Net Rate:* ₹${Number(b.quoted_rate).toLocaleString('en-IN')}/- Net per pax
• *Total Payable:* ₹${Number(b.total_amount).toLocaleString('en-IN')}/-
━━━━━━━━━━━━━━━━━━━━━━━━━━
Seats have been held on our desk. Please provide passenger passport copies for ticket issuance.`;

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
  };

  const getAgentTrackingUrl = (b) => {
    const origin = window.location.origin;
    return `${origin}/?track=${b.request_ref}`;
  };

  const getAgentReviewWhatsAppUrl = (b) => {
    const phone = String(b.agent_mobile || '').replace(/\D/g, '');
    const cleanPhone = phone.length === 10 ? `91${phone}` : phone;
    const trackUrl = getAgentTrackingUrl(b);

    let msg = '';
    if (b.status === 'AVAILABLE') {
      const infantLine = b.pax_infants > 0 
        ? (b.infant_fare ? `\n• *Infant Fare:* ₹${Number(b.infant_fare).toLocaleString('en-IN')} x ${b.pax_infants} (Airline fee)` : `\n• *Infant Fare:* As per Airline actuals`)
        : '';
      msg = `✅ *SEATS AVAILABLE — TRAVELX OPERATIONS*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Dear *${b.agency_name}*,

Good news! Seats are *AVAILABLE* at the quoted rate of *₹${Number(b.quoted_rate).toLocaleString('en-IN')}/pax* for your booking *#${b.request_ref}*.

• *Sector:* ${b.origin} ➔ ${b.destination} (${b.airline_name || b.airline_code} ${b.flight_number || ''})
• *Date:* ${b.travel_date}
• *Passengers:* ${formatPaxBreakdown(b)}${infantLine}
• *Total Fare:* ₹${Number(b.total_amount).toLocaleString('en-IN')}

👉 Please open your live tracking link to verify and upload passenger passport copies:
${trackUrl}

Thank you!
TravelX Special Fares`;
    } else if (b.status === 'FARE_REVISED') {
      const revisedPerPax = Number(b.revised_fare || b.quoted_rate);
      const infantLine = b.pax_infants > 0 
        ? (b.infant_fare ? `\n• *Infant Fare:* ₹${Number(b.infant_fare).toLocaleString('en-IN')} x ${b.pax_infants} (Airline fee)` : `\n• *Infant Fare:* As per Airline actuals`)
        : '';
      msg = `⚠️ *FARE REVISED UPDATE — TRAVELX OPERATIONS*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Dear *${b.agency_name}*,

Regarding booking *#${b.request_ref}* (${b.origin} ➔ ${b.destination}, ${b.travel_date}):
The current airline revised fare is *₹${revisedPerPax.toLocaleString('en-IN')}/pax*.${infantLine}
• *Total Amount:* ₹${Number(b.total_amount).toLocaleString('en-IN')}
${b.admin_notes ? `Note: ${b.admin_notes}\n` : ''}
👉 If acceptable to your passenger, please confirm and upload passport copies here:
${trackUrl}

Thank you!
TravelX Special Fares`;
    } else if (b.status === 'SOLD_OUT') {
      msg = `❌ *SEATS SOLD OUT — TRAVELX OPERATIONS*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Dear *${b.agency_name}*,

Regarding booking *#${b.request_ref}* (${b.origin} ➔ ${b.destination} on ${b.travel_date}):
Unfortunately, seats on this flight/date are *SOLD OUT*.
${b.admin_notes ? `Note: ${b.admin_notes}\n` : ''}
Please check alternate dates on our B2B portal or reply to this chat for next best options.

TravelX Special Fares`;
    } else {
      msg = `Hi ${b.agency_name}, regarding your booking #${b.request_ref}: please check the live status and upload documents here: ${trackUrl}`;
    }

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
  };

  const getAgentTicketWhatsAppUrl = (b) => {
    const phone = String(b.agent_mobile || '').replace(/\D/g, '');
    const cleanPhone = phone.length === 10 ? `91${phone}` : phone;
    const trackUrl = getAgentTrackingUrl(b);
    const text = `🎉 *E-TICKET ISSUED — TRAVELX SPECIAL FARES*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Dear *${b.agency_name}*,

Your E-Ticket for Booking *#${b.request_ref}* has been issued!

• *PNR:* *${b.pnr_code || 'CONFIRMED'}*
• *Sector:* ${b.origin} ➔ ${b.destination}
• *Flight:* ${b.airline_name || b.airline_code} ${b.flight_number || ''}
• *Date:* ${b.travel_date} (${b.departure_time || ''} ➔ ${b.arrival_time || ''})
• *Passengers:* ${b.pax_count} Pax
• *Baggage:* ${b.baggage || '30+7 KG'}

📥 *Download your E-Ticket PDF directly here:*
${trackUrl}

Thank you for booking with TravelX!`;

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  };

  // Review Modal Handlers
  const handleOpenReviewModal = (b, defaultStatus = 'AVAILABLE') => {
    setReviewingBooking(b);
    setReviewStatus(defaultStatus);
    setRevisedFareInput(b.revised_fare || b.quoted_rate || '');
    setReviewInfantFareInput(b.infant_fare ? String(b.infant_fare) : '');
    setAdminNotesInput(b.admin_notes || '');
    setReviewSuccessBooking(null);
  };

  const handleSubmitReview = async (e) => {
    if (e) e.preventDefault();
    if (!reviewingBooking) return;
    try {
      setReviewSubmitting(true);
      const res = await api.reviewBookingRequest(reviewingBooking.id, {
        status: reviewStatus,
        revised_fare: reviewStatus === 'FARE_REVISED' ? revisedFareInput : (reviewStatus === 'AVAILABLE' ? reviewingBooking.quoted_rate : null),
        infant_fare: reviewInfantFareInput ? Number(reviewInfantFareInput) : null,
        admin_notes: adminNotesInput.trim()
      });
      if (res && res.success) {
        setBookings(prev => prev.map(item => item.id === reviewingBooking.id ? res.booking : item));
        setReviewSuccessBooking(res.booking);
      } else {
        alert(res?.error || 'Failed to submit review');
      }
    } catch (err) {
      console.error('Error submitting review:', err);
      alert('Error updating booking review');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleSaveAndWhatsAppReview = async (e) => {
    if (e) e.preventDefault();
    if (!reviewingBooking) return;
    try {
      setReviewSubmitting(true);
      const res = await api.reviewBookingRequest(reviewingBooking.id, {
        status: reviewStatus,
        revised_fare: reviewStatus === 'FARE_REVISED' ? revisedFareInput : (reviewStatus === 'AVAILABLE' ? reviewingBooking.quoted_rate : null),
        infant_fare: reviewInfantFareInput ? Number(reviewInfantFareInput) : null,
        admin_notes: adminNotesInput.trim()
      });
      if (res && res.success) {
        setBookings(prev => prev.map(item => item.id === reviewingBooking.id ? res.booking : item));
        const url = getAgentReviewWhatsAppUrl(res.booking);
        window.open(url, '_blank');
        setReviewingBooking(null);
      } else {
        alert(res?.error || 'Failed to submit review');
      }
    } catch (err) {
      console.error('Error submitting review:', err);
      alert('Error updating booking review');
    } finally {
      setReviewSubmitting(false);
    }
  };

  // Ticket Upload Handlers
  const handleOpenTicketModal = (b) => {
    setTicketUploadBooking(b);
    setTicketPnrInput(b.pnr_code || '');
    setTicketFileInput(null);
  };

  const handleSubmitTicket = async (e) => {
    if (e) e.preventDefault();
    if (!ticketUploadBooking || !ticketFileInput) {
      alert('Please select an E-Ticket PDF or image file to upload.');
      return;
    }
    try {
      setTicketSubmitting(true);
      const formData = new FormData();
      formData.append('ticket', ticketFileInput);
      if (ticketPnrInput) {
        formData.append('pnr_code', ticketPnrInput.trim().toUpperCase());
      }
      const res = await api.uploadTicket(ticketUploadBooking.id, formData);
      if (res && res.success) {
        setBookings(prev => prev.map(item => item.id === ticketUploadBooking.id ? res.booking : item));
        alert('E-Ticket uploaded and booking confirmed successfully!');
        setTicketUploadBooking(null);
      } else {
        alert(res?.error || 'Failed to upload ticket');
      }
    } catch (err) {
      console.error('Error uploading ticket:', err);
      alert('Failed to upload ticket');
    } finally {
      setTicketSubmitting(false);
    }
  };

  return (
    <div className="max-w-[1750px] mx-auto px-4 sm:px-6 py-4 space-y-4">
      
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. TOP HEADER & SUB-TABS                                      */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
              <Inbox className="w-5 h-5 text-blue-900" />
              <span>Live Booking & Seat Hold Requests</span>
            </h1>
            {stats.pending > 0 && (
              <span className="bg-amber-500 text-white font-extrabold text-xs px-2 py-0.5 rounded-full animate-pulse">
                {stats.pending} New Pending
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time incoming seat hold inquiries from 500+ B2B verified travel agents
          </p>
        </div>

        {/* Action Controls & Sub-Tabs */}
        <div className="flex items-center space-x-2">
          {/* Sub-Tabs: Requests vs Agents */}
          <div className="bg-slate-100 p-0.5 rounded-lg flex items-center text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveSubTab('requests')}
              className={`px-3 py-1.5 rounded-md transition cursor-pointer flex items-center space-x-1.5 ${
                activeSubTab === 'requests'
                  ? 'bg-white text-blue-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Inbox className="w-3.5 h-3.5" />
              <span>Requests ({stats.total})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('directory')}
              className={`px-3 py-1.5 rounded-md transition cursor-pointer flex items-center space-x-1.5 ${
                activeSubTab === 'directory'
                  ? 'bg-white text-blue-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>B2B Agent Directory</span>
            </button>
          </div>

          {/* Desktop Push Notification Toggle */}
          <button
            type="button"
            onClick={requestDesktopPermission}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer flex items-center space-x-1.5 ${
              desktopNotifsEnabled 
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300 shadow-2xs' 
                : 'bg-amber-50 text-amber-900 border-amber-300 animate-pulse'
            }`}
            title={desktopNotifsEnabled ? 'Desktop notifications active (popups even when minimized)' : 'Click to enable desktop popups when browser is minimized'}
          >
            <Bell className={`w-3.5 h-3.5 ${desktopNotifsEnabled ? 'text-emerald-700' : 'text-amber-700'}`} />
            <span className="hidden md:inline">
              {desktopNotifsEnabled ? 'Desktop Alerts ON' : 'Enable Desktop Alerts'}
            </span>
            <span className={`w-2 h-2 rounded-full ${desktopNotifsEnabled ? 'bg-emerald-500' : 'bg-amber-500 animate-ping'}`} />
          </button>

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg border text-xs font-bold transition cursor-pointer ${
              soundEnabled ? 'bg-blue-50 text-blue-900 border-blue-200' : 'bg-slate-50 text-slate-400 border-slate-200'
            }`}
            title={soundEnabled ? 'Chime sound alert ON' : 'Chime sound alert MUTED'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => activeSubTab === 'requests' ? loadBookings() : loadAgents()}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-700' : ''}`} />
          </button>

          {/* WhatsApp Alert & Automation Settings */}
          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition flex items-center space-x-1.5 cursor-pointer shadow-2xs"
            title="Configure Live WhatsApp Alerts & Automation"
          >
            <Settings className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">WhatsApp Alerts</span>
            {settingsData.whatsapp_alerts_enabled && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* Desktop Notification Enable Banner */}
      {!desktopNotifsEnabled && (
        <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border border-amber-300 p-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Bell className="w-4 h-4 animate-bounce" />
            </div>
            <div>
              <p className="text-xs font-black text-amber-950">
                Enable Desktop Notifications (Band screen me bhi Pop-up aayega)
              </p>
              <p className="text-[11px] text-amber-800 font-medium">
                Jab browser minimized ya background me hoga, tab bhi screen par Windows pop-up aayega aur sound bajegi.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={requestDesktopPermission}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:scale-98 text-white font-black text-xs rounded-xl transition shadow-sm shrink-0 cursor-pointer flex items-center justify-center space-x-1.5"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Enable Popups Now</span>
          </button>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. STATS CARDS (Requests View)                                */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'requests' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Card 1: Total Inquiries */}
          <div className="bg-gradient-to-br from-white to-slate-50/80 rounded-2xl border border-slate-200/90 p-3.5 shadow-2xs hover:shadow-xs transition">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Total Inquiries</span>
              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                <Inbox className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-950 mt-1.5">{stats.total || bookings.length}</p>
            <span className="text-[11px] text-slate-500 font-semibold block mt-0.5">All Desk Requests</span>
          </div>

          {/* Card 2: Pending Review */}
          <div className="bg-gradient-to-br from-amber-50/90 via-amber-50/40 to-white rounded-2xl border border-amber-300/90 p-3.5 shadow-2xs hover:shadow-xs transition">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-amber-900 uppercase tracking-wider">Pending Action</span>
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 relative">
                <Clock className="w-4 h-4" />
                {(stats.pending > 0) && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 absolute -top-0.5 -right-0.5 animate-ping" />
                )}
              </div>
            </div>
            <p className="text-2xl font-black text-amber-950 mt-1.5">{stats.pending || 0}</p>
            <span className="text-[11px] text-amber-800 font-bold block mt-0.5">⚡ Needs Review</span>
          </div>

          {/* Card 3: Seats Available / Held */}
          <div className="bg-gradient-to-br from-sky-50/90 via-sky-50/40 to-white rounded-2xl border border-sky-300/90 p-3.5 shadow-2xs hover:shadow-xs transition">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-sky-900 uppercase tracking-wider">Seats Available</span>
              <div className="w-7 h-7 rounded-lg bg-sky-100 flex items-center justify-center text-sky-700">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-sky-950 mt-1.5">{stats.available || bookings.filter(b => b.status === 'AVAILABLE' || b.status === 'FARE_REVISED').length}</p>
            <span className="text-[11px] text-sky-800 font-bold block mt-0.5">Held on Desk</span>
          </div>

          {/* Card 4: Passports Ready for Issue */}
          <div className="bg-gradient-to-br from-teal-50/90 via-emerald-50/40 to-white rounded-2xl border border-teal-300/90 p-3.5 shadow-2xs hover:shadow-xs transition">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-teal-900 uppercase tracking-wider">Passports Ready</span>
              <div className="w-7 h-7 rounded-lg bg-teal-100 flex items-center justify-center text-teal-700 relative">
                <FileText className="w-4 h-4" />
                {((stats.docs_submitted || bookings.filter(b => b.status === 'DOCS_SUBMITTED').length) > 0) && (
                  <span className="w-2 h-2 rounded-full bg-teal-500 absolute -top-0.5 -right-0.5 animate-pulse" />
                )}
              </div>
            </div>
            <p className="text-2xl font-black text-teal-950 mt-1.5">{stats.docs_submitted || bookings.filter(b => b.status === 'DOCS_SUBMITTED').length}</p>
            <span className="text-[11px] text-teal-800 font-bold block mt-0.5">Ready for E-Ticket</span>
          </div>

          {/* Card 5: Confirmed PNRs */}
          <div className="bg-gradient-to-br from-emerald-50/90 via-emerald-50/40 to-white rounded-2xl border border-emerald-300/90 p-3.5 shadow-2xs hover:shadow-xs transition">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-emerald-900 uppercase tracking-wider">Confirmed PNRs</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                <Ticket className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-emerald-950 mt-1.5">{stats.confirmed || bookings.filter(b => b.status === 'CONFIRMED').length}</p>
            <span className="text-[11px] text-emerald-800 font-bold block mt-0.5">Tickets Dispatched</span>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. FILTER TABS & SEARCH BAR                                    */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        {activeSubTab === 'requests' ? (
          <div className="flex items-center space-x-1.5 overflow-x-auto py-0.5">
            {[
              { id: 'ALL', label: 'All Inquiries', count: stats.total || bookings.length },
              { id: 'PENDING', label: 'Pending Review', count: stats.pending, alert: stats.pending > 0, alertColor: 'bg-amber-500' },
              { id: 'AVAILABLE', label: 'Available', count: stats.available },
              { id: 'DOCS_SUBMITTED', label: 'Passports Ready', count: stats.docs_submitted, alert: stats.docs_submitted > 0, alertColor: 'bg-teal-500' },
              { id: 'CONFIRMED', label: 'Confirmed', count: stats.confirmed },
              { id: 'CANCELLED', label: 'Cancelled / Sold Out' }
            ].map(tab => {
              const isSelected = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center space-x-1.5 shrink-0 ${
                    isSelected
                      ? 'bg-blue-900 text-white shadow-sm ring-2 ring-blue-900/20'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && tab.count !== null && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : tab.alert
                        ? `${tab.alertColor} text-white animate-pulse`
                        : 'bg-slate-200 text-slate-700'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-700">
              <Building2 className="w-4 h-4 text-blue-900" />
              <span>Registered B2B Agents ({agents.length})</span>
            </div>
            <button
              type="button"
              onClick={handleOpenAddAgentModal}
              className="px-3 py-1 bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs rounded-lg transition shadow-xs flex items-center space-x-1 cursor-pointer active:scale-98"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add New Agent</span>
            </button>
          </div>
        )}

        {/* Search Input */}
        <div className="relative min-w-[260px] sm:min-w-[300px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeSubTab === 'requests' ? 'Search by Ref ID, Agency, Phone...' : 'Search agent name, city, phone...'}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-900 focus:bg-white font-medium"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. MAIN DATA TABLE (Requests Sub-Tab)                         */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'requests' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {bookings.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Inbox className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700">No booking requests found.</p>
              <p className="text-xs text-slate-400">
                When agents click "Book Seat" on the B2B portal, inquiries will instantly appear here with an audio alert.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Ref ID & Time</th>
                    <th className="py-3 px-4">B2B Agency & Contact</th>
                    <th className="py-3 px-4">Sector & Flight</th>
                    <th className="py-3 px-4">Travel Date & Timings</th>
                    <th className="py-3 px-4 text-center">Pax & Rate</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bookings.map(b => {
                    const isActioning = actionLoadingId === b.id;
                    const isPending = b.status === 'PENDING';
                    const isConfirmed = b.status === 'CONFIRMED';
                    const isCancelled = b.status === 'CANCELLED';

                    return (
                      <tr 
                        key={b.id} 
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isPending ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        {/* 1. Ref & Timestamp */}
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-black text-xs text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            #{b.request_ref}
                          </span>
                          <p className="text-[10px] text-slate-500 mt-1 flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{b.formatted_created_at || b.created_at}</span>
                          </p>
                        </td>

                        {/* 2. Agency & Contact Info */}
                        <td className="py-3.5 px-4">
                          <p className="font-black text-slate-900 text-xs">{b.agency_name}</p>
                          <div className="flex items-center space-x-1.5 text-slate-500 text-[11px] mt-0.5">
                            {b.agent_city && (
                              <span className="flex items-center space-x-0.5">
                                <MapPin className="w-3 h-3 text-slate-400" />
                                <span>{b.agent_city}</span>
                              </span>
                            )}
                            {b.agent_name && b.agent_name !== b.agency_name && (
                              <span>• {b.agent_name}</span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 mt-1">
                            <a
                              href={`tel:${b.agent_mobile}`}
                              className="text-blue-700 hover:underline font-mono font-bold text-[11px] flex items-center space-x-1"
                            >
                              <Phone className="w-3 h-3" />
                              <span>{b.agent_mobile}</span>
                            </a>
                            <a
                              href={getWhatsAppReplyUrl(b)}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
                              title="Chat on WhatsApp"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </td>

                        {/* 3. Sector & Flight */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                            <span>{b.origin} ➔ {b.destination}</span>
                          </div>
                          <div className="flex items-center space-x-1.5 mt-0.5">
                            <span className="font-bold text-slate-700">{b.airline_name}</span>
                            <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                              {b.flight_number}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">{b.baggage || '30+7 KG'}</p>

                          {/* Winning Vendor & Admin Profit Info */}
                          {b.vendor_name && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px]">
                              <span className="font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                                Vendor: {b.vendor_name}
                              </span>
                              {b.net_fare && (
                                <span className="text-slate-500 font-mono">
                                  Net: ₹{Number(b.net_fare).toLocaleString('en-IN')}
                                </span>
                              )}
                              {b.net_fare && b.quoted_rate && Number(b.quoted_rate) > Number(b.net_fare) && (
                                <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 py-0.5 rounded">
                                  +₹{(Number(b.quoted_rate) - Number(b.net_fare)) * Number(b.pax_count)} Profit
                                </span>
                              )}
                            </div>
                          )}

                          {/* PNR Code */}
                          {b.pnr_code && (
                            <div className="mt-1">
                              <span className="font-mono font-black text-[11px] text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded inline-flex items-center space-x-1">
                                <CheckCheck className="w-3 h-3 text-emerald-700" />
                                <span>PNR: {b.pnr_code}</span>
                              </span>
                            </div>
                          )}
                        </td>

                        {/* 4. Travel Date & Timings */}
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-900">{b.travel_date}</p>
                          <p className="text-slate-600 font-medium text-[11px]">
                            {b.departure_time} ➔ {b.arrival_time}
                          </p>
                          {b.duration && (
                            <span className="text-[10px] text-slate-400">Non-Stop ({b.duration})</span>
                          )}
                        </td>

                        {/* 5. Pax & Quoted Rate */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="font-black text-slate-900 text-sm block">
                            {b.pax_count} Pax
                          </span>
                          {(b.pax_adults != null || b.pax_children != null || b.pax_infants != null) && (
                            <span className="text-[10px] font-semibold text-slate-500 block leading-tight">
                              {b.pax_adults || b.pax_count} Adt{b.pax_children ? `, ${b.pax_children} Chd` : ''}{b.pax_infants ? `, ${b.pax_infants} Inf` : ''}
                            </span>
                          )}
                          <p className="text-xs font-bold text-[#0b3b82] mt-0.5">
                            ₹{Number(b.quoted_rate).toLocaleString('en-IN')}/pax
                          </p>
                          <span className="text-[10px] font-extrabold text-slate-500">
                            Total: ₹{Number(b.total_amount).toLocaleString('en-IN')}
                          </span>
                          {b.pax_infants > 0 && (
                            <span className="block text-[9px] font-bold text-amber-700 mt-0.5">
                              {b.infant_fare ? `+ Inf: ₹${Number(b.infant_fare).toLocaleString('en-IN')}` : '+ Inf: Airline fee extra'}
                            </span>
                          )}
                        </td>

                        {/* 6. Status Badge */}
                        <td className="py-3.5 px-4 text-center">
                          {b.status === 'PENDING' && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-ping mr-1" />
                              <span>PENDING</span>
                            </span>
                          )}
                          {b.status === 'AVAILABLE' && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                              <span>AVAILABLE</span>
                            </span>
                          )}
                          {b.status === 'FARE_REVISED' && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-900 border border-indigo-300">
                              <AlertCircle className="w-3 h-3 text-indigo-700" />
                              <span>REVISED ₹{Number(b.revised_fare || b.quoted_rate).toLocaleString('en-IN')}</span>
                            </span>
                          )}
                          {b.status === 'SOLD_OUT' && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                              <XCircle className="w-3 h-3 text-rose-700" />
                              <span>SOLD OUT</span>
                            </span>
                          )}
                          {b.status === 'DOCS_SUBMITTED' && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-teal-100 text-teal-900 border border-teal-300">
                              <FileText className="w-3 h-3 text-teal-700" />
                              <span>DOCS SUBMITTED</span>
                            </span>
                          )}
                          {b.status === 'CONFIRMED' && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                              <span>CONFIRMED</span>
                            </span>
                          )}
                          {b.status === 'CONTACTED' && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-100 text-blue-900 border border-blue-300">
                              <span>CONTACTED</span>
                            </span>
                          )}
                          {(b.status === 'FARE_DECLINED' || (b.status === 'CANCELLED' && b.admin_notes && b.admin_notes.includes('Declined'))) && (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-600 text-white shadow-xs">
                                <XCircle className="w-3 h-3 text-white" />
                                <span>FARE DECLINED</span>
                              </span>
                              {b.revised_fare && (
                                <span className="text-[10px] text-rose-700 font-extrabold block">
                                  Rejected ₹{Number(b.revised_fare).toLocaleString('en-IN')}
                                </span>
                              )}
                            </div>
                          )}
                          {(b.status === 'FARE_ACCEPTED' || (b.admin_notes && b.admin_notes.includes('Agent Accepted Revised Fare'))) && (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-600 text-white shadow-xs">
                                <CheckCircle2 className="w-3 h-3 text-white" />
                                <span>FARE ACCEPTED</span>
                              </span>
                              {b.revised_fare && (
                                <span className="text-[10px] text-emerald-700 font-extrabold block">
                                  Agreed ₹{Number(b.revised_fare).toLocaleString('en-IN')}
                                </span>
                              )}
                            </div>
                          )}
                          {b.status === 'CANCELLED' && (!b.admin_notes || !b.admin_notes.includes('Declined')) && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-800 border border-slate-300">
                              <span>CANCELLED</span>
                            </span>
                          )}

                          {/* Passports Badge / Viewer Link */}
                          {(() => {
                            let pList = [];
                            try { if (b.passport_files) pList = JSON.parse(b.passport_files); } catch (e) {}
                            if (pList.length > 0) {
                              return (
                                <button
                                  type="button"
                                  onClick={() => setViewingPassportsBooking(b)}
                                  className="mt-1.5 px-2 py-0.5 rounded bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 font-extrabold text-[10px] flex items-center justify-center space-x-1 mx-auto transition cursor-pointer shadow-2xs"
                                  title="View passenger passports"
                                >
                                  <FileText className="w-3 h-3 text-teal-600" />
                                  <span>Passports ({pList.length})</span>
                                </button>
                              );
                            }
                            return null;
                          })()}

                          {/* Ticket Uploaded Badge */}
                          {b.ticket_file_path && (
                            <div className="mt-1">
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-[10px] inline-flex items-center space-x-0.5">
                                <Ticket className="w-3 h-3 text-emerald-600" />
                                <span>Ticket Attached</span>
                              </span>
                            </div>
                          )}

                          {b.remarks && (
                            <p className="text-[10px] text-slate-500 italic mt-1 max-w-[140px] truncate mx-auto" title={b.remarks}>
                              "{b.remarks}"
                            </p>
                          )}
                        </td>

                        {/* 7. Action Buttons */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1.5 flex-wrap gap-y-1.5">
                            {/* 1. Review & Availability Reply Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenReviewModal(b)}
                              className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-[11px] transition flex items-center space-x-1.5 cursor-pointer shadow-xs active:scale-95"
                              title="Check Availability & Reply (Available, Revised Fare, Sold Out)"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>Review</span>
                            </button>

                            {/* 2. E-Ticket Upload Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenTicketModal(b)}
                              className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-[#0b3b82] to-blue-900 hover:from-blue-900 hover:to-blue-950 text-white font-black text-[11px] transition flex items-center space-x-1.5 cursor-pointer shadow-xs active:scale-95"
                              title="Upload E-Ticket PDF & Issue PNR"
                            >
                              <Ticket className="w-3.5 h-3.5" />
                              <span>Ticket</span>
                            </button>

                            {/* 3. Vendor 1-Click WhatsApp */}
                            <a
                              href={getVendorWhatsAppUrl(b)}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-black text-[11px] transition flex items-center space-x-1 shadow-xs cursor-pointer active:scale-95"
                              title={`1-Click WhatsApp to Vendor: ${b.vendor_name || 'Partner'}`}
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Vendor</span>
                            </a>

                            {/* 4. Smart WhatsApp Button to Agent */}
                            {b.status === 'CONFIRMED' ? (
                              <a
                                href={getAgentTicketWhatsAppUrl(b)}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-[11px] transition flex items-center space-x-1.5 shadow-xs cursor-pointer active:scale-95"
                                title="Send E-Ticket Download link to Agent on WhatsApp"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Send Ticket</span>
                              </a>
                            ) : ['AVAILABLE', 'FARE_REVISED', 'SOLD_OUT'].includes(b.status) ? (
                              <a
                                href={getAgentReviewWhatsAppUrl(b)}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-[11px] transition flex items-center space-x-1.5 shadow-xs cursor-pointer active:scale-95"
                                title="Send Status & Passport Upload Link to Agent"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>Send Link</span>
                              </a>
                            ) : (
                              <a
                                href={getWhatsAppReplyUrl(b)}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-[11px] transition flex items-center space-x-1 cursor-pointer"
                                title="Chat with Agent on WhatsApp"
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                                <span className="hidden sm:inline">Agent</span>
                              </a>
                            )}

                            {/* Status Change Dropdown Menu */}
                            <select
                              value={b.status}
                              disabled={isActioning}
                              onChange={(e) => {
                                if (e.target.value === 'CONFIRMED') {
                                  handleOpenTicketModal(b);
                                } else {
                                  handleUpdateStatus(b.id, e.target.value);
                                }
                              }}
                              className="px-2 py-1.5 rounded-xl border border-slate-300 bg-white text-[11px] font-black text-slate-800 outline-none hover:border-slate-400 cursor-pointer shadow-2xs transition"
                            >
                              <option value="PENDING">Pending</option>
                              <option value="AVAILABLE">Available</option>
                              <option value="FARE_REVISED">Fare Revised</option>
                              <option value="SOLD_OUT">Sold Out</option>
                              <option value="DOCS_SUBMITTED">Docs Submitted</option>
                              <option value="CONFIRMED">Confirmed</option>
                              <option value="CONTACTED">Contacted</option>
                              <option value="CANCELLED">Cancelled</option>
                            </select>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 5. B2B AGENTS DIRECTORY SUB-TAB                               */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'directory' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {agents.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <Users className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700">No agents registered yet.</p>
              <p className="text-xs text-slate-400">
                Whenever an agent submits their first seat hold request, they will be automatically cataloged here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Agency Name</th>
                    <th className="py-3 px-4">Contact Person</th>
                    <th className="py-3 px-4">Mobile Number</th>
                    <th className="py-3 px-4">Registered Office Address</th>
                    <th className="py-3 px-4 text-center">Inquiries</th>
                    <th className="py-3 px-4">Last Active</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {agents.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div>
                          <span className="font-extrabold text-slate-900 text-xs flex items-center space-x-1.5">
                            <Building2 className="w-3.5 h-3.5 text-blue-900 shrink-0" />
                            <span>{a.agency_name}</span>
                          </span>
                          {a.email && (
                            <span className="text-[10px] text-slate-400 block ml-5">{a.email}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        {a.agent_name || '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-slate-900">{a.mobile}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 text-xs max-w-xs">
                        {a.address || a.city || a.state ? (
                          <div className="space-y-0.5">
                            {a.address && <p className="font-medium text-slate-800">{a.address}</p>}
                            <p className="text-[11px] text-slate-500 font-semibold flex items-center space-x-1">
                              <MapPin className="w-3 h-3 text-orange-600 shrink-0" />
                              <span>
                                {[a.city, a.state, a.pincode].filter(Boolean).join(', ')}
                              </span>
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No address on file</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-full font-black text-xs bg-blue-100 text-blue-950">
                          {a.total_bookings} Inquiries
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        {a.last_active_at || a.created_at}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditAgentModal(a)}
                            className="p-1.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-800 transition cursor-pointer"
                            title="Edit Agent Profile & Address"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={`tel:${a.mobile}`}
                            className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                            title="Call Agent"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                          <a
                            href={`https://wa.me/91${a.mobile.replace(/\D/g, '')}?text=${encodeURIComponent(`Hello ${a.agency_name}, this is TravelX Special Fares Desk.`)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition"
                            title="Chat on WhatsApp"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 6. ADMIN ADD / EDIT B2B AGENT MODAL                           */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showAgentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden my-auto animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-900 to-[#0b3b82] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-sky-300" />
                <h3 className="font-bold text-sm sm:text-base">
                  {editingAgent ? 'Edit B2B Agent Profile & Address' : 'Register New B2B Agent'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAgentModal(false)}
                className="p-1 rounded-full hover:bg-white/20 transition cursor-pointer text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body Form */}
            <form onSubmit={handleSaveAgent} className="p-5 space-y-4 text-xs">
              <div className="space-y-2.5">
                <span className="text-[11px] font-black text-slate-900 uppercase tracking-wider block">
                  1. Agency & Primary Contact
                </span>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Agency Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter Agency Name"
                    value={agentForm.agency_name}
                    onChange={(e) => setAgentForm({ ...agentForm, agency_name: e.target.value })}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-bold text-slate-900 outline-none focus:border-blue-900 text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Mobile Number *</label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="10-digit mobile"
                      value={agentForm.mobile}
                      onChange={(e) => setAgentForm({ ...agentForm, mobile: e.target.value.replace(/\D/g, '') })}
                      className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-mono font-bold text-slate-900 outline-none focus:border-blue-900 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Contact Person (Optional)</label>
                    <input
                      type="text"
                      placeholder="Contact / Owner Name"
                      value={agentForm.agent_name}
                      onChange={(e) => setAgentForm({ ...agentForm, agent_name: e.target.value })}
                      className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-medium text-slate-900 outline-none focus:border-blue-900 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Email ID (Optional)</label>
                  <input
                    type="email"
                    placeholder="agency@example.com"
                    value={agentForm.email}
                    onChange={(e) => setAgentForm({ ...agentForm, email: e.target.value })}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-medium text-slate-900 outline-none focus:border-blue-900 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-2.5 pt-2 border-t border-slate-200">
                <div className="flex items-center space-x-1 text-[11px] font-black text-slate-900 uppercase tracking-wider">
                  <MapPin className="w-3.5 h-3.5 text-orange-600" />
                  <span>2. Office / Shop Address Details</span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Office / Shop Address</label>
                  <input
                    type="text"
                    placeholder="Shop/Office No., Building, Market / Street"
                    value={agentForm.address}
                    onChange={(e) => setAgentForm({ ...agentForm, address: e.target.value })}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-slate-900 outline-none focus:border-blue-900 text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">City</label>
                    <input
                      type="text"
                      placeholder="e.g. Amritsar"
                      value={agentForm.city}
                      onChange={(e) => setAgentForm({ ...agentForm, city: e.target.value })}
                      className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-medium text-slate-900 outline-none focus:border-blue-900 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">State</label>
                    <select
                      value={agentForm.state || 'Punjab'}
                      onChange={(e) => setAgentForm({ ...agentForm, state: e.target.value })}
                      className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-medium text-slate-900 outline-none focus:border-blue-900 text-xs cursor-pointer"
                    >
                      {INDIAN_STATES.map(st => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Pincode</label>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="e.g. 143001"
                      value={agentForm.pincode}
                      onChange={(e) => setAgentForm({ ...agentForm, pincode: e.target.value.replace(/\D/g, '') })}
                      className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-mono text-slate-900 outline-none focus:border-blue-900 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 flex items-center space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAgentModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={agentFormLoading}
                  className="flex-1 py-2.5 bg-blue-900 hover:bg-blue-950 text-white font-bold rounded-xl transition cursor-pointer shadow-sm flex items-center justify-center space-x-1.5"
                >
                  {agentFormLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{editingAgent ? 'Update Agent Profile' : 'Save Agent'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 7. CONFIRM BOOKING & ISSUE PNR MODAL                           */}
      {/* ───────────────────────────────────────────────────────────── */}
      {confirmingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 leading-tight">
                    Confirm Seat Hold & Issue PNR
                  </h3>
                  <span className="font-mono font-bold text-xs text-blue-900">
                    Ref: #{confirmingBooking.request_ref}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmingBooking(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmWithPnr} className="mt-4 space-y-4">
              {/* Flight & Agency Summary Box */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Agency:</span>
                  <span className="font-bold text-slate-900">{confirmingBooking.agency_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Sector & Flight:</span>
                  <span className="font-bold text-slate-900">
                    {confirmingBooking.origin} ➔ {confirmingBooking.destination} ({confirmingBooking.airline_name} {confirmingBooking.flight_number})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Travel Date:</span>
                  <span className="font-bold text-slate-900">{confirmingBooking.travel_date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Passengers:</span>
                  <span className="font-bold text-slate-900">{formatPaxBreakdown(confirmingBooking)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Total Quoted:</span>
                  <span className="font-black text-[#0b3b82]">
                    ₹{Number(confirmingBooking.total_amount).toLocaleString('en-IN')}/-
                  </span>
                </div>
                {confirmingBooking.vendor_name && (
                  <div className="flex justify-between pt-1 border-t border-slate-200">
                    <span className="text-indigo-700 font-semibold">Winning Vendor:</span>
                    <span className="font-bold text-indigo-900">
                      {confirmingBooking.vendor_name} (Net: ₹{confirmingBooking.net_fare})
                    </span>
                  </div>
                )}
              </div>

              {/* PNR Code Input */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Airline PNR Number / Booking Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. K9X2LP or ABC123"
                  value={pnrCodeInput}
                  onChange={(e) => setPnrCodeInput(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2.5 bg-white rounded-xl border border-slate-300 font-mono font-bold text-slate-900 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 uppercase"
                  autoFocus
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  This PNR will be displayed on the desk and sent in the 1-click WhatsApp confirmation voucher to the agent.
                </p>
              </div>

              {/* Internal Remarks */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Internal Remarks (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Issued via Monga, payment pending"
                  value={confirmRemarksInput}
                  onChange={(e) => setConfirmRemarksInput(e.target.value)}
                  className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-slate-900 text-xs outline-none focus:border-blue-900"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-2 flex items-center space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConfirmingBooking(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={confirmSubmitting || !pnrCodeInput.trim()}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl transition cursor-pointer shadow-sm flex items-center justify-center space-x-1.5 text-xs"
                >
                  {confirmSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Confirm Booking & Issue PNR</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 8. WHATSAPP ALERTS & AUTOMATION SETTINGS MODAL                 */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shadow-2xs">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 leading-tight">
                    WhatsApp Business Live Alerts
                  </h3>
                  <span className="text-xs text-slate-500 font-medium">
                    100% Free instant background notifications to your phone
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="mt-4 space-y-4">
              {/* Phone Number */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Admin WhatsApp Business Number (with Country Code)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 919888919465"
                  value={settingsData.admin_whatsapp_phone}
                  onChange={(e) => setSettingsData({ ...settingsData, admin_whatsapp_phone: e.target.value.replace(/\D/g, '') })}
                  className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 font-mono font-bold text-slate-900 text-xs outline-none focus:border-blue-900"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Must include country code without + or dashes (e.g. 919888919465 for India).
                </p>
              </div>

              {/* CallMeBot API Key */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  CallMeBot Free API Key
                </label>
                <input
                  type="text"
                  placeholder="e.g. 123456"
                  value={settingsData.callmebot_api_key}
                  onChange={(e) => setSettingsData({ ...settingsData, callmebot_api_key: e.target.value.trim() })}
                  className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 font-mono font-bold text-slate-900 text-xs outline-none focus:border-blue-900"
                />

                {/* 10-Second Free Setup Instructions */}
                <div className="mt-2 p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-[11px] text-emerald-950 space-y-1.5">
                  <div className="font-bold flex items-center space-x-1 text-emerald-900">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                    <span>How to get your Free API Key (10 Seconds):</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-emerald-800">
                    <li>
                      Apne phone WhatsApp Business se is link par click karein:{' '}
                      <a
                        href="https://wa.me/34911981111?text=I%20allow%20callmebot%20to%20send%20me%20messages"
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold underline text-emerald-950 inline-flex items-center space-x-0.5"
                      >
                        <span>Activate CallMeBot on WhatsApp</span>
                        <ExternalLink className="w-3 h-3 ml-0.5" />
                      </a>
                    </li>
                    <li>
                      Chat khulne par <b>"I allow callmebot to send me messages"</b> send karein.
                    </li>
                    <li>
                      CallMeBot aapko turant reply mein aapka <b>apikey</b> bhej dega. Usko yahan paste karein!
                    </li>
                  </ol>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="flex items-center space-x-2.5 cursor-pointer text-xs font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={settingsData.whatsapp_alerts_enabled}
                    onChange={(e) => setSettingsData({ ...settingsData, whatsapp_alerts_enabled: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600 cursor-pointer"
                  />
                  <span>Enable Live WhatsApp Alerts on New Bookings</span>
                </label>

                <label className="flex items-center space-x-2.5 cursor-pointer text-xs font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={settingsData.auto_expiry_enabled}
                    onChange={(e) => setSettingsData({ ...settingsData, auto_expiry_enabled: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-900 cursor-pointer"
                  />
                  <span>Auto-Expire Past Flight Dates from Portal (Self-Hygiene)</span>
                </label>
              </div>

              {/* Test Alert Button & Response */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={testAlertLoading || !settingsData.admin_whatsapp_phone || !settingsData.callmebot_api_key}
                  onClick={handleTestWhatsAppAlert}
                  className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 text-emerald-900 font-bold rounded-xl transition cursor-pointer border border-emerald-200 text-xs flex items-center justify-center space-x-1.5"
                >
                  {testAlertLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Send Test WhatsApp Alert to My Phone</span>
                </button>

                {testAlertStatus && (
                  <div className={`mt-2 p-2.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 ${
                    testAlertStatus.success 
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      : 'bg-rose-100 text-rose-900 border border-rose-300'
                  }`}>
                    {testAlertStatus.success ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-700" />}
                    <span>{testAlertStatus.message}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="flex-1 py-2.5 bg-blue-900 hover:bg-blue-950 text-white font-bold rounded-xl transition cursor-pointer shadow-sm flex items-center justify-center space-x-1.5 text-xs"
                >
                  {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Save Automation Settings</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 9. INQUIRY REVIEW & AVAILABILITY REPLY MODAL                  */}
      {/* ───────────────────────────────────────────────────────────── */}
      {reviewingBooking && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200/90 shadow-[0_20px_60px_-15px_rgba(11,59,130,0.35)] overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Executive Operations Header */}
            <div className="bg-gradient-to-r from-[#072450] via-[#0b3b82] to-[#124b96] text-white p-5 relative overflow-hidden">
              <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full blur-xl pointer-events-none" />
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-sky-200 shadow-inner">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] uppercase font-black tracking-widest text-sky-300">
                        TravelX Operations Desk
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                    <h3 className="text-base sm:text-lg font-black leading-tight text-white">
                      Review Seat Availability & Pricing
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReviewingBooking(null)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
                  title="Close modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Booking Reference & Agency Pill */}
              <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs relative z-10">
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-black bg-white/15 px-2.5 py-0.5 rounded-md text-white border border-white/20">
                    #{reviewingBooking.request_ref}
                  </span>
                  <span className="font-bold text-sky-100 truncate max-w-[200px] sm:max-w-xs">
                    {reviewingBooking.agency_name}
                  </span>
                </div>
                {reviewingBooking.agent_mobile && (
                  <span className="font-mono text-sky-200 text-[11px] font-bold">
                    📞 +{reviewingBooking.agent_mobile}
                  </span>
                )}
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-4 max-h-[82vh] overflow-y-auto">
              {/* Boarding-Card Style Flight Overview */}
              <div className="bg-gradient-to-br from-slate-50 to-blue-50/40 border border-slate-200/90 rounded-2xl p-4 space-y-3 shadow-2xs">
                {/* Sector & Airline Banner */}
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/80">
                  <div className="flex items-center space-x-2">
                    <span className="font-black text-slate-900 text-sm sm:text-base tracking-tight">
                      {reviewingBooking.origin} ➔ {reviewingBooking.destination}
                    </span>
                    {reviewingBooking.route_label && (
                      <span className="text-[11px] text-slate-500 hidden sm:inline">
                        ({reviewingBooking.route_label})
                      </span>
                    )}
                  </div>
                  <span className="px-2.5 py-1 bg-white rounded-lg border border-slate-200 font-extrabold text-[11px] text-blue-900 shadow-2xs">
                    {reviewingBooking.airline_name || reviewingBooking.airline_code} {reviewingBooking.flight_number}
                  </span>
                </div>

                {/* 3-Column Flight Details */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                      Travel Date & Time
                    </span>
                    <span className="font-bold text-slate-900 block mt-0.5">
                      {reviewingBooking.travel_date}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {reviewingBooking.departure_time || 'Non-Stop'} ➔ {reviewingBooking.arrival_time || ''}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                      Passengers
                    </span>
                    <span className="font-bold text-slate-900 block mt-0.5">
                      {reviewingBooking.pax_count} Pax
                    </span>
                    <span className="text-[10px] text-slate-600 font-medium block">
                      {reviewingBooking.pax_adults || reviewingBooking.pax_count} Adt{reviewingBooking.pax_children ? `, ${reviewingBooking.pax_children} Chd` : ''}{reviewingBooking.pax_infants ? `, ${reviewingBooking.pax_infants} Inf` : ''}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                      Quoted Rate
                    </span>
                    <span className="font-black text-[#0b3b82] text-sm block mt-0.5">
                      ₹{Number(reviewingBooking.quoted_rate).toLocaleString('en-IN')}<span className="text-[10px] text-slate-500 font-normal">/pax</span>
                    </span>
                    <span className="text-[10px] font-black text-slate-600 block">
                      Total: ₹{Number(reviewingBooking.total_amount).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Baggage & Vendor info if any */}
                {(reviewingBooking.baggage || reviewingBooking.vendor_name) && (
                  <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px] text-slate-500">
                    <span>🧳 Baggage: <b>{reviewingBooking.baggage || '30+7 KG'}</b></span>
                    {reviewingBooking.vendor_name && (
                      <span className="font-semibold text-indigo-900">
                        Vendor: <b>{reviewingBooking.vendor_name}</b> {reviewingBooking.net_fare ? `(₹${Number(reviewingBooking.net_fare).toLocaleString('en-IN')})` : ''}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Status Decision Selector: Available vs Fare Revised vs Sold Out */}
              <div>
                <label className="block text-xs font-black text-slate-900 mb-2">
                  Select Availability Decision:
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {/* Card 1: Available */}
                  <button
                    type="button"
                    onClick={() => setReviewStatus('AVAILABLE')}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      reviewStatus === 'AVAILABLE'
                        ? 'bg-emerald-50/90 border-2 border-emerald-500 text-emerald-950 shadow-sm ring-4 ring-emerald-500/10'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 font-black text-xs text-emerald-700">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Available</span>
                    </div>
                    <span className="text-[10px] text-slate-600 font-medium mt-1">
                      Same Rate (₹{Number(reviewingBooking.quoted_rate).toLocaleString('en-IN')})
                    </span>
                  </button>

                  {/* Card 2: Fare Revised */}
                  <button
                    type="button"
                    onClick={() => setReviewStatus('FARE_REVISED')}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      reviewStatus === 'FARE_REVISED'
                        ? 'bg-indigo-50/90 border-2 border-indigo-500 text-indigo-950 shadow-sm ring-4 ring-indigo-500/10'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 font-black text-xs text-indigo-700">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>Fare Revised</span>
                    </div>
                    <span className="text-[10px] text-slate-600 font-medium mt-1">
                      Airline Rate Changed
                    </span>
                  </button>

                  {/* Card 3: Sold Out */}
                  <button
                    type="button"
                    onClick={() => setReviewStatus('SOLD_OUT')}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      reviewStatus === 'SOLD_OUT'
                        ? 'bg-rose-50/90 border-2 border-rose-500 text-rose-950 shadow-sm ring-4 ring-rose-500/10'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 font-black text-xs text-rose-700">
                      <XCircle className="w-4 h-4 shrink-0" />
                      <span>Sold Out</span>
                    </div>
                    <span className="text-[10px] text-slate-600 font-medium mt-1">
                      Check Next Date
                    </span>
                  </button>
                </div>
              </div>

              {/* Input for Revised Fare if selected */}
              {reviewStatus === 'FARE_REVISED' && (
                <div className="p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-2xl space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-black text-indigo-950">
                      New / Revised Net Rate (per Seat):
                    </label>
                    <span className="text-[10px] font-bold text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded border border-indigo-300">
                      Was: ₹{Number(reviewingBooking.quoted_rate).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-sm font-bold text-slate-400">₹</span>
                    <input
                      type="number"
                      required
                      value={revisedFareInput}
                      onChange={(e) => setRevisedFareInput(e.target.value)}
                      placeholder="e.g. 21500"
                      className="w-full pl-8 pr-3 py-2.5 bg-white rounded-xl border border-indigo-300 font-black text-indigo-950 text-sm outline-none focus:border-indigo-600 shadow-2xs"
                    />
                  </div>
                  <p className="text-[11px] text-indigo-900 font-semibold">
                    New seat total for {(Number(reviewingBooking.pax_adults) || Number(reviewingBooking.pax_count)) + Number(reviewingBooking.pax_children || 0)} physical seats: <b>₹{Number(Number(revisedFareInput || 0) * ((Number(reviewingBooking.pax_adults) || Number(reviewingBooking.pax_count)) + Number(reviewingBooking.pax_children || 0))).toLocaleString('en-IN')}</b>
                  </p>
                </div>
              )}

              {/* Input for Infant Fare if booking has infants */}
              {Number(reviewingBooking.pax_infants || 0) > 0 && (reviewStatus === 'AVAILABLE' || reviewStatus === 'FARE_REVISED') && (
                <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-2xl space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-black text-amber-950">
                      Airline Infant Fare ({reviewingBooking.pax_infants} Infant{reviewingBooking.pax_infants > 1 ? 's' : ''}):
                    </label>
                    <span className="text-[10px] text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                      Airline Actuals (Per Infant)
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-sm font-bold text-slate-400">₹</span>
                    <input
                      type="number"
                      value={reviewInfantFareInput}
                      onChange={(e) => setReviewInfantFareInput(e.target.value)}
                      placeholder="e.g. 2800 (Enter exact airline infant fee)"
                      className="w-full pl-8 pr-3 py-2.5 bg-white rounded-xl border border-amber-300 font-black text-amber-950 text-sm outline-none focus:border-amber-600 shadow-2xs"
                    />
                  </div>
                  <p className="text-[11px] text-amber-900 font-medium">
                    {reviewInfantFareInput ? (
                      <>
                        Infant Total ({reviewingBooking.pax_infants} inf): <b>₹{(Number(reviewInfantFareInput) * reviewingBooking.pax_infants).toLocaleString('en-IN')}</b>.
                        {' '}Grand Total: <b>₹{((reviewStatus === 'FARE_REVISED' ? Number(revisedFareInput || reviewingBooking.quoted_rate) : Number(reviewingBooking.quoted_rate)) * ((Number(reviewingBooking.pax_adults) || Number(reviewingBooking.pax_count)) + Number(reviewingBooking.pax_children || 0)) + Number(reviewInfantFareInput) * reviewingBooking.pax_infants).toLocaleString('en-IN')}</b>
                      </>
                    ) : (
                      <>
                        Infant fee not included yet. Enter fee if confirmed with airline, or leave empty if to be settled later.
                      </>
                    )}
                  </p>
                </div>
              )}

              {/* Admin Notes & Quick Reply Chips */}
              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-900">
                  Admin Remarks / Note for Agent (Optional):
                </label>
                <input
                  type="text"
                  placeholder={
                    reviewStatus === 'AVAILABLE' 
                      ? 'e.g. Seats held on vendor desk. Send passports within 30 mins.' 
                      : reviewStatus === 'FARE_REVISED' 
                      ? 'e.g. Airline increased basic fare. Confirm if passenger agrees.'
                      : 'e.g. Sold out for today. Next available on 29-Sep @ same fare.'
                  }
                  value={adminNotesInput}
                  onChange={(e) => setAdminNotesInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 outline-none focus:border-blue-900 focus:bg-white transition"
                />

                {/* 1-Click Quick Note Chips */}
                <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Quick Notes:</span>
                  <button
                    type="button"
                    onClick={() => setAdminNotesInput('Seats held on desk. Send passport copies within 30 mins for issue.')}
                    className="text-[10px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md transition cursor-pointer"
                  >
                    ⚡ Held on Desk
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminNotesInput('Airline revised rate. Confirm if passenger accepts to proceed.')}
                    className="text-[10px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md transition cursor-pointer"
                  >
                    ⚠️ Rate Revision
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminNotesInput('Flight sold out for this date. Check next date on portal.')}
                    className="text-[10px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md transition cursor-pointer"
                  >
                    ❌ Sold Out
                  </button>
                </div>
              </div>

              {/* Success Alert & WhatsApp Send button */}
              {reviewSuccessBooking && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-2xl space-y-2 animate-in fade-in">
                  <div className="flex items-center space-x-2 text-emerald-900 text-xs font-black">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Review saved successfully: Status marked as {reviewSuccessBooking.status}!</span>
                  </div>
                  <a
                    href={getAgentReviewWhatsAppUrl(reviewSuccessBooking)}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-xs rounded-xl transition flex items-center justify-center space-x-2 shadow-sm"
                  >
                    <Send className="w-4 h-4" />
                    <span>Send WhatsApp Update to Agent with Live Tracking Link</span>
                  </a>
                </div>
              )}

              {/* Modal Action Buttons Footer */}
              <div className="pt-3 flex flex-col sm:flex-row items-center gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReviewingBooking(null)}
                  className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer text-xs"
                >
                  {reviewSuccessBooking ? 'Close' : 'Cancel'}
                </button>
                {!reviewSuccessBooking && (
                  <>
                    <button
                      type="button"
                      disabled={reviewSubmitting}
                      onClick={handleSubmitReview}
                      className="w-full sm:w-auto px-5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold rounded-xl transition cursor-pointer shadow-2xs flex items-center justify-center space-x-1.5 text-xs disabled:opacity-50"
                      title="Save review in database only without triggering WhatsApp"
                    >
                      {reviewSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 text-slate-600" />}
                      <span>Save Only</span>
                    </button>
                    <button
                      type="button"
                      disabled={reviewSubmitting}
                      onClick={handleSaveAndWhatsAppReview}
                      className="flex-1 w-full py-2.5 bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 active:scale-98 text-white font-black rounded-xl transition cursor-pointer shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-2 text-xs disabled:opacity-50"
                    >
                      {reviewSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4 text-white" />}
                      <span>🚀 Save & WhatsApp Agent (1-Click)</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 10. PASSPORTS VIEWER MODAL                                    */}
      {/* ───────────────────────────────────────────────────────────── */}
      {viewingPassportsBooking && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95">
            {/* Executive Operations Header */}
            <div className="bg-gradient-to-r from-[#0b3b82] via-[#0f4c9c] to-teal-900 text-white p-5 relative overflow-hidden">
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-teal-200 shadow-inner">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] uppercase font-black tracking-widest text-teal-300">
                        TravelX Operations Desk
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                    </div>
                    <h3 className="text-base sm:text-lg font-black leading-tight text-white">
                      Passenger Passports & Travel Documents
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingPassportsBooking(null)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
                  title="Close modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Booking Reference & Agency Pill */}
              <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs relative z-10">
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-black bg-white/15 px-2.5 py-0.5 rounded-md text-white border border-white/20">
                    #{viewingPassportsBooking.request_ref}
                  </span>
                  <span className="font-bold text-sky-100 truncate max-w-[200px] sm:max-w-xs">
                    {viewingPassportsBooking.agency_name}
                  </span>
                </div>
                {viewingPassportsBooking.agent_mobile && (
                  <span className="font-mono text-sky-200 text-[11px] font-bold">
                    📞 +{viewingPassportsBooking.agent_mobile}
                  </span>
                )}
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-4 max-h-[82vh] overflow-y-auto">
              {/* Boarding-Card Flight Summary */}
              <div className="bg-gradient-to-br from-slate-50 to-teal-50/40 border border-slate-200/90 rounded-2xl p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/80">
                  <span className="font-black text-slate-900 text-sm sm:text-base tracking-tight">
                    {viewingPassportsBooking.origin} ➔ {viewingPassportsBooking.destination}
                  </span>
                  <span className="px-2.5 py-1 bg-white rounded-lg border border-slate-200 font-extrabold text-[11px] text-blue-900 shadow-2xs">
                    {viewingPassportsBooking.airline_name || viewingPassportsBooking.airline_code} {viewingPassportsBooking.flight_number}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                      Travel Date
                    </span>
                    <span className="font-bold text-slate-900 block mt-0.5">
                      {viewingPassportsBooking.travel_date}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                      Passengers
                    </span>
                    <span className="font-bold text-slate-900 block mt-0.5">
                      {viewingPassportsBooking.pax_count} Pax
                    </span>
                    <span className="text-[10px] text-slate-600 font-medium block">
                      {formatPaxBreakdown(viewingPassportsBooking)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                      Total Rate
                    </span>
                    <span className="font-black text-[#0b3b82] text-sm block mt-0.5">
                      ₹{Number(viewingPassportsBooking.total_amount).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Passports List */}
              {(() => {
                let pList = [];
                try {
                  if (viewingPassportsBooking.passport_files) {
                    pList = JSON.parse(viewingPassportsBooking.passport_files);
                  }
                } catch (e) {}

                if (pList.length === 0) {
                  return (
                    <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                      <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="font-bold text-slate-700 text-xs">No passport files attached yet.</p>
                      <p className="text-[11px] text-slate-400">
                        When the agent submits passport copies from their tracking link, files will appear here automatically.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900">
                        Uploaded Passenger Documents ({pList.length} files):
                      </span>
                      <span className="text-[10px] font-black text-teal-800 bg-teal-100 px-2 py-0.5 rounded-full border border-teal-300">
                        Ready for Verification
                      </span>
                    </div>

                    <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                      {pList.map((p, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-2xl hover:border-teal-400 hover:shadow-xs transition"
                        >
                          <div className="flex items-center space-x-3 overflow-hidden">
                            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="truncate">
                              <p className="font-black text-slate-900 text-xs truncate" title={p.originalName}>
                                {p.originalName}
                              </p>
                              <p className="text-[10px] text-slate-500 font-medium">
                                {p.size ? `${(p.size / 1024).toFixed(1)} KB` : ''} • {p.uploadedAt ? new Date(p.uploadedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : 'Uploaded'}
                              </p>
                            </div>
                          </div>
                          <a
                            href={`/api/bookings/${viewingPassportsBooking.id}/passport-download/${p.filename}`}
                            download
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 bg-gradient-to-r from-teal-600 to-emerald-700 hover:from-teal-700 hover:to-emerald-800 text-white rounded-xl text-xs font-black flex items-center space-x-1.5 shrink-0 ml-2 shadow-xs active:scale-95 transition"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download</span>
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Action Buttons Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setViewingPassportsBooking(null)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const b = viewingPassportsBooking;
                    setViewingPassportsBooking(null);
                    handleOpenTicketModal(b);
                  }}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#0b3b82] to-blue-900 hover:from-blue-900 hover:to-blue-950 text-white font-black rounded-xl text-xs transition flex items-center space-x-2 shadow-md cursor-pointer active:scale-98"
                >
                  <Ticket className="w-4 h-4" />
                  <span>Proceed to Issue E-Ticket</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 11. E-TICKET UPLOAD & CONFIRM MODAL                          */}
      {/* ───────────────────────────────────────────────────────────── */}
      {ticketUploadBooking && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95">
            {/* Executive Operations Header */}
            <div className="bg-gradient-to-r from-[#0b3b82] via-[#0f4c9c] to-blue-950 text-white p-5 relative overflow-hidden">
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-sky-200 shadow-inner">
                    <Ticket className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] uppercase font-black tracking-widest text-sky-300">
                        E-Ticket Issuance & Dispatch
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                    <h3 className="text-base sm:text-lg font-black leading-tight text-white">
                      Upload & Issue Official Airline E-Ticket
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTicketUploadBooking(null)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
                  title="Close modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Booking Reference & Agency Pill */}
              <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs relative z-10">
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-black bg-white/15 px-2.5 py-0.5 rounded-md text-white border border-white/20">
                    #{ticketUploadBooking.request_ref}
                  </span>
                  <span className="font-bold text-sky-100 truncate max-w-[200px] sm:max-w-xs">
                    {ticketUploadBooking.agency_name}
                  </span>
                </div>
                {ticketUploadBooking.agent_mobile && (
                  <span className="font-mono text-sky-200 text-[11px] font-bold">
                    📞 +{ticketUploadBooking.agent_mobile}
                  </span>
                )}
              </div>
            </div>

            <form onSubmit={handleSubmitTicket} className="p-5 sm:p-6 space-y-4 max-h-[82vh] overflow-y-auto">
              {/* Boarding-Card Flight Summary */}
              <div className="bg-gradient-to-br from-slate-50 to-blue-50/40 border border-slate-200/90 rounded-2xl p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/80">
                  <span className="font-black text-slate-900 text-sm sm:text-base tracking-tight">
                    {ticketUploadBooking.origin} ➔ {ticketUploadBooking.destination}
                  </span>
                  <span className="px-2.5 py-1 bg-white rounded-lg border border-slate-200 font-extrabold text-[11px] text-blue-900 shadow-2xs">
                    {ticketUploadBooking.airline_name || ticketUploadBooking.airline_code} {ticketUploadBooking.flight_number}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                      Travel Date
                    </span>
                    <span className="font-bold text-slate-900 block mt-0.5">
                      {ticketUploadBooking.travel_date}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                      Passengers
                    </span>
                    <span className="font-bold text-slate-900 block mt-0.5">
                      {ticketUploadBooking.pax_count} Pax
                    </span>
                    <span className="text-[10px] text-slate-600 font-medium block">
                      {formatPaxBreakdown(ticketUploadBooking)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                      Total Rate
                    </span>
                    <span className="font-black text-[#0b3b82] text-sm block mt-0.5">
                      ₹{Number(ticketUploadBooking.total_amount).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              {/* PNR Code Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-900">
                  Airline PNR / Ticket Number:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. IX-98124 or 6E-KL9X2"
                    value={ticketPnrInput}
                    onChange={(e) => setTicketPnrInput(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 uppercase rounded-xl border border-slate-300 font-mono font-black text-slate-900 text-sm outline-none focus:border-blue-900 focus:bg-white shadow-2xs tracking-wider"
                  />
                  <span className="absolute right-3.5 top-3 text-[10px] font-mono font-bold text-slate-400 uppercase">
                    PNR
                  </span>
                </div>
              </div>

              {/* Ticket PDF File Picker */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-900">
                  Attach Official E-Ticket Document (PDF or Image):
                </label>
                <div className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition ${
                  ticketFileInput 
                    ? 'border-emerald-400 bg-emerald-50/40' 
                    : 'border-slate-300 hover:border-blue-500 bg-slate-50/50'
                }`}>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    required
                    id="ticket-file-input"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setTicketFileInput(e.target.files[0]);
                      }
                    }}
                  />
                  <label htmlFor="ticket-file-input" className="cursor-pointer space-y-2 block">
                    {ticketFileInput ? (
                      <div className="space-y-1">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <p className="text-xs font-black text-emerald-900">{ticketFileInput.name}</p>
                        <p className="text-[10px] text-emerald-700 font-semibold">
                          {(ticketFileInput.size / 1024).toFixed(1)} KB • Click to select a different file
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#0b3b82] flex items-center justify-center mx-auto">
                          <Upload className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-black text-slate-800">Click or Drag & Drop E-Ticket PDF</p>
                        <p className="text-[10px] text-slate-400 font-medium">Supports PDF, JPG, PNG up to 25MB</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* Helper Note */}
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                ℹ️ Once uploaded, this booking will automatically switch to <b>CONFIRMED</b>. The agent will receive instant access to download the e-ticket on their live tracking link!
              </p>

              {/* Actions */}
              <div className="pt-2 flex items-center space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTicketUploadBooking(null)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={ticketSubmitting || !ticketFileInput}
                  className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 disabled:opacity-50 text-white font-black rounded-xl transition shadow-md flex items-center justify-center space-x-2 text-xs cursor-pointer active:scale-98"
                >
                  {ticketSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Upload E-Ticket & Mark Confirmed</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 12. ADMIN REAL-TIME EVENT POPUP MODAL                         */}
      {/* ───────────────────────────────────────────────────────────── */}
      {adminEventModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full border-2 border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95">
            {/* Modal Header */}
            <div className={`p-5 text-white flex items-center justify-between ${
              adminEventModal.type === 'DOCS_SUBMITTED'
                ? 'bg-gradient-to-r from-teal-700 to-emerald-800'
                : adminEventModal.type === 'CONFIRMED'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-700'
                : 'bg-gradient-to-r from-[#0b3b82] to-blue-900'
            }`}>
              <div className="flex items-center space-x-3">
                <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center text-white shrink-0 shadow-inner">
                  {adminEventModal.type === 'DOCS_SUBMITTED' ? (
                    <FileText className="w-6 h-6 text-teal-200 animate-bounce" />
                  ) : adminEventModal.type === 'CONFIRMED' ? (
                    <Ticket className="w-6 h-6 text-emerald-200" />
                  ) : (
                    <Clock className="w-6 h-6 text-amber-200 animate-pulse" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-black leading-tight">
                    {adminEventModal.title}
                  </h3>
                  <span className="text-[11px] text-white/80 font-mono">
                    Ref: #{adminEventModal.booking.request_ref} • {adminEventModal.booking.agency_name}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAdminEventModal(null)}
                className="text-white/70 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                {adminEventModal.subtitle}
              </p>

              {/* Booking Summary Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-2">
                <div className="flex justify-between pb-1.5 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Sector & Date:</span>
                  <span className="font-bold text-slate-900">
                    {adminEventModal.booking.origin} ➔ {adminEventModal.booking.destination} • {adminEventModal.booking.travel_date}
                  </span>
                </div>
                <div className="flex justify-between pb-1.5 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Flight & Pax:</span>
                  <span className="font-bold text-slate-900">
                    {adminEventModal.booking.airline_name || adminEventModal.booking.airline_code} ({adminEventModal.booking.flight_number}) • {formatPaxBreakdown(adminEventModal.booking)}
                  </span>
                </div>
                <div className="flex justify-between pb-1.5 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Agent Contact:</span>
                  <span className="font-bold text-blue-900 font-mono">
                    {adminEventModal.booking.agent_mobile} ({adminEventModal.booking.agency_name})
                  </span>
                </div>
                <div className="flex justify-between pt-0.5">
                  <span className="text-slate-700 font-black">Net Amount:</span>
                  <span className="font-black text-sm text-[#0b3b82]">
                    ₹{Number(adminEventModal.booking.total_amount).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Passports Count Indicator if DOCS_SUBMITTED */}
              {adminEventModal.type === 'DOCS_SUBMITTED' && (
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2 text-teal-950 font-bold">
                    <FileText className="w-4 h-4 text-teal-600" />
                    <span>Passenger Passports Attached</span>
                  </div>
                  <span className="px-2 py-0.5 bg-teal-200/70 text-teal-900 rounded-md font-extrabold text-[11px]">
                    Ready to Verify
                  </span>
                </div>
              )}

              {/* Quick Actions Footer */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAdminEventModal(null)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Dismiss
                </button>

                {adminEventModal.type === 'DOCS_SUBMITTED' && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const b = adminEventModal.booking;
                        setAdminEventModal(null);
                        setViewingPassportsBooking(b);
                      }}
                      className="w-full sm:w-auto px-4 py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 font-bold rounded-xl text-xs transition flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Passports</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const b = adminEventModal.booking;
                        setAdminEventModal(null);
                        handleOpenTicketModal(b);
                      }}
                      className="flex-1 w-full py-2.5 bg-gradient-to-r from-[#0b3b82] to-blue-900 hover:from-blue-900 hover:to-blue-950 text-white font-bold rounded-xl text-xs transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-md"
                    >
                      <Ticket className="w-3.5 h-3.5" />
                      <span>Issue & Upload E-Ticket Now</span>
                    </button>
                  </>
                )}

                {adminEventModal.type === 'CONFIRMED' && (
                  <a
                    href={getAgentTicketWhatsAppUrl(adminEventModal.booking)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setAdminEventModal(null)}
                    className="flex-1 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send E-Ticket to Agent on WhatsApp</span>
                  </a>
                )}

                {adminEventModal.type === 'NEW_BOOKING' && (
                  <button
                    type="button"
                    onClick={() => {
                      const b = adminEventModal.booking;
                      setAdminEventModal(null);
                      handleOpenReviewModal(b);
                    }}
                    className="flex-1 w-full py-2.5 bg-blue-900 hover:bg-blue-950 text-white font-bold rounded-xl text-xs transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-md"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Review & Confirm Available</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
