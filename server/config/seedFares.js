const db = require('./database');
const { calculateMargin } = require('../services/marginCalculator');

function seedRealisticFares() {
  const count = db.prepare('SELECT COUNT(*) as count FROM fares').get().count;
  if (count > 0) {
    console.log('Fares already exist, skipping initial fare seeding.');
    return;
  }

  console.log('Seeding initial realistic B2B vendor fares...');

  const vendors = db.prepare('SELECT id, name FROM vendors').all();
  const vAkbar = vendors.find(v => v.name.includes('Akbar'))?.id || 1;
  const vRiya = vendors.find(v => v.name.includes('Riya'))?.id || 2;
  const vTBO = vendors.find(v => v.name.includes('TBO'))?.id || 3;
  const vTripJack = vendors.find(v => v.name.includes('TripJack'))?.id || 4;
  const vFlywings = vendors.find(v => v.name.includes('Flywings'))?.id || 5;

  const insertFare = db.prepare(`
    INSERT INTO fares (
      vendor_id, airline_code, origin, destination, travel_date,
      flight_number, departure_time, arrival_time, net_fare, currency,
      cabin, baggage, is_refundable, remarks, margin_amount, publish_fare, is_published,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'INR', ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
  `);

  const initialFares = [
    // ATQ -> DXB (Air India) Multi-Vendor Comparison
    // Date: 2026-09-15
    { v: vAkbar, a: 'AI', o: 'ATQ', d: 'DXB', dt: '2026-09-15', fn: 'AI 929', dep: '13:45', arr: '16:15', fare: 17900, bag: '30kg', ref: 'NON_REFUNDABLE', rem: 'Series Fare', pub: 0 },
    { v: vRiya, a: 'AI', o: 'ATQ', d: 'DXB', dt: '2026-09-15', fn: 'AI 929', dep: '13:45', arr: '16:15', fare: 17500, bag: '30kg', ref: 'NON_REFUNDABLE', rem: 'Special Quote', pub: 0 },
    { v: vTBO, a: 'AI', o: 'ATQ', d: 'DXB', dt: '2026-09-15', fn: 'AI 929', dep: '13:45', arr: '16:15', fare: 17100, bag: '20kg', ref: 'NON_REFUNDABLE', rem: 'Saver 20kg', pub: 0 },
    { v: vTripJack, a: 'AI', o: 'ATQ', d: 'DXB', dt: '2026-09-15', fn: 'AI 929', dep: '13:45', arr: '16:15', fare: 17300, bag: '30kg', ref: 'NON_REFUNDABLE', rem: 'Special Group Net', pub: 1 },

    // Date: 2026-09-16
    { v: vAkbar, a: 'AI', o: 'ATQ', d: 'DXB', dt: '2026-09-16', fn: 'AI 929', dep: '13:45', arr: '16:15', fare: 17300, bag: '30kg', ref: 'NON_REFUNDABLE', rem: 'Desk Rate', pub: 0 },
    { v: vRiya, a: 'AI', o: 'ATQ', d: 'DXB', dt: '2026-09-16', fn: 'AI 929', dep: '13:45', arr: '16:15', fare: 17100, bag: '30kg', ref: 'NON_REFUNDABLE', rem: 'Special Promo', pub: 0 },
    { v: vTripJack, a: 'AI', o: 'ATQ', d: 'DXB', dt: '2026-09-16', fn: 'AI 929', dep: '13:45', arr: '16:15', fare: 16900, bag: '30kg', ref: 'NON_REFUNDABLE', rem: 'Best Net Guarantee', pub: 1 },
    { v: vFlywings, a: 'AI', o: 'ATQ', d: 'DXB', dt: '2026-09-16', fn: 'AI 929', dep: '13:45', arr: '16:15', fare: 17500, bag: '30kg', ref: 'REFUNDABLE', rem: 'Refundable option', pub: 0 },

    // Date: 2026-09-17
    { v: vTripJack, a: 'AI', o: 'ATQ', d: 'DXB', dt: '2026-09-17', fn: 'AI 929', dep: '13:45', arr: '16:15', fare: 17200, bag: '30kg', ref: 'NON_REFUNDABLE', rem: 'WhatsApp Special', pub: 1 },
    { v: vAkbar, a: 'AI', o: 'ATQ', d: 'DXB', dt: '2026-09-17', fn: 'AI 929', dep: '13:45', arr: '16:15', fare: 17500, bag: '30kg', ref: 'NON_REFUNDABLE', rem: 'Standard Net', pub: 0 },

    // Date: 2026-09-18
    { v: vTripJack, a: 'AI', o: 'ATQ', d: 'DXB', dt: '2026-09-18', fn: 'AI 929', dep: '13:45', arr: '16:15', fare: 17500, bag: '30kg', ref: 'NON_REFUNDABLE', rem: 'WhatsApp Special', pub: 1 },
    { v: vRiya, a: 'AI', o: 'ATQ', d: 'DXB', dt: '2026-09-18', fn: 'AI 929', dep: '13:45', arr: '16:15', fare: 17700, bag: '30kg', ref: 'NON_REFUNDABLE', rem: 'Desk Fare', pub: 0 },

    // ATQ -> SHJ (Air Arabia G9)
    { v: vFlywings, a: 'G9', o: 'ATQ', d: 'SHJ', dt: '2026-09-15', fn: 'G9 462', dep: '04:10', arr: '06:40', fare: 15400, bag: '30kg', ref: 'NON_REFUNDABLE', rem: 'Early Morning Special', pub: 1 },
    { v: vAkbar, a: 'G9', o: 'ATQ', d: 'SHJ', dt: '2026-09-15', fn: 'G9 462', dep: '04:10', arr: '06:40', fare: 15900, bag: '30kg', ref: 'NON_REFUNDABLE', rem: 'Series Fare', pub: 0 },

    // DEL -> DXB (IndiGo 6E)
    { v: vAkbar, a: '6E', o: 'DEL', d: 'DXB', dt: '2026-09-16', fn: '6E 1451', dep: '18:15', arr: '20:50', fare: 14800, bag: '30kg', ref: 'NON_REFUNDABLE', rem: 'Direct flight', pub: 1 },
    { v: vTBO, a: '6E', o: 'DEL', d: 'DXB', dt: '2026-09-16', fn: '6E 1451', dep: '18:15', arr: '20:50', fare: 15200, bag: '30kg', ref: 'NON_REFUNDABLE', rem: 'Direct flight', pub: 0 }
  ];

  for (const item of initialFares) {
    const marginCalc = calculateMargin(item.fare, item.a, item.o, item.d);
    insertFare.run(
      item.v, item.a, item.o, item.d, item.dt,
      item.fn, item.dep, item.arr, item.fare,
      'ECONOMY', item.bag, item.ref, item.rem,
      marginCalc.marginAmount, marginCalc.publishFare, item.pub
    );
  }

  // Seed sample price history updates as requested in Section 8:
  // "ATQ → DXB AI 16-Sep: 10:00 AM = ₹16,900, 12:00 PM = ₹17,200, 03:00 PM = ₹16,700"
  const insertHistory = db.prepare(`
    INSERT INTO fare_history (
      fare_id, vendor_id, airline_code, origin, destination, travel_date,
      flight_number, old_fare, new_fare, fare_diff, recorded_at, reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertHistory.run(7, vTripJack, 'AI', 'ATQ', 'DXB', '2026-09-16', 'AI 929', 16900, 17200, 300, '2026-09-10 10:00:00', 'Intraday price hike from vendor');
  insertHistory.run(7, vTripJack, 'AI', 'ATQ', 'DXB', '2026-09-16', 'AI 929', 17200, 16700, -500, '2026-09-10 12:00:00', 'Flash discount released');
  insertHistory.run(7, vTripJack, 'AI', 'ATQ', 'DXB', '2026-09-16', 'AI 929', 16700, 16900, 200, '2026-09-10 15:00:00', 'Fare stabilized');

  console.log(`Seeded ${initialFares.length} realistic fares and 3 price audit history records.`);
}

seedRealisticFares();
