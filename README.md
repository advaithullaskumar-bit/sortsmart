# SortSmart ♻️
> **Vision-Powered Waste Segregation & Intelligence Core**

SortSmart is an AI-powered waste classification system designed to analyze household, campus, and industrial waste items using multimodal computer vision (Google Gemini API). It features a safety-first decision engine that prioritizes hazard safety, cross-checks vision perception against policy rules, and prevents misclassification of contaminated or uncertain items.

---

## ✨ Features

- 📸 **Vision AI Classification**: Analyzes images to classify items into four primary waste streams:
  - **Wet Waste** (Compostable / Organic)
  - **Dry Waste** (Recyclables, Packaging, Paper, Plastic, Metal)
  - **E-Waste** (Electronics, Cables, Small Appliances)
  - **Hazardous Waste** (Batteries, Chemicals, Sharps, Pharmaceuticals)
- 🛡️ **Safety-First Decision Engine**:
  - Overrides low-confidence perception outputs (`< 72%` confidence triggers human check).
  - Enforces safety rules (e.g., batteries are routed to Hazardous Waste even if tagged as E-waste).
  - Explicitly flags ambiguous or contaminated items for human review instead of guessing.
- 🧪 **Preloaded Test Suite**: Includes sample test images covering single items, mixed bags, e-waste, and hazardous waste.
- ⚡ **Dual Deployment Architecture**:
  - Standalone Node.js server (`server.mjs`) for local development.
  - Vercel serverless API function (`api/classify.mjs`) for cloud deployment.

---

## 🛠️ Tech Stack

- **Backend / API**: Node.js (ES Modules), Vercel Serverless Functions
- **AI Model**: Google Gemini 3.7 / 3.6 Flash Multimodal API
- **Frontend**: HTML5, CSS3, Vanilla JavaScript (Static Web Interface)
- **Deployment**: Local Node server or Vercel

---

## 📂 Project Structure

```
.
├── api/
│   └── classify.mjs         # Vercel serverless function endpoint for vision classification
├── outputs/
│   ├── index.html           # Main web interface & dashboard
│   └── test-images/         # Sample test dataset for verification
│       ├── 01-single-organic-banana-peel.png
│       ├── 02-single-dry-plastic-and-cardboard.png
│       ├── 03-mixed-bag-four-materials.png
│       ├── 04-e-waste-phone-cable-earbuds.png
│       ├── 05-ambiguous-contaminated-pile.png
│       └── 06-hazardous-batteries.png
├── decision-engine.mjs      # Policy core & confidence verification rules
├── server.mjs               # Express-compatible standalone Node.js development server
├── package.json             # Node.js project manifest
├── vercel.json              # Vercel deployment configuration
├── DEPLOYMENT.md            # Vercel deployment checklist
└── .env.example             # Environment variable template
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- A [Google Gemini API Key](https://aistudio.google.com/)

### Installation & Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/advaithullaskumar-bit/sortsmart.git
   cd sortsmart
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to `.env` (or set environment variables in your terminal):
   ```bash
   cp .env.example .env
   ```
   Set your API credentials in your environment or `.env`:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-3.7-flash
   PORT=8787
   ```

3. **Start the Development Server**:
   ```bash
   npm start
   ```
   Open `http://localhost:8787` in your browser.

---

## 🚢 Deployment

### Deploying to Vercel

1. Import the repository into [Vercel](https://vercel.com).
2. Configure Environment Variables in Vercel project settings:
   - `GEMINI_API_KEY`: Your Gemini API Key.
   - `GEMINI_MODEL`: `gemini-3.6-flash` or `gemini-3.7-flash`.
3. Deploy! Vercel serves the static UI from `outputs/index.html` and routes `/api/classify` to the serverless function.

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.
