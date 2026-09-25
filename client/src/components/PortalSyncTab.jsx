import React, { useState } from 'react';
import { 
  Globe, ExternalLink, Copy, Check, Sparkles, Zap, ShieldCheck, 
  ArrowRight, AlertCircle, RefreshCw, Trash2, CheckCircle2, ChevronRight
} from 'lucide-react';
import { api } from '../utils/api';

export default function PortalSyncTab({ 
  vendor, 
  vendorFares = [], 
  onFaresUpdated, 
  setActiveTab 
}) {
  const [copied, setCopied] = useState(false);
  const [testSector, setTestSector] = useState('ATQ-DXB');
  const [testDate, setTestDate] = useState('2026-10-04');
  const [testAirline, setTestAirline] = useState('IX');
  const [testFlightNo, setTestFlightNo] = useState('IX 191');
  const [testNetFare, setTestNetFare] = useState(13500);
  const [testLoading, setTestLoading] = useState(false);
  const [testStatus, setTestStatus] = useState(null);

  // The complete, bulletproof Bookmarklet script
  const bookmarkletScript = `javascript:(function(){
  const API_URL = 'https://rates.travelx.co.in/api/fares/portal-sync';
  const VENDOR_NAME = '${vendor?.name || 'Shree Balaji'}';
  const PIN = '7788';

  let toast = document.getElementById('tx-sync-modal');
  if (toast) toast.remove();
  
  toast = document.createElement('div');
  toast.id = 'tx-sync-modal';
  toast.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999999;background:#0f172a;color:#f8fafc;padding:18px 22px;border-radius:14px;box-shadow:0 20px 40px rgba(0,0,0,0.5);font-family:system-ui,-apple-system,sans-serif;font-size:14px;max-width:400px;border:2px solid #3b82f6;line-height:1.5;';
  toast.innerHTML = '<div style="display:flex;align-items:center;gap:10px;"><div style="width:12px;height:12px;border:2px solid #38bdf8;border-top-color:transparent;border-radius:50%;animation:txspin 1s linear infinite;"></div><b style="font-size:15px;color:#38bdf8;">TravelX Special Fare Sync</b></div><div style="margin-top:8px;color:#94a3b8;font-size:13px;">Scanning live flight rates from portal...</div><style>@keyframes txspin{to{transform:rotate(360deg)}}</style>';
  document.body.appendChild(toast);

  function notify(title, msg, isError, autoClose) {
    toast.style.borderColor = isError ? '#ef4444' : '#10b981';
    toast.innerHTML = '<b style="font-size:15px;color:' + (isError ? '#f87171' : '#34d399') + ';">' + title + '</b><div style="margin-top:6px;color:#cbd5e1;font-size:13px;">' + msg + '</div>';
    if (autoClose) setTimeout(() => toast.remove(), autoClose);
  }

  function formatToYMD(dStr) {
    if (!dStr) return '';
    const mmm = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
    const match = dStr.match(/(\\d{1,2})[-\\/ ]([A-Za-z]{3})[-\\/ ](\\d{4})/);
    if (match) {
      const day = match[1].padStart(2, '0');
      const mon = mmm[match[2].toLowerCase()] || '01';
      return match[3] + '-' + mon + '-' + day;
    }
    const iso = dStr.match(/(\\d{4})-(\\d{2})-(\\d{2})/);
    if (iso) return iso[0];
    return '';
  }

  try {
    let fares = [];

    // TIER 1: Read directly from Angular component state
    const appResult = document.querySelector('app-flight-result');
    if (window.ng && appResult) {
      try {
        const comp = window.ng.getComponent(appResult);
        const flightList = (comp && comp.resultList && comp.resultList[0]) || (comp && comp.actualResultFromSearchAPI) || [];
        if (flightList && flightList.length > 0) {
          for (const f of flightList) {
            const seg = f.segments && f.segments[0];
            if (!seg || !seg[0]) continue;
            const firstSeg = seg[0];
            const lastSeg = seg[seg.length - 1];

            const airlineCode = (firstSeg.airline && firstSeg.airline.airlineCode) || f.airlineCode || 'AI';
            const flightNumber = (firstSeg.airline && firstSeg.airline.flightNumber) || '';
            const origin = (firstSeg.origin && firstSeg.origin.airport && firstSeg.origin.airport.airportCode) || 'ATQ';
            const destination = (lastSeg.destination && lastSeg.destination.airport && lastSeg.destination.airport.airportCode) || 'DXB';
            
            const depRaw = (firstSeg.origin && firstSeg.origin.depTime) || '';
            const arrRaw = (lastSeg.destination && lastSeg.destination.arrTime) || '';
            
            const travelDate = depRaw ? depRaw.substring(0, 10) : '';
            const depTime = depRaw ? depRaw.substring(11, 16) : '';
            const arrTime = arrRaw ? arrRaw.substring(11, 16) : '';

            let netFare = 0;
            if (f.artFareslist && f.artFareslist.length > 0) {
              const netFares = f.artFareslist.map(x => Number(x.offeredFare || x.publishedFare)).filter(n => n > 0);
              if (netFares.length > 0) netFare = Math.min(...netFares);
            }
            if (!netFare && f.fare) {
              netFare = Number(f.fare.offeredFare || f.fare.publishedFare || f.totalFare || 0);
            }
            if (!netFare) {
              netFare = Number(f.totalFare || f.publishedFare || 0);
            }

            const baggage = firstSeg.baggage || '30kg';
            const refundable = f.refundable && String(f.refundable).toLowerCase().includes('non') ? 'NON_REFUNDABLE' : (f.refundable ? 'REFUNDABLE' : 'NON_REFUNDABLE');
            const remarks = 'Shree Balaji ' + (f.airlineRemark || '');

            if (airlineCode && origin && destination && travelDate && netFare > 0) {
              fares.push({
                airline_code: airlineCode,
                flight_number: flightNumber,
                origin: origin.toUpperCase(),
                destination: destination.toUpperCase(),
                travel_date: travelDate,
                departure_time: depTime,
                arrival_time: arrTime,
                net_fare: netFare,
                baggage: baggage,
                is_refundable: refundable,
                remarks: remarks.trim()
              });
            }
          }
        }
      } catch (e) {
        console.warn('Angular Tier 1 failed:', e);
      }
    }

    // TIER 2: DOM Scraping Fallback
    if (fares.length === 0) {
      const originInput = document.getElementById('origin');
      const destInput = document.querySelector('[placeholder="Destination"]');
      const dateInput = document.getElementById('onwarddate');

      let defaultOrigin = originInput ? (originInput.value.match(/\\b([A-Z]{3})\\b/) || [,'ATQ'])[1] : 'ATQ';
      let defaultDest = destInput ? (destInput.value.match(/\\b([A-Z]{3})\\b/) || [,'DXB'])[1] : 'DXB';
      let defaultDate = dateInput ? formatToYMD(dateInput.value) : '';

      const cards = document.querySelectorAll('.fltcardBody, .flight-booking-list');
      cards.forEach(card => {
        try {
          const text = card.innerText || '';
          
          let airlineCode = 'AI';
          const logoImg = card.querySelector('img[src*="flight-logo"]');
          if (logoImg && logoImg.src) {
            const m = logoImg.src.match(/flight-logo\\/([A-Za-z0-9]+)\\.png/);
            if (m) airlineCode = m[1].toUpperCase();
          }
          if (airlineCode === 'AI') {
            const codeMatch = text.match(/\\b(IX|6E|AI|SG|UK|FZ|EK|GF|WY|QR|G9)\\b/);
            if (codeMatch) airlineCode = codeMatch[1];
          }

          const fltMatch = text.match(/([A-Z0-9]{2})\\s*[- ]?\\s*(\\d{3,4})/);
          const flightNo = fltMatch ? fltMatch[0] : '';

          const times = text.match(/\\b([01]?\\d|2[0-3]):[0-5]\\d\\b/g) || [];
          const depTime = times[0] || '';
          const arrTime = times[1] || '';

          let cardDate = defaultDate;
          const dateMatch = text.match(/(\\d{1,2}[-\\/ ][A-Za-z]{3}[-\\/ ]\\d{4})/);
          if (dateMatch) {
            const parsed = formatToYMD(dateMatch[1]);
            if (parsed) cardDate = parsed;
          }

          let price = 0;
          const netMatch = text.match(/Net\\s*:\\s*(?:Rs\\.?|INR)?\\s*([\\d,]+)/i);
          if (netMatch) {
            price = Number(netMatch[1].replace(/,/g, ''));
          } else {
            const greenEl = card.querySelector('.netprice, .myprice');
            if (greenEl) {
              const numMatch = greenEl.innerText.match(/([\\d,]+)/);
              if (numMatch) price = Number(numMatch[1].replace(/,/g, ''));
            }
          }
          if (!price) {
            const anyPrice = text.match(/(?:Rs\\.?|INR)?\\s*([\\d,]+)/i);
            if (anyPrice) price = Number(anyPrice[1].replace(/,/g, ''));
          }

          const baggage = text.includes('30') ? '30kg' : (text.includes('20') ? '20kg' : '15kg');
          const isRefundable = text.toLowerCase().includes('non-refundable') ? 'NON_REFUNDABLE' : 'REFUNDABLE';

          if (price > 0 && cardDate) {
            fares.push({
              airline_code: airlineCode,
              flight_number: flightNo,
              origin: defaultOrigin,
              destination: defaultDest,
              travel_date: cardDate,
              departure_time: depTime,
              arrival_time: arrTime,
              net_fare: price,
              baggage: baggage,
              is_refundable: isRefundable,
              remarks: 'Synced from Shree Balaji'
            });
          }
        } catch(e) {}
      });
    }

    if (fares.length === 0) {
      notify('⚠️ No Flights Found', 'Kripya pehle portal par flight search karein aur rates load hone dein.', true, 8000);
      return;
    }

    notify('🚀 Syncing ' + fares.length + ' Flights...', 'Sending live rates to TravelX Special Fare Manager...', false, null);

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendor_name: VENDOR_NAME,
        fares: fares,
        pin: PIN
      })
    })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        notify('🎉 Sync Complete!', '<b>' + data.saved_count + ' flights</b> successfully synced to <b>TravelX</b>!<br><span style="color:#86efac;font-size:12px;">✅ Profit margins auto-applied.<br>✅ Now live on Comparison Desk!</span>', false, 9000);
      } else {
        notify('❌ Sync Failed', data.error || 'Server rejected the request.', true, 8000);
      }
    })
    .catch(err => {
      notify('❌ Network Error', 'Failed to connect to TravelX: ' + err.message, true, 8000);
    });

  } catch (err) {
    notify('❌ Error', err.message, true, 8000);
  }
})();`;

  const handleCopyBookmarklet = () => {
    navigator.clipboard.writeText(bookmarkletScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleTestSync = async (e) => {
    e.preventDefault();
    if (!testNetFare || testNetFare <= 0) return;
    try {
      setTestLoading(true);
      setTestStatus(null);
      const [origin, destination] = testSector.split('-');
      const faresPayload = [{
        airline_code: testAirline,
        flight_number: testFlightNo,
        origin: origin.trim().toUpperCase(),
        destination: destination.trim().toUpperCase(),
        travel_date: testDate,
        departure_time: '11:45',
        arrival_time: '14:00',
        net_fare: Number(testNetFare),
        baggage: '30kg',
        is_refundable: 'NON_REFUNDABLE',
        remarks: 'Direct test sync via Balaji Protocol'
      }];

      const res = await api.portalSyncFares(vendor.name, faresPayload, '7788');
      if (res.success) {
        setTestStatus({
          type: 'success',
          text: `🎉 Sync Success! ${res.saved_count} flight saved under ${vendor.name}. TravelX Margin auto-applied!`
        });
        if (onFaresUpdated) onFaresUpdated();
      } else {
        setTestStatus({ type: 'error', text: res.error || 'Failed to sync fare.' });
      }
    } catch (err) {
      setTestStatus({ type: 'error', text: err.message });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner: Supplier Connection */}
      <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 rounded-2xl p-6 text-white border border-blue-800/60 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Globe className="w-48 h-48 text-blue-400" />
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Active Portal Protocol</span>
              </span>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Zero Extra Cost (₹0 API Fees)
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center space-x-2">
              <span>{vendor?.name || 'Shree Balaji Travels'} Live Rate Sync</span>
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Shree Balaji ke portal par Excel export nahi hota. Isliye yeh <strong>1-Click Sync Bridge</strong> banaya gaya hai. Balaji par flight search karein aur 1 button dabayein — saare rates aapke <strong>TravelX Special Fare Manager</strong> me auto-margin jodkar live ho jayenge!
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3 text-xs">
              <a
                href="https://www.shreebalajitravelsonline.com/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-sm transition"
              >
                <span>Open Shree Balaji Portal</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <span className="text-slate-400 font-mono">
                Login: <strong>TRAVELLX (SBT10011)</strong> | PIN: <strong>7788</strong>
              </span>
            </div>
          </div>

          {/* Quick Action: Sort & Compare */}
          <div className="shrink-0 flex flex-col space-y-2">
            <button
              type="button"
              onClick={() => setActiveTab && setActiveTab('compare')}
              className="px-5 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg transition flex items-center justify-center space-x-2"
            >
              <Zap className="w-4 h-4 fill-slate-950" />
              <span>Go to Comparison Desk</span>
            </button>
            <span className="text-[11px] text-center text-slate-400">
              {vendorFares.length} Live Rates in Database
            </span>
          </div>
        </div>
      </div>

      {/* Main Tool: The Draggable Bookmarklet & Code Box */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: 1-Click Bookmarklet Tool (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border-2 border-indigo-200 shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  1-Click Chrome Sync Bookmarklet
                </h3>
                <p className="text-[11px] text-slate-500">
                  Sabse aasan tareeqa — Chrome Bookmarks me save karein aur har roz 1-click se sync karein.
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded bg-indigo-100 text-indigo-700">
              Instant
            </span>
          </div>

          {/* Big Draggable Button */}
          <div className="p-5 bg-gradient-to-br from-indigo-50 via-blue-50 to-indigo-50/50 rounded-xl border border-indigo-200 text-center space-y-3">
            <p className="text-xs font-bold text-slate-700">
              👇 Niche diye gaye blue button ko mouse se pakad kar apne <strong>Chrome Bookmarks Bar</strong> par chhod dein (Drag & Drop):
            </p>

            <div className="py-2">
              <a
                href={bookmarkletScript}
                onClick={(e) => {
                  e.preventDefault();
                  alert("Is button ko mouse se drag karke apne Chrome Bookmarks Bar (Ctrl+Shift+B) par drop karein!\n\nYa fir niche 'Copy Script' dabakar Chrome Console (F12) me paste karein.");
                }}
                className="inline-flex items-center space-x-2.5 px-6 py-3.5 bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 hover:from-indigo-700 hover:to-blue-700 text-white font-black text-sm rounded-xl shadow-lg shadow-indigo-500/25 transition-all transform hover:scale-105 cursor-grab active:cursor-grabbing border border-indigo-400"
                title="Drag this button to your Chrome Bookmarks Bar"
              >
                <Zap className="w-4 h-4 fill-white" />
                <span>⚡ Sync Balaji Rates to TravelX</span>
              </a>
            </div>

            <p className="text-[11px] text-slate-500">
              Tip: Agar Bookmarks bar nahi dikh rahi to keyboard par <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono font-bold text-[10px] text-slate-700">Ctrl + Shift + B</kbd> dabayein.
            </p>
          </div>

          {/* Alternative: Copy Console Script */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                Alternative: Chrome Console Snippet
              </span>
              <button
                type="button"
                onClick={handleCopyBookmarklet}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy 1-Click Script</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-3 bg-slate-900 rounded-xl text-slate-300 font-mono text-[11px] max-h-24 overflow-y-auto border border-slate-800">
              <code>{bookmarkletScript}</code>
            </div>

            <p className="text-[11px] text-slate-500">
              Agar bookmark nahi lagana chahte to script copy karein, Balaji tab par <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono font-bold text-[10px]">F12</kbd> dabakar <strong>Console</strong> me paste karein aur Enter dabayein.
            </p>
          </div>

          {/* 3 Step Visual Guide */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
              How it works (Sirf 3 Steps):
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center">
                  1
                </span>
                <p className="text-xs font-bold text-slate-800">Search Flight</p>
                <p className="text-[11px] text-slate-500">
                  Balaji portal par route search karein (e.g. Amritsar to Dubai, 4-Oct-2026).
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center">
                  2
                </span>
                <p className="text-xs font-bold text-slate-800">Click Bookmark</p>
                <p className="text-[11px] text-slate-500">
                  Flight cards load hone par Bookmarklet par click karein.
                </p>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1.5">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center">
                  3
                </span>
                <p className="text-xs font-bold text-emerald-900">Rates Live!</p>
                <p className="text-[11px] text-emerald-700">
                  TravelX automatic profit margin (+₹600) lagakar B2B Compare Desk par publish kar dega.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Live Margin Logic & Quick Test Form (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Margin Calculation Preview Card */}
          <div className="bg-gradient-to-br from-emerald-50 via-slate-50 to-emerald-50/40 rounded-2xl border-2 border-emerald-200 p-5 space-y-4">
            <div className="flex items-center space-x-2 text-emerald-900">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-black">
                TravelX Auto-Margin Guarantee
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Balaji ke rate supplier net rate hote hain. TravelX aapke pricing rules ke anusaar apna profit margin automatic jod deta hai:
            </p>

            <div className="p-3.5 bg-white rounded-xl border border-emerald-200 space-y-2 text-xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                <span className="text-slate-500">Balaji Net Fare:</span>
                <span className="font-mono font-bold text-slate-800">₹13,500</span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 text-emerald-700 font-bold">
                <span>+ TravelX Profit Margin:</span>
                <span className="font-mono">+₹600</span>
              </div>
              <div className="flex items-center justify-between pt-1 text-sm font-black text-slate-900">
                <span>B2B Published Rate:</span>
                <span className="font-mono text-emerald-600 text-base">₹14,100</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              Aap <strong>Margin Rules Desk</strong> se kisi bhi sector ka margin badha ya ghata sakte hain.
            </p>
          </div>

          {/* Quick Test / Manual Push Form */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                🧪 Quick Test / Push Single Rate
              </h4>
              <span className="text-[10px] text-slate-400 font-mono">Instant Verify</span>
            </div>

            {testStatus && (
              <div className={`p-3 rounded-xl text-xs font-bold flex items-center space-x-2 ${
                testStatus.type === 'success' 
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' 
                  : 'bg-rose-50 text-rose-900 border border-rose-200'
              }`}>
                {testStatus.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{testStatus.text}</span>
              </div>
            )}

            <form onSubmit={handleTestSync} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Sector (Origin-Dest)</label>
                  <input
                    type="text"
                    value={testSector}
                    onChange={e => setTestSector(e.target.value)}
                    placeholder="ATQ-DXB"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Travel Date</label>
                  <input
                    type="date"
                    value={testDate}
                    onChange={e => setTestDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Airline & Flight</label>
                  <input
                    type="text"
                    value={testFlightNo}
                    onChange={e => setTestFlightNo(e.target.value)}
                    placeholder="IX 191"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Supplier Net Fare (₹)</label>
                  <input
                    type="number"
                    value={testNetFare}
                    onChange={e => setTestNetFare(e.target.value)}
                    placeholder="13500"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-black text-slate-900"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={testLoading}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold rounded-xl shadow transition flex items-center justify-center space-x-1.5"
              >
                {testLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Syncing to Database...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>Test Sync Live to TravelX</span>
                  </>
                )}
              </button>
            </form>
          </div>

        </div>

      </div>

      {/* Synced Fares Table for this Vendor */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center space-x-2">
              <span>{vendor?.name} Database Rates</span>
              <span className="px-2 py-0.5 text-[10px] font-mono bg-indigo-100 text-indigo-800 rounded-full font-bold">
                {vendorFares.length} Live Rates
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Yeh sabhi rates portal ya manual sync ke through database me live hain.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setActiveTab && setActiveTab('compare')}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center space-x-1.5"
            >
              <span>View in Comparison Desk</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {vendorFares.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Globe className="w-6 h-6" />
            </div>
            <div className="text-slate-600 font-bold text-xs">
              Abhi {vendor?.name} ke rates sync nahi huye hain.
            </div>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              Upar diye gaye Bookmarklet se Balaji portal par flight search karke 1-click me sync karein ya Quick Test karein.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase font-black text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Route</th>
                  <th className="px-4 py-3">Travel Date</th>
                  <th className="px-4 py-3">Airline & Flight</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Net Fare (₹)</th>
                  <th className="px-4 py-3">Margin</th>
                  <th className="px-4 py-3">Published Fare (₹)</th>
                  <th className="px-4 py-3">Baggage / Refund</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vendorFares.slice(0, 50).map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">
                      {f.origin} → {f.destination}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">
                      {f.travel_date}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 font-bold text-slate-800 font-mono mr-1.5">
                        {f.airline_code}
                      </span>
                      <span className="text-slate-600">{f.flight_number || '-'}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                      {f.departure_time && f.arrival_time ? `${f.departure_time} - ${f.arrival_time}` : '-'}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-700">
                      ₹{Number(f.net_fare).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-600">
                      +₹{Number(f.margin_amount || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 font-mono font-black text-emerald-700 text-sm">
                      ₹{Number(f.publish_fare || f.net_fare).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-500">
                      <span className="mr-1">{f.baggage || '30kg'}</span>
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        f.is_refundable === 'REFUNDABLE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {f.is_refundable === 'REFUNDABLE' ? 'REF' : 'NON-REF'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
