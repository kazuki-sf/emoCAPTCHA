## emoCAPTCHA

This project is a CAPTCHA-like authentication system where the user is shown an emoji and must mimic the same facial expression in front of their camera to pass the verification.

Built with Next.js 15, React 19, and Tailwind CSS. Scoring supports two engines:

### Name
The “emo” in `emoCAPTCHA` stands for both “emotion” and “emoji”.

- On-device (MediaPipe Tasks Vision) — private and fast, no network calls
- Cloud (OpenAI Vision) — simple and robust; requires `OPENAI_API_KEY`

### Tech stack
- Next.js (App Router, Turbopack)
- React 19
- Tailwind CSS
- MediaPipe Tasks Vision (on-device face blendshapes)
- OpenAI Vision API (optional)

### Built with Cursor/Windsurf + GPT-5
This project was pair‑programmed in Cursor/Windsurf with GPT‑5 assistance.

### Project vision
Regular CAPTCHAs are tedious. emoCAPTCHA makes verification playful by asking people to mimic emojis. Beyond fun, the goal is societal benefit: modern AI still struggles with reading human emotions, and ethically sourced examples of real facial expressions can help improve that. If users choose to contribute, their emoji-matching selfies could form a valuable dataset to train models to better understand human emotions.

Ethics and privacy are central: any data contribution must be strictly opt‑in, consented, and protected with clear retention and anonymization policies. This repo ships with data collection disabled by default.

## Demo

<video src="./public/demo.mp4" controls playsinline muted width="720"></video>

## Quick start

Prereqs: Node.js 20+, a browser with webcam access.

1) Install dependencies (pick ONE package manager and stick with it):

```bash
# npm (recommended)
npm install

# or Yarn
yarn install
```

2) Optional: enable OpenAI scoring by creating `.env.local`:

```bash
OPENAI_API_KEY=sk-...
# optional overrides
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_VISION_MODEL=gpt-5
```

3) Run the dev server (defaults to port 3000):

```bash
npm run dev
# or: PORT=3000 npm run dev
# or: yarn dev
```

Open `http://localhost:3000`.

---

## How it works
- UI: `components/EmoCaptcha.tsx` renders the camera, emoji challenge, and verification flow.
- Challenges: `constants/emojis.ts` defines all emoji prompts and local thresholds.
- Cloud scoring: `app/api/score/route.ts` calls the OpenAI Vision model and returns `{ matched, confidence, reasons, model }`.
- On-device scoring: MediaPipe face blendshapes are evaluated locally against thresholds.

By default, the component uses the cloud engine (OpenAI). If the cloud call fails, it automatically falls back to on‑device scoring. There is no visible engine toggle in the UI:

```ts
// components/EmoCaptcha.tsx
const [engine] = useState<'mediapipe' | 'openai'>('openai')
```

You can change the default engine in code by editing the initial `useState` value if desired.

---

## API
### POST `/api/score`
Scores a captured selfie against the active emoji challenge using OpenAI Vision.

Request body:

```json
{
  "imageDataUrl": "data:image/jpeg;base64,...",
  "challenge": { "id": "sleep", "emoji": "😴", "label": "Sleep (eyes closed)" }
}
```

Response:

```json
{
  "matched": true,
  "confidence": 0.71,
  "reasons": ["eyes mostly closed", "drooped eyelids / drowsy gaze", "relaxed mouth and jaw"],
  "model": "gpt-5"
}
```

Notes:
- Env validation: if `OPENAI_API_KEY` is not set, the endpoint returns an error.
- Rate limiting: best‑effort in‑memory limiter (30 req/min per client). Use Redis/Upstash in production.
- Confidence is rounded to two decimals; pass threshold is ≥ 0.60.

Security headers: `next.config.ts` sets CSP, Permissions‑Policy (camera allowed only for self), HSTS, and other hardened defaults.

---

## Privacy
- On-device mode: images never leave the browser. MediaPipe model is loaded from a public CDN.
- Cloud mode: the captured image is sent to the configured OpenAI API endpoint. Do not enable without user consent.

---

## Development
- Start: `npm run dev` (or `yarn dev`). If port 3000 is busy, Next.js selects the next available port.
- Build: `npm run build` → `npm start`.
- Key files:
  - `components/EmoCaptcha.tsx` — main UI and verification logic
  - `app/api/score/route.ts` — OpenAI Vision scoring
  - `constants/emojis.ts` — emoji challenges and thresholds

Add a new challenge:
1. Append to `EMOJI_CHALLENGES` in `constants/emojis.ts`.
2. Update the switch in `components/EmoCaptcha.tsx` inside `evaluateChallenge` for on-device rules (if needed).

---

## Troubleshooting
- Camera not working: ensure browser permissions are granted for the site.
- Port conflict: stop existing servers on 3000 (`lsof -ti :3000 | xargs kill -9`) or run `PORT=3000 npm run dev`.
- MediaPipe model load issues: verify network access to `cdn.jsdelivr.net`.
- Mixed lockfiles: avoid using both npm and Yarn. Prefer one and delete the other lockfile.

---

## License
MIT — see `LICENSE` for details.
