/**
 * Date Range & Streak Grouping Utility for Travel Agency Special Fares
 * Groups consecutive dates having identical publish fares into clean ranges:
 * - 1 Date:  "16 SEP"
 * - 2 Dates: "21 SEP & 22 SEP"
 * - 3+ Dates: "23 SEP TO 02 OCT (ALL DATES)"
 */

import { formatRouteName } from './airportHelper';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function parseDateParts(dateStr) {
  if (!dateStr) return new Date();
  const clean = String(dateStr).split('T')[0].trim();
  const parts = clean.split('-');
  if (parts.length === 3) {
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }
  return new Date(dateStr);
}

export function isConsecutiveDay(dateStrA, dateStrB) {
  const dA = parseDateParts(dateStrA);
  const dB = parseDateParts(dateStrB);
  const utcA = Date.UTC(dA.getFullYear(), dA.getMonth(), dA.getDate());
  const utcB = Date.UTC(dB.getFullYear(), dB.getMonth(), dB.getDate());
  const diffDays = Math.round((utcB - utcA) / (1000 * 60 * 60 * 24));
  return diffDays === 1;
}

export function formatDayMonth(dateStr) {
  const d = parseDateParts(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTH_NAMES[d.getMonth()] || '';
  return `${day} ${month}`;
}

export function formatStreakLabel(streak) {
  if (!streak || streak.length === 0) return '';
  if (streak.length === 1) {
    return formatDayMonth(streak[0].travel_date);
  }

  // Check if all items belong to same month and year
  const firstDate = parseDateParts(streak[0].travel_date);
  const sameMonthYear = streak.every(item => {
    const d = parseDateParts(item.travel_date);
    return d.getMonth() === firstDate.getMonth() && d.getFullYear() === firstDate.getFullYear();
  });

  // Check if the entire streak is 100% unbroken consecutive days
  let isAllConsecutive = true;
  for (let i = 1; i < streak.length; i++) {
    if (!isConsecutiveDay(streak[i - 1].travel_date, streak[i].travel_date)) {
      isAllConsecutive = false;
      break;
    }
  }

  // Case 1: All dates in the same month
  if (sameMonthYear) {
    const month = MONTH_NAMES[firstDate.getMonth()];
    // 4+ consecutive days in same month -> range (e.g. "22 Sep to 30 Sep")
    if (isAllConsecutive && streak.length >= 4) {
      return `${formatDayMonth(streak[0].travel_date)} to ${formatDayMonth(streak[streak.length - 1].travel_date)}`;
    }

    // Break into consecutive runs
    const runs = [];
    let curRun = [streak[0]];
    for (let i = 1; i < streak.length; i++) {
      if (isConsecutiveDay(streak[i - 1].travel_date, streak[i].travel_date)) {
        curRun.push(streak[i]);
      } else {
        runs.push(curRun);
        curRun = [streak[i]];
      }
    }
    if (curRun.length > 0) runs.push(curRun);

    const runLabels = runs.map(run => {
      if (run.length >= 4) {
        const d1 = String(parseDateParts(run[0].travel_date).getDate()).padStart(2, '0');
        const d2 = String(parseDateParts(run[run.length - 1].travel_date).getDate()).padStart(2, '0');
        return `${d1} to ${d2}`;
      }
      return run.map(item => String(parseDateParts(item.travel_date).getDate()).padStart(2, '0')).join(', ');
    });

    return `${runLabels.join(', ')} ${month}`;
  }

  // Case 2: Across months and 100% unbroken consecutive -> range (e.g. "01 Oct to 31 Dec")
  if (isAllConsecutive) {
    return `${formatDayMonth(streak[0].travel_date)} to ${formatDayMonth(streak[streak.length - 1].travel_date)}`;
  }

  // Case 3: Across months and non-consecutive -> group by month and format
  const monthMap = new Map();
  for (const item of streak) {
    const d = parseDateParts(item.travel_date);
    const mKey = `${d.getFullYear()}-${d.getMonth()}`;
    if (!monthMap.has(mKey)) {
      monthMap.set(mKey, []);
    }
    monthMap.get(mKey).push(item);
  }

  const parts = [];
  for (const mStreak of monthMap.values()) {
    parts.push(formatStreakLabel(mStreak));
  }
  return parts.join(', ');
}

/**
 * Groups a list of fares by Route -> Airline -> Same Fare & Month Buckets with clean comma & range formatting
 */
export function groupFaresByDateRanges(faresList = []) {
  if (!faresList || faresList.length === 0) return [];

  // 1. Group by Route Key: format as "Delhi to Milan"
  const routeMap = new Map();
  for (const f of faresList) {
    const routeKey = formatRouteName(f.origin, f.destination, 'TO');
    if (!routeMap.has(routeKey)) {
      routeMap.set(routeKey, []);
    }
    routeMap.get(routeKey).push(f);
  }

  const consolidatedList = [];

  for (const [routeKey, routeFares] of routeMap.entries()) {
    // 2. Group by Airline
    const airlineMap = new Map();
    for (const f of routeFares) {
      const airKey = f.airline_name || f.airline_code || 'Airline';
      if (!airlineMap.has(airKey)) {
        airlineMap.set(airKey, []);
      }
      airlineMap.get(airKey).push(f);
    }

    for (const [airName, airFares] of airlineMap.entries()) {
      // Deduplicate by date: keep the most recently updated or lowest fare (ensures zero double dates)
      const dateMap = new Map();
      for (const f of airFares) {
        const d = String(f.travel_date).split('T')[0];
        const dayMonthKey = d.length >= 10 ? d.slice(5) : d; // e.g. "09-16"
        const existing = dateMap.get(dayMonthKey);
        if (!existing) {
          dateMap.set(dayMonthKey, f);
        } else {
          const fTime = f.updated_at || f.created_at || '';
          const exTime = existing.updated_at || existing.created_at || '';
          const isNewer = fTime > exTime;
          const isCheaper = Number(f.publish_fare) < Number(existing.publish_fare);

          if (isNewer || isCheaper) {
            dateMap.set(dayMonthKey, f);
          }
        }
      }
      const uniqueFares = Array.from(dateMap.values()).sort((a, b) => String(a.travel_date).localeCompare(String(b.travel_date)));

      // 3. Group by (Month, publish_fare) across vendors so dates sharing the same fare in a month group into 1 clean row
      const bucketMap = new Map();
      for (const f of uniqueFares) {
        const monthKey = String(f.travel_date).slice(0, 7); // YYYY-MM
        const bucketKey = `${monthKey}_${Number(f.publish_fare)}`;
        if (!bucketMap.has(bucketKey)) {
          bucketMap.set(bucketKey, []);
        }
        bucketMap.get(bucketKey).push(f);
      }

      // Sort buckets chronologically by their earliest travel date
      const sortedBuckets = Array.from(bucketMap.values()).sort((a, b) => 
        String(a[0].travel_date).localeCompare(String(b[0].travel_date))
      );

      for (const bucket of sortedBuckets) {
        bucket.sort((x, y) => String(x.travel_date).localeCompare(String(y.travel_date)));
        consolidatedList.push(createConsolidatedItem(routeKey, bucket));
      }
    }
  }

  return consolidatedList;
}

function createConsolidatedItem(routeKey, streak) {
  const first = streak[0];
  const last = streak[streak.length - 1];
  const dateLabel = formatStreakLabel(streak);

  const vendorList = Array.from(
    new Set(streak.map(s => s.vendor_name || s['Vendor / Source'] || '').filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  const vendorName = vendorList.join(', ') || first.vendor_name || first['Vendor / Source'] || '';

  return {
    id: `streak-${first.id}-${last.id}-${streak.length}`,
    route: routeKey,
    origin: first.origin,
    destination: first.destination,
    airline_code: first.airline_code,
    airline_name: first.airline_name,
    vendor_name: vendorName,
    date_label: dateLabel,
    start_date: first.travel_date,
    end_date: last.travel_date,
    dates_count: streak.length,
    net_fare: Number(first.net_fare) || 0,
    margin_amount: Number(first.margin_amount) || 0,
    publish_fare: Number(first.publish_fare) || 0,
    baggage: first.baggage || '30kg',
    is_refundable: first.is_refundable,
    cabin: first.cabin || 'ECONOMY',
    fare_ids: streak.map(s => s.id),
    streak_items: streak
  };
}

/**
 * Format WhatsApp broadcast with grouped date ranges
 */
export function formatWhatsAppBroadcast(faresList, options = {}) {
  const {
    title = '✈️ TRAVELX SPECIAL FARE',
    footer = '🔥 BEST FARE GUARANTEE\n⚡ LIMITED SEATS AVAILABLE\n📞 Contact Travelx Desk for Instant Issuance',
    groupByRanges = true
  } = options;

  if (!faresList || faresList.length === 0) return '';

  if (!groupByRanges) {
    // Individual day by day
    let text = `${title}\n\n`;
    for (const f of faresList) {
      const d = formatDayMonth(f.travel_date);
      const routeText = formatRouteName(f.origin, f.destination, 'TO');
      text += `🗓️ *${d}* | ${routeText}\n`;
      text += `✈️ ${f.airline_name || f.airline_code} – *₹${Number(f.publish_fare).toLocaleString('en-IN')}* | ${f.baggage || '30kg'}\n\n`;
    }
    text += `${footer}\n`;
    return text;
  }

  const consolidated = groupFaresByDateRanges(faresList);
  if (consolidated.length === 0) return '';

  // Group by Route
  const routeMap = new Map();
  for (const item of consolidated) {
    if (!routeMap.has(item.route)) {
      routeMap.set(item.route, new Map());
    }
    const airMap = routeMap.get(item.route);
    const airName = item.airline_name || item.airline_code || 'Airline';
    if (!airMap.has(airName)) {
      airMap.set(airName, []);
    }
    airMap.get(airName).push(item);
  }

  let text = `${title}\n\n`;

  for (const [routeKey, airMap] of routeMap.entries()) {
    text += `📍 *${routeKey}*\n\n`;

    for (const [airName, items] of airMap.entries()) {
      const baggage = items[0]?.baggage ? ` (${items[0].baggage})` : '';
      text += `✈️ *${airName}*${baggage}\n`;

      for (const item of items) {
        text += `• *${item.date_label}* – *₹${Number(item.publish_fare).toLocaleString('en-IN')}*\n`;
      }
      text += `\n`;
    }
    text += `───────────────\n\n`;
  }

  text += `${footer}\n`;
  return text;
}
