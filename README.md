# ✈️ Travelx Special Fare Manager

A complete, high-performance web software built for **Travelx** to replace manual Excel tracking of airline special fares received via WhatsApp and vendor portals.

---

## 🌟 Key Features

1. **Executive Dashboard**:
   - Live KPI cards: Today's Fares, Airlines, Routes, Vendors, Published Specials, Price Movement Ticker (Drops vs Hikes).
   - Favorite Routes Quick Bar (ATQ-DXB, ATQ-SHJ, DEL-DXB, etc.).
   - Recently updated fares stream.

2. **Fast Fare Entry**:
   - Sticky form state remembers your current Vendor, Airline, Origin, Destination, Cabin, Baggage, and Refundability.
   - Live Travelx Margin and Publish Fare calculation as you type Net Fare.
   - Press <kbd>Enter</kbd> to save and auto-advance the travel date by +1 day!

3. **Quick Grid Entry (Multi-Date Matrix)**:
   - Select Vendor + Airline + Route once.
   - Rapidly fill 10–30 dates and fares in a matrix grid.
   - One-click helper buttons: `+ 7 Days`, `+ 14 Days`, `+ 30 Days`.
   - Single-click **"Save All Fares"** batch database commit.

4. **Smart WhatsApp Bulk Paste Parser**:
   - Large text area to paste raw WhatsApp messages (e.g. `AI ATQ-DXB \n 15 SEP 17100 \n 16 SEP 16900`).
   - Intelligent regex extraction of airlines, routes, dates, net fares, baggage, and refundability.
   - Live editable preview table before confirming database save.

5. **Fare Comparison Engine**:
   - Groups all vendor quotes by sector, travel date, airline, and cabin.
   - Automatically identifies and highlights the **BEST NET FARE** winner.
   - Side-by-side price difference matrix (`+₹200`, `+₹400`, `+₹600`).
   - Smart Condition Guards:
     - ⚠️ Baggage disparity alert (e.g. cheaper vendor only offers 20kg vs 30kg).
     - ℹ️ Refundability differences (non-refundable vs refundable options).
     - Multiple flight number options.

6. **Configurable Margin Engine**:
   - Configurable tiered slabs:
     - ₹0 – ₹10,000 $\to$ ₹300 Margin
     - ₹10,001 – ₹20,000 $\to$ ₹500 Margin
     - ₹20,001 – ₹30,000 $\to$ ₹700 Margin
     - ₹30,001+ $\to$ ₹1,000 Margin
   - Add custom percentage or fixed rules by Airline or Route.
   - Interactive Live Margin Simulator for test calculations.

7. **Special Fare Publishing & WhatsApp Broadcast**:
   - Select winning quotes and publish them in 1 click.
   - Automatically formats emoji-styled, professional WhatsApp broadcast messages:
     - Route headers
     - Dates and Publish Fares
     - Promotional footers (Best Fare Guarantee / Limited Seats)
   - **1-Click "Copy to WhatsApp"** button with visual confirmation.

8. **Fare History & Audit Trail**:
   - Immutable log of all intraday price updates.
   - Tracks timestamp (10:00 AM, 12:00 PM, 3:00 PM), previous price, new price, difference.
   - Green price-drop and red price-hike badges.

9. **Master Data & Excel Export**:
   - Master data management for Airlines, B2B Vendors, and Favorite Routes.
   - Native `.xlsx` download formatted with proper columns and auto-column widths.

---

## 🚀 How to Run the Software

### Option 1: Double-Click (Easiest on Windows)
Simply double-click:
```
start.bat
```
This automatically starts the backend server on `http://localhost:5000` and opens your default browser!

### Option 2: Command Line
```powershell
# From project folder:
npm start
```
Then open:
```
http://localhost:5000
```

---

## 📂 Project Structure

```
travelx-special-fare-manager/
├── start.bat                   # 1-Click Windows Launcher
├── package.json
├── server/
│   ├── index.js                # Express Server (Port 5000)
│   ├── config/
│   │   ├── database.js         # SQLite WAL mode initialization
│   │   └── seedFares.js        # Initial realistic master data & fares
│   ├── controllers/
│   │   ├── fareController.js   # Single, Quick Grid, Bulk saves & duplicate logic
│   │   ├── compareController.js# Comparison engine & dashboard statistics
│   │   ├── marginController.js # Margin rules & live simulator
│   │   ├── masterController.js # Airlines, Vendors, Routes
│   │   └── exportController.js # WhatsApp message formatter & XLSX download
│   ├── services/
│   │   ├── whatsappParser.js   # Natural language text tokenizer
│   │   ├── comparisonEngine.js # Condition checks & lowest net calculation
│   │   └── marginCalculator.js # Tiered slab calculation engine
│   └── data/
│       └── travelx_fares.db    # SQLite Embedded Database File
├── client/                     # Vite + React 19 + Tailwind CSS Frontend
│   ├── dist/                   # Production compiled frontend bundle
│   └── src/
│       ├── components/
│       │   └── Navbar.jsx
│       ├── pages/
│       │   ├── Dashboard.jsx
│       │   ├── FastEntry.jsx
│       │   ├── QuickGrid.jsx
│       │   ├── BulkPaste.jsx
│       │   ├── ComparisonDesk.jsx
│       │   ├── PublishDesk.jsx
│       │   ├── HistoryDesk.jsx
│       │   ├── MarginRules.jsx
│       │   └── MasterData.jsx
│       └── utils/
│           └── api.js
└── tests/
    └── backend.test.js         # Comprehensive unit & integration tests
```

---

## 🛡️ Data Safety & Storage

- **Database**: SQLite3 in `WAL` (Write-Ahead Logging) mode.
- **Location**: `server/data/travelx_fares.db`.
- **Zero Cloud Dependence**: Operates 100% locally with high performance and zero monthly subscription costs.
- **Future Integration Ready**: Modular architecture allows plugging in WhatsApp Cloud API, Airline APIs, or OCR engines without rewriting core business logic.
