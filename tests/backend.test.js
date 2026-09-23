const assert = require('assert');
const { parseWhatsAppFareText, parseDateString } = require('../server/services/whatsappParser');
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

console.log('\n🎉 ALL BACKEND LOGIC TESTS PASSED SUCCESSFULLY!');
