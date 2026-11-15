# SMART TRADER AI — Real-Time Bilingual Voice & Indian Market Research Assistant

An educational NSE/BSE equity research workstation paired with a **real-time Voice-to-Voice AI Assistant** supporting **Bengali (`বাংলা`)**, **English**, and **Bengali-English mixed** speech and text.

> **Disclaimer**: Educational research tool only. Not investment advice. Markets involve risk of loss. Use SEBI-registered brokers.

---

## Features Implemented

### Real-Time Voice-to-Voice Assistant (`VOICE ASSISTANT`)
- **Bilingual & Code-Switching Intelligence**: Understands and responds naturally in Bengali (`"আজ কেমন আছো?"`), English (`"How is the market today?"`), and Bengali-English mixed (`"আজ HDFC Bank-এর RSI কত এবং EMA 20-এর উপরে আছে কি?"`).
- **Low-Latency Streaming Pipeline**:
  - Microphone capture + real-time Web Audio `AnalyserNode` waveform visualization.
  - Web `SpeechRecognition` live interim transcripts (`bn-IN` / `en-IN`) + MediaRecorder transcription fallback (`/api/voice/transcribe` via `gemini-3.5-transcribe`).
  - Server-Sent Events (SSE) streaming from `/api/voice/stream` (`gemini-4-hydrogen` or configurable model).
  - Sentence-level streaming browser `SpeechSynthesis` + optional Gemini Neural TTS (`/api/voice/tts` via `gemini-3.8-flash-lite-tts`).
- **Mandatory Barge-In / Interruption**: Tap **Interrupt AI** or start speaking while AI audio plays — TTS stops immediately, unfinished streams abort cleanly via `AbortController`, and listening resumes.
- **Conversation Memory & Context**: Resolves follow-ups (`"এর RSI কত?"` → active `HDFCBANK` context) with local search, rename, export, and a **Save Conversation History ON/OFF** privacy toggle.
- **Command Router & Market Integration**: Routes spoken intents (`MARKET_STATUS`, `STOCK_ANALYSIS`, `WATCHLIST`, `RISK_CALCULATOR`, `JOURNAL`, `SETTINGS`, `HELP`) across the **150-Stock Indian Equity Universe** (`50 Nifty 50` + `50 Midcap` + `50 Smallcap`) using verified JSON data (`null` for missing fields; never invents prices).

### Deterministic Market & Risk Engines
- Data Integrity Panel, Corporate Action checks, Configurable & Strict Smallcap Liquidity Filter, EMA 20/50/200, RSI 14, MACD (12,26,9), Bollinger Bands, ATR 14, ADX 14, VWAP, Fibonacci, Fundamental 100-pt Scoring, Risk/Position Sizing Calculator, Paper Trading, 22-Field Trade Journal, Zero-Look-Ahead Backtester, and Signal Audit Trail.

---

## Which Features Work Standalone vs External APIs

| Feature | Standalone / Local | External Requirement |
| --- | --- | --- |
| Technical indicators, Risk sizing, Backtesting, Journal, Paper Trading | 100% deterministic in-browser | None |
| 150-Stock NSE/BSE Universe + CSV Upload | Included (Demo/CSV data) | Live broker feed (Phase 2 future) |
| Voice Waveform, Web Speech Recognition (STT) & SpeechSynthesis (TTS) | Browser Web Audio & Web Speech API | Chrome/Edge/Safari microphone permission |
| Gemini Streaming Explanations, Transcribe Fallback, Neural TTS | Demo Mode deterministic fallback | `GEMINI_API_KEY` on server |

---

## Gemini API Setup (Security First)

Never place `GEMINI_API_KEY` inside browser JavaScript or commit `.env` / `.env.local` files.

1. For **local development**, create `.env.local` in the project root (already ignored by `.gitignore`):
   ```env
   GEMINI_API_KEY="your_server_side_gemini_api_key"
   GEMINI_MODEL="gemini-4-hydrogen"
   ```
2. In **Google AI Studio / Cloud Run / Vercel / Netlify**, configure `GEMINI_API_KEY` inside your platform's **Environment Variables / Secrets** panel.

---

## Local Development

```bash
npm install
npm run dev
```
Open `http://localhost:3000` in Chrome or Edge (HTTPS or `localhost` is required for microphone access).

### Production Build
```bash
npm run build
npm run start
```

---

## How to Test Bengali, English & Mixed Voice

1. Open the **VOICE ASSISTANT** tab and leave Language on **AUTO** (or test **বাংলা**, **English**, **বাংলা + English**).
2. Click the large **Tap to Speak** microphone button (allow microphone permission when prompted) or run the built-in **12-Case Voice Test Suite** inside the Voice Assistant drawer:
   - **English**: `"Hello, how are you?"`, `"What can you do?"`, `"Stop."`
   - **Bengali**: `"আজ কেমন আছো?"`, `"এটা একটু সহজ করে বলুন."`, `"আবার বলুন."`, `"আমার watchlist দেখাও."`
   - **Bengali-English Mixed**: `"আজ market কেমন?"`, `"Please explain Nifty in Bengali."`, `"HDFC Bank-এর RSI কত?"`, `"EMA 20 আর EMA 50-এর difference explain করো."`, `"English-এ আবার বলুন."`

---

## Troubleshooting & Security Notes
- **Microphone Denied (`NotAllowedError`)**: Enable microphone access in browser site settings (`localhost` or `https://`), or use the **Text Input Fallback** bar anytime.
- **No Bengali Browser Voice Installed**: Enable **Gemini Neural TTS** inside Voice Settings to synthesize natural Bengali & English WAV audio server-side.
- **Demo Mode**: If `GEMINI_API_KEY` is missing on the server, the app starts cleanly in **DEMO MODE** with deterministic market replies instead of crashing.
- **What to Build Next**: Connect a SEBI-registered Broker Read-Only OAuth quote/holdings adapter (`BrokerAPIProvider` Phase 2) and WebSocket live ticks (`gemini-3.8-live` bidirectional audio bridge).
