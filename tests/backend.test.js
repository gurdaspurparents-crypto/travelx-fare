const assert = require('assert');
const { parseWhatsAppFareText, parseDateString } = require('../server/services/whatsappParser');
const { buildRecordsFromModelText } = require('../server/services/aiVisionService');
const { calculateMargin } = require('../server/services/marginCalculator');
const db = require('../server/config/database');
const { getFareComparisons } = require('../server/services/comparisonEngine');

console.log('🧪 Running Travelx Special Fare Manager Backend Tests...\n');

// Test 1: Date parsing
console.log('Test 1: Testing Date Parsing...');
assert.strictEqual(parseDateString('15 Sep 2026'), '2026-09-15');
assert.strictEqual(parseDateString('16-Sep-2026'), '2026-09-16');
assert.strictEqual(parseDateString('17SEP2026'), '2026-09-17');
assert.strictEqual(parseDateString('2026-09-18'), '2026-09-18');
console.log('✅ Date parsing tests passed.');

// Test 2: WhatsApp Text Parser
console.log('\nTest 2: Testing WhatsApp Text Parser...');
const sampleWhatsappMsg = `
AI ATQ-DXB
Baggage 30kg Non-Refundable

15 SEP 17100
16 SEP 16900
17 SEP 17200
18 SEP 17500
`;

const parsed = parseWhatsAppFareText(sampleWhatsappMsg);
console.log('Parsed Header:', parsed.detectedHeader);
console.log('Parsed Record Count:', parsed.records.length);

assert.strictEqual(parsed.detectedHeader.airline, 'AI');
assert.strictEqual(parsed.detectedHeader.origin, 'ATQ');
assert.strictEqual(parsed.detectedHeader.destination, 'DXB');
assert.strictEqual(String(parsed.detectedHeader.baggage).toUpperCase(), '30KG');
assert.strictEqual(parsed.detectedHeader.is_refundable, 'NON_REFUNDABLE');
assert.strictEqual(parsed.records.length, 4);
assert.strictEqual(parsed.records[0].net_fare, 17100);
assert.strictEqual(parsed.records[1].net_fare, 16900);
console.log('✅ WhatsApp Text Parser tests passed.');

// Test 3: Margin Engine (DB rules + custom override)
console.log('\nTest 3: Testing Margin Engine...');
const m1 = calculateMargin(8500);
assert.ok(Number.isFinite(m1.marginAmount));
assert.strictEqual(m1.publishFare, 8500 + m1.marginAmount);

const mCustom = calculateMargin(16900, 'AI', 'ATQ', 'DXB', 800);
assert.strictEqual(mCustom.marginAmount, 800);
assert.strictEqual(mCustom.publishFare, 17700);
assert.strictEqual(mCustom.ruleApplied, 'Custom Override');

console.log('✅ Margin Engine tests passed.');

// Test 4: Database Master Data Seeding
console.log('\nTest 4: Checking Database Master Data...');
const airlines = db.prepare('SELECT COUNT(*) as count FROM airlines').get().count;
const vendors = db.prepare('SELECT COUNT(*) as count FROM vendors').get().count;
const routes = db.prepare('SELECT COUNT(*) as count FROM routes').get().count;

console.log(`Airlines seeded: ${airlines}`);
console.log(`Vendors seeded: ${vendors}`);
console.log(`Routes seeded: ${routes}`);
assert(airlines >= 10, 'Airlines should be >= 10');
assert(vendors >= 5, 'Vendors should be >= 5');
assert(routes >= 5, 'Routes should be >= 5');
console.log('✅ Database Master Data verified.');

console.log('\nTest 5: Flyer date ranges expand into fare rows...');
const flyerJson = JSON.stringify({
  flyer_text: [
    'AIR INDIA EXPRESS',
    'AMRITSAR DUBAI',
    '20 SEP & 21 SEP & 26 SEP & 30 SEP & 01 OCT 17000',
    '01 OCT TO 05 OCT (ALL DATES) 18000',
    '06 OCT TO 31 OCT (ALL DATES) 17000',
    'AIR INDIA EXPRESS',
    'AMRITSAR SHARJAH',
    '20 SEP 15500',
    '06 OCT TO 31 OCT (ALL DATES) 17000',
    'INDIGO',
    'AMRITSAR SHARJAH',
    '21 SEP & 27 SEP 21500',
    '06 OCT TO 29 OCT (ALL DATES) 17000'
  ].join('\n'),
  records: [
    { origin: 'ATQ', destination: 'DXB', airline_code: 'IX', date_text: '20 SEP & 21 SEP & 26 SEP', net_fare: 17000 },
    { origin: 'ATQ', destination: 'SHJ', airline_code: '6E', date_text: '06 OCT TO 10 OCT', net_fare: 17000 }
  ]
});
const flyerRows = buildRecordsFromModelText(flyerJson, {});
const dxb = flyerRows.filter(r => r.airline_code === 'IX' && r.origin === 'ATQ' && r.destination === 'DXB');
const shj6e = flyerRows.filter(r => r.airline_code === '6E' && r.destination === 'SHJ');
assert(dxb.length >= 30, `expected expanded ATQ-DXB rows, got ${dxb.length}`);
assert(shj6e.length >= 5, `expected IndiGo SHJ rows, got ${shj6e.length}`);
assert(flyerRows.some(r => r.travel_date === '2026-10-01' && r.destination === 'DXB'));
console.log(`✅ Flyer expansion produced ${flyerRows.length} rows.`);

console.log('\n🎉 ALL BACKEND LOGIC TESTS PASSED SUCCESSFULLY!');
