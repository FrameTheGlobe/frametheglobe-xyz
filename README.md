# FrameTheGlobe Geopolitical Intelligence Hub

**Version:** 5.2.0 — *Hostinger Auto-Deploy Readiness*  
**Deployment:** [frametheglobe.xyz](https://frametheglobe.xyz)  
**Stack:** Next.js 16 (App Router), React 19, TypeScript, Vanilla CSS Design System.

---

## 🌐 Overview
FrameTheGlobe is a high-performance, real-time news aggregation and intelligence platform specifically engineered to monitor the **Iran War Theater**, **South Asia**, and the **Global Pivot** (the emerging superpower dynamics between the West, China, and Russia).

The application distills thousands of signals from direct news agency wires, international state media, and OSINT conflict trackers into a single, high-density dashboard designed for analysts, researchers, and geopolitical observers.

---

## 🗺️ Geographical Intelligence Scope

The platform categorizes intelligence across **10 distinct regional poles**, ensuring a balanced view of "The Global Pivot":

| Region Pole | Description | Primary Sources |
| :--- | :--- | :--- |
| **Western** | Transatlantic and global reporting. | Reuters, BBC World, AP News, The Guardian, Foreign Policy. |
| **Iranian** | State-linked and independent Persian-theater news. | Mehr News, Tasnim (IRGC), Financial Tribune, Iran International. |
| **Levant** | The Israel-Palestine-Lebanon conflict core. | Times of Israel, WAFA (Palestine), L'Orient Today (Lebanon), Haaretz. |
| **Gulf / MENA** | Energy-rich states and regional mediators. | Arab News, UAE National, Al Jazeera, Al Arabiya. |
| **South Asian** | The Afghanistan-Pakistan conflict corridor. | Dawn (PK), TOLOnews (AF), Geo News, The Print (IN), Pajhwok Afghan News. |
| **China** | Beijing's influence and the "Belt & Road" context. | Xinhua, Global Times (CN), SCMP, China Daily. |
| **Russia** | Moscow's strategic moves and energy diplomacy. | TASS, RT News, Sputnik Globe, The Moscow Times. |
| **Analysis** | Deep-dive think tanks and conflict researchers. | War on the Rocks, ICG (Crisis Group), Atlantic Council, The Cradle. |
| **OSINT** | Open-source conflict tracking and independent probes. | Bellingcat, The Intercept, DropSite News, liveuamap. |
| **Global** | Markets, logistics, and international bodies. | OilPrice.com, gCaptain, ZeroHedge, GDELT Project, UN Security Council. |

---

## 🔍 Thematic Lenses (Content Segments)

The intelligence is sliced into **16 specialized lenses** using a custom keyword-heuristic engine:

### Regional Theaters
*   **Gaza**: Deep monitoring of the Gaza war, IDF operations, Hamas, UNRWA, and ceasefire negotiations.
*   **Lebanon**: Focused tracking of Hezbollah, Beirut developments, and the South Lebanon Litani frontier.
*   **Afghanistan**: Surveillance of Taliban rule, the Islamic Emirate, NRF resistance, and Kabul security.
*   **Pakistan**: Tracking TTP insurgency, Balochistan (BLA) conflict, and Pakistan Military (ISPR) operations.

### Strategic Segments
*   **Nuclear/Diplomacy**: Real-time tracking of IAEA inspections, Iranian uranium enrichment (Natanz/Fordow), and JCPOA status.
*   **Naval / Hormuz**: Monitoring the Strait of Hormuz, Persian Gulf maritime security, and tanker seizures.
*   **Proxy Network**: Investigating the "Axis of Resistance" including Houthis (Ansarallah), PMU militias, and regional proxy coordination.
*   **Iran Domestic**: Tracking internal Iranian protests, parliamentary leadership Pezeshkian/Khamenei), and economic dissent.

### Superpower Pivot
*   **Rapid 47 (Trump)**: Monitoring the 47th US Administration’s policy shifts, White House alerts, and MAGA geopolitical strategy.
*   **China Pivot**: Beijing’s BRICS influence, PLA maritime moves, and Silk Road economic diplomacy.
*   **Russia Pivot**: Moscow’s military maneuvers, Kremlin diplomacy, and Wagner/Energy influence.

### Markets & Logistics
*   **Oil Markets**: Comprehensive crude energy tracking (OPEC+, production quotas, supply disruptions).
*   **Commodities**: Tracking LNG, grains/wheat (food security), and strategic metals.
*   **Finance/Markets**: Monitoring war premiums, FX rates, sanctions impacts, and global bond yields.
*   **Shipping**: Real-time intelligence on Suez/Red Sea chokepoints, freight rates, and maritime insurance.

---

## 📉 Financial & Commodity Intelligence (The Pulse)

The **Energy Dashboard** provides live financial data integrated with sector-specific news wires:

### Market Tickers (via Stooq Proxy)
*   **WTI Crude (CL.F)**: West Texas Intermediate benchmark.
*   **Brent Crude (CB.F)**: International energy benchmark.
*   **Natural Gas (NG.F)**: Tracks global LNG and pipeline gas pricing.

### Resilience Features
*   **Server-Side Logic**: API requests are proxied via `/api/market` to handle CORS and prevent provider rate-limiting.
*   **JSON Repair Layer**: A regex-based sanitization engine automatically fixes malformed JSON streams (common with free market data providers) before the dashboard renders.

---

## 🚀 Technical Features & Clustering

### 1. Top Storylines (The Clustering Engine)
Automatically groups related reports from diverse global sources into unified "Storylines."
*   **Algorithm**: Uses **Jaccard Similarity** (0.40 threshold) to compare article titles and summaries.
*   **Clustering**: Groups stories published within a 12-hour window.
*   **Scoring**: Ranked by a proprietary "Impact Score" factoring in source diversity and recency.

### 2. Live Updates (SSE)
Built a custom **Server-Sent Events (SSE)** stream (`/api/stream`) to push updates to the dashboard without the overhead of WebSockets. If SSE fails, the system automatically falls back to 5-minute polling.

### 3. Leaflet Geo-Mapping
A customized **Leaflet.js** map provides spatial context to news, with color-coded markers linked directly to current story clusters.

---

## 🛠️ Stack & Infrastructure

*   **Runtime**: Node.js 20.9+ (Essential for SSE and persistent in-memory caching).
*   **Framework**: Next.js 16 (Turbopack enabled) using the App Router.
*   **CSS**: Pure Vanilla CSS logic for maximum performance.
*   **Data Parsing**: `rss-parser` for high-throughput XML/Atom ingestion.

### Nginx Recommendation (SSE Support)
For the live feed to function, Nginx buffering **must** be disabled:
```nginx
location /api/stream {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_cache off;
    chunked_transfer_encoding off;
}
```

---
*Maintained by the FrameTheGlobe Engineering Team.*
