# DualTranslate

Real-time dual-language speech translation app powered by Gemini Live API.

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create local env file:
   ```bash
   cp .env.example .env.local
   ```
3. Set your API key in `.env.local`:
   ```bash
   VITE_GEMINI_API_KEY=your_key
   ```
4. Run dev server:
   ```bash
   npm run dev
   ```

## Vercel Deployment

1. Import this repo in Vercel.
2. In Vercel Project Settings -> Environment Variables, add:
   - `VITE_GEMINI_API_KEY`
3. Keep build settings:
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Deploy.

The repo includes `vercel.json` with SPA rewrites so all routes resolve to `index.html`.
