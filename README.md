# Loaf-o-Meter 🐾

A standalone website that rates how "perfect" a cat loaf photo is, using
Google's **Gemini API** for the actual image judging. This runs as a real
Node/Express server, so it works in any browser, not just inside an AI chat app.

```
loaf-o-meter-standalone/
├── server.js          # Express server + Gemini API proxy endpoint
├── package.json
├── .env.example        # copy to .env and fill in your key
└── public/
    └── index.html       # the whole front-end (HTML/CSS/JS in one file)
```

Why a server at all? Calling Gemini directly from client-side JavaScript
would mean shipping your secret API key inside the page source, where
anyone could steal and use it on your bill. So the browser talks to *your*
small server, and your server talks to Gemini using a key that only it knows.

---

## Part 1 — Integrating the Gemini API (image analysis)

### 1. Create a Google AI Studio account and get an API key
1. Go to **https://aistudio.google.com/apikey** and sign in with a Google
   account.
2. Click **Create API key**, and choose or create a Google Cloud project to
   attach it to.
3. Copy the key. You can view/regenerate it later from the same page, so
   losing it isn't fatal — but treat it as a secret.
4. For higher rate limits / production use, enable billing on the attached
   Cloud project under **Google Cloud Console → Billing** (the free tier
   has generous but limited daily quotas, fine for testing).

### 2. Configure the project with your key
1. In the project folder, copy the example env file:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and paste your key:
   ```
   GEMINI_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   PORT=3000
   ```
3. **Never commit `.env` to git or share it publicly.** It's already
   ignored if you set up a `.gitignore` (see Part 2, step 2).

### 3. How the integration actually works (server.js)
- The browser reads the uploaded image, converts it to base64, and `POST`s
  it to your own server at `/api/rate-loaf` — no API key is ever sent to
  the browser.
- `server.js` receives that request, then calls Gemini's `generateContent`
  endpoint:
  ```
  POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent
  Headers:
    x-goog-api-key: <your GEMINI_API_KEY>
    Content-Type: application/json
  Body:
    {
      "system_instruction": { "parts": [{ "text": "<judging rubric prompt>" }] },
      "contents": [{
        "role": "user",
        "parts": [
          { "text": "Judge this cat loaf." },
          { "inline_data": { "mime_type": "<mime>", "data": "<base64>" } }
        ]
      }],
      "generationConfig": { "response_mime_type": "application/json" }
    }
  ```
- Gemini's vision capability inspects the photo directly (no separate
  "computer vision" service needed) and returns a JSON verdict, which the
  server forwards back to the page, which renders the paw score and
  per-criterion notes.
- `generationConfig.response_mime_type: "application/json"` tells Gemini
  to guarantee valid JSON output — the server still strips stray markdown
  fences as a safety net in case that's ever bypassed.

### 4. Install dependencies and run it locally
```bash
npm install
npm start
```
Then open **http://localhost:3000** in your browser and try uploading a photo.

If something goes wrong, check the terminal — `server.js` logs Gemini's raw
error response so you can see exactly what failed (bad key, quota exceeded,
bad image, unsupported model, etc.).

---

## Part 2 — Deploying it as a real, public website

Below is the simplest path: **Render.com** (free tier available, no credit
card needed to start, handles Node servers natively). Alternatives are
listed at the bottom if you'd rather use something else.

### 1. Put the project on GitHub
1. Create a new repository on **https://github.com/new** (e.g. `loaf-o-meter`).
2. Add a `.gitignore` file in the project root so you never push secrets or
   `node_modules`:
   ```
   node_modules/
   .env
   ```
3. From the project folder:
   ```bash
   git init
   git add .
   git commit -m "Loaf-o-Meter initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/loaf-o-meter.git
   git push -u origin main
   ```

### 2. Deploy on Render
1. Go to **https://render.com** and sign up (you can sign in with GitHub).
2. Click **New → Web Service**.
3. Connect your GitHub account and select the `loaf-o-meter` repo.
4. Fill in the settings:
   - **Name:** `loaf-o-meter` (this becomes part of your URL)
   - **Region:** whichever is closest to you
   - **Branch:** `main`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free (fine for personal use/demos)
5. Under **Environment Variables**, click **Add Environment Variable** and add:
   - `GEMINI_API_KEY` = your key from Part 1
   - `PORT` = `10000` (Render sets its own `PORT` automatically, but this is
     a harmless fallback — Render's injected `PORT` env var takes priority)
6. Click **Create Web Service**. Render will install dependencies, start
   the server, and give you a public URL like:
   ```
   https://loaf-o-meter.onrender.com
   ```
7. Open that URL — your site is now live for anyone on the internet.

Note: on Render's free tier, the service "sleeps" after ~15 minutes of no
traffic and takes ~30–60 seconds to wake up on the next visit. Upgrade to a
paid instance if you want it always-on.

### 3. (Optional) Add a custom domain
1. Buy a domain from any registrar (Namecheap, Google Domains, etc.).
2. In Render, go to your service → **Settings → Custom Domains → Add
   Custom Domain**, enter your domain.
3. Render gives you a CNAME record — add it in your domain registrar's DNS
   settings.
4. Wait for DNS to propagate (a few minutes to a few hours) and Render will
   auto-issue an SSL certificate.

### Alternatives to Render
All of these work the same way — push to GitHub, connect the repo, set the
`GEMINI_API_KEY` environment variable, deploy:
- **Railway** (https://railway.app) — similar free-tier flow, very fast setup.
- **Fly.io** (https://fly.io) — deploy via `fly launch` from the CLI, good if
  you want more control over infrastructure.
- **A VPS (DigitalOcean, Linode, EC2, etc.)** — more manual: install Node,
  copy the project over, run `npm install && npm start` behind a process
  manager like `pm2`, and put Nginx in front of it for SSL/domain routing.
  Only worth it if you want full control or plan to scale up significantly.

---

## Costs to expect
- **Hosting:** free tier is enough for personal/demo use on Render or Railway.
- **Gemini API:** Google AI Studio keys include a free daily quota for
  `gemini-3.7-flash`; beyond that (or with billing enabled for higher
  limits) it's billed per token. Check current pricing at
  **https://ai.google.dev/pricing**.

## Troubleshooting
- **"Server is missing GEMINI_API_KEY"** — you forgot to set the env var
  locally (`.env`) or on your hosting provider's dashboard.
- **401/403 from Gemini** — your API key is wrong, restricted, or the
  attached Cloud project doesn't have the Generative Language API enabled.
- **429 from Gemini** — you've hit the free-tier daily/per-minute quota;
  enable billing on the Cloud project for higher limits, or wait for the
  quota to reset.
- **400 mentioning the model** — `gemini-3.7-flash` may not be available in
  your region yet; try `gemini-2.5-flash` in `server.js` instead and restart.
- **Site loads but rating fails** — check your host's server logs (Render:
  service → **Logs** tab) for the exact error `server.js` printed.
