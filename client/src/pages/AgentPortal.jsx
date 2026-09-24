import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plane, Search, MessageSquare, Copy, Check, Filter, 
  Clock, ShieldAlert, Sparkles, Phone, ArrowRight, 
  ExternalLink, SlidersHorizontal, Eye, EyeOff, Plus, Minus,
  Calendar, Layers, CheckCircle2, CheckCircle, RefreshCw, Smartphone,
  Lock, ArrowUpDown, ChevronLeft, ChevronRight, X, User,
  Menu, Share2, Mail, Users, CheckSquare,
  AlertCircle, Briefcase, Coffee, Info, ChevronDown, Loader2, Building2, MapPin,
  Download, Upload, FileText, Ticket, Bell, XCircle, LogOut, KeyRound,
  Image as ImageIcon, Camera, Trash2
} from 'lucide-react';
import { api } from '../utils/api';

function resizeImageToDataUrl(file, maxWidth = 360, maxHeight = 160) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    if (!file.type || !file.type.startsWith('image/')) {
      return reject(new Error('Kripya image file (PNG, JPG, WebP) select karein'));
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png', 0.9));
      };
      img.onerror = () => reject(new Error('Image process nahi ho saki'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('File read nahi ho saki'));
    reader.readAsDataURL(file);
  });
}

const INDIAN_STATES = [
  'Punjab', 'Delhi NCR', 'Haryana', 'Chandigarh UT', 'Rajasthan', 
  'Uttar Pradesh', 'Himachal Pradesh', 'Jammu & Kashmir', 'Uttarakhand', 
  'Maharashtra', 'Gujarat', 'West Bengal', 'Karnataka', 'Telangana', 
  'Tamil Nadu', 'Kerala', 'Bihar', 'Madhya Pradesh', 'Other'
];

const ALLOWED_B2B_SECTOR_KEYS = ['ATQ-DXB', 'ATQ-SHJ', 'IXC-AUH'];

const DEFAULT_SECTOR_OPTIONS = [
  { origin: 'ATQ', originCity: 'Amritsar', dest: 'DXB', destCity: 'Dubai', label: '(ATQ) Amritsar ➔ (DXB) Dubai' },
  { origin: 'ATQ', originCity: 'Amritsar', dest: 'SHJ', destCity: 'Sharjah', label: '(ATQ) Amritsar ➔ (SHJ) Sharjah' },
  { origin: 'IXC', originCity: 'Chandigarh', dest: 'AUH', destCity: 'Abu Dhabi', label: '(IXC) Chandigarh ➔ (AUH) Abu Dhabi' }
];

const DEFAULT_ORIGINS = [
  { code: 'ATQ', city: 'Amritsar', label: '(ATQ) Amritsar' },
  { code: 'IXC', city: 'Chandigarh', label: '(IXC) Chandigarh' }
];

const DEFAULT_DESTINATIONS = {
  'ATQ': [
    { code: 'DXB', city: 'Dubai', label: '(DXB) Dubai' },
    { code: 'SHJ', city: 'Sharjah', label: '(SHJ) Sharjah' }
  ],
  'IXC': [
    { code: 'AUH', city: 'Abu Dhabi', label: '(AUH) Abu Dhabi' }
  ]
};

const formatBaggage = (bag) => {
  if (!bag) return '30+7 KG';
  const clean = String(bag).trim();
  const lower = clean.toLowerCase();
  if (lower === '20kg' || lower === '20 kg' || lower === '20') return '30+7 KG';
  if (lower === '30kg' || lower === '30 kg' || lower === '30') return '30+7 KG';
  if (lower === '30 + 07 kg' || lower === '30 + 7 kg' || lower === '30+07 kg' || lower === '30+07kg' || lower === '30+7kg') return '30+7 KG';
  return clean;
};

