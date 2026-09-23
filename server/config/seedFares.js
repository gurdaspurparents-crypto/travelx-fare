const db = require('./database');
const { calculateMargin } = require('../services/marginCalculator');

function seedRealisticFares() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const futureCount = db.prepare(`
      SELECT COUNT(*) as count 
      FROM fares 
      WHERE travel_date >= ?
        AND (
          (origin = 'ATQ' AND destination = 'DXB') OR
          (origin = 'ATQ' AND destination = 'SHJ') OR
          (origin = 'IXC' AND destination = 'AUH')
        )
    `).get(today).count;

    if (futureCount > 0) {
      console.log(`[Seed] ${futureCount} future fares already exist for exclusive B2B sectors.`);
      return;
    }

    console.log('[Seed] Seeding realistic future fares for ATQ-DXB, ATQ-SHJ, and IXC-AUH...');

    const vendors = db.prepare('SELECT id, name FROM vendors').all();
    const vendorId = vendors.length > 0 ? vendors[0].id : 1;

    const insertFare = db.prepare(`
      INSERT INTO fares (
        vendor_id, airline_code, origin, destination, travel_date,
        flight_number, departure_time, arrival_time, net_fare, currency,
        cabin, baggage, is_refundable, remarks, margin_amount, publish_fare, is_published,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'INR', ?, ?, ?, ?, ?, ?, 1, datetime('now', 'localtime'), datetime('now', 'localtime'))
    `);

    const routes = [
      {
        airline: 'IX',
        flight_number: 'IX 191',
        origin: 'ATQ',
        destination: 'DXB',
        dep: '00:15',
        arr: '02:55',
        baseFare: 17500,
        bag: '30+7 KG',
        refundable: 'NON_REFUNDABLE',
        remarks: 'Series Direct Flight'
      },
      {
        airline: 'SG',
        flight_number: 'SG 59',
        origin: 'ATQ',
        destination: 'DXB',
        dep: '08:40',
        arr: '11:25',
        baseFare: 18900,
        bag: '30+7 KG',
        refundable: 'NON_REFUNDABLE',
        remarks: 'SpiceJet Direct Saver'
      },
      {
        airline: 'IX',
        flight_number: 'IX 137',
        origin: 'ATQ',
        destination: 'SHJ',
        dep: '13:15',
        arr: '16:05',
        baseFare: 17200,
        bag: '30+7 KG',
        refundable: 'NON_REFUNDABLE',
        remarks: 'Direct Sharjah Express'
      },
      {
        airline: '6E',
        flight_number: '6E 1427',
        origin: 'ATQ',
        destination: 'SHJ',
        dep: '12:15',
        arr: '14:40',
        baseFare: 17800,
        bag: '30+7 KG',
        refundable: 'NON_REFUNDABLE',
        remarks: 'IndiGo Non-Stop'
      },
      {
        airline: '6E',
        flight_number: '6E 1418',
        origin: 'IXC',
        destination: 'AUH',
        dep: '15:10',
        arr: '17:30',
        baseFare: 16900,
        bag: '30+7 KG',
        refundable: 'NON_REFUNDABLE',
        remarks: 'Direct Abu Dhabi Special'
      }
    ];

    const todayDate = new Date();
    let totalSeeded = 0;

    const seedTransaction = db.transaction(() => {
      for (let dayOffset = 1; dayOffset <= 35; dayOffset++) {
        const curDate = new Date(todayDate);
        curDate.setDate(curDate.getDate() + dayOffset);
        const dtStr = curDate.toISOString().slice(0, 10);

        for (const r of routes) {
          // Add mild dynamic variation based on day
          const dayVar = (dayOffset % 7) * 200;
          const net = r.baseFare + dayVar;
          const marginCalc = calculateMargin(net, r.airline, r.origin, r.destination);
          const margin = marginCalc.marginAmount || 300;
          const pub = marginCalc.publishFare || (net + margin);

          insertFare.run(
            vendorId,
            r.airline,
            r.origin,
            r.destination,
            dtStr,
            r.flight_number,
            r.dep,
            r.arr,
            net,
            'ECONOMY',
            r.bag,
            r.refundable,
            r.remarks,
            margin,
            pub
          );
          totalSeeded++;
        }
      }
    });

    seedTransaction();
    console.log(`[Seed] Successfully seeded ${totalSeeded} dynamic future fares for B2B portal across next 35 days.`);
  } catch (err) {
    console.error('[Seed] Error seeding realistic fares:', err.message);
  }
}

seedRealisticFares();

module.exports = { seedRealisticFares };
