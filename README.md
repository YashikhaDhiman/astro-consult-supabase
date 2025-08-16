# astro-consult-supabase

A Next.js + Supabase app with local-first RAG and AI features (embeddings, generation, moderation, analytics).

This README documents how to run the project locally, start the local embedding server (zero-cost), seed the KB, and run the Next.js dev server.

## Prerequisites
- Node.js 18+ and npm (or pnpm/yarn)
- Git
- Python 3.10+ (for the local embedding server)
- Optional: a local generation server (GPT4All or text-generation-webui) if you want local generation

## Important env vars
- `NEXT_PUBLIC_SUPABASE_URL` (client-side)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client-side)
- `SUPABASE_SERVICE_ROLE_KEY` (server-side, keep secret)

## Local model / fallback config (recommended for zero cost dev)
- `LOCAL_EMBEDDINGS_URL=http://localhost:5001/embed`  # points to the local embed server (scripts/local_embed_server.py)
- `LOCAL_GPT4ALL_URL=http://localhost:5000/generate`   # optional - local LLM server endpoint
- `HUGGINGFACE_API_KEY=...`  # optional fallback to Hugging Face inference API

## Repository scripts (package.json)
- `npm run dev`         # Start Next.js dev server
- `npm run build`       # Build
- `npm run start`       # Start production server
- `npm run lint`        # Run linters
- `npm run seed:kb`     # Seed the knowledge base (scripts/seedKB.ts)
- `npm run embed:start` # Create venv (if missing), install deps, and start local embed server (Windows PowerShell)
- `npm run embed:run`   # Start local embed server (assumes venv exists)

## Quick setup (recommended)
1. **Clone & install:**
   ```bash
   git clone <repo>
   cd astro-consult-supabase
   npm install
   ```

2. **Configure environment variables**
- Create a `.env.local` at the project root with the Supabase keys and optional local endpoints, e.g.:

  ```env
  NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=public-anon-key
  SUPABASE_SERVICE_ROLE_KEY=service-role-key
  LOCAL_EMBEDDINGS_URL=http://localhost:5001/embed
  LOCAL_GPT4ALL_URL=http://localhost:5000/generate
  # HUGGINGFACE_API_KEY=your_huggingface_api_key  (optional)
  ```

3. **Start the local embedding server (zero-cost)**
- Windows PowerShell (recommended):
  ```bash
  npm run embed:start
  ```

  This will create a `.venv`, install Python deps from `scripts/requirements_local.txt`, download the sentence-transformers model and start a Flask server at `http://localhost:5001/embed`.

- Manual Python run (cross-platform):
  ```bash
  python -m venv .venv
  .\.venv\Scripts\Activate    # PowerShell
  # or source .venv/bin/activate  # macOS/Linux
  pip install -r scripts/requirements_local.txt
  python scripts/local_embed_server.py
  ```

4. **(Optional) Start a local generation server**
- If you want local generation, run GPT4All or text-generation-webui per their docs and set `LOCAL_GPT4ALL_URL` to the server's generation endpoint (e.g. `http://localhost:5000/generate` or webui `/api/generate`).

5. **Seed the KB (optional but recommended for RAG tests)**
- `npm run seed:kb`

6. **Run the Next.js dev server**
- `npm run dev`
- Restart the dev server after editing `.env.local` so server-side code picks up new env vars.

## Quick tests
- Test local embed server (curl / PowerShell):
  ```bash
  curl -X POST http://localhost:5001/embed -H "Content-Type: application/json" -d "{ \"texts\": [\"hello\", \"नमस्ते\"] }"
  ```

- Test RAG endpoint (example using the app UI or a direct POST to `/api/ask`):
  - `POST /api/ask` with JSON body `{ "chatId": "<id>", "question": "आप कैसे हैं?" }`
  - The server will:
    - call `embed()` which prefers `LOCAL_EMBEDDINGS_URL` → Hugging Face → zero-vector fallback
    - call `generateHindi()` which prefers `LOCAL_GPT4ALL_URL` → Hugging Face → canned fallback

## Notes on behavior and fallbacks
- **Local-first**: the code prefers local endpoints for embeddings and generation when `LOCAL_*` env vars are set.
- **Hosted fallback**: if local endpoints are not available and `HUGGINGFACE_API_KEY` is set, the app will use Hugging Face inference API.
- **Dev fallback**: when neither local nor HF is available, embeddings return zero vectors and generation returns a canned Hindi reply so the UI can be developed without model costs.

## Files & helpers added
- `src/lib/embeddings.ts` — local/HF/mock embedding wrapper
- `src/lib/llm.ts` — local/HF/mock generation wrapper
- `scripts/local_embed_server.py` — lightweight Flask embedding server (sentence-transformers)
- `scripts/requirements_local.txt` — Python dependencies for the local embed server
- `scripts/start-embed.ps1` — PowerShell helper to create venv, install deps and run embed server
- `scripts/start-embed.ps1` is invoked by `npm run embed:start`

## Deploy notes
- Local-first approach is ideal for development and internal testing.
- For production/public usage, self-hosting models requires more ops: GPU/CPU sizing, process managers, TLS, authentication, monitoring, and scaling strategies.
- If you want managed LLMs, you can integrate Hugging Face or Google Vertex AI (Gemini) but those services are paid.

## Support
- If you want I can:
  - Add an `npm` script to start both embed server and Next.js concurrently.
  - Dockerize the embed server and add a docker-compose stub for local deployment.
  - Add a small local generation wrapper to unify GPT4All/webui response shapes.

Thanks — start with `npm run embed:start` then `npm run dev`. If you hit any errors, paste the terminal logs and I will help debug.