export default function AgentPortal({ onSwitchToAdmin, onSwitchToStaff, isStaffEmbedded = false }) {
  const isAllowedB2BSector = (f) => {
    if (!f) return false;
    const s = f.sector_code || `${f.origin}-${f.destination}`;
    return ALLOWED_B2B_SECTOR_KEYS.includes(s);
  };

  // Master API Data - strictly filtered to the 3 allowed B2B sectors (ATQ-DXB, ATQ-SHJ, IXC-AUH)
  const [fares, setFares] = useState(() => {
    try {
      const cached = localStorage.getItem('travelx_cached_fares');
      const list = cached ? JSON.parse(cached) : [];
      return Array.isArray(list) ? list.filter(isAllowedB2BSector) : [];
    } catch (_) {
      return [];
    }
  });
  const [dailyFlights, setDailyFlights] = useState(() => {
    try {
      const cached = localStorage.getItem('travelx_cached_daily');
      const list = cached ? JSON.parse(cached) : [];
      return Array.isArray(list) ? list.filter(isAllowedB2BSector) : [];
    } catch (_) {
      return [];
    }
  });
  const [agencyConfig, setAgencyConfig] = useState({
    name: 'TravelX',
    subName: 'B2B Special Fares',
    agentCode: 'TRAVELX (TX10011)',
    agentBadge: 'TX B2B',
    tagline: 'Comfort • Trust • Journey.',
    balance: '100000(0)',
    whatsapp: '918146526257',
    phone: '+91 81465 26257',
    email: 'desk@travelx.co.in'
  });
  const [loading, setLoading] = useState(() => {
    try {
      const cached = localStorage.getItem('travelx_cached_daily');
      return !cached || JSON.parse(cached).length === 0;
    } catch (_) {
      return true;
    }
  });
  const [error, setError] = useState(null);

  const agencyWhatsAppDigits = useMemo(
    () => String(agencyConfig.whatsapp || '').replace(/\D/g, ''),
    [agencyConfig.whatsapp]
  );
  const hasAgencyWhatsApp = agencyWhatsAppDigits.length >= 10;

  const openAgencyWhatsApp = (message) => {
    if (!hasAgencyWhatsApp) {
      alert('TravelX WhatsApp desk number is not configured yet. Please call or email the desk.');
      return;
    }
    window.open(`https://wa.me/${agencyWhatsAppDigits}?text=${encodeURIComponent(message)}`, '_blank');
  };

  // Search Bar State (Image 1 & 2)
  const [tripType, setTripType] = useState('ONE_WAY'); // 'ONE_WAY' | 'ROUND_TRIP'
  const [origin, setOrigin] = useState('ATQ');
  const [destination, setDestination] = useState('DXB');
  const [onwardDate, setOnwardDate] = useState('2026-09-25');
  const [returnDate, setReturnDate] = useState('');
  const [travellers, setTravellers] = useState(1);
  const [searchAdults, setSearchAdults] = useState(1);
  const [searchChildren, setSearchChildren] = useState(0);
  const [searchInfants, setSearchInfants] = useState(0);
  const [travelClass, setTravelClass] = useState('Economy');
  const [hasSearched, setHasSearched] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  // Dropdown open states
  const [showOriginDropdown, setShowOriginDropdown] = useState(false);
  const [showDestDropdown, setShowDestDropdown] = useState(false);
  const [showTravellerDropdown, setShowTravellerDropdown] = useState(false);
  const travellerDropdownRef = useRef(null);
  const dateInputRef = useRef(null);

  // Filters State (Image 3 Left Sidebar)
  const [filterRefundable, setFilterRefundable] = useState('ALL'); // 'ALL' | 'REFUNDABLE' | 'NON_REFUNDABLE'
  const [filterStops, setFilterStops] = useState('ALL'); // 'ALL' | '0' | '1' | '2+'
  const [filterTimeSlot, setFilterTimeSlot] = useState('ALL'); // 'ALL' | '00-06' | '06-12' | '12-18' | '18-00'
  const [selectedAirlines, setSelectedAirlines] = useState([]);
  const [showIncentive, setShowIncentive] = useState(false);

  // Flight Details Modal Drawer
  const [detailFlight, setDetailFlight] = useState(null);

  // Live Maintenance & System Update States (100% Privacy Protection)
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState('');
  const [isServerSyncing, setIsServerSyncing] = useState(false);
  const [syncCountdown, setSyncCountdown] = useState(5);

  // Copy status
  const [copySuccess, setCopySuccess] = useState(false);

  // Agent Identification Session (stored in localStorage or URL query params)
  const [agentProfile, setAgentProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('travelx_b2b_agent');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlMobile = params.get('mobile') || params.get('phone');
      const urlAgency = params.get('agent') || params.get('agency');
      const urlCity = params.get('city');
      if (urlMobile || urlAgency) {
        const p = {
          mobile: (urlMobile || '').replace(/\D/g, '').slice(-10),
          agencyName: urlAgency || '',
          agentName: '',
          city: urlCity || ''
        };
        try {
          localStorage.setItem('travelx_b2b_agent', JSON.stringify(p));
        } catch (e) {}
        return p;
      }
    }
    return null;
  });

  // Booking Modal States
  const [bookingFlight, setBookingFlight] = useState(null);
  const [bookingPax, setBookingPax] = useState(1);
  const [bookingAdults, setBookingAdults] = useState(1);
  const [bookingChildren, setBookingChildren] = useState(0);
  const [bookingInfants, setBookingInfants] = useState(0);
  const [bookingForm, setBookingForm] = useState({
    mobile: '',
    agencyName: '',
    agentName: '',
    email: '',
    address: '',
    city: '',
    state: 'Punjab',
    pincode: '',
    remarks: ''
  });
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [bookingSuccessResult, setBookingSuccessResult] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);

  // B2B Gateway Auth States (Login & Register)
  const [authTab, setAuthTab] = useState('login'); // 'login' | 'register'
  const [loginForm, setLoginForm] = useState({ mobile: '', pin: '', showPassword: false });
  const [regForm, setRegForm] = useState({
    agentName: '',
    agencyName: '',
    mobile: '',
    email: '',
    address: '',
    city: '',
    state: 'Punjab',
    pincode: '',
    pin: '',
    confirmPin: '',
    logo_data: null,
    showPassword: false
  });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [profileLogoData, setProfileLogoData] = useState(null);
  const [profilePassword, setProfilePassword] = useState('');

  // Live Booking Tracker Modal States
  const [showTrackerModal, setShowTrackerModal] = useState(false);
  const [trackInputRef, setTrackInputRef] = useState('');
  const [trackedBooking, setTrackedBooking] = useState(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackError, setTrackError] = useState(null);
  const [selectedPassportFiles, setSelectedPassportFiles] = useState([]);
  const [passportUploading, setPassportUploading] = useState(false);
  const [passportUploadSuccess, setPassportUploadSuccess] = useState(false);
  const [acceptedFares, setAcceptedFares] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('travelx_accepted_fares') || '{}');
    } catch (_) {
      return {};
    }
  });
  const [fareResponding, setFareResponding] = useState(false);

  // Active Booking Reference for Background Response Polling & "Updates" Navbar Tab
  const [activeBookingRef, setActiveBookingRef] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('travelx_active_request_ref') || null;
      } catch (e) {}
    }
    return null;
  });
  const [activeBookingData, setActiveBookingData] = useState(null);
  const lastPolledStatusRef = useRef(null);

  // Calendar Carousel Scroll Ref
  const calendarScrollRef = useRef(null);

  // 1. Fetch live data with resilient fallback and persistent caching
  const loadPortalData = async (isRetry = false, retryAttempt = 0) => {
    try {
      // Only set loading true if we don't already have flight data displayed
      setDailyFlights(current => {
        if (!current || current.length === 0) {
          setLoading(true);
        }
        return current;
      });

      const res = await api.getPublicFares();
      if (res && res.maintenance) {
        setIsMaintenance(true);
        setIsServerSyncing(false);
        setMaintenanceMsg(res.message || "TravelX Special Fare Engine is currently synchronizing live flight allocations.");
        if (res.agency) {
          setAgencyConfig(prev => ({ 
            ...prev, 
            ...res.agency,
            whatsapp: res.agency.whatsapp || prev.whatsapp,
            phone: res.agency.contact || res.agency.phone || prev.phone,
            email: res.agency.email || prev.email,
            name: 'TravelX'
          }));
        }
        setLoading(false);
        setTimeout(() => loadPortalData(false), 5000);
        return;
      }
      setIsMaintenance(false);

      if (res && res.success) {
        setIsServerSyncing(false);
        setError(null);
        setLoading(false);
        if (Array.isArray(res.fares)) {
          const cleanFares = res.fares.filter(isAllowedB2BSector);
          setFares(cleanFares);
          try {
            if (cleanFares.length > 0) {
              localStorage.setItem('travelx_cached_fares', JSON.stringify(cleanFares));
            } else {
              localStorage.removeItem('travelx_cached_fares');
            }
          } catch (_) {}
        }
        if (Array.isArray(res.dailyFlights)) {
          const cleanDaily = res.dailyFlights.filter(isAllowedB2BSector);
          setDailyFlights(cleanDaily);
          try {
            if (cleanDaily.length > 0) {
              localStorage.setItem('travelx_cached_daily', JSON.stringify(cleanDaily));
            } else {
              localStorage.removeItem('travelx_cached_daily');
            }
          } catch (_) {}
        }
        if (res.agency) {
          setAgencyConfig(prev => ({ 
            ...prev, 
            ...res.agency,
            whatsapp: res.agency.whatsapp || prev.whatsapp,
            phone: res.agency.contact || res.agency.phone || prev.phone,
            email: res.agency.email || prev.email,
            name: 'TravelX',
            agentCode: 'TRAVELX (TX10011)',
            agentBadge: 'TX B2B'
          }));
        }
      } else {
        // If rates are already loaded on the screen, preserve them! Never show disconnect.
        const hasExisting = (dailyFlights && dailyFlights.length > 0) || (() => {
          try {
            const c = localStorage.getItem('travelx_cached_daily');
            return c && JSON.parse(c).length > 0;
          } catch (_) { return false; }
        })();

        if (!hasExisting) {
          setIsServerSyncing(true);
          setTimeout(() => loadPortalData(true), 3500);
        } else {
          console.warn('Transient server response; keeping existing live rates.');
        }
      }
    } catch (err) {
      console.error('Error fetching public fares:', err);
      const hasExisting = (dailyFlights && dailyFlights.length > 0) || (() => {
        try {
          const c = localStorage.getItem('travelx_cached_daily');
          return c && JSON.parse(c).length > 0;
        } catch (_) { return false; }
      })();

      if (!hasExisting) {
        setIsServerSyncing(true);
        setTimeout(() => loadPortalData(true), 3500);
      } else {
        console.warn('Network issue; keeping existing live rates active.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = async (e) => {
    if (e) e.preventDefault();
    setHasSearched(true);
    setIsSearching(true);
    try {
      if (dailyFlights.length === 0) {
        await loadPortalData(true);
      }
      if (onwardDate) {
        centerSelectedDate(onwardDate);
      }
    } catch (err) {
      console.error('Search submit error:', err);
    } finally {
      setTimeout(() => setIsSearching(false), 400);
    }
  };

  const handleFetchTracking = async (targetRef) => {
    const cleanRef = String(targetRef || trackInputRef || '').trim().toUpperCase();
    if (!cleanRef) return;
    try {
      setTrackLoading(true);
      setTrackError(null);
      setShowTrackerModal(true);
      const res = await api.trackBooking(cleanRef);
      if (res && res.success && res.booking) {
        setTrackedBooking(res.booking);
        setTrackInputRef(res.booking.request_ref);
        setActiveBookingRef(res.booking.request_ref);
        setActiveBookingData(res.booking);
        lastPolledStatusRef.current = res.booking.status;
        try {
          localStorage.setItem('travelx_active_request_ref', res.booking.request_ref);
        } catch (e) {}
      } else {
        setTrackError(res?.error || 'Booking reference not found. Please verify your reference ID.');
        setTrackedBooking(null);
      }
    } catch (err) {
      console.error('Error tracking booking:', err);
      setTrackError('Failed to load tracking details. Please try again.');
      setTrackedBooking(null);
    } finally {
      setTrackLoading(false);
    }
  };

  const isFareAccepted = useMemo(() => {
    if (!trackedBooking) return false;
    if (acceptedFares[trackedBooking.request_ref]) return true;
    if (trackedBooking.status === 'FARE_ACCEPTED') return true;
    if (trackedBooking.admin_notes && trackedBooking.admin_notes.includes('Agent Accepted Revised Fare')) return true;
    return false;
  }, [trackedBooking, acceptedFares]);

  const handleAcceptRevisedFare = async () => {
    if (!trackedBooking) return;
    try {
      setFareResponding(true);
      const res = await api.respondToRevisedFare(trackedBooking.request_ref, 'ACCEPT');
      if (res && res.success) {
        const next = { ...acceptedFares, [trackedBooking.request_ref]: true };
        setAcceptedFares(next);
        try {
          localStorage.setItem('travelx_accepted_fares', JSON.stringify(next));
        } catch (_) {}
        if (res.booking) {
          setTrackedBooking(res.booking);
          setActiveBookingData(res.booking);
        }
        await handleFetchTracking(trackedBooking.request_ref);
      } else {
        alert(res?.error || 'Failed to accept revised fare');
      }
    } catch (err) {
      console.error('Error accepting fare:', err);
      alert('Connection error');
    } finally {
      setFareResponding(false);
    }
  };

  const handleDeclineAndNewSearch = async () => {
    if (!trackedBooking) return;
    const confirmCancel = window.confirm(
      'Are you sure you want to decline this revised fare? The booking request will be cancelled and you will be returned to search alternate flights.'
    );
    if (!confirmCancel) return;

    const o = trackedBooking.origin || origin;
    const d = trackedBooking.destination || destination;
    const dt = trackedBooking.travel_date || onwardDate;

    try {
      setFareResponding(true);
      await api.respondToRevisedFare(trackedBooking.request_ref, 'DECLINE');
    } catch (err) {
      console.error('Error declining fare:', err);
    } finally {
      setFareResponding(false);
      setShowTrackerModal(false);
      setTrackedBooking(null);
      lastPolledStatusRef.current = 'FARE_DECLINED';
      setActiveBookingRef(null);
      setActiveBookingData(null);
      try {
        localStorage.removeItem('travelx_active_request_ref');
      } catch (_) {}
      if (o) setOrigin(o);
      if (d) setDestination(d);
      if (dt) setOnwardDate(dt);
      setHasSearched(true);
      if (dailyFlights.length === 0) {
        loadPortalData(true);
      }
      setTimeout(() => centerSelectedDate(dt), 150);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleAutoUploadPassports = async (files) => {
    if (!trackedBooking) return;
    const fileList = Array.from(files || []);
    if (fileList.length === 0) return;

    try {
      setPassportUploading(true);
      const formData = new FormData();
      for (let i = 0; i < fileList.length; i++) {
        formData.append('passports', fileList[i]);
      }
      const res = await api.uploadPassports(trackedBooking.request_ref, formData);
      if (res && res.success) {
        setPassportUploadSuccess(true);
        setSelectedPassportFiles([]);
        await handleFetchTracking(trackedBooking.request_ref);
        setTimeout(() => setPassportUploadSuccess(false), 6000);
      } else {
        alert(res?.error || 'Failed to upload passports');
      }
    } catch (err) {
      console.error('Error uploading passports:', err);
      alert('Connection error uploading passports');
    } finally {
      setPassportUploading(false);
      const fileInput = document.getElementById('agent-passport-input');
      if (fileInput) fileInput.value = '';
    }
  };

  const playNotificationSound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) {
      // Audio might be prevented by browser policy before first gesture
    }
  };

  // Sync latest Agent Profile (with logo, firm name, etc.) from server
  useEffect(() => {
    if (agentProfile?.mobile) {
      api.getCurrentAgent(agentProfile.mobile).then(res => {
        if (res && res.success && res.agent) {
          setAgentProfile(prev => ({ ...(prev || {}), ...res.agent }));
          try {
            localStorage.setItem('travelx_b2b_agent', JSON.stringify({ ...(agentProfile || {}), ...res.agent }));
          } catch (_) {}
        }
      }).catch(() => {});
    }
  }, [agentProfile?.mobile]);

  // Live Auto-Refresh Polling for Tracked Booking (every 4.5s)
  useEffect(() => {
    if (!showTrackerModal || !trackedBooking?.request_ref) return;
    if (['CONFIRMED', 'CANCELLED', 'SOLD_OUT'].includes(trackedBooking.status)) return;

    const currentRef = trackedBooking.request_ref;
    const interval = setInterval(async () => {
      try {
        const res = await api.trackBooking(currentRef);
        if (res && res.success && res.booking) {
          setTrackedBooking(prev => {
            if (!prev) return res.booking;
            if (prev.status !== res.booking.status) {
              playNotificationSound();
            }
            return res.booking;
          });
        }
      } catch (err) {
        // silent fail on network jitter
      }
    }, 4500);

    return () => clearInterval(interval);
  }, [showTrackerModal, trackedBooking?.request_ref, trackedBooking?.status]);

  // Live Auto-Refresh Polling when Agent is on Booking Success / Dispatched screen (every 3.5s)
  useEffect(() => {
    if (!bookingSuccessResult?.booking?.request_ref) return;
    const currentRef = bookingSuccessResult.booking.request_ref;
    if (['CONFIRMED', 'CANCELLED', 'SOLD_OUT'].includes(bookingSuccessResult.booking.status)) return;

    const interval = setInterval(async () => {
      try {
        const res = await api.trackBooking(currentRef);
        if (res && res.success && res.booking) {
          setBookingSuccessResult(prev => {
            if (!prev) return null;
            if (prev.booking?.status !== res.booking.status) {
              playNotificationSound();
            }
            return {
              ...prev,
              booking: {
                ...prev.booking,
                ...res.booking
              }
            };
          });
        }
      } catch (err) {
        // silent fail on network jitter
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [bookingSuccessResult?.booking?.request_ref, bookingSuccessResult?.booking?.status]);

  // Background Monitor for Active Booking:
  // When agent is browsing the main screen, poll active booking every 3.5s.
  // When Admin updates status (e.g. from PENDING to AVAILABLE / FARE_REVISED / SOLD_OUT / CONFIRMED):
  // 1. Play audio chime
  // 2. Automatically open the Tracker / Passport Upload popup modal!
  useEffect(() => {
    if (!activeBookingRef) return;

    if (!activeBookingData) {
      api.trackBooking(activeBookingRef).then(res => {
        if (res && res.success && res.booking) {
          setActiveBookingData(res.booking);
          lastPolledStatusRef.current = res.booking.status;
        }
      }).catch(() => {});
    }

    const interval = setInterval(async () => {
      try {
        const res = await api.trackBooking(activeBookingRef);
        if (res && res.success && res.booking) {
          const newStatus = res.booking.status;
          const oldStatus = lastPolledStatusRef.current;

          // If status changed from PENDING to a response state (AVAILABLE, FARE_REVISED, SOLD_OUT, etc.)
          if (oldStatus && oldStatus !== newStatus) {
            playNotificationSound();
            // Automatically launch the popup modal on agent's screen!
            setTrackedBooking(res.booking);
            setTrackInputRef(res.booking.request_ref);
            setShowTrackerModal(true);
          }

          lastPolledStatusRef.current = newStatus;
          setActiveBookingData(res.booking);
        }
      } catch (err) {
        // silent fail on network jitter
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [activeBookingRef]);

  useEffect(() => {
    loadPortalData();
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const t = params.get('track');
      if (t) {
        setTrackInputRef(t.trim().toUpperCase());
        handleFetchTracking(t.trim().toUpperCase());
      }
    }

    // Background silent refresh for live rates every 2.5 minutes so rates stay freshly synced
    const rateInterval = setInterval(() => {
      loadPortalData(false, 0);
    }, 150000);

    return () => clearInterval(rateInterval);
  }, []);

  // Close traveller dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (travellerDropdownRef.current && !travellerDropdownRef.current.contains(e.target)) {
        setShowTravellerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Helper: Display price
  const getDisplayPrice = (basePrice) => {
    return Number(basePrice) || 0;
  };

  // Helper: Cycle through allowed B2B sectors (ATQ-DXB -> ATQ-SHJ -> IXC-AUH)
  const handleSwapAirports = () => {
    const key = `${origin}-${destination}`;
    if (key === 'ATQ-DXB') {
      setOrigin('ATQ');
      setDestination('SHJ');
    } else if (key === 'ATQ-SHJ') {
      setOrigin('IXC');
      setDestination('AUH');
    } else {
      setOrigin('ATQ');
      setDestination('DXB');
    }
  };

  // Strictly allowed sector options: ATQ-DXB, ATQ-SHJ, IXC-AUH
  const availableSectorOptions = useMemo(() => {
    return DEFAULT_SECTOR_OPTIONS;
  }, []);

  // Derived Origins: strictly ATQ and IXC
  const derivedOrigins = useMemo(() => {
    return DEFAULT_ORIGINS;
  }, []);

  // Derived Destinations by Origin: strictly DXB/SHJ for ATQ, and AUH for IXC
  const derivedDestinations = useMemo(() => {
    return DEFAULT_DESTINATIONS;
  }, []);

  // Guarantee selected origin & destination are always one of the 3 allowed B2B sectors
  useEffect(() => {
    const key = `${origin}-${destination}`;
    if (!ALLOWED_B2B_SECTOR_KEYS.includes(key)) {
      setOrigin('ATQ');
      setDestination('DXB');
    }
  }, [origin, destination]);

  // 2. Derive unique available dates for current sector (ATQ-DXB, etc.)
  const currentSectorKey = `${origin}-${destination}`;

  const availableDatesList = useMemo(() => {
    const flightsForSector = dailyFlights.filter(f => f.sector_code === currentSectorKey);
    const dateMap = new Map();

    flightsForSector.forEach(f => {
      const dStr = f.travel_date;
      if (!dateMap.has(dStr)) {
        dateMap.set(dStr, {
          date: dStr,
          dayName: f.day_name,
          label: f.day_label,
          minFare: f.final_rate
        });
      } else {
        const cur = dateMap.get(dStr);
        if (f.final_rate < cur.minFare) {
          cur.minFare = f.final_rate;
        }
      }
    });

    const list = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    return list;
  }, [dailyFlights, currentSectorKey]);

  // Nearest available date for the sector (used when selected date has no flights)
  const nearestAvailableDate = useMemo(() => {
    if (!availableDatesList.length) return null;
    const todayStr = new Date().toISOString().slice(0, 10);
    const target = onwardDate || todayStr;
    const exact = availableDatesList.find(d => d.date === target);
    if (exact) return exact;
    const next = availableDatesList.find(d => d.date > target);
    return next || availableDatesList[0];
  }, [availableDatesList, onwardDate]);

  // Auto-select nearest available date if current date is not in sector dates
  useEffect(() => {
    if (availableDatesList.length > 0) {
      const exists = availableDatesList.some(d => d.date === onwardDate);
      if (!exists) {
        const todayStr = new Date().toISOString().slice(0, 10);
        const futureDate = availableDatesList.find(d => d.date >= (onwardDate || todayStr));
        setOnwardDate(futureDate ? futureDate.date : availableDatesList[0].date);
      }
    }
  }, [availableDatesList, currentSectorKey]);

  // 3. Scroll Calendar Strip & Auto-center selected date in the middle
  const scrollCalendar = (direction) => {
    if (calendarScrollRef.current) {
      const scrollAmount = direction === 'left' ? -260 : 260;
      calendarScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const centerSelectedDate = (targetDate) => {
    const d = targetDate || onwardDate;
    if (!calendarScrollRef.current || !d) return;
    const container = calendarScrollRef.current;
    const btn = container.querySelector(`[data-date="${d}"]`);
    if (btn) {
      const containerWidth = container.clientWidth;
      const btnLeft = btn.offsetLeft;
      const btnWidth = btn.clientWidth;
      const scrollLeft = btnLeft - (containerWidth / 2) + (btnWidth / 2);
      container.scrollTo({
        left: Math.max(0, scrollLeft),
        behavior: 'smooth'
      });
    }
  };

  // Automatically scroll selected date to the middle whenever onwardDate or availableDatesList changes
  useEffect(() => {
    const timer = setTimeout(() => {
      centerSelectedDate(onwardDate);
    }, 100);
    return () => clearTimeout(timer);
  }, [onwardDate, availableDatesList]);

  // 4. Filtered Flights matching current search & sidebar filters
  const displayedFlights = useMemo(() => {
    return dailyFlights.filter(f => {
      // Sector filter
      if (f.sector_code !== currentSectorKey) return false;

      // Date filter
      if (f.travel_date !== onwardDate) return false;

      // Refundable filter
      if (filterRefundable === 'REFUNDABLE' && f.is_refundable !== 'Refundable') return false;
      if (filterRefundable === 'NON_REFUNDABLE' && f.is_refundable === 'Refundable') return false;

      // Stops filter
      if (filterStops === '0' && f.stops !== 'Non Stop') return false;
      if (filterStops === '1' && f.stops !== '1 Stop') return false;
      if (filterStops === '2+') {
        const stopsLabel = String(f.stops || '').toLowerCase();
        if (!stopsLabel.includes('2') && stopsLabel !== '2+ stop' && stopsLabel !== '2+ stops') {
          return false;
        }
      }

      // Time slot filter
      if (filterTimeSlot !== 'ALL') {
        const hour = parseInt((f.departure_time || '00:00').split(':')[0], 10);
        if (filterTimeSlot === '00-06' && (hour < 0 || hour >= 6)) return false;
        if (filterTimeSlot === '06-12' && (hour < 6 || hour >= 12)) return false;
        if (filterTimeSlot === '12-18' && (hour < 12 || hour >= 18)) return false;
        if (filterTimeSlot === '18-00' && (hour < 18 || hour >= 24)) return false;
      }

      // Airline filter
      if (selectedAirlines.length > 0 && !selectedAirlines.includes(f.airline_code)) {
        return false;
      }

      return true;
    });
  }, [dailyFlights, currentSectorKey, onwardDate, filterRefundable, filterStops, filterTimeSlot, selectedAirlines]);

  // Open Profile Modal with synced data
  const handleOpenProfileModal = () => {
    setBookingForm({
      mobile: agentProfile?.mobile || '',
      agencyName: agentProfile?.agencyName || agentProfile?.agency_name || '',
      agentName: agentProfile?.agentName || agentProfile?.agent_name || '',
      email: agentProfile?.email || '',
      address: agentProfile?.address || '',
      city: agentProfile?.city || '',
      state: agentProfile?.state || 'Punjab',
      pincode: agentProfile?.pincode || '',
      remarks: ''
    });
    setProfileLogoData(agentProfile?.logo_data || null);
    setProfilePassword('');
    setShowProfileModal(true);
  };

  // 5. Open Booking Modal (1-Click if recognized, or 10s setup if new)
  const handleOpenBookingModal = (flight) => {
    setBookingFlight(flight);
    const initialAdults = Math.max(1, searchAdults || 1);
    const initialChildren = Math.max(0, searchChildren || 0);
    const initialInfants = Math.max(0, searchInfants || 0);
    setBookingAdults(initialAdults);
    setBookingChildren(initialChildren);
    setBookingInfants(initialInfants);
    setBookingPax(initialAdults + initialChildren + initialInfants);
    setBookingSuccessResult(null);
    if (agentProfile && agentProfile.agencyName) {
      setBookingForm({
        mobile: agentProfile.mobile || '',
        agencyName: agentProfile.agencyName || '',
        agentName: agentProfile.agentName || '',
        email: agentProfile.email || '',
        address: agentProfile.address || '',
        city: agentProfile.city || '',
        state: agentProfile.state || 'Punjab',
        pincode: agentProfile.pincode || '',
        remarks: ''
      });
    } else {
      setBookingForm({
        mobile: '',
        agencyName: '',
        agentName: '',
        email: '',
        address: '',
        city: '',
        state: 'Punjab',
        pincode: '',
        remarks: ''
      });
    }
  };

  const handleMobileLookup = async (mob) => {
    const clean = String(mob).replace(/\D/g, '').slice(-10);
    if (clean.length === 10) {
      try {
        setLookupLoading(true);
        const res = await api.lookupAgent(clean);
        if (res && res.success && res.exists && res.agent) {
          setBookingForm(prev => ({
            ...prev,
            agencyName: res.agent.agency_name || prev.agencyName,
            agentName: res.agent.agent_name || prev.agentName,
            email: res.agent.email || prev.email,
            address: res.agent.address || prev.address,
            city: res.agent.city || prev.city,
            state: res.agent.state || prev.state || 'Punjab',
            pincode: res.agent.pincode || prev.pincode
          }));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLookupLoading(false);
      }
    }
  };

  const handleSubmitBooking = async (e) => {
    if (e) e.preventDefault();
    if (!bookingFlight) return;

    const cleanMob = String(bookingForm.mobile).replace(/\D/g, '').slice(-10);
    if (!cleanMob || cleanMob.length < 10) {
      alert('Please enter a valid 10-digit mobile number');
      return;
    }
    if (!bookingForm.agencyName || !bookingForm.agencyName.trim()) {
      alert('Please enter your Agency Name');
      return;
    }

    try {
      setIsSubmittingBooking(true);
      const rate = getDisplayPrice(bookingFlight.final_rate);
      const totalPax = bookingAdults + bookingChildren + bookingInfants;
      const totalSeats = bookingAdults + bookingChildren;
      const totalAmount = totalSeats * rate; // Seats only; infant fee confirmed at airline actuals

      const payload = {
        mobile: cleanMob,
        agency_name: bookingForm.agencyName.trim(),
        agent_name: bookingForm.agentName ? bookingForm.agentName.trim() : '',
        email: bookingForm.email ? bookingForm.email.trim() : '',
        address: bookingForm.address ? bookingForm.address.trim() : '',
        city: bookingForm.city ? bookingForm.city.trim() : '',
        state: bookingForm.state ? bookingForm.state.trim() : '',
        pincode: bookingForm.pincode ? bookingForm.pincode.trim() : '',
        origin: bookingFlight.origin,
        destination: bookingFlight.destination,
        route_label: bookingFlight.route_label,
        airline_code: bookingFlight.airline_code,
        airline_name: bookingFlight.airline_name,
        flight_number: bookingFlight.flight_number,
        travel_date: bookingFlight.travel_date,
        departure_time: bookingFlight.departure_time,
        arrival_time: bookingFlight.arrival_time,
        duration: bookingFlight.duration,
        quoted_rate: rate,
        pax_count: totalPax,
        pax_adults: bookingAdults,
        pax_children: bookingChildren,
        pax_infants: bookingInfants,
        infant_fare: null,
        total_amount: totalAmount,
        baggage: formatBaggage(bookingFlight.baggage),
        remarks: bookingForm.remarks
      };

      const res = await api.createBookingRequest(payload);
      if (res && res.success) {
        const newProfile = {
          mobile: cleanMob,
          agencyName: bookingForm.agencyName.trim(),
          agentName: bookingForm.agentName ? bookingForm.agentName.trim() : '',
          email: bookingForm.email ? bookingForm.email.trim() : '',
          address: bookingForm.address ? bookingForm.address.trim() : '',
          city: bookingForm.city ? bookingForm.city.trim() : '',
          state: bookingForm.state ? bookingForm.state.trim() : '',
          pincode: bookingForm.pincode ? bookingForm.pincode.trim() : ''
        };
        setAgentProfile(newProfile);
        try {
          localStorage.setItem('travelx_b2b_agent', JSON.stringify(newProfile));
        } catch (e) {}
        setBookingSuccessResult(res);
        if (res.booking?.request_ref) {
          setActiveBookingRef(res.booking.request_ref);
          setActiveBookingData(res.booking);
          lastPolledStatusRef.current = res.booking.status || 'PENDING';
          try {
            localStorage.setItem('travelx_active_request_ref', res.booking.request_ref);
          } catch (e) {}
        }
      } else {
        alert(res?.error || 'Failed to submit seat hold request');
      }
    } catch (err) {
      console.error('Error submitting booking:', err);
      alert('Connection error. Please try again.');
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  // Save / Update Agent Profile in modal
  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault();
    const cleanMob = String(bookingForm.mobile || (agentProfile?.mobile || '')).replace(/\D/g, '').slice(-10);
    const agency = (bookingForm.agencyName || (agentProfile?.agencyName || agentProfile?.agency_name || '')).trim();
    if (!cleanMob || cleanMob.length < 10) {
      alert('Please enter a valid 10-digit mobile number');
      return;
    }
    if (!agency) {
      alert('Please enter your Agency Name');
      return;
    }
    const profile = {
      ...(agentProfile || {}),
      mobile: cleanMob,
      agencyName: agency,
      agency_name: agency,
      agentName: (bookingForm.agentName || (agentProfile?.agentName || agentProfile?.agent_name || '')).trim(),
      agent_name: (bookingForm.agentName || (agentProfile?.agentName || agentProfile?.agent_name || '')).trim(),
      email: (bookingForm.email || (agentProfile?.email || '')).trim(),
      address: (bookingForm.address || (agentProfile?.address || '')).trim(),
      city: (bookingForm.city || (agentProfile?.city || '')).trim(),
      state: (bookingForm.state || (agentProfile?.state || '')).trim(),
      pincode: (bookingForm.pincode || (agentProfile?.pincode || '')).trim(),
      logo_data: profileLogoData !== undefined ? profileLogoData : (agentProfile?.logo_data || null)
    };
    try {
      const res = await api.updateAgentProfile({
        mobile: profile.mobile,
        agency_name: profile.agencyName,
        agent_name: profile.agentName,
        email: profile.email,
        address: profile.address,
        city: profile.city,
        state: profile.state,
        pincode: profile.pincode,
        logo_data: profile.logo_data,
        password: profilePassword && profilePassword.trim().length >= 4 ? profilePassword.trim() : undefined
      });
      if (res && res.success && res.agent) {
        setAgentProfile(res.agent);
        try { localStorage.setItem('travelx_b2b_agent', JSON.stringify(res.agent)); } catch (_) {}
      } else {
        setAgentProfile(profile);
        try { localStorage.setItem('travelx_b2b_agent', JSON.stringify(profile)); } catch (_) {}
      }
    } catch (err) {
      console.error(err);
      setAgentProfile(profile);
      try { localStorage.setItem('travelx_b2b_agent', JSON.stringify(profile)); } catch (_) {}
    }
    setShowProfileModal(false);
  };

  // Logout / Switch Agent Account
  const handleLogout = () => {
    if (window.confirm('Kya aap B2B Agent Portal se Logout karna chahte hain?')) {
      setAgentProfile(null);
      try {
        localStorage.removeItem('travelx_b2b_agent');
        localStorage.removeItem('travelx_b2b_agent_token');
      } catch (e) {}
      setBookingForm({
        mobile: '',
        agencyName: '',
        agentName: '',
        email: '',
        address: '',
        city: '',
        state: 'Punjab',
        pincode: '',
        remarks: ''
      });
      setShowProfileModal(false);
    }
  };

  const handleClearProfile = handleLogout;

  // Handle Logo Upload during Registration
  const handleRegLogoChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file, 360, 160);
      setRegForm(prev => ({ ...prev, logo_data: dataUrl }));
    } catch (err) {
      alert(err.message || 'Image upload failed');
    }
  };

  // Handle Logo Upload in Profile Modal
  const handleModalLogoChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file, 360, 160);
      setProfileLogoData(dataUrl);
    } catch (err) {
      alert(err.message || 'Image upload failed');
    }
  };

  // Agent Login
  const handleAgentLogin = async (e) => {
    if (e) e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    const cleanMob = String(loginForm.mobile || '').replace(/\D/g, '').slice(-10);
    if (!cleanMob || cleanMob.length < 10) {
      setAuthError('Kripya apna 10-digit mobile number enter karein.');
      return;
    }
    if (!loginForm.pin || loginForm.pin.trim().length < 4) {
      setAuthError('Kripya apna Password ya 4-digit PIN enter karein.');
      return;
    }
    setAuthLoading(true);
    try {
      const res = await api.loginAgent({
        mobile: cleanMob,
        pin: loginForm.pin.trim()
      });
      if (res && res.success && res.agent) {
        setAuthSuccess('Login safal! Portal khul raha hai...');
        setAgentProfile(res.agent);
        try {
          localStorage.setItem('travelx_b2b_agent', JSON.stringify(res.agent));
          if (res.token) localStorage.setItem('travelx_b2b_agent_token', res.token);
        } catch (_) {}
      } else if (res && res.not_registered) {
        setAuthError(res.error || 'Yeh mobile registered nahi mila. Niche "New Agency Register" par click karein.');
      } else {
        setAuthError(res?.error || 'Login nahi ho saka. Kripya PIN dobara check karein.');
      }
    } catch (err) {
      setAuthError(err?.message || 'Server error. Kripya check karein.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Agent Registration
  const handleAgentRegister = async (e) => {
    if (e) e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    const cleanMob = String(regForm.mobile || '').replace(/\D/g, '').slice(-10);
    if (!cleanMob || cleanMob.length < 10) {
      setAuthError('Kripya 10-digit mobile number enter karein.');
      return;
    }
    if (!regForm.agencyName || !regForm.agencyName.trim()) {
      setAuthError('Faram / Agency Name enter karna zaroori hai.');
      return;
    }
    if (!regForm.agentName || !regForm.agentName.trim()) {
      setAuthError('Contact Person Name enter karna zaroori hai.');
      return;
    }
    if (!regForm.pin || regForm.pin.trim().length < 4) {
      setAuthError('Security PIN / Password kam se kam 4 characters/digits ka hona chahiye.');
      return;
    }
    if (regForm.confirmPin && regForm.confirmPin.trim() !== regForm.pin.trim()) {
      setAuthError('Password aur Confirm Password match nahi kar rahe.');
      return;
    }
    setAuthLoading(true);
    try {
      const res = await api.registerAgent({
        mobile: cleanMob,
        agency_name: regForm.agencyName.trim(),
        agent_name: regForm.agentName.trim(),
        email: regForm.email ? regForm.email.trim() : '',
        address: regForm.address ? regForm.address.trim() : '',
        city: regForm.city ? regForm.city.trim() : '',
        state: regForm.state || 'Punjab',
        pincode: regForm.pincode ? regForm.pincode.trim() : '',
        pin: regForm.pin.trim(),
        logo_data: regForm.logo_data || null
      });
      if (res && res.success && res.agent) {
        setAuthSuccess('Registration safal raha! B2B Portal khul raha hai...');
        setAgentProfile(res.agent);
        try {
          localStorage.setItem('travelx_b2b_agent', JSON.stringify(res.agent));
          if (res.token) localStorage.setItem('travelx_b2b_agent_token', res.token);
        } catch (_) {}
      } else {
        setAuthError(res?.error || 'Registration nahi ho saka. Kripya check karein.');
      }
    } catch (err) {
      setAuthError(err?.message || 'Server connection error.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Copy Reference ID
  const handleCopyRef = (refText) => {
    navigator.clipboard.writeText(refText);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  // WhatsApp helper from booking celebration screen
  const handleWhatsAppBookingConfirm = (booking, flight) => {
    const paxDetails = [];
    if (booking.pax_adults) paxDetails.push(`${booking.pax_adults} Adult${booking.pax_adults > 1 ? 's' : ''}`);
    if (booking.pax_children) paxDetails.push(`${booking.pax_children} Child${booking.pax_children > 1 ? 'ren' : ''}`);
    if (booking.pax_infants) paxDetails.push(`${booking.pax_infants} Infant${booking.pax_infants > 1 ? 's' : ''}`);
    const paxStr = paxDetails.length > 0 
      ? `${booking.pax_count} Pax (${paxDetails.join(', ')})` 
      : `${booking.pax_count} Pax`;

    const msg = `✈️ *TRAVELX SEAT AVAILABILITY REQUEST #${booking.request_ref}*
━━━━━━━━━━━━━━━━━━━━━━━━━━
• *Agency:* ${booking.agency_name} (${booking.agent_mobile})
• *Sector:* ${booking.origin} ➔ ${booking.destination}
• *Flight:* ${booking.airline_name} (${booking.flight_number})
• *Date:* ${booking.travel_date} (${booking.departure_time} - ${booking.arrival_time})
• *Passengers:* ${paxStr}
• *Quoted Net:* ₹${Number(booking.quoted_rate).toLocaleString('en-IN')}/- (Total: ₹${Number(booking.total_amount).toLocaleString('en-IN')})
${booking.remarks ? `• *Remarks:* ${booking.remarks}\n` : ''}━━━━━━━━━━━━━━━━━━━━━━━━━━
Please confirm availability and share status for Reference *#${booking.request_ref}*.`;
    openAgencyWhatsApp(msg);
  };

  // WhatsApp Booking Fallback Generator
  const handleBookFlight = (flight) => {
    const rate = getDisplayPrice(flight.final_rate);
    const paxDetails = [];
    if (searchAdults) paxDetails.push(`${searchAdults} Adult${searchAdults > 1 ? 's' : ''}`);
    if (searchChildren) paxDetails.push(`${searchChildren} Child${searchChildren > 1 ? 'ren' : ''}`);
    if (searchInfants) paxDetails.push(`${searchInfants} Infant${searchInfants > 1 ? 's' : ''}`);
    const totalP = searchAdults + searchChildren + searchInfants;
    const paxStr = paxDetails.length > 0 ? `${totalP} Pax (${paxDetails.join(', ')})` : `${totalP} Pax`;

    const message = `✈️ *TRAVELX FIXED DEPARTURE SEAT AVAILABILITY REQUEST*
━━━━━━━━━━━━━━━━━━━━━━━━━━
• *Sector:* ${flight.origin_city} (${flight.origin}) ➔ ${flight.destination_city} (${flight.destination})
• *Flight:* ${flight.airline_name} (${flight.flight_number})
• *Travel Date:* ${flight.day_label} (${flight.formatted_date})
• *Timings:* ${flight.departure_time} ➔ ${flight.arrival_time} (Non-Stop)
• *Rate Quoted:* ₹${rate.toLocaleString('en-IN')}/- Net per pax
• *Baggage:* ${formatBaggage(flight.baggage)}
• *Fare Rule:* 100% Non-Refundable & Non-Changeable
━━━━━━━━━━━━━━━━━━━━━━━━━━
*Agent Details:*
• Agent Name: 
• Agency Code: ${agencyConfig.agentCode || 'TRAVELX (TX10011)'}
• Total Passengers: ${paxStr}

Please confirm availability and share status.`;

    openAgencyWhatsApp(message);
  };

  // 6. Share Itinerary (White-Label Quotation)
  const handleShareQuote = (flight) => {
    const rate = getDisplayPrice(flight.final_rate);
    const agencyHeader = agentProfile?.agencyName 
      ? `🏢 *${agentProfile.agencyName}* - SPECIAL FARE QUOTATION`
      : `✈️ *SPECIAL FIXED DEPARTURE AIR FARE*`;
    const contactFooter = agentProfile?.agencyName
      ? `━━━━━━━━━━━━━━━━━━━━━━━━━━\nIssued by: *${agentProfile.agencyName}*\n📞 Contact: ${agentProfile.mobile}${agentProfile.city ? ` • ${agentProfile.city}` : ''}\nReply to this message for instant booking!`
      : `━━━━━━━━━━━━━━━━━━━━━━━━━━\n📲 Contact desk for instant seat issuance!`;

    const text = `${agencyHeader}
━━━━━━━━━━━━━━━━━━━━━━━━━━
• *Route:* ${flight.origin_city} ➔ ${flight.destination_city}
• *Airline:* ${flight.airline_name} ${flight.flight_number}
• *Date:* ${flight.day_label}
• *Time:* ${flight.departure_time} - ${flight.arrival_time} (Non-Stop)
• *Rate:* *₹${rate.toLocaleString('en-IN')}/-* All-Inclusive
• *Baggage:* ${formatBaggage(flight.baggage)}
• *Terms:* Non-Refundable & Non-Changeable
${contactFooter}`;

    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // Airline Logos & Colors helper using official downloaded PNG logos
  const renderAirlineIcon = (code, name, customClass = "w-11 h-11") => {
    const fallbackColor = 
      code === 'IX' ? 'from-orange-500 to-amber-600' :
      code === '6E' ? 'from-blue-700 to-indigo-800' :
      code === 'SG' ? 'from-red-600 to-rose-700' :
      code === 'AI' ? 'from-red-700 to-red-900' :
      'from-slate-700 to-slate-900';

    return (
      <div className={`${customClass} rounded-xl bg-white border border-slate-200/90 p-1 flex items-center justify-center shadow-xs shrink-0 relative overflow-hidden group`}>
        <img
          src={`/airlines/${code}.png`}
          alt={name || code}
          className="w-full h-full object-contain p-0.5"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            if (e.currentTarget.nextElementSibling) {
              e.currentTarget.nextElementSibling.style.display = 'flex';
            }
          }}
        />
        <div 
          style={{ display: 'none' }}
          className={`w-full h-full rounded-lg bg-gradient-to-br ${fallbackColor} items-center justify-center text-white font-black tracking-tighter text-xs`}
        >
          {code}
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────
  // B2B GATEWAY: RESTRICTED ACCESS (LOGIN & REGISTRATION)
  // Shown when agent is NOT authenticated
  // ─────────────────────────────────────────────────────────────
  if (!agentProfile || !agentProfile.agencyName) {
    const isRegister = authTab === 'register';

    return (
      <div 
        className="min-h-screen flex flex-col justify-between font-sans selection:bg-blue-600 selection:text-white relative bg-cover bg-center bg-no-repeat bg-fixed"
        style={{
          backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.06), rgba(15, 23, 42, 0.12)), url('/travelx-login-bg.jpg')`
        }}
      >
        {/* Top Minimal Corporate Navigation Bar */}
        <header className="relative z-20 border-b border-slate-200/80 bg-white/92 backdrop-blur-md shadow-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between">
            {/* Left Brand Identity */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-800 p-0.5 shadow-md flex items-center justify-center">
                <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
                  <Plane className="w-5 h-5 text-sky-400 -rotate-45" />
                </div>
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xl font-black text-slate-900 tracking-tight">TravelX</span>
                  <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    B2B AIR PORTAL
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 font-semibold">Special Fixed Fare Group Desk</p>
              </div>
            </div>

            {/* Right Contact Quick Access */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              <a
                href="tel:+918146526257"
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-bold transition shadow-2xs"
              >
                <Phone className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline">+91 81465 26257</span>
                <span className="sm:hidden">Call</span>
              </a>
              <a
                href="https://wa.me/918146526257?text=Hello%20TravelX%20Desk%2C%20I%20need%20help%20with%20Agent%20Portal%20access."
                target="_blank"
                rel="noreferrer"
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Desk WhatsApp</span>
              </a>
            </div>
          </div>
        </header>

        {/* Center Floating Luxury Light Card */}
        <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8 sm:py-12 my-auto">
          <div className={`w-full ${isRegister ? 'max-w-xl' : 'max-w-[450px]'} mx-auto bg-white/96 border border-white/80 rounded-3xl shadow-[0_25px_60px_-15px_rgba(15,23,42,0.30)] backdrop-blur-2xl overflow-hidden transition-all duration-300 ring-1 ring-slate-900/5`}>
            
            {/* Card Header */}
            <div className="p-6 pb-4 border-b border-slate-100 bg-gradient-to-b from-blue-50/60 via-slate-50/40 to-white text-center">
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-blue-100/70 border border-blue-200 text-blue-800 text-[10px] font-black uppercase tracking-wider mb-2">
                <Lock className="w-3 h-3 text-blue-600" />
                <span>Authorized B2B Portal</span>
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                {isRegister ? 'New Agency Registration' : 'Special Flight Rates Desk'}
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto font-medium">
                {isRegister 
                  ? 'Register your agency to unlock live wholesale fixed rates & branding' 
                  : 'Direct group allocations for Dubai & Abu Dhabi'}
              </p>

              {/* Tabs Switcher */}
              <div className="mt-4 grid grid-cols-2 p-1 bg-slate-100 border border-slate-200/90 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => { setAuthTab('login'); setAuthError(''); setAuthSuccess(''); }}
                  className={`py-2 rounded-lg transition cursor-pointer flex items-center justify-center space-x-1.5 ${
                    authTab === 'login'
                      ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80 font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Agent Login</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthTab('register'); setAuthError(''); setAuthSuccess(''); }}
                  className={`py-2 rounded-lg transition cursor-pointer flex items-center justify-center space-x-1.5 ${
                    authTab === 'register'
                      ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80 font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>New Agency Register</span>
                </button>
              </div>
            </div>

            {/* Error / Success Feedback */}
            {authError && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span className="font-semibold">{authError}</span>
              </div>
            )}
            {authSuccess && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">{authSuccess}</span>
              </div>
            )}

            {/* Tab 1: Login Form */}
            {authTab === 'login' && (
              <form onSubmit={handleAgentLogin} className="p-6 space-y-4 text-xs">
                
                {/* Mobile Number Input */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">
                    Registered Mobile Number <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center rounded-xl bg-slate-50 border border-slate-300 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100 transition overflow-hidden shadow-2xs">
                    <div className="px-3.5 py-2.5 bg-slate-100 border-r border-slate-200 text-slate-700 font-mono font-bold text-xs select-none">
                      🇮🇳 +91
                    </div>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="10-digit mobile number"
                      value={loginForm.mobile}
                      onChange={(e) => setLoginForm({ ...loginForm, mobile: e.target.value.replace(/\D/g, '') })}
                      className="w-full px-3.5 py-2.5 bg-transparent text-slate-900 font-mono font-bold text-sm outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Security PIN / Password */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">
                    Security Password / 4-Digit PIN <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center rounded-xl bg-slate-50 border border-slate-300 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100 transition overflow-hidden pr-3 shadow-2xs">
                    <input
                      type={loginForm.showPassword ? 'text' : 'password'}
                      required
                      placeholder="Enter your Password or PIN"
                      value={loginForm.pin}
                      onChange={(e) => setLoginForm({ ...loginForm, pin: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-transparent text-slate-900 font-mono font-bold text-sm outline-none placeholder:text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => setLoginForm({ ...loginForm, showPassword: !loginForm.showPassword })}
                      className="text-slate-400 hover:text-slate-700 transition cursor-pointer p-1"
                      title={loginForm.showPassword ? 'Hide PIN' : 'Show PIN'}
                    >
                      {loginForm.showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Pehli baar login kar rahe hain? Koi bhi 4-digit PIN enter karke login karein.
                  </p>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white font-black text-sm rounded-xl shadow-lg shadow-blue-500/25 transition cursor-pointer flex items-center justify-center space-x-2 active:scale-98 disabled:opacity-50 mt-2"
                >
                  {authLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying Credentials...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Secure B2B Login</span>
                    </>
                  )}
                </button>

                {/* Switch to Register */}
                <div className="pt-2 text-center border-t border-slate-100">
                  <p className="text-slate-600 text-xs">
                    Naya account banana hai?{' '}
                    <button
                      type="button"
                      onClick={() => { setAuthTab('register'); setAuthError(''); }}
                      className="text-blue-600 hover:text-blue-700 font-bold underline cursor-pointer ml-1"
                    >
                      New Agency Register karein (1-min)
                    </button>
                  </p>
                </div>
              </form>
            )}

            {/* Tab 2: New Agency Registration Form */}
            {authTab === 'register' && (
              <form onSubmit={handleAgentRegister} className="p-6 space-y-3.5 text-xs max-h-[72vh] overflow-y-auto">
                
                {/* 1. Firm Name & Contact Person */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      Firm / Agency Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Enter Firm / Agency Name"
                      value={regForm.agencyName}
                      onChange={(e) => setRegForm({ ...regForm, agencyName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 rounded-xl text-slate-900 font-bold outline-none text-xs placeholder:text-slate-400 transition shadow-2xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      Contact Person Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Enter Contact Person Name"
                      value={regForm.agentName}
                      onChange={(e) => setRegForm({ ...regForm, agentName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 rounded-xl text-slate-900 font-medium outline-none text-xs placeholder:text-slate-400 transition shadow-2xs"
                    />
                  </div>
                </div>

                {/* 2. Mobile Number & Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      Mobile Number (WhatsApp) <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center rounded-xl bg-slate-50 border border-slate-300 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100 overflow-hidden shadow-2xs">
                      <span className="px-2.5 py-2 bg-slate-100 border-r border-slate-200 text-slate-700 font-mono font-bold text-xs">
                        +91
                      </span>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        placeholder="10-digit mobile"
                        value={regForm.mobile}
                        onChange={(e) => setRegForm({ ...regForm, mobile: e.target.value.replace(/\D/g, '') })}
                        className="w-full px-2.5 py-2 bg-transparent text-slate-900 font-mono font-bold outline-none text-xs placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      Email Address (Optional)
                    </label>
                    <input
                      type="email"
                      placeholder="Enter email address"
                      value={regForm.email}
                      onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 rounded-xl text-slate-900 font-medium outline-none text-xs placeholder:text-slate-400 transition shadow-2xs"
                    />
                  </div>
                </div>

                {/* 3. Address */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Office / Shop Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Shop/Office No., Street, Complex or Market"
                    value={regForm.address}
                    onChange={(e) => setRegForm({ ...regForm, address: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 rounded-xl text-slate-900 outline-none text-xs placeholder:text-slate-400 transition shadow-2xs"
                  />
                </div>

                {/* City, State, Pincode */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">City <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="Enter city"
                      value={regForm.city}
                      onChange={(e) => setRegForm({ ...regForm, city: e.target.value })}
                      className="w-full px-2.5 py-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 rounded-xl text-slate-900 font-medium outline-none text-xs placeholder:text-slate-400 transition shadow-2xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">State</label>
                    <select
                      value={regForm.state}
                      onChange={(e) => setRegForm({ ...regForm, state: e.target.value })}
                      className="w-full px-2 py-2 bg-slate-50 border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 rounded-xl text-slate-900 font-medium outline-none text-xs cursor-pointer"
                    >
                      {INDIAN_STATES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Pincode</label>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="6-digit pincode"
                      value={regForm.pincode}
                      onChange={(e) => setRegForm({ ...regForm, pincode: e.target.value.replace(/\D/g, '') })}
                      className="w-full px-2.5 py-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 rounded-xl text-slate-900 font-mono outline-none text-xs placeholder:text-slate-400 transition shadow-2xs"
                    />
                  </div>
                </div>

                {/* 4. Logo Upload (Optional) */}
                <div className="p-3 bg-slate-50/80 border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl transition">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-slate-800 flex items-center space-x-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                      <span>Agency Logo (White-Label Interface)</span>
                    </span>
                    <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">Optional</span>
                  </div>
                  
                  {regForm.logo_data ? (
                    <div className="flex items-center space-x-3 bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                      <img
                        src={regForm.logo_data}
                        alt="Logo preview"
                        className="h-10 w-auto max-w-[120px] object-contain rounded bg-slate-50 p-1 border border-slate-200"
                      />
                      <div className="flex-1">
                        <span className="text-[11px] text-emerald-600 font-bold block">Logo Attached!</span>
                        <span className="text-[10px] text-slate-500">Appears on your portal header & quotations</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRegForm({ ...regForm, logo_data: null })}
                        className="p-1 rounded text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                        title="Remove Logo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <label className="flex items-center justify-center space-x-2 py-2.5 px-4 bg-white hover:bg-blue-50 border border-slate-300 hover:border-blue-400 rounded-xl cursor-pointer transition text-slate-700 hover:text-blue-700 text-xs font-bold shadow-2xs">
                        <Camera className="w-4 h-4 text-blue-600" />
                        <span>Upload Logo (PNG / JPG / WebP)</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleRegLogoChange}
                        />
                      </label>
                      <p className="text-[10px] text-slate-500 mt-1.5 text-center">
                        Logo upload karne par aapka logo aapke B2B portal header aur quotation par dikhai dega.
                      </p>
                    </div>
                  )}
                </div>

                {/* 5. Set Security PIN / Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      Set 4-Digit PIN / Password <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type={regForm.showPassword ? 'text' : 'password'}
                      required
                      minLength={4}
                      placeholder="Enter 4-digit PIN or password"
                      value={regForm.pin}
                      onChange={(e) => setRegForm({ ...regForm, pin: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 rounded-xl text-slate-900 font-mono font-bold outline-none text-xs placeholder:text-slate-400 transition shadow-2xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      Confirm PIN / Password <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type={regForm.showPassword ? 'text' : 'password'}
                      required
                      minLength={4}
                      placeholder="Re-enter same PIN"
                      value={regForm.confirmPin}
                      onChange={(e) => setRegForm({ ...regForm, confirmPin: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 rounded-xl text-slate-900 font-mono font-bold outline-none text-xs placeholder:text-slate-400 transition shadow-2xs"
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-sm rounded-xl shadow-lg shadow-emerald-500/25 transition cursor-pointer flex items-center justify-center space-x-2 active:scale-98 disabled:opacity-50 mt-2"
                >
                  {authLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Registering Agency...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Register Agency & Unlock Live Rates</span>
                    </>
                  )}
                </button>

                <div className="pt-2 text-center border-t border-slate-100">
                  <p className="text-slate-600 text-xs">
                    Pehle se account hai?{' '}
                    <button
                      type="button"
                      onClick={() => { setAuthTab('login'); setAuthError(''); }}
                      className="text-blue-600 hover:text-blue-700 font-bold underline cursor-pointer ml-1"
                    >
                      Login karein
                    </button>
                  </p>
                </div>
              </form>
            )}

          </div>
        </main>

        {/* Footer */}
        <footer className="relative z-10 py-3 text-center border-t border-slate-200/80 text-xs text-slate-600 bg-white/92 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span className="font-semibold text-slate-700">
              TravelX Global Aviation Desk • Amritsar • Chandigarh • Delhi NCR
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              Strict B2B Privacy Isolation • Fixed Group Departures
            </span>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans selection:bg-orange-500 selection:text-white">
      
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. TOP BRAND HEADER: AGENT WHITE-LABEL DESK                   */}
      {/* ───────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200/90 shadow-2xs sticky top-0 z-40 backdrop-blur-md bg-white/95">
        <div className="max-w-[1700px] mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between">
          
          {/* Left Brand Identity: Agent White-Label Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setHasSearched(true)}>
            {agentProfile?.logo_data ? (
              <div className="flex items-center justify-center bg-white rounded-xl p-1 border border-slate-200/90 shadow-2xs max-h-12 overflow-hidden">
                <img 
                  src={agentProfile.logo_data} 
                  alt={agentProfile.agencyName} 
                  className="h-9 sm:h-11 w-auto max-w-[120px] sm:max-w-[160px] object-contain rounded" 
                />
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-700 via-indigo-600 to-blue-900 p-0.5 shadow-md flex items-center justify-center">
                  <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-blue-900" />
                  </div>
                </div>
              </div>
            )}

            {/* Brand Title & Tagline */}
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight font-sans">
                  {agentProfile.agencyName}
                </span>
                <span className="inline-flex items-center space-x-1 text-[10px] bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-black px-2 py-0.5 rounded-full shadow-2xs uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  <span>B2B PARTNER</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium tracking-wide flex items-center space-x-1.5">
                <span>{agentProfile.agentName ? `Desk: ${agentProfile.agentName}` : 'Special Fixed Fare Desk'}</span>
                <span className="text-slate-300">•</span>
                <span className="text-blue-900 font-semibold">{[agentProfile.city, agentProfile.state].filter(Boolean).join(', ') || 'Authorized Agent'}</span>
                <span className="text-slate-300">•</span>
                <span className="font-mono text-slate-700">{agentProfile.mobile}</span>
              </p>
            </div>
          </div>

          {/* Right Agent Dashboard Controls */}
          <div className="flex items-center space-x-2 sm:space-x-3 text-xs">
            
            {/* Agent Profile & Branding Button */}
            <button 
              type="button"
              onClick={handleOpenProfileModal}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-950 cursor-pointer transition shadow-2xs group"
              title="Click to view or edit agency profile & branding"
            >
              <Building2 className="w-3.5 h-3.5 text-blue-800" />
              <span className="font-bold text-xs hidden sm:inline">My Agency Profile</span>
            </button>

            {/* Updates Tab (Active Booking & Live Status Alerts) */}
            <button
              type="button"
              onClick={() => {
                if (activeBookingRef) {
                  handleFetchTracking(activeBookingRef);
                } else {
                  setShowTrackerModal(true);
                }
              }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full font-extrabold transition shadow-2xs cursor-pointer text-xs ${
                activeBookingData?.status === 'AVAILABLE'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md animate-pulse ring-2 ring-emerald-300'
                  : activeBookingData?.status === 'FARE_REVISED'
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md ring-2 ring-indigo-300'
                  : activeBookingData?.status === 'TICKET_PROCESSING'
                  ? 'bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white shadow-md animate-pulse ring-2 ring-sky-300'
                  : activeBookingData?.status === 'CONFIRMED'
                  ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-md'
                  : activeBookingData?.status === 'PENDING'
                  ? 'bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
              }`}
              title={activeBookingRef ? `Active Booking #${activeBookingRef} (${activeBookingData?.status || 'Pending'})` : 'Live Booking Updates'}
            >
              <div className="relative">
                <Bell className="w-3.5 h-3.5" />
                {activeBookingData && activeBookingData.status !== 'CONFIRMED' && (
                  <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
                    activeBookingData.status === 'AVAILABLE' || activeBookingData.status === 'TICKET_PROCESSING'
                      ? 'bg-white animate-ping'
                      : 'bg-amber-500'
                  }`} />
                )}
              </div>
              <span>Updates</span>
              {activeBookingData && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                  activeBookingData.status === 'AVAILABLE'
                    ? 'bg-white text-emerald-800'
                    : activeBookingData.status === 'TICKET_PROCESSING'
                    ? 'bg-white text-sky-900 animate-pulse'
                    : activeBookingData.status === 'PENDING'
                    ? 'bg-amber-200 text-amber-950'
                    : 'bg-white/20 text-white'
                }`}>
                  {activeBookingData.status === 'AVAILABLE' 
                    ? 'Seat Available!' 
                    : activeBookingData.status === 'FARE_REVISED'
                    ? 'Fare Revised'
                    : activeBookingData.status === 'TICKET_PROCESSING'
                    ? '✈️ Under Issuance...'
                    : activeBookingData.status === 'DOCS_SUBMITTED'
                    ? 'Passports Sent'
                    : activeBookingData.status === 'CONFIRMED'
                    ? 'Ticket Ready'
                    : 'Pending'}
                </span>
              )}
            </button>

            {/* Track Booking Button */}
            <button
              type="button"
              onClick={() => setShowTrackerModal(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-900 font-extrabold border border-amber-300 transition shadow-2xs cursor-pointer"
              title="Track existing booking, upload passports, or download ticket"
            >
              <Search className="w-3.5 h-3.5 text-amber-600" />
              <span>Track Booking</span>
            </button>

            {/* Booking Desk Contact */}
            <button
              type="button"
              onClick={() => openAgencyWhatsApp('Hello TravelX, I need assistance with fixed departure rates.')}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 transition shadow-2xs cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Booking Desk</span>
            </button>

            {/* Logout Button */}
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold transition shadow-2xs cursor-pointer text-xs"
              title="Logout from B2B Portal"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-600" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1.5 LIVE MAINTENANCE / ROUTINE INVENTORY SYNCHRONIZATION      */}
      {/* ───────────────────────────────────────────────────────────── */}
      {(isMaintenance || (isServerSyncing && (!dailyFlights || dailyFlights.length === 0))) ? (
        <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 sm:px-6 py-12 flex items-center justify-center">
          <div className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-xl p-8 sm:p-12 text-center relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-amber-500" />
            
            {/* Animated Radar Pulse */}
            <div className="relative w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-20" />
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-900 to-indigo-900 text-white flex items-center justify-center shadow-lg border border-blue-700/50 relative z-10">
                <Plane className="w-8 h-8 text-blue-200 -rotate-45" />
              </div>
            </div>

            {/* Badge */}
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-900 text-xs font-black uppercase tracking-wider mb-4">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>TravelX Live Fare Engine • Routine Sync</span>
            </div>

            {/* Heading */}
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-3">
              Live Airline Inventory Synchronization
            </h2>

            {/* Body Description */}
            <p className="text-sm text-slate-600 leading-relaxed max-w-lg mx-auto mb-6">
              {maintenanceMsg || "Our automated pricing desks are currently synchronizing today's guaranteed airline seats and group allocations for Amritsar, Delhi & Chandigarh sectors. Live search and instant seat hold will resume in a few moments."}
            </p>

            {/* Live Auto-Recovery Status */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 max-w-md mx-auto mb-6 flex items-center justify-between">
              <div className="flex items-center space-x-2.5 text-left">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <div>
                  <p className="text-xs font-bold text-slate-900">System Auto-Reconnecting</p>
                  <p className="text-[11px] text-slate-500">Checking live server status continuously...</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => loadPortalData(true)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs flex items-center space-x-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Check Now</span>
              </button>
            </div>

            {/* Emergency Offline Issuance Contact */}
            <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-center gap-4 text-xs text-slate-500">
              <span>Urgent ticket issuance:</span>
              <a 
                href={`tel:${agencyConfig?.phone || '+918146526257'}`}
                className="font-bold text-slate-800 hover:text-blue-600 transition flex items-center space-x-1"
              >
                <span>📞 {agencyConfig?.phone || '+91 81465 26257'}</span>
              </a>
              <span className="hidden sm:inline text-slate-300">•</span>
              <button
                type="button"
                onClick={() => openAgencyWhatsApp('Hello TravelX, I need urgent booking assistance during inventory sync.')}
                className="font-bold text-emerald-700 hover:text-emerald-800 transition flex items-center space-x-1 cursor-pointer"
              >
                <span>💬 WhatsApp Support</span>
              </button>
            </div>
          </div>
        </main>
      ) : (
        <>
          {/* ───────────────────────────────────────────────────────────── */}
          {/* 2. EXECUTIVE AVIATION SEARCH ENGINE                          */}
          {/* ───────────────────────────────────────────────────────────── */}
          <section className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 pt-4 pb-4 px-3 sm:px-6 shadow-xl border-b border-slate-800 text-white">
        <div className="max-w-[1700px] mx-auto space-y-3">
          
          {/* Top Bar: Trip Mode & Airline Badges */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Trip Selector Pills */}
            <div className="inline-flex p-1 bg-slate-800/90 backdrop-blur-md rounded-xl border border-slate-700/70 shadow-inner">
              <button
                type="button"
                onClick={() => setTripType('ONE_WAY')}
                className={`px-5 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer ${
                  tripType === 'ONE_WAY'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ONE WAY
              </button>
              <button
                type="button"
                onClick={() => setTripType('ROUND_TRIP')}
                className={`px-5 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer ${
                  tripType === 'ROUND_TRIP'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ROUND TRIP
              </button>
            </div>

            {/* Feature Trust Badges */}
            <div className="hidden sm:flex items-center space-x-3 text-xs font-bold text-slate-300">
              <span className="flex items-center space-x-1.5 bg-blue-500/10 text-blue-300 px-3 py-1 rounded-full border border-blue-500/20">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Guaranteed Group PNR Inventory</span>
              </span>
            </div>
          </div>

          {/* Luxury Flight Search Form Grid */}
          <div className="bg-white rounded-2xl p-2 sm:p-2.5 shadow-2xl border border-slate-200/90">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
              
              {/* Origin Capsule (3 Cols) */}
              <div className="relative md:col-span-3">
                <div 
                  onClick={() => {
                    setShowOriginDropdown(!showOriginDropdown);
                    setShowDestDropdown(false);
                    setShowTravellerDropdown(false);
                  }}
                  className="bg-slate-50 hover:bg-white rounded-xl h-14 px-3.5 flex items-center justify-between cursor-pointer border border-slate-200/90 hover:border-blue-500 shadow-2xs hover:shadow-sm transition group"
                >
                  <div className="flex flex-col text-left">
                    <span className="text-[10px] text-slate-400 font-extrabold tracking-wider uppercase leading-none">
                      From (Origin)
                    </span>
                    <div className="flex items-baseline space-x-1.5 mt-0.5">
                      <span className="text-base font-black text-slate-900 font-mono">
                        {origin}
                      </span>
                      <span className="text-xs font-bold text-slate-600 truncate">
                        {derivedOrigins.find(o => o.code === origin)?.city || origin}
                      </span>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors shrink-0 ml-1" />
                </div>

                {/* Origin Dropdown */}
                {showOriginDropdown && (
                  <div className="absolute left-0 top-15 w-full bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 p-1.5 space-y-1 animate-in zoom-in-95 duration-100 max-h-64 overflow-y-auto">
                    {derivedOrigins.map(o => (
                      <div
                        key={o.code}
                        onClick={() => {
                          setOrigin(o.code);
                          const destList = derivedDestinations[o.code] || [];
                          if (destList.length > 0 && !destList.some(d => d.code === destination)) {
                            setDestination(destList[0].code);
                          }
                          setShowOriginDropdown(false);
                        }}
                        className={`px-3.5 py-2.5 rounded-xl text-xs font-bold hover:bg-blue-50 cursor-pointer flex items-center justify-between transition ${
                          origin === o.code ? 'bg-blue-100/70 text-blue-950 font-black border border-blue-200' : 'text-slate-700'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <Plane className="w-3.5 h-3.5 text-blue-700 -rotate-45" />
                          <span>({o.code}) {o.city}</span>
                        </div>
                        {origin === o.code && <Check className="w-4 h-4 text-blue-700" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Swap Button (1 Col) */}
              <div className="hidden md:flex md:col-span-1 items-center justify-center">
                <button
                  type="button"
                  onClick={handleSwapAirports}
                  className="w-10 h-10 rounded-full bg-blue-50 hover:bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-900 shadow-2xs hover:shadow-sm hover:rotate-180 transition-all duration-300 cursor-pointer"
                  title="Swap Sectors"
                >
                  <ArrowUpDown className="w-4 h-4 text-blue-800" />
                </button>
              </div>

              {/* Destination Capsule (3 Cols) */}
              <div className="relative md:col-span-3">
                <div 
                  onClick={() => {
                    setShowDestDropdown(!showDestDropdown);
                    setShowOriginDropdown(false);
                    setShowTravellerDropdown(false);
                  }}
                  className="bg-slate-50 hover:bg-white rounded-xl h-14 px-3.5 flex items-center justify-between cursor-pointer border border-slate-200/90 hover:border-blue-500 shadow-2xs hover:shadow-sm transition group"
                >
                  <div className="flex flex-col text-left">
                    <span className="text-[10px] text-slate-400 font-extrabold tracking-wider uppercase leading-none">
                      To (Destination)
                    </span>
                    <div className="flex items-baseline space-x-1.5 mt-0.5">
                      <span className="text-base font-black text-slate-900 font-mono">
                        {destination}
                      </span>
                      <span className="text-xs font-bold text-slate-600 truncate">
                        {((derivedDestinations[origin] || []).find(d => d.code === destination))?.city || destination}
                      </span>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors shrink-0 ml-1" />
                </div>

                {/* Destination Dropdown */}
                {showDestDropdown && (
                  <div className="absolute left-0 top-15 w-full bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 p-1.5 space-y-1 animate-in zoom-in-95 duration-100 max-h-64 overflow-y-auto">
                    {(derivedDestinations[origin] || DEFAULT_DESTINATIONS['ATQ'] || []).map(d => (
                      <div
                        key={d.code}
                        onClick={() => {
                          setDestination(d.code);
                          setShowDestDropdown(false);
                        }}
                        className={`px-3.5 py-2.5 rounded-xl text-xs font-bold hover:bg-blue-50 cursor-pointer flex items-center justify-between transition ${
                          destination === d.code ? 'bg-blue-100/70 text-blue-950 font-black border border-blue-200' : 'text-slate-700'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <Plane className="w-3.5 h-3.5 text-blue-700" />
                          <span>({d.code}) {d.city}</span>
                        </div>
                        {destination === d.code && <Check className="w-4 h-4 text-blue-700" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Onward Date (2 Cols) */}
              <div className="md:col-span-2">
                <div 
                  onClick={() => {
                    try {
                      if (dateInputRef.current && typeof dateInputRef.current.showPicker === 'function') {
                        dateInputRef.current.showPicker();
                      } else {
                        dateInputRef.current?.focus();
                      }
                    } catch (_) {
                      dateInputRef.current?.focus();
                    }
                  }}
                  className="bg-slate-50 hover:bg-white rounded-xl h-14 px-3 flex flex-col justify-center border border-slate-200/90 hover:border-blue-500 shadow-2xs hover:shadow-sm transition cursor-pointer select-none group"
                  title="Click to open calendar"
                >
                  <span className="text-[10px] text-slate-400 font-extrabold tracking-wider uppercase leading-none">
                    Departure Date
                  </span>
                  <div className="flex items-center justify-between mt-1">
                    <input
                      ref={dateInputRef}
                      type="date"
                      value={onwardDate}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => {
                        setOnwardDate(e.target.value);
                        setHasSearched(true);
                      }}
                      className="text-xs font-black text-slate-900 bg-transparent outline-none w-full cursor-pointer font-sans [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Travellers & Cabin (2 Cols) */}
              <div className="relative md:col-span-2" ref={travellerDropdownRef}>
                <div
                  onClick={() => {
                    setShowTravellerDropdown(!showTravellerDropdown);
                    setShowOriginDropdown(false);
                    setShowDestDropdown(false);
                  }}
                  className="bg-slate-50 hover:bg-white rounded-xl h-14 px-3 flex flex-col justify-center border border-slate-200/90 hover:border-blue-500 shadow-2xs hover:shadow-sm cursor-pointer select-none transition"
                >
                  <span className="text-[10px] text-slate-400 font-extrabold tracking-wider uppercase leading-none">
                    Travellers & Cabin
                  </span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs font-black text-slate-900 leading-tight truncate">
                      {searchAdults + searchChildren + searchInfants} Pax • Economy
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                  </div>
                </div>

                {/* Travellers Popover */}
                {showTravellerDropdown && (
                  <div className="absolute right-0 top-15 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 p-4 space-y-3 animate-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center space-x-1.5">
                        <Users className="w-4 h-4 text-blue-900" />
                        <span className="text-xs font-black text-slate-900">
                          Passengers ({searchAdults + searchChildren + searchInfants} Pax)
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Economy
                      </span>
                    </div>

                    {/* Adults */}
                    <div className="flex items-center justify-between py-1">
                      <div className="pr-2">
                        <div className="text-xs font-extrabold text-slate-900">Adults</div>
                        <div className="text-[11px] text-slate-500 font-medium">12+ years</div>
                      </div>
                      <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-lg p-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const next = Math.max(1, searchAdults - 1);
                            setSearchAdults(next);
                            const nextInfants = Math.min(searchInfants, next);
                            if (nextInfants !== searchInfants) setSearchInfants(nextInfants);
                            setTravellers(next + searchChildren + nextInfants);
                          }}
                          className="w-7 h-7 flex items-center justify-center rounded bg-white hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer border border-slate-200"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-7 text-center font-black text-sm text-slate-900">
                          {searchAdults}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const next = searchAdults + 1;
                            setSearchAdults(next);
                            setTravellers(next + searchChildren + searchInfants);
                          }}
                          className="w-7 h-7 flex items-center justify-center rounded bg-blue-900 hover:bg-blue-950 text-white font-bold transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Children */}
                    <div className="flex items-center justify-between border-t border-slate-100 py-1 pt-2">
                      <div className="pr-2">
                        <div className="text-xs font-extrabold text-slate-900">Children</div>
                        <div className="text-[11px] text-slate-500 font-medium">2 - 12 years</div>
                      </div>
                      <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-lg p-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const next = Math.max(0, searchChildren - 1);
                            setSearchChildren(next);
                            setTravellers(searchAdults + next + searchInfants);
                          }}
                          className="w-7 h-7 flex items-center justify-center rounded bg-white hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer border border-slate-200"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-7 text-center font-black text-sm text-slate-900">
                          {searchChildren}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const next = searchChildren + 1;
                            setSearchChildren(next);
                            setTravellers(searchAdults + next + searchInfants);
                          }}
                          className="w-7 h-7 flex items-center justify-center rounded bg-blue-900 hover:bg-blue-950 text-white font-bold transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Infants */}
                    <div className="flex items-center justify-between border-t border-slate-100 py-1 pt-2">
                      <div className="pr-2">
                        <div className="text-xs font-extrabold text-slate-900">Infants</div>
                        <div className="text-[11px] text-slate-500 font-medium">Under 2 years (lap infant)</div>
                      </div>
                      <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-lg p-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const next = Math.max(0, searchInfants - 1);
                            setSearchInfants(next);
                            setTravellers(searchAdults + searchChildren + next);
                          }}
                          className="w-7 h-7 flex items-center justify-center rounded bg-white hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer border border-slate-200"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-7 text-center font-black text-sm text-slate-900">
                          {searchInfants}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const next = Math.min(searchAdults, searchInfants + 1);
                            setSearchInfants(next);
                            setTravellers(searchAdults + searchChildren + next);
                          }}
                          className="w-7 h-7 flex items-center justify-center rounded bg-blue-900 hover:bg-blue-950 text-white font-bold transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Done Button & Summary */}
                    <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500">
                        Total: {searchAdults + searchChildren + searchInfants} Pax
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowTravellerDropdown(false);
                        }}
                        className="px-5 py-1.5 bg-blue-900 hover:bg-blue-950 text-white text-xs font-black rounded-lg transition cursor-pointer shadow-xs"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Search Button (1 Col) */}
              <div className="md:col-span-1">
                <button
                  type="button"
                  onClick={handleSearchSubmit}
                  disabled={isSearching}
                  className="w-full h-14 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-orange-500/25 flex items-center justify-center space-x-1.5 transition-all cursor-pointer active:scale-98 disabled:opacity-80"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="hidden sm:inline">Searching...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span className="hidden sm:inline">Search</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>

          {/* Quick Route Selector Chips */}
          <div className="pt-1 flex items-center space-x-2 overflow-x-auto no-scrollbar text-xs">
            <span className="text-slate-400 font-extrabold text-[11px] shrink-0 uppercase tracking-wider flex items-center space-x-1">
              <span>Popular Sectors:</span>
            </span>
            {availableSectorOptions.map(s => {
              const isSelected = origin === s.origin && destination === s.dest;
              return (
                <button
                  key={`${s.origin}-${s.dest}`}
                  type="button"
                  onClick={() => {
                    setOrigin(s.origin);
                    setDestination(s.dest);
                    setHasSearched(true);
                    if (dailyFlights.length === 0) {
                      loadPortalData(true);
                    }
                  }}
                  className={`px-3.5 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer flex items-center space-x-2 border ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/25'
                      : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700/80'
                  }`}
                >
                  <Plane className="w-3 h-3 text-amber-400 -rotate-45" />
                  <span>{s.origin} ➔ {s.dest}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-300'}`}>
                    {s.destCity}
                  </span>
                </button>
              );
            })}
          </div>

        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. EXECUTIVE AVIATION HIGHLIGHTS & TRUST STRIP                */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="max-w-[1700px] w-full mx-auto px-3 sm:px-6 pt-3 pb-1">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="bg-white rounded-xl border border-slate-200/90 p-2.5 flex items-center space-x-2.5 shadow-2xs">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-blue-700" />
            </div>
            <div>
              <p className="text-xs font-extrabold text-slate-900 leading-tight">Guaranteed PNRs</p>
              <p className="text-[10px] text-slate-500 font-medium">Direct Group Inventory</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/90 p-2.5 flex items-center space-x-2.5 shadow-2xs">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <p className="text-xs font-extrabold text-slate-900 leading-tight">30+7 KG Baggage</p>
              <p className="text-[10px] text-slate-500 font-medium">Standard on Gulf flights</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/90 p-2.5 flex items-center space-x-2.5 shadow-2xs">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
              <Plane className="w-4 h-4 text-purple-700 -rotate-45" />
            </div>
            <div>
              <p className="text-xs font-extrabold text-slate-900 leading-tight">Direct Non-Stop</p>
              <p className="text-[10px] text-slate-500 font-medium">ATQ & IXC Express routes</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/90 p-2.5 flex items-center space-x-2.5 shadow-2xs">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <Ticket className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <p className="text-xs font-extrabold text-slate-900 leading-tight">Instant WhatsApp E-Ticket</p>
              <p className="text-[10px] text-slate-500 font-medium">PDF dispatch to agent phone</p>
            </div>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. SEARCH RESULTS AREA (Exact Match: Image 3)                 */}
      {/* ───────────────────────────────────────────────────────────── */}
      {hasSearched && (
        <main className="flex-1 max-w-[1700px] w-full mx-auto px-3 sm:px-6 py-3 flex flex-col gap-3">
          
          {/* Live Rates Error / Server Warmup Alert with Retry */}
          {error && (
            <div className="bg-amber-50 border border-amber-300/80 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-amber-950 shadow-sm animate-in fade-in duration-200">
              <div className="flex items-center space-x-3 text-center sm:text-left">
                <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <p className="font-extrabold text-xs sm:text-sm text-amber-950 leading-snug">{error}</p>
                  <p className="text-[11px] text-amber-700 font-medium mt-0.5">Click "Reload Rates" to fetch latest live B2B airline inventory immediately.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => loadPortalData(true)}
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-xl text-xs font-black flex items-center space-x-2 transition cursor-pointer shadow-sm active:scale-98 shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Rates</span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
            
            {/* ───────────────────────────────────────────────────────── */}
            {/* LEFT SIDEBAR: FILTERS (Image 3 Left Side)                */}
            {/* ───────────────────────────────────────────────────────── */}
            <aside className="lg:col-span-3 bg-white rounded-lg border border-slate-200 shadow-2xs p-3.5 space-y-4">
              
              {/* Header: Found count + Reset */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span className="text-xs font-black text-slate-900">
                  {displayedFlights.length} Flights found
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFilterRefundable('ALL');
                    setFilterStops('ALL');
                    setFilterTimeSlot('ALL');
                    setSelectedAirlines([]);
                  }}
                  className="text-[11px] font-bold text-blue-700 hover:underline cursor-pointer"
                >
                  Reset Filters
                </button>
              </div>


              {/* Filter 2: Stops */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700">Stops</label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFilterStops('0')}
                    className={`py-1.5 px-1 text-center rounded border text-xs font-bold cursor-pointer transition ${
                      filterStops === '0'
                        ? 'border-blue-900 bg-blue-50 text-blue-950 ring-1 ring-blue-900'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div>0</div>
                    <div className="text-[10px] font-medium text-slate-500">Non-Stop</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterStops('1')}
                    className={`py-1.5 px-1 text-center rounded border text-xs font-bold cursor-pointer transition ${
                      filterStops === '1'
                        ? 'border-blue-900 bg-blue-50 text-blue-950 ring-1 ring-blue-900'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div>1</div>
                    <div className="text-[10px] font-medium text-slate-500">Stop</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterStops('2+')}
                    className={`py-1.5 px-1 text-center rounded border text-xs font-bold cursor-pointer transition ${
                      filterStops === '2+'
                        ? 'border-blue-900 bg-blue-50 text-blue-950 ring-1 ring-blue-900'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div>2+</div>
                    <div className="text-[10px] font-medium text-slate-500">Stop</div>
                  </button>
                </div>
              </div>

              {/* Filter 3: Departure Time Slot */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700">Departure</label>
                <div className="grid grid-cols-4 gap-1 text-center text-xs">
                  {[
                    { key: '00-06', label: '00-06', icon: '🌅' },
                    { key: '06-12', label: '06-12', icon: '☀️' },
                    { key: '12-18', label: '12-18', icon: '🌤️' },
                    { key: '18-00', label: '18-00', icon: '🌙' },
                  ].map(slot => (
                    <button
                      key={slot.key}
                      type="button"
                      onClick={() => setFilterTimeSlot(filterTimeSlot === slot.key ? 'ALL' : slot.key)}
                      className={`p-1.5 rounded border flex flex-col items-center justify-center cursor-pointer transition ${
                        filterTimeSlot === slot.key
                          ? 'border-blue-800 bg-blue-50 text-blue-950 ring-1 ring-blue-800 font-bold'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-sm">{slot.icon}</span>
                      <span className="text-[10px] mt-0.5">{slot.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Filter 4: Airlines */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-bold text-slate-700">Airlines</label>
                <div className="space-y-1.5 text-xs text-slate-700">
                  {[
                    { code: 'IX', name: 'Air India Express' },
                    { code: '6E', name: 'IndiGo' },
                    { code: 'SG', name: 'SpiceJet' }
                  ].map(a => {
                    const isChecked = selectedAirlines.includes(a.code);
                    return (
                      <label 
                        key={a.code} 
                        className={`flex items-center space-x-2.5 p-1.5 rounded-lg border cursor-pointer transition ${
                          isChecked ? 'bg-blue-50/80 border-blue-300 ring-1 ring-blue-300' : 'border-slate-100 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedAirlines(selectedAirlines.filter(c => c !== a.code));
                            } else {
                              setSelectedAirlines([...selectedAirlines, a.code]);
                            }
                          }}
                          className="rounded text-blue-600 focus:ring-0 cursor-pointer w-3.5 h-3.5"
                        />
                        {renderAirlineIcon(a.code, a.name, "w-6 h-6")}
                        <span className="font-bold text-xs text-slate-800 flex-1">{a.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Quick Sector Selector inside filter */}
              <div className="pt-2 border-t border-slate-100">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Switch Sector</label>
                <div className="mt-1.5 space-y-1">
                  {availableSectorOptions.map(s => {
                    const isCurrent = origin === s.origin && destination === s.dest;
                    return (
                      <button
                        key={`${s.origin}-${s.dest}`}
                        type="button"
                        onClick={() => {
                          setOrigin(s.origin);
                          setDestination(s.dest);
                        }}
                        className={`w-full text-left px-2 py-1.5 rounded text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                          isCurrent
                            ? 'bg-blue-900 text-white'
                            : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>{s.origin} ➔ {s.dest}</span>
                        <span className="text-[10px] opacity-80">{s.destCity}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

            </aside>

            {/* ───────────────────────────────────────────────────────── */}
            {/* RIGHT MAIN: DATE CAROUSEL + FLIGHT RESULTS (Image 3)      */}
            {/* ───────────────────────────────────────────────────────── */}
            <section className="lg:col-span-9 space-y-2.5">
              
              {/* 1. HORIZONTAL DATE CAROUSEL STRIP (Exact Match: Image 3) */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
                <div className="flex items-center">
                  
                  {/* Left Arrow Button */}
                  <button
                    type="button"
                    onClick={() => scrollCalendar('left')}
                    className="w-8 h-12 bg-[#0b3b82] hover:bg-blue-900 text-white flex items-center justify-center shrink-0 cursor-pointer transition"
                    title="Previous Dates"
                  >
                    <ChevronLeft className="w-5 h-5 font-bold" />
                  </button>

                  {/* Scrollable Date Tabs */}
                  <div 
                    ref={calendarScrollRef}
                    className="flex-1 flex items-center overflow-x-auto scrollbar-none py-1.5 px-2 space-x-1.5 scroll-smooth min-h-[58px]"
                  >
                    {loading && availableDatesList.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center py-2 text-xs text-slate-500 font-bold space-x-2">
                        <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                        <span>Loading live flight dates for {origin} ➔ {destination}...</span>
                      </div>
                    ) : availableDatesList.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center py-2 px-3 text-xs text-slate-600 font-bold space-x-3 flex-wrap gap-2">
                        <span>No flight dates loaded yet for {origin} ➔ {destination}</span>
                        <button
                          type="button"
                          onClick={() => loadPortalData(true)}
                          className="px-3 py-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-lg text-xs font-black flex items-center space-x-1.5 cursor-pointer shadow-xs transition active:scale-95"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Load Rates</span>
                        </button>
                      </div>
                    ) : (
                      availableDatesList.map(item => {
                        const isSelected = item.date === onwardDate;
                        const displayFare = getDisplayPrice(item.minFare);
                        return (
                          <button
                            key={item.date}
                            data-date={item.date}
                            type="button"
                            onClick={() => {
                              setOnwardDate(item.date);
                              centerSelectedDate(item.date);
                            }}
                            className={`min-w-[115px] sm:min-w-[130px] py-2 px-2 text-center transition-all duration-200 flex flex-col items-center justify-center cursor-pointer relative rounded-xl shrink-0 select-none ${
                              isSelected
                                ? 'bg-gradient-to-b from-orange-500 via-orange-600 to-amber-600 text-white shadow-lg shadow-orange-500/40 ring-2 ring-orange-400 font-bold scale-[1.04] z-10'
                                : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 hover:border-slate-300 shadow-2xs'
                            }`}
                          >
                            <span className={`text-[10px] uppercase tracking-wider font-extrabold leading-tight ${isSelected ? 'text-orange-100' : 'text-slate-400'}`}>
                              {item.dayName}
                            </span>
                            <span className={`text-xs font-black tracking-tight mt-0.5 ${isSelected ? 'text-white drop-shadow-xs' : 'text-slate-800'}`}>
                              {item.label}
                            </span>
                            <span className={`text-[10px] font-black mt-0.5 px-2.5 py-0.5 rounded-full ${
                              isSelected 
                                ? 'bg-white/25 text-white shadow-2xs border border-white/30' 
                                : 'text-blue-900 bg-blue-50 font-bold'
                            }`}>
                              {displayFare > 0 ? `₹${displayFare.toLocaleString('en-IN')}` : '--'}
                            </span>

                            {/* Active Bottom Glow Pill */}
                            {isSelected && (
                              <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-5 h-1 bg-amber-300 rounded-full shadow-xs" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* Right Arrow Button */}
                  <button
                    type="button"
                    onClick={() => scrollCalendar('right')}
                    className="w-8 h-12 bg-[#0b3b82] hover:bg-blue-900 text-white flex items-center justify-center shrink-0 cursor-pointer transition"
                    title="Next Dates"
                  >
                    <ChevronRight className="w-5 h-5 font-bold" />
                  </button>
                </div>

                {/* Sub-bar below calendar: Navigation links & Share actions */}
                <div className="bg-slate-50 border-t border-slate-200 px-3 py-1.5 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
                  <div className="flex items-center space-x-2 font-medium">
                    <button
                      type="button"
                      onClick={() => {
                        const idx = availableDatesList.findIndex(d => d.date === onwardDate);
                        if (idx > 0) setOnwardDate(availableDatesList[idx - 1].date);
                      }}
                      className="hover:text-blue-700 cursor-pointer"
                    >
                      « Previous Day
                    </button>
                    <span>|</span>
                    <button
                      type="button"
                      onClick={() => {
                        const idx = availableDatesList.findIndex(d => d.date === onwardDate);
                        if (idx !== -1 && idx < availableDatesList.length - 1) {
                          setOnwardDate(availableDatesList[idx + 1].date);
                        }
                      }}
                      className="hover:text-blue-700 cursor-pointer"
                    >
                      Next Day »
                    </button>
                  </div>

                  <div className="flex items-center space-x-3">
                    {/* Show Incentive Toggle */}
                    <label className="flex items-center space-x-1.5 cursor-pointer text-[11px] font-semibold text-slate-600">
                      <input
                        type="checkbox"
                        checked={showIncentive}
                        onChange={(e) => setShowIncentive(e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span>Show Incentive</span>
                    </label>

                    {/* Share By WhatsApp / Email */}
                    <div className="flex items-center space-x-1 text-[11px]">
                      <span>Share By :-</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (displayedFlights.length > 0) handleShareQuote(displayedFlights[0]);
                        }}
                        className="p-1 text-emerald-600 hover:text-emerald-700 cursor-pointer"
                        title="Share on WhatsApp"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (displayedFlights.length > 0) handleShareQuote(displayedFlights[0]);
                        }}
                        className="p-1 text-rose-600 hover:text-rose-700 cursor-pointer"
                        title="Share by Email"
                      >
                        <Mail className="w-4 h-4" />
                      </button>
                      {copySuccess && (
                        <span className="text-emerald-600 font-bold text-[10px] animate-fade-in">
                          Copied!
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. RESULTS TABLE HEADER (Image 3) */}
              <div className="bg-white border border-slate-200 rounded-t-lg px-4 py-2 flex items-center justify-between text-[11px] font-extrabold text-slate-700 uppercase tracking-wider shadow-2xs">
                <div>SORT BY:</div>
                <div className="hidden sm:grid grid-cols-4 gap-8 text-center text-slate-500 font-bold">
                  <span>DEPARTURE</span>
                  <span>DURATION</span>
                  <span>ARRIVAL</span>
                  <span>PRICE</span>
                </div>
              </div>

              {/* 3. FLIGHT RESULT CARDS LIST (Exact Match: Image 3) */}
              {dailyFlights.length === 0 ? (
                <div className="bg-white rounded-b-lg border border-slate-200 p-8 text-center space-y-4">
                  <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto border border-orange-200 shadow-2xs">
                    {loading ? (
                      <Loader2 className="w-7 h-7 text-orange-600 animate-spin" />
                    ) : (
                      <Plane className="w-7 h-7 text-orange-600 -rotate-45" />
                    )}
                  </div>
                  <div>
                    <p className="font-black text-base text-slate-900">
                      {loading ? 'Connecting to Live Flight Inventory...' : `No Flights Loaded for ${origin} ➔ ${destination}`}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                      {loading 
                        ? 'Fetching the latest guaranteed B2B seats and group rates...' 
                        : 'Click the button below to fetch live B2B group inventory and rates.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => loadPortalData(true)}
                    className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition active:scale-98 inline-flex items-center space-x-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    <span>{loading ? 'Refreshing Rates...' : 'Reload Live Rates Now'}</span>
                  </button>
                </div>
              ) : displayedFlights.length === 0 ? (
                <div className="bg-white rounded-b-lg border border-slate-200 p-8 text-center space-y-4">
                  <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto border border-amber-200 shadow-2xs">
                    <Plane className="w-7 h-7 text-amber-600 -rotate-45" />
                  </div>
                  <div>
                    <p className="font-black text-base text-slate-900">
                      No flights found on {onwardDate || 'this date'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                      Special group fares for {origin} ➔ {destination} are available on alternate dates in the calendar strip above.
                    </p>
                  </div>

                  {nearestAvailableDate && (
                    <div className="inline-flex flex-col sm:flex-row items-center gap-3 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 border border-orange-200/90 p-3.5 rounded-2xl shadow-xs">
                      <div className="text-left text-xs">
                        <span className="font-black text-orange-950 uppercase tracking-wider text-[10px] block">Nearest Departure:</span>
                        <span className="font-black text-orange-600 text-sm">{nearestAvailableDate.label} ({nearestAvailableDate.dayName})</span>
                        <span className="text-slate-600 text-xs ml-2">Fare from <strong className="text-slate-900 font-black">₹{getDisplayPrice(nearestAvailableDate.minFare).toLocaleString('en-IN')}</strong></span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setOnwardDate(nearestAvailableDate.date);
                          centerSelectedDate(nearestAvailableDate.date);
                        }}
                        className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition active:scale-98 shrink-0"
                      >
                        View {nearestAvailableDate.label} Flights →
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {displayedFlights.map(flight => {
                    const price = getDisplayPrice(flight.final_rate);
                    return (
                      <div 
                        key={flight.id} 
                        className="bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all overflow-hidden"
                      >
                        {/* Main Flight Row */}
                        <div className="p-4 sm:p-4.5 grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-center">
                          
                          {/* Col 1: Airline Logo, Name & Flight Number (3.5 Cols) */}
                          <div className="lg:col-span-3 flex items-center space-x-3.5">
                            {renderAirlineIcon(flight.airline_code, flight.airline_name, "w-12 h-12")}
                            <div>
                              <p className="text-sm font-black text-slate-900 leading-tight">
                                {flight.airline_name}
                              </p>
                              <div className="flex items-center space-x-1.5 mt-1">
                                <span className="bg-slate-100 text-slate-800 font-mono text-[11px] font-bold px-2 py-0.5 rounded border border-slate-200">
                                  {flight.flight_number}
                                </span>
                                {flight.aircraft && (
                                  <span className="text-[10px] text-slate-400 font-medium hidden sm:inline-block">
                                    {flight.aircraft}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Col 2: Departure, Flight Path Bar, Arrival (6 Cols) */}
                          <div className="lg:col-span-6 grid grid-cols-3 gap-2 items-center text-center">
                            
                            {/* Departure */}
                            <div className="flex flex-col items-center">
                              <div className="flex items-center space-x-1">
                                <span className="text-xs font-black text-slate-900 uppercase">{flight.origin}</span>
                                {flight.origin_terminal && (
                                  <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-bold border border-slate-200">
                                    {flight.origin_terminal}
                                  </span>
                                )}
                              </div>
                              <span className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight my-0.5">
                                {flight.departure_time}
                              </span>
                              <span className="text-xs font-medium text-slate-600">{flight.origin_city}</span>
                              <span className="text-[10px] text-amber-900 font-bold bg-amber-50 px-1.5 py-0.2 rounded mt-0.5 border border-amber-200/60">
                                {flight.formatted_date}
                              </span>
                            </div>

                            {/* Duration & Non Stop Line */}
                            <div className="flex flex-col items-center px-1">
                              <span className="text-xs font-black text-slate-700 tracking-tight">{flight.duration}</span>
                              <div className="relative w-full flex items-center justify-center my-1.5">
                                <div className="w-full h-0.5 bg-slate-200"></div>
                                <div className="absolute w-6 h-6 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center shadow-2xs">
                                  <Plane className="w-3.5 h-3.5 text-[#0b3b82] transform rotate-45" />
                                </div>
                              </div>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                ● {flight.stops}
                              </span>
                            </div>

                            {/* Arrival */}
                            <div className="flex flex-col items-center">
                              <div className="flex items-center space-x-1">
                                <span className="text-xs font-black text-slate-900 uppercase">{flight.destination}</span>
                                {flight.destination_terminal && (
                                  <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-bold border border-slate-200">
                                    {flight.destination_terminal}
                                  </span>
                                )}
                              </div>
                              <span className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight my-0.5">
                                {flight.arrival_time}
                              </span>
                              <span className="text-xs font-medium text-slate-600">{flight.destination_city}</span>
                              <span className="text-[10px] text-amber-900 font-bold bg-amber-50 px-1.5 py-0.2 rounded mt-0.5 border border-amber-200/60">
                                {flight.formatted_date}
                              </span>
                            </div>

                          </div>

                          {/* Col 3: Price & Book Button (3 Cols) */}
                          <div className="lg:col-span-3 flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 border-t sm:border-t-0 pt-2.5 sm:pt-0 border-slate-100">
                            
                            {/* Price with Radio icon */}
                            <div className="text-left sm:text-right">
                              <div className="flex items-center space-x-1.5 justify-start sm:justify-end">
                                <div className="w-3.5 h-3.5 rounded-full border-2 border-blue-900 flex items-center justify-center shrink-0">
                                  <div className="w-1.5 h-1.5 bg-blue-900 rounded-full"></div>
                                </div>
                                <span className="text-xl sm:text-2xl font-black text-[#0b3b82] tracking-tight">
                                  ₹{price.toLocaleString('en-IN')}
                                </span>
                                <span className="text-[9px] bg-orange-500 text-white font-extrabold px-1.5 py-0.5 rounded uppercase">
                                  TX
                                </span>
                              </div>
                              <p className="text-[10px] font-semibold text-slate-400">Net per pax • Special Fare</p>
                            </div>

                            {/* Book Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenBookingModal(flight)}
                              className="px-6 py-2.5 bg-gradient-to-r from-[#0b3b82] to-blue-900 hover:from-blue-900 hover:to-blue-950 text-white font-black text-xs sm:text-sm rounded-lg shadow-xs hover:shadow-md transition-all flex items-center space-x-1.5 cursor-pointer active:scale-98"
                            >
                              <span>Book Seat</span>
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          </div>

                        </div>

                        {/* Card Bottom Strip (Badges) */}
                        <div className="bg-slate-50 border-t border-slate-200/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                          
                          {/* Badges */}
                          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                            <span className="w-5 h-5 bg-orange-500 text-white font-black text-[10px] rounded flex items-center justify-center">
                              E
                            </span>

                            <span className="text-slate-300">|</span>
                            <span className="font-bold text-slate-800">TravelX Guaranteed</span>

                            <span className="text-slate-300">|</span>
                            <span className="text-slate-700 font-semibold">{flight.is_refundable}</span>

                            <span className="text-slate-300">|</span>
                            <span className="text-slate-700 font-semibold">{flight.meal_type}</span>

                            <span className="text-slate-300">|</span>
                            <span className="text-slate-700 font-semibold">{formatBaggage(flight.baggage)}</span>

                            <span className="text-slate-300">|</span>
                            {/* Share Itinerary */}
                            <label className="flex items-center space-x-1 cursor-pointer text-[11px] font-semibold hover:text-slate-900">
                              <input
                                type="checkbox"
                                onChange={() => handleShareQuote(flight)}
                                className="rounded text-blue-600 cursor-pointer"
                              />
                              <span>Share Itinerary</span>
                            </label>

                            {/* Seats Left Badge (Orange) */}
                            <div className="flex items-center space-x-1 text-orange-700 bg-orange-50 px-2.5 py-0.5 rounded-full font-extrabold text-[11px] border border-orange-200">
                              <Users className="w-3.5 h-3.5" />
                              <span>{flight.seats_left} Seat(s) Left</span>
                            </div>
                          </div>

                          {/* View Flight Details Pill Button */}
                          <button
                            type="button"
                            onClick={() => setDetailFlight(flight)}
                            className="px-3.5 py-1 rounded-full border border-orange-500 text-orange-600 hover:bg-orange-500 hover:text-white font-bold text-xs transition-colors cursor-pointer"
                          >
                            View Flight Details
                          </button>

                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </section>
          </div>
        </main>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 5. VIEW FLIGHT DETAILS MODAL                                   */}
      {/* ───────────────────────────────────────────────────────────── */}
      {detailFlight && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-[#0b3b82] text-white px-5 py-3.5 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Flight Itinerary & Fare Rules</h3>
                <p className="text-xs text-sky-200">{detailFlight.route_label} • {detailFlight.formatted_date}</p>
              </div>
              <button
                type="button"
                onClick={() => setDetailFlight(null)}
                className="p-1 rounded-full hover:bg-white/20 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
              
              {/* Flight Details Block */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {renderAirlineIcon(detailFlight.airline_code, detailFlight.airline_name, "w-12 h-12")}
                    <div>
                      <p className="font-extrabold text-sm text-slate-900">{detailFlight.airline_name}</p>
                      <div className="flex items-center space-x-1.5 mt-0.5">
                        <span className="font-mono font-bold text-xs text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          {detailFlight.flight_number}
                        </span>
                        {detailFlight.aircraft && (
                          <span className="text-[10px] text-slate-500 font-medium">
                            • {detailFlight.aircraft}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] border border-emerald-200">
                    Non-Stop ({detailFlight.duration})
                  </span>
                </div>

                {/* Timings with Terminals */}
                <div className="grid grid-cols-3 gap-2 text-center pt-3 border-t border-slate-200">
                  <div>
                    <div className="flex items-center justify-center space-x-1">
                      <span className="text-[11px] text-slate-700 font-black">{detailFlight.origin}</span>
                      {detailFlight.origin_terminal && (
                        <span className="text-[9px] bg-slate-200 text-slate-700 px-1 rounded font-bold">
                          {detailFlight.origin_terminal}
                        </span>
                      )}
                    </div>
                    <p className="font-black text-lg text-slate-950 my-0.5">{detailFlight.departure_time}</p>
                    <p className="text-slate-600 text-[11px] font-medium">{detailFlight.origin_city}</p>
                  </div>
                  <div className="flex flex-col items-center justify-center px-1">
                    <span className="text-[10px] text-slate-400 font-semibold">Direct Flight</span>
                    <div className="w-full flex items-center justify-center my-1">
                      <div className="w-full h-0.5 bg-slate-300"></div>
                      <Plane className="w-3.5 h-3.5 text-[#0b3b82] mx-1 -rotate-45 shrink-0" />
                      <div className="w-full h-0.5 bg-slate-300"></div>
                    </div>
                    <span className="font-bold text-slate-700 text-xs">{detailFlight.duration}</span>
                  </div>
                  <div>
                    <div className="flex items-center justify-center space-x-1">
                      <span className="text-[11px] text-slate-700 font-black">{detailFlight.destination}</span>
                      {detailFlight.destination_terminal && (
                        <span className="text-[9px] bg-slate-200 text-slate-700 px-1 rounded font-bold">
                          {detailFlight.destination_terminal}
                        </span>
                      )}
                    </div>
                    <p className="font-black text-lg text-slate-950 my-0.5">{detailFlight.arrival_time}</p>
                    <p className="text-slate-600 text-[11px] font-medium">{detailFlight.destination_city}</p>
                  </div>
                </div>
              </div>

              {/* Baggage & In-flight rules */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3">
                  <div className="flex items-center space-x-1.5 font-bold text-amber-900">
                    <Briefcase className="w-4 h-4 text-amber-700" />
                    <span>Baggage Allowance</span>
                  </div>
                  <p className="text-slate-700 mt-1">{formatBaggage(detailFlight.baggage)}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Check-in + 7 Kg Cabin Hand Baggage</p>
                </div>

                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3">
                  <div className="flex items-center space-x-1.5 font-bold text-emerald-900">
                    <Coffee className="w-4 h-4 text-emerald-700" />
                    <span>Meal & Service</span>
                  </div>
                  <p className="text-slate-700 mt-1">{detailFlight.meal_type}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Pre-booked or buy on board</p>
                </div>
              </div>

              {/* Cancellation Policy */}
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-900 space-y-1">
                <div className="flex items-center space-x-1.5 font-bold">
                  <ShieldAlert className="w-4 h-4 text-rose-700" />
                  <span>Fare Rules & Policy</span>
                </div>
                <p className="text-[11px] text-rose-800">
                  • 100% Non-Refundable & Non-Changeable after ticket confirmation.
                </p>
                <p className="text-[11px] text-rose-800">
                  • Name correction strictly subject to airline group policy.
                </p>
              </div>

              {/* Fare Summary */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <div>
                  <span className="text-slate-500">Quoted Rate:</span>
                  <span className="text-lg font-black text-[#0b3b82] ml-2">
                    ₹{getDisplayPrice(detailFlight.final_rate).toLocaleString('en-IN')}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const f = detailFlight;
                    setDetailFlight(null);
                    handleOpenBookingModal(f);
                  }}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#0b3b82] to-blue-900 hover:from-blue-900 hover:to-blue-950 text-white font-black text-xs rounded-lg transition cursor-pointer shadow-md flex items-center space-x-1.5"
                >
                  <span>Book Seat Now</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 5B. BOOKING REQUEST MODAL (Direct to Admin Desk)              */}
      {/* ───────────────────────────────────────────────────────────── */}
      {bookingFlight && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden my-auto animate-in zoom-in-95 duration-150">
            {bookingSuccessResult ? (
              /* Success Celebration State */
              <div className="p-6 text-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ring-8 ${
                  bookingSuccessResult.booking.status === 'AVAILABLE'
                    ? 'bg-emerald-100 text-emerald-600 ring-emerald-50'
                    : bookingSuccessResult.booking.status === 'FARE_REVISED'
                    ? 'bg-indigo-100 text-indigo-600 ring-indigo-50'
                    : bookingSuccessResult.booking.status === 'SOLD_OUT'
                    ? 'bg-rose-100 text-rose-600 ring-rose-50'
                    : 'bg-emerald-100 text-emerald-600 ring-emerald-50'
                }`}>
                  {bookingSuccessResult.booking.status === 'SOLD_OUT' ? (
                    <XCircle className="w-10 h-10 text-rose-600" />
                  ) : bookingSuccessResult.booking.status === 'FARE_REVISED' ? (
                    <AlertCircle className="w-10 h-10 text-indigo-600" />
                  ) : (
                    <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                  )}
                </div>

                <h3 className="text-xl font-black text-slate-900">
                  {bookingSuccessResult.booking.status === 'AVAILABLE'
                    ? '🎉 Seat Available, Update Passport for Issue'
                    : bookingSuccessResult.booking.status === 'FARE_REVISED'
                    ? 'Airline Fare Update Received'
                    : bookingSuccessResult.booking.status === 'SOLD_OUT'
                    ? 'Seats Sold Out for this Flight'
                    : 'Seat Availability Request Dispatched!'}
                </h3>
                <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
                  {bookingSuccessResult.booking.status === 'AVAILABLE'
                    ? 'TravelX Operations Desk has confirmed your seats. Please upload passenger passports below to issue tickets immediately.'
                    : bookingSuccessResult.booking.status === 'FARE_REVISED'
                    ? 'The airline has revised the fare. Please review and proceed if acceptable.'
                    : bookingSuccessResult.booking.status === 'SOLD_OUT'
                    ? 'Unfortunately, seats are full. Please check alternate travel dates.'
                    : 'Your request was delivered live to the TravelX Operations Desk. An executive is checking seat availability now.'}
                </p>

                {/* Reference Card */}
                <div className="bg-blue-50/80 border-2 border-dashed border-blue-300 rounded-xl p-4 my-4">
                  <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Your Booking Reference</span>
                  <div className="flex items-center justify-center space-x-2 mt-1">
                    <span className="text-2xl font-black text-blue-950 font-mono tracking-normal">
                      #{bookingSuccessResult.booking.request_ref}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyRef(bookingSuccessResult.booking.request_ref)}
                      className="p-1.5 hover:bg-blue-100 rounded-lg text-blue-800 transition cursor-pointer"
                      title="Copy Reference Code"
                    >
                      {copiedRef ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  {copiedRef && (
                    <span className="text-[11px] text-emerald-600 font-bold block mt-1">Copied to clipboard!</span>
                  )}
                </div>

                {/* Flight & Amount Summary */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left text-xs space-y-2 mb-5">
                  <div className="flex justify-between pb-2 border-b border-slate-200">
                    <span className="text-slate-500">Flight:</span>
                    <span className="font-bold text-slate-900">
                      {bookingFlight.airline_name} ({bookingFlight.flight_number})
                    </span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-slate-200">
                    <span className="text-slate-500">Sector & Date:</span>
                    <span className="font-bold text-slate-900">
                      {bookingFlight.origin} ➔ {bookingFlight.destination} • {bookingFlight.day_label}, {bookingFlight.formatted_date}
                    </span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-slate-200">
                    <span className="text-slate-500">Passengers:</span>
                    <span className="font-bold text-slate-900">
                      {bookingSuccessResult.booking.pax_count} Pax
                      {(bookingSuccessResult.booking.pax_adults || bookingSuccessResult.booking.pax_children || bookingSuccessResult.booking.pax_infants) ? (
                        <span className="text-slate-500 font-normal ml-1">
                          ({bookingSuccessResult.booking.pax_adults || bookingSuccessResult.booking.pax_count} Adt
                          {bookingSuccessResult.booking.pax_children ? `, ${bookingSuccessResult.booking.pax_children} Chd` : ''}
                          {bookingSuccessResult.booking.pax_infants ? `, ${bookingSuccessResult.booking.pax_infants} Inf` : ''})
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm pt-0.5">
                    <span className="font-extrabold text-slate-700">Total Rate:</span>
                    <div className="text-right">
                      <span className="font-black text-[#0b3b82] block leading-tight">
                        ₹{Number(bookingSuccessResult.booking.total_amount).toLocaleString('en-IN')}
                      </span>
                      {bookingSuccessResult.booking.pax_infants > 0 && (
                        <span className="text-[10px] text-amber-800 font-bold block mt-0.5">
                          {bookingSuccessResult.booking.infant_fare
                            ? `(Includes Infant: ₹${Number(bookingSuccessResult.booking.infant_fare * bookingSuccessResult.booking.pax_infants).toLocaleString('en-IN')})`
                            : `• Infant rate extra, not included in this. For infant rate, please contact TravelX.`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status Notice Card */}
                {bookingSuccessResult.booking.status === 'AVAILABLE' ? (
                  <div className="p-4 bg-emerald-50 border-2 border-emerald-500 rounded-2xl mb-5 text-emerald-950 text-left space-y-1.5 shadow-sm animate-in zoom-in-95">
                    <div className="flex items-center space-x-2 text-xs font-black text-emerald-950">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span>SEAT AVAILABLE — UPDATE PASSPORT FOR ISSUE</span>
                    </div>
                    <p className="text-[11px] text-emerald-900 font-semibold leading-relaxed">
                      Seats are confirmed and held for your agency! Please upload passenger passports below to proceed with ticket issuance.
                    </p>
                  </div>
                ) : bookingSuccessResult.booking.status === 'FARE_REVISED' ? (
                  <div className="p-4 bg-indigo-50 border-2 border-indigo-400 rounded-2xl mb-5 text-indigo-950 text-left space-y-1.5 shadow-sm animate-in zoom-in-95">
                    <div className="flex items-center space-x-2 text-xs font-black text-indigo-950">
                      <AlertCircle className="w-5 h-5 text-indigo-600 shrink-0" />
                      <span>AIRLINE FARE REVISED: ₹{Number(bookingSuccessResult.booking.revised_fare).toLocaleString('en-IN')}/PAX</span>
                    </div>
                    <p className="text-[11px] text-indigo-900 font-medium">
                      {bookingSuccessResult.booking.admin_notes || 'Airline increased basic fare. If acceptable to your passenger, proceed to upload passports.'}
                    </p>
                  </div>
                ) : bookingSuccessResult.booking.status === 'SOLD_OUT' ? (
                  <div className="p-4 bg-rose-50 border-2 border-rose-400 rounded-2xl mb-5 text-rose-950 text-left space-y-1.5 shadow-sm animate-in zoom-in-95">
                    <div className="flex items-center space-x-2 text-xs font-black text-rose-950">
                      <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                      <span>SEATS SOLD OUT FOR THIS DATE</span>
                    </div>
                    <p className="text-[11px] text-rose-900 font-medium">
                      {bookingSuccessResult.booking.admin_notes || 'Seats are no longer available for this flight. Please search alternate dates.'}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2 text-xs font-bold text-amber-900 bg-amber-50 px-3.5 py-2.5 rounded-xl border border-amber-300 mb-5">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>Status: PENDING REVIEW at TravelX Operations Desk</span>
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping ml-1" title="Live Auto-Checking Active" />
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-2">
                  {bookingSuccessResult.booking.status === 'AVAILABLE' ? (
                    <button
                      type="button"
                      onClick={() => {
                        const ref = bookingSuccessResult.booking.request_ref;
                        setBookingFlight(null);
                        setBookingSuccessResult(null);
                        handleFetchTracking(ref);
                      }}
                      className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-black rounded-xl transition flex items-center justify-center space-x-2 cursor-pointer shadow-md animate-pulse active:scale-98"
                    >
                      <Upload className="w-4 h-4" />
                      <span>👉 Update Passport for Issue (Upload Passports)</span>
                    </button>
                  ) : bookingSuccessResult.booking.status === 'FARE_REVISED' ? (
                    <button
                      type="button"
                      onClick={() => {
                        const ref = bookingSuccessResult.booking.request_ref;
                        setBookingFlight(null);
                        setBookingSuccessResult(null);
                        handleFetchTracking(ref);
                      }}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-black rounded-xl transition flex items-center justify-center space-x-2 cursor-pointer shadow-md"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Proceed to Upload Passports (₹{Number(bookingSuccessResult.booking.revised_fare).toLocaleString('en-IN')})</span>
                    </button>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const ref = bookingSuccessResult.booking.request_ref;
                          setBookingFlight(null);
                          setBookingSuccessResult(null);
                          handleFetchTracking(ref);
                        }}
                        className="flex-1 py-2.5 bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold rounded-xl transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
                      >
                        <Search className="w-4 h-4" />
                        <span>Live Track & Upload Passports</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleWhatsAppBookingConfirm(bookingSuccessResult.booking, bookingFlight)}
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>Chat on WhatsApp</span>
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setBookingFlight(null);
                      setBookingSuccessResult(null);
                    }}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              /* Request Form State */
              <div>
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-[#0b3b82] via-[#0f4c9c] to-blue-900 text-white p-5 relative overflow-hidden">
                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-sky-200 shadow-inner">
                        <Plane className="w-5 h-5 -rotate-45" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] uppercase font-black tracking-widest text-sky-300">
                            Seat Available??? • Instant Enquiry
                          </span>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        </div>
                        <h3 className="text-base sm:text-lg font-black leading-tight text-white">
                          {bookingFlight.origin_city} ({bookingFlight.origin}) ➔ {bookingFlight.destination_city} ({bookingFlight.destination})
                        </h3>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBookingFlight(null)}
                      className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
                      title="Close modal"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Flight Summary Strip */}
                <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-3">
                    {renderAirlineIcon(bookingFlight.airline_code, bookingFlight.airline_name, "w-8 h-8")}
                    <div>
                      <div className="font-extrabold text-slate-900">
                        {bookingFlight.airline_name} <span className="font-mono text-slate-600 font-bold">({bookingFlight.flight_number})</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        {bookingFlight.day_label}, {bookingFlight.formatted_date} • {bookingFlight.departure_time} - {bookingFlight.arrival_time}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block font-medium">Per Pax</span>
                    <span className="text-sm font-black text-[#0b3b82]">
                      ₹{getDisplayPrice(bookingFlight.final_rate).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Form Container */}
                <form onSubmit={handleSubmitBooking} className="p-5 space-y-4">
                  {/* Passenger Breakdown Card: Adults, Children, Infants */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                      <div className="flex items-center space-x-1.5">
                        <Users className="w-4 h-4 text-[#0b3b82]" />
                        <label className="text-xs font-black text-slate-900">
                          Passengers ({bookingAdults + bookingChildren + bookingInfants} Pax)
                        </label>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                        {bookingFlight.seats_left} seats available
                      </span>
                    </div>

                    {/* 1. Adults Counter */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-extrabold text-slate-900">Adults</div>
                        <div className="text-[11px] text-slate-500 font-medium">12+ years</div>
                      </div>
                      <div className="flex items-center space-x-2 bg-white border border-slate-300 rounded-lg p-1 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => {
                            const next = Math.max(1, bookingAdults - 1);
                            setBookingAdults(next);
                            const nextInfants = Math.min(bookingInfants, next);
                            if (nextInfants !== bookingInfants) setBookingInfants(nextInfants);
                            setBookingPax(next + bookingChildren + nextInfants);
                          }}
                          className="w-7 h-7 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-7 text-center font-black text-xs sm:text-sm text-slate-900">
                          {bookingAdults}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const next = Math.min(9, bookingAdults + 1);
                            setBookingAdults(next);
                            setBookingPax(next + bookingChildren + bookingInfants);
                          }}
                          className="w-7 h-7 flex items-center justify-center rounded bg-[#0b3b82] hover:bg-blue-900 text-white font-bold transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* 2. Children Counter */}
                    <div className="flex items-center justify-between border-t border-slate-200/60 pt-2.5">
                      <div>
                        <div className="text-xs font-extrabold text-slate-900">Children</div>
                        <div className="text-[11px] text-slate-500 font-medium">2-11 years</div>
                      </div>
                      <div className="flex items-center space-x-2 bg-white border border-slate-300 rounded-lg p-1 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => {
                            const next = Math.max(0, bookingChildren - 1);
                            setBookingChildren(next);
                            setBookingPax(bookingAdults + next + bookingInfants);
                          }}
                          className="w-7 h-7 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-7 text-center font-black text-xs sm:text-sm text-slate-900">
                          {bookingChildren}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const next = Math.min(8, bookingChildren + 1);
                            setBookingChildren(next);
                            setBookingPax(bookingAdults + next + bookingInfants);
                          }}
                          className="w-7 h-7 flex items-center justify-center rounded bg-[#0b3b82] hover:bg-blue-900 text-white font-bold transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* 3. Infants Counter */}
                    <div className="flex items-center justify-between border-t border-slate-200/60 pt-2.5">
                      <div>
                        <div className="text-xs font-extrabold text-slate-900">Infants</div>
                        <div className="text-[11px] text-slate-500 font-medium">Under 2 years (lap infant)</div>
                      </div>
                      <div className="flex items-center space-x-2 bg-white border border-slate-300 rounded-lg p-1 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => {
                            const next = Math.max(0, bookingInfants - 1);
                            setBookingInfants(next);
                            setBookingPax(bookingAdults + bookingChildren + next);
                          }}
                          className="w-7 h-7 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-7 text-center font-black text-xs sm:text-sm text-slate-900">
                          {bookingInfants}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const next = Math.min(bookingAdults, bookingInfants + 1);
                            setBookingInfants(next);
                            setBookingPax(bookingAdults + bookingChildren + next);
                          }}
                          className="w-7 h-7 flex items-center justify-center rounded bg-[#0b3b82] hover:bg-blue-900 text-white font-bold transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Total Fare Breakdown Highlight */}
                  <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-600 font-bold block">
                        Estimated Net Fare:
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {bookingAdults + bookingChildren} {bookingAdults + bookingChildren === 1 ? 'Seat' : 'Seats'} × ₹{getDisplayPrice(bookingFlight.final_rate).toLocaleString('en-IN')}
                        {bookingInfants > 0 && ` (+ ${bookingInfants} Infant)`}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black text-[#0b3b82] block leading-tight">
                        ₹{((bookingAdults + bookingChildren) * getDisplayPrice(bookingFlight.final_rate)).toLocaleString('en-IN')}
                      </span>
                      {bookingInfants > 0 && (
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded mt-0.5 inline-block border border-amber-300">
                          Infant rate not included
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Infant Rate Notice Card */}
                  {bookingInfants > 0 && (
                    <div className="p-3.5 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border border-amber-300/90 rounded-2xl flex items-start space-x-3 text-xs text-amber-950 animate-in fade-in">
                      <div className="w-7 h-7 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                        <AlertCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-black text-amber-950 text-xs leading-tight">
                          Infant rate extra, not included in this.
                        </p>
                        <p className="text-[11px] text-amber-800 font-bold mt-0.5">
                          For infant rate, please contact TravelX.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Agency Details: Shown only for first-time agents without a saved profile */}
                  {(!agentProfile || !agentProfile.agencyName) && (
                    /* First Time Agent: 10-SECOND SETUP */
                    <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                      <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800">
                        <Smartphone className="w-4 h-4 text-[#0b3b82]" />
                        <span>Agency Details (One-Time Setup)</span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Enter once — we remember your agency for instant 1-click booking on your next visit!
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                        {/* Mobile */}
                        <div className="sm:col-span-1">
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Mobile Number *
                          </label>
                          <div className="relative">
                            <input
                              type="tel"
                              required
                              maxLength={10}
                              placeholder="10-digit mobile"
                              value={bookingForm.mobile}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '');
                                setBookingForm({ ...bookingForm, mobile: val });
                                if (val.length === 10) {
                                  handleMobileLookup(val);
                                }
                              }}
                              className="w-full pl-3 pr-8 py-2 bg-white rounded-lg border border-slate-300 text-xs font-bold text-slate-900 outline-none focus:border-blue-900 focus:ring-1 focus:ring-blue-900 font-mono"
                            />
                            {lookupLoading && (
                              <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin absolute right-2.5 top-2.5" />
                            )}
                          </div>
                        </div>

                        {/* Agency Name */}
                        <div className="sm:col-span-1">
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Agency Name *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Enter your Agency Name"
                            value={bookingForm.agencyName}
                            onChange={(e) => setBookingForm({ ...bookingForm, agencyName: e.target.value })}
                            className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-xs font-bold text-slate-900 outline-none focus:border-blue-900 focus:ring-1 focus:ring-blue-900"
                          />
                        </div>

                        {/* Contact Person */}
                        <div className="sm:col-span-1">
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Contact Person (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="Your Name (Optional)"
                            value={bookingForm.agentName}
                            onChange={(e) => setBookingForm({ ...bookingForm, agentName: e.target.value })}
                            className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-xs font-medium text-slate-900 outline-none focus:border-blue-900 focus:ring-1 focus:ring-blue-900"
                          />
                        </div>

                        {/* City */}
                        <div className="sm:col-span-1">
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            City (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="Enter City (Optional)"
                            value={bookingForm.city}
                            onChange={(e) => setBookingForm({ ...bookingForm, city: e.target.value })}
                            className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-xs font-medium text-slate-900 outline-none focus:border-blue-900 focus:ring-1 focus:ring-blue-900"
                          />
                        </div>

                        {/* Office Address */}
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Office / Shop Address (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="Shop/Office No., Building, Market / Street"
                            value={bookingForm.address}
                            onChange={(e) => setBookingForm({ ...bookingForm, address: e.target.value })}
                            className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-xs text-slate-900 outline-none focus:border-blue-900 focus:ring-1 focus:ring-blue-900"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Remarks / Passenger Names (Optional) */}
                  <div className="text-xs">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Remarks / Pax Names (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 2 adults, 1 child, passenger names: Mr Rajesh Kumar, urgent"
                      value={bookingForm.remarks}
                      onChange={(e) => setBookingForm({ ...bookingForm, remarks: e.target.value })}
                      className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-xs text-slate-900 outline-none focus:border-blue-900 focus:ring-1 focus:ring-blue-900"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setBookingFlight(null)}
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={isSubmittingBooking}
                      className="flex-1 py-2.5 bg-gradient-to-r from-[#0b3b82] to-blue-900 hover:from-blue-900 hover:to-blue-950 disabled:opacity-50 text-white text-xs sm:text-sm font-black rounded-xl shadow-md transition cursor-pointer flex items-center justify-center space-x-1.5 active:scale-98"
                    >
                      {isSubmittingBooking ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Checking with Desk...</span>
                        </>
                      ) : (
                        <>
                          <span>
                            ⚡ Seat Available??? • ₹{((bookingAdults + bookingChildren) * getDisplayPrice(bookingFlight.final_rate)).toLocaleString('en-IN')}
                            {bookingInfants > 0 ? ` (+ ${bookingInfants} Inf)` : ''}
                          </span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 5C. B2B AGENT PROFILE & ADDRESS MODAL                         */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden my-auto animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#0b3b82] to-blue-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-sky-200" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base leading-tight">Agency Profile & Address</h3>
                  <p className="text-[11px] text-sky-200 mt-0.5">Complete business details for 1-click booking</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="p-1.5 rounded-full hover:bg-white/20 transition cursor-pointer text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="p-5 space-y-4 text-xs">
              <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3 text-[11px] text-blue-900 leading-relaxed">
                ℹ️ Your agency profile is stored on this browser for automatic 1-click booking without re-entering details.
              </div>

              {/* Section 1: Agency & Contact */}
              <div className="space-y-2.5">
                <span className="text-[11px] font-black text-slate-900 uppercase tracking-wider block">
                  1. Agency & Contact Info
                </span>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Agency Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter your Agency Name"
                    value={bookingForm.agencyName || agentProfile?.agencyName || ''}
                    onChange={(e) => setBookingForm({ ...bookingForm, agencyName: e.target.value })}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-bold text-slate-900 outline-none focus:border-blue-900 focus:ring-1 focus:ring-blue-900 text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Mobile Number *</label>
                    <div className="relative">
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        placeholder="10-digit mobile"
                        value={bookingForm.mobile || agentProfile?.mobile || ''}
                        onChange={(e) => {
                          const clean = e.target.value.replace(/\D/g, '');
                          setBookingForm({ ...bookingForm, mobile: clean });
                          if (clean.length === 10) handleMobileLookup(clean);
                        }}
                        className="w-full pl-3 pr-8 py-2 bg-white rounded-lg border border-slate-300 font-mono font-bold text-slate-900 outline-none focus:border-blue-900 focus:ring-1 focus:ring-blue-900 text-xs"
                      />
                      {lookupLoading && (
                        <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin absolute right-2.5 top-2.5" />
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Contact Person (Optional)</label>
                    <input
                      type="text"
                      placeholder="Your Name (Optional)"
                      value={bookingForm.agentName || agentProfile?.agentName || ''}
                      onChange={(e) => setBookingForm({ ...bookingForm, agentName: e.target.value })}
                      className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-medium text-slate-900 outline-none focus:border-blue-900 focus:ring-1 focus:ring-blue-900 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Email ID (Optional)</label>
                  <input
                    type="email"
                    placeholder="e.g. agency@yourcompany.com"
                    value={bookingForm.email || agentProfile?.email || ''}
                    onChange={(e) => setBookingForm({ ...bookingForm, email: e.target.value })}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-medium text-slate-900 outline-none focus:border-blue-900 focus:ring-1 focus:ring-blue-900 text-xs"
                  />
                </div>
              </div>

              {/* Section 2: Complete Address Details (Proper Address Options) */}
              <div className="space-y-2.5 pt-2 border-t border-slate-200">
                <div className="flex items-center space-x-1 text-[11px] font-black text-slate-900 uppercase tracking-wider">
                  <MapPin className="w-3.5 h-3.5 text-orange-600" />
                  <span>2. Registered Office Address</span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Office / Shop Address (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Shop/Office No., Floor, Complex/Market, Street"
                    value={bookingForm.address || agentProfile?.address || ''}
                    onChange={(e) => setBookingForm({ ...bookingForm, address: e.target.value })}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-slate-900 outline-none focus:border-blue-900 focus:ring-1 focus:ring-blue-900 text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">City (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Amritsar"
                      value={bookingForm.city || agentProfile?.city || ''}
                      onChange={(e) => setBookingForm({ ...bookingForm, city: e.target.value })}
                      className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-medium text-slate-900 outline-none focus:border-blue-900 focus:ring-1 focus:ring-blue-900 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">State (Optional)</label>
                    <select
                      value={bookingForm.state || agentProfile?.state || 'Punjab'}
                      onChange={(e) => setBookingForm({ ...bookingForm, state: e.target.value })}
                      className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-medium text-slate-900 outline-none focus:border-blue-900 focus:ring-1 focus:ring-blue-900 text-xs cursor-pointer"
                    >
                      {INDIAN_STATES.map(st => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Pincode (Optional)</label>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="e.g. 143001"
                      value={bookingForm.pincode || agentProfile?.pincode || ''}
                      onChange={(e) => setBookingForm({ ...bookingForm, pincode: e.target.value.replace(/\D/g, '') })}
                      className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-mono text-slate-900 outline-none focus:border-blue-900 focus:ring-1 focus:ring-blue-900 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Agency Logo & Branding */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex items-center space-x-1.5 text-[11px] font-black text-slate-900 uppercase tracking-wider">
                  <ImageIcon className="w-3.5 h-3.5 text-blue-800" />
                  <span>3. Agency Logo (White-Label Interface)</span>
                </div>
                
                {profileLogoData ? (
                  <div className="flex items-center space-x-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <img
                      src={profileLogoData}
                      alt="Agency Logo"
                      className="h-10 w-auto max-w-[120px] object-contain rounded bg-white p-1 border border-slate-300"
                    />
                    <div className="flex-1">
                      <p className="font-bold text-slate-800 text-[11px]">Logo Active</p>
                      <p className="text-[10px] text-slate-500">Appears on header & quotations</p>
                    </div>
                    <div className="flex items-center space-x-1">
                      <label className="p-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer font-bold text-[10px] transition" title="Change Logo">
                        Change
                        <input type="file" accept="image/*" className="hidden" onChange={handleModalLogoChange} />
                      </label>
                      <button
                        type="button"
                        onClick={() => setProfileLogoData(null)}
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        title="Remove Logo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="flex items-center justify-center space-x-2 py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 rounded-xl cursor-pointer transition text-blue-900 text-xs font-bold">
                      <Camera className="w-4 h-4 text-blue-700" />
                      <span>Upload Agency Logo (PNG, JPG, WebP)</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleModalLogoChange}
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Section 4: Security PIN / Password */}
              <div className="space-y-1.5 pt-2 border-t border-slate-200">
                <div className="flex items-center space-x-1.5 text-[11px] font-black text-slate-900 uppercase tracking-wider">
                  <KeyRound className="w-3.5 h-3.5 text-blue-800" />
                  <span>4. Change Security PIN / Password (Optional)</span>
                </div>
                <input
                  type="password"
                  placeholder="Leave empty to keep current PIN, or enter 4+ digit new PIN"
                  value={profilePassword}
                  onChange={(e) => setProfilePassword(e.target.value)}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-mono text-slate-900 outline-none focus:border-blue-900 focus:ring-1 focus:ring-blue-900 text-xs"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 space-y-2 border-t border-slate-100">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-gradient-to-r from-[#0b3b82] to-blue-900 hover:from-blue-900 hover:to-blue-950 text-white font-black text-xs sm:text-sm rounded-xl transition cursor-pointer shadow-md flex items-center justify-center space-x-1.5 active:scale-98"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Agency Profile & Branding</span>
                </button>

                {agentProfile && (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition cursor-pointer border border-rose-200 flex items-center justify-center space-x-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Logout / Switch Agency Account</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 6B. LIVE BOOKING TRACKER & E-TICKET MODAL                      */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showTrackerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[92vh] flex flex-col">
            {/* Tracker Header */}
            <div className="bg-[#0b3b82] text-white p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-white/10 text-white">
                  <Search className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-sm sm:text-base leading-tight">
                      Live Booking Tracker & E-Ticket
                    </h3>
                    {trackedBooking && !['CONFIRMED', 'CANCELLED', 'SOLD_OUT'].includes(trackedBooking.status) && (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span>Live Sync 5s</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-sky-200">
                    Track status, upload passenger passports, and download issued tickets
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowTrackerModal(false);
                  setTrackError(null);
                }}
                className="text-white/70 hover:text-white p-1.5 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
              
              {/* Reference Search Bar */}
              <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={trackInputRef}
                    onChange={(e) => setTrackInputRef(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleFetchTracking(trackInputRef)}
                    placeholder="Enter Booking Reference (e.g. TX-NT5Y)"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 text-sm outline-none focus:border-blue-900 focus:bg-white"
                  />
                </div>
                <button
                  type="button"
                  disabled={trackLoading || !trackInputRef.trim()}
                  onClick={() => handleFetchTracking(trackInputRef)}
                  className="px-5 py-2.5 bg-blue-900 hover:bg-blue-950 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center space-x-1.5 shrink-0 shadow-xs"
                >
                  {trackLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>Track</span>
                </button>
              </div>

              {/* Error State */}
              {trackError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{trackError}</span>
                </div>
              )}

              {/* When Booking Loaded */}
              {trackedBooking && (
                <div className="space-y-4">
                  {/* Top Reference & Status Card */}
                  <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-2xl p-4 sm:p-5 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-sky-200 font-bold block">
                          Booking Reference
                        </span>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <span className="text-xl sm:text-2xl font-black font-mono tracking-normal text-white">
                            #{trackedBooking.request_ref}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(trackedBooking.request_ref);
                              setCopiedRef(true);
                              setTimeout(() => setCopiedRef(false), 2000);
                            }}
                            className="p-1 hover:bg-white/10 rounded text-sky-200 transition cursor-pointer"
                            title="Copy Reference"
                          >
                            {copiedRef ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div>
                        {trackedBooking.status === 'PENDING' && (
                          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-400 text-slate-950 shadow-sm">
                            <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping mr-0.5" />
                            <span>PENDING REVIEW</span>
                          </span>
                        )}
                        {trackedBooking.status === 'AVAILABLE' && (
                          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-400 text-slate-950 shadow-sm">
                            <CheckCircle2 className="w-4 h-4 text-slate-950" />
                            <span>SEATS AVAILABLE</span>
                          </span>
                        )}
                        {trackedBooking.status === 'FARE_REVISED' && (
                          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-black bg-purple-300 text-slate-950 shadow-sm">
                            <AlertCircle className="w-4 h-4 text-slate-950" />
                            <span>FARE REVISED: ₹{Number(trackedBooking.revised_fare).toLocaleString('en-IN')}</span>
                          </span>
                        )}
                        {trackedBooking.status === 'FARE_ACCEPTED' && (
                          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-300 text-slate-950 shadow-sm">
                            <CheckCircle2 className="w-4 h-4 text-slate-950" />
                            <span>REVISED FARE ACCEPTED</span>
                          </span>
                        )}
                        {trackedBooking.status === 'FARE_DECLINED' && (
                          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-400 text-slate-950 shadow-sm">
                            <XCircle className="w-4 h-4 text-slate-950" />
                            <span>FARE DECLINED / CANCELLED</span>
                          </span>
                        )}
                        {trackedBooking.status === 'CANCELLED' && (
                          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-black bg-slate-300 text-slate-950 shadow-sm">
                            <XCircle className="w-4 h-4 text-slate-950" />
                            <span>CANCELLED</span>
                          </span>
                        )}
                        {trackedBooking.status === 'SOLD_OUT' && (
                          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-400 text-slate-950 shadow-sm">
                            <XCircle className="w-4 h-4 text-slate-950" />
                            <span>SOLD OUT</span>
                          </span>
                        )}
                        {['DOCS_SUBMITTED', 'TICKET_PROCESSING'].includes(trackedBooking.status) && (
                          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-black bg-sky-300 text-slate-950 shadow-sm animate-pulse">
                            <Loader2 className="w-4 h-4 text-slate-950 animate-spin" />
                            <span>TICKET UNDER ISSUANCE / IN PROCESS</span>
                          </span>
                        )}
                        {trackedBooking.status === 'CONFIRMED' && (
                          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-300 text-slate-950 shadow-sm">
                            <CheckCircle2 className="w-4 h-4 text-slate-950" />
                            <span>TICKET ISSUED</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Sector & Passenger Quick Info */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 text-xs">
                      <div>
                        <span className="text-sky-200 text-[10px] block">Sector</span>
                        <span className="font-black text-white">{trackedBooking.origin} ➔ {trackedBooking.destination}</span>
                      </div>
                      <div>
                        <span className="text-sky-200 text-[10px] block">Travel Date</span>
                        <span className="font-black text-white">{trackedBooking.travel_date}</span>
                      </div>
                      <div>
                        <span className="text-sky-200 text-[10px] block">Flight</span>
                        <span className="font-black text-white">{trackedBooking.airline_name || trackedBooking.airline_code} {trackedBooking.flight_number}</span>
                      </div>
                      <div>
                        <span className="text-sky-200 text-[10px] block">Total Amount</span>
                        <span className="font-black text-white">
                          ₹{Number(trackedBooking.total_amount || (trackedBooking.quoted_rate * trackedBooking.pax_count)).toLocaleString('en-IN')}
                        </span>
                        {trackedBooking.pax_infants > 0 && (
                          <span className="text-[9px] text-amber-200 block font-semibold">
                            {trackedBooking.infant_fare
                              ? `(Includes Inf: ₹${Number(trackedBooking.infant_fare * trackedBooking.pax_infants).toLocaleString('en-IN')})`
                              : `• Infant rate extra (Contact TravelX)`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Admin Note if any */}
                  {trackedBooking.admin_notes && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950">
                      <span className="font-bold block mb-0.5">TravelX Operations Desk Note:</span>
                      <p className="italic">{trackedBooking.admin_notes}</p>
                    </div>
                  )}

                  {/* ───────────────────────────────────────────────────────── */}
                  {/* PROMINENT FARE REVISED DECISION CARD                      */}
                  {/* ───────────────────────────────────────────────────────── */}
                  {(trackedBooking.status === 'FARE_REVISED' || (trackedBooking.status === 'FARE_ACCEPTED' && isFareAccepted)) && (
                    <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/15 to-amber-500/10 border-2 border-amber-400 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
                      {/* Alert Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shrink-0 shadow-md">
                            <AlertCircle className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                              ⚠️ Sorry, Airline Fare Changed!
                            </h3>
                            <p className="text-xs text-slate-600 font-medium mt-0.5">
                              The airline / group inventory desk has updated the seat rate for this flight.
                            </p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-500 text-white shrink-0 shadow-2xs uppercase tracking-wider">
                          Action Required
                        </span>
                      </div>

                      {/* Side-by-Side Rates Comparison */}
                      <div className="bg-white rounded-xl p-3 border border-amber-200/90 shadow-2xs grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-center text-center">
                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block leading-tight">Previous Quoted</span>
                          <span className="text-base font-bold text-slate-400 line-through">
                            ₹{Number(trackedBooking.quoted_rate).toLocaleString('en-IN')}/pax
                          </span>
                        </div>

                        <div className="p-2.5 bg-gradient-to-b from-amber-50 to-orange-50 rounded-xl border-2 border-amber-400 ring-2 ring-amber-400/20 shadow-xs">
                          <span className="text-[10px] font-black text-amber-800 uppercase block leading-tight">New Revised Rate</span>
                          <span className="text-xl font-black text-orange-600">
                            ₹{Number(trackedBooking.revised_fare).toLocaleString('en-IN')}<span className="text-xs font-bold text-slate-600">/pax</span>
                          </span>
                        </div>

                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                          <span className="text-[10px] font-bold text-slate-500 uppercase block leading-tight">Updated Total ({trackedBooking.pax_count} Pax)</span>
                          <span className="text-lg font-black text-slate-900">
                            ₹{Number(trackedBooking.total_amount || (trackedBooking.revised_fare * trackedBooking.pax_count)).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>

                      {/* Decision Question & Action Buttons */}
                      <div className="pt-2 border-t border-amber-200/70 space-y-2.5">
                        <p className="text-xs font-black text-slate-800">
                          Do you want to continue booking with this new revised rate?
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {/* YES BUTTON */}
                          <button
                            type="button"
                            disabled={fareResponding}
                            onClick={handleAcceptRevisedFare}
                            className={`py-3 px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-md active:scale-98 ${
                              isFareAccepted
                                ? 'bg-emerald-600 text-white ring-2 ring-emerald-400 shadow-emerald-600/30'
                                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-600/25'
                            }`}
                          >
                            {fareResponding ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4" />
                            )}
                            <span>{isFareAccepted ? '✓ Revised Fare Accepted' : `Yes, Continue with ₹${Number(trackedBooking.revised_fare).toLocaleString('en-IN')}`}</span>
                          </button>

                          {/* NO BUTTON */}
                          <button
                            type="button"
                            disabled={fareResponding}
                            onClick={handleDeclineAndNewSearch}
                            className="py-3 px-4 rounded-xl font-black text-xs sm:text-sm bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 hover:border-slate-400 flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-xs active:scale-98"
                          >
                            <Search className="w-4 h-4 text-orange-600" />
                            <span>No, Cancel & Search Again</span>
                          </button>
                        </div>

                        {isFareAccepted && (
                          <div className="p-2.5 bg-emerald-100 border border-emerald-300 rounded-xl text-xs text-emerald-900 font-bold flex items-center space-x-2 animate-in fade-in duration-200">
                            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                            <span>New fare accepted! Please proceed to Step 3 below to upload passenger passports.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 4-Step Interactive Lifecycle Card */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      Booking Progress Timeline
                    </h4>

                    {/* Step 1: Inquiry */}
                    <div className="flex items-start space-x-3">
                      <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 text-xs font-bold shadow-xs">
                        <Check className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-slate-900">1. Seat Availability Request Submitted</p>
                        <p className="text-[11px] text-slate-500">
                          Received for {trackedBooking.pax_count} Pax ({trackedBooking.pax_adults || trackedBooking.pax_count} Adt{trackedBooking.pax_children ? `, ${trackedBooking.pax_children} Chd` : ''}{trackedBooking.pax_infants ? `, ${trackedBooking.pax_infants} Inf` : ''}) • {trackedBooking.baggage || '30+7 KG'}.
                        </p>
                      </div>
                    </div>

                    {/* Step 2: Verification */}
                    <div className="flex items-start space-x-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold shadow-xs ${
                        trackedBooking.status === 'PENDING'
                          ? 'bg-amber-500 text-white animate-pulse'
                          : trackedBooking.status === 'SOLD_OUT'
                          ? 'bg-rose-600 text-white'
                          : 'bg-emerald-600 text-white'
                      }`}>
                        {trackedBooking.status === 'PENDING' ? <Clock className="w-4 h-4" /> : trackedBooking.status === 'SOLD_OUT' ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-slate-900">2. Seat Availability & Fare Verification</p>
                        {trackedBooking.status === 'PENDING' && (
                          <p className="text-[11px] text-amber-700 font-medium">
                            Operations desk is checking real-time availability with the airline. Refresh in 1-2 minutes.
                          </p>
                        )}
                        {trackedBooking.status === 'AVAILABLE' && (
                          <div className="space-y-0.5">
                            <p className="text-[11px] text-emerald-700 font-bold">
                              Seats Confirmed Available at ₹{Number(trackedBooking.quoted_rate).toLocaleString('en-IN')}/pax! Upload passenger passports below to issue tickets.
                            </p>
                            {trackedBooking.pax_infants > 0 && (
                              <p className="text-[11px] text-emerald-800 font-semibold">
                                {trackedBooking.infant_fare
                                  ? `• Airline Infant Fare: ₹${Number(trackedBooking.infant_fare).toLocaleString('en-IN')} x ${trackedBooking.pax_infants} (Total: ₹${Number(trackedBooking.total_amount).toLocaleString('en-IN')})`
                                  : `• Infant rate extra, not included in this. For infant rate, please contact TravelX.`}
                              </p>
                            )}
                          </div>
                        )}
                        {trackedBooking.status === 'FARE_REVISED' && (
                          <div className="space-y-0.5">
                            <p className="text-[11px] text-indigo-700 font-bold">
                              Airline Fare Update: Revised rate is ₹{Number(trackedBooking.revised_fare).toLocaleString('en-IN')}/pax (Quoted was ₹{Number(trackedBooking.quoted_rate).toLocaleString('en-IN')}). If acceptable, proceed to upload passports.
                            </p>
                            {trackedBooking.pax_infants > 0 && (
                              <p className="text-[11px] text-indigo-800 font-semibold">
                                {trackedBooking.infant_fare
                                  ? `• Airline Infant Fare: ₹${Number(trackedBooking.infant_fare).toLocaleString('en-IN')} x ${trackedBooking.pax_infants} (Total: ₹${Number(trackedBooking.total_amount).toLocaleString('en-IN')})`
                                  : `• Infant rate extra, not included in this. For infant rate, please contact TravelX.`}
                              </p>
                            )}
                          </div>
                        )}
                        {trackedBooking.status === 'SOLD_OUT' && (
                          <p className="text-[11px] text-rose-700 font-bold">
                            Seats are Sold Out for this date. Please check alternate travel dates.
                          </p>
                        )}
                        {!['PENDING', 'AVAILABLE', 'FARE_REVISED', 'SOLD_OUT'].includes(trackedBooking.status) && (
                          <p className="text-[11px] text-emerald-700">
                            Seats confirmed and verified.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Step 3: Passport Upload Section */}
                    <div className="flex items-start space-x-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold shadow-xs ${
                        trackedBooking.has_passports || trackedBooking.status === 'DOCS_SUBMITTED' || trackedBooking.status === 'TICKET_PROCESSING' || trackedBooking.status === 'CONFIRMED'
                          ? 'bg-emerald-600 text-white'
                          : ['AVAILABLE', 'FARE_REVISED', 'FARE_ACCEPTED'].includes(trackedBooking.status)
                          ? 'bg-blue-600 text-white animate-bounce'
                          : 'bg-slate-300 text-slate-600'
                      }`}>
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <p className="text-xs font-bold text-slate-900">3. Passenger Passports Submission</p>

                        {/* List previously uploaded passports */}
                        {trackedBooking.passports && trackedBooking.passports.length > 0 && (
                          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 text-xs">
                            <div className="flex items-center space-x-1.5 text-emerald-900 font-bold">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span>{trackedBooking.passports.length} Passport(s) Received</span>
                            </div>
                            <div className="text-[11px] text-emerald-800 space-y-0.5 pl-5">
                              {trackedBooking.passports.map((p, i) => (
                                <p key={i} className="truncate">• {p.originalName} ({p.size ? `${(p.size / 1024).toFixed(1)} KB` : ''})</p>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* If Fare Revised and not yet accepted, pause passport upload with helpful prompt */}
                        {trackedBooking.status === 'FARE_REVISED' && !isFareAccepted && (
                          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center space-x-2 font-medium">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Passport submission will unlock once you accept the revised fare above.</span>
                          </div>
                        )}

                        {/* Upload Dropzone (Auto-uploads immediately upon selection, No submit button needed) */}
                        {((trackedBooking.status === 'AVAILABLE') || (trackedBooking.status === 'FARE_REVISED' && isFareAccepted) || (trackedBooking.status === 'FARE_ACCEPTED') || (trackedBooking.status === 'DOCS_SUBMITTED') || (trackedBooking.status === 'TICKET_PROCESSING')) && (
                          <div className="space-y-2 pt-1">
                            <div className={`border-2 border-dashed rounded-xl p-4 bg-white text-center transition ${
                              passportUploading 
                                ? 'border-blue-400 bg-blue-50/50 cursor-wait' 
                                : 'border-slate-300 hover:border-blue-500 cursor-pointer'
                            }`}>
                              <input
                                type="file"
                                id="agent-passport-input"
                                multiple
                                disabled={passportUploading}
                                accept=".pdf,.jpg,.jpeg,.png"
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files && e.target.files.length > 0) {
                                    handleAutoUploadPassports(e.target.files);
                                  }
                                }}
                              />
                              <label 
                                htmlFor="agent-passport-input" 
                                className={`block space-y-1.5 ${passportUploading ? 'cursor-wait pointer-events-none' : 'cursor-pointer'}`}
                              >
                                {passportUploading ? (
                                  <div className="py-2 space-y-2">
                                    <Loader2 className="w-7 h-7 text-blue-900 animate-spin mx-auto" />
                                    <p className="text-xs font-black text-blue-950">
                                      Uploading passport(s) & updating booking...
                                    </p>
                                    <p className="text-[10px] text-slate-500 font-medium">
                                      Please wait while files are being securely submitted to operations
                                    </p>
                                  </div>
                                ) : (
                                  <>
                                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center mx-auto">
                                      <Upload className="w-5 h-5" />
                                    </div>
                                    <p className="text-xs font-black text-slate-800">
                                      {trackedBooking.passports && trackedBooking.passports.length > 0
                                        ? 'Click to add more Passenger Passport copies (Images or PDF)'
                                        : 'Click to select Passenger Passport copies (Images or PDF)'}
                                    </p>
                                    <p className="text-[10px] text-blue-700 font-bold">
                                      ⚡ Auto-uploads instantly upon selection • Select up to 10 pages (max 15MB each)
                                    </p>
                                  </>
                                )}
                              </label>
                            </div>
                          </div>
                        )}

                        {passportUploadSuccess && (
                          <p className="text-xs font-bold text-emerald-700">
                            ✅ Passports uploaded successfully! TravelX Operations Desk has been notified to issue your ticket.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Step 4: E-Ticket Issuance & Download */}
                    <div className="flex items-start space-x-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold shadow-xs ${
                        trackedBooking.has_ticket || trackedBooking.status === 'CONFIRMED'
                          ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                          : ['DOCS_SUBMITTED', 'TICKET_PROCESSING'].includes(trackedBooking.status)
                          ? 'bg-sky-500 text-white ring-4 ring-sky-100 animate-pulse'
                          : 'bg-slate-300 text-slate-600'
                      }`}>
                        {['DOCS_SUBMITTED', 'TICKET_PROCESSING'].includes(trackedBooking.status) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ticket className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 space-y-2">
                        <p className="text-xs font-bold text-slate-900">4. Official E-Ticket & Confirmation</p>

                        {trackedBooking.has_ticket || trackedBooking.status === 'CONFIRMED' ? (
                          <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <p className="text-xs font-black text-emerald-950 flex items-center space-x-1.5">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                                  <span>Ticket Issued & Confirmed!</span>
                                </p>
                                {trackedBooking.pnr_code && (
                                  <p className="text-xs font-mono font-bold text-emerald-900 mt-0.5">
                                    Airline PNR: <span className="bg-emerald-200/80 px-2 py-0.5 rounded text-emerald-950 font-black">{trackedBooking.pnr_code}</span>
                                  </p>
                                )}
                              </div>

                              {/* Download E-Ticket Button */}
                              {trackedBooking.ticket_download_url && (
                                <a
                                  href={trackedBooking.ticket_download_url}
                                  download
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition flex items-center justify-center space-x-2 shadow-md cursor-pointer active:scale-98"
                                >
                                  <Download className="w-4 h-4" />
                                  <span>Download Official E-Ticket (PDF)</span>
                                </a>
                              )}
                            </div>

                            <p className="text-[11px] text-emerald-800">
                              The ticket PDF contains official airline barcode and passenger details. You can print or WhatsApp directly to your passenger!
                            </p>
                          </div>
                        ) : ['DOCS_SUBMITTED', 'TICKET_PROCESSING'].includes(trackedBooking.status) ? (
                          <div className="p-4 bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 border-2 border-sky-200 rounded-2xl space-y-3">
                            <div className="flex items-center space-x-2">
                              <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center">
                                <Loader2 className="w-5 h-5 text-sky-600 animate-spin" />
                              </div>
                              <div>
                                <p className="text-xs font-black text-sky-950">Ticket Under Process & Issuance</p>
                                <p className="text-[10px] text-sky-700 font-semibold">
                                  {trackedBooking.status === 'TICKET_PROCESSING'
                                    ? 'Operations desk is actively preparing your official airline e-ticket'
                                    : 'Passports received • Operations desk is processing your booking with the airline'}
                                </p>
                              </div>
                            </div>
                            <div className="space-y-2 pl-2">
                              <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span className="text-[11px] text-slate-700 font-medium">Passenger passports received & verified</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span className="text-[11px] text-slate-700 font-medium">Seat availability confirmed & special fare locked</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                                <span className="text-[11px] text-sky-900 font-bold">Airline PNR issuance & ticket dispatch in progress...</span>
                              </div>
                              <div className="flex items-center space-x-2 opacity-40">
                                <div className="w-2 h-2 rounded-full bg-slate-300" />
                                <span className="text-[11px] text-slate-500">Official E-Ticket PDF ready for download</span>
                              </div>
                            </div>
                            <div className="h-2 bg-sky-100 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 rounded-full animate-pulse" style={{ width: '75%' }} />
                            </div>
                            <p className="text-[10px] text-sky-700 font-bold text-center">
                              ⏳ Status: Under Issuance • Expected time: 5-15 mins • Live auto-sync active
                            </p>
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-500">
                            Ticket will be uploaded here as soon as passports are verified by the operations desk.
                          </p>
                        )}
                      </div>
                    </div>

                  </div>

                  {/* Quick WhatsApp Support for this Booking */}
                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => openAgencyWhatsApp(`Hi TravelX, regarding booking #${trackedBooking.request_ref} (${trackedBooking.origin} to ${trackedBooking.destination} on ${trackedBooking.travel_date}): please assist.`)}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <MessageSquare className="w-4 h-4 text-emerald-600" />
                      <span>Chat with Operations Desk regarding #{trackedBooking.request_ref}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFetchTracking(trackedBooking.request_ref)}
                      className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center justify-center space-x-1 cursor-pointer"
                      title="Refresh Status"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                      <span>Refresh Status</span>
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
      </>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 7. FOOTER                                                     */}
      {/* ───────────────────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-slate-200 text-slate-500 text-xs py-5 mt-auto">
        <div className="max-w-[1700px] mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div>
            <span className="font-extrabold text-slate-900 font-sans">TravelX</span>
            <span className="mx-2">•</span>
            <span>B2B Fixed Departure Special Air Fares Engine</span>
          </div>

          <div className="flex items-center space-x-4 text-[11px]">
            <span>Rates verified live</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
