Local GPT4All + Embeddings setup (zero-cost, dev)

1) Local embedding server (Python)
- Script: scripts/local_embed_server.py
- Install and run:
  - python -m venv .venv; .\.venv\Scripts\Activate; pip install -r requirements_local.txt
  - python scripts/local_embed_server.py
- Default server: http://localhost:5001/embed

2) Local generation server
- Options:
  - GPT4All (https://gpt4all.io) — lightweight local models, CLI and API
  - text-generation-webui (https://github.com/oobabooga/text-generation-webui) — more featureful web UI
- Start per their docs. WebUI default API endpoints often look like http://localhost:7860/api/generate
- Example LOCAL_GPT4ALL_URL: http://localhost:5000/generate or http://localhost:7860/api/generate

3) .env.local example
- LOCAL_EMBEDDINGS_URL=http://localhost:5001/embed
- LOCAL_GPT4ALL_URL=http://localhost:5000/generate

4) Notes
- The app prefers LOCAL_* endpoints first, then falls back to Hugging Face, then to mock zero vectors / canned response.
- The local embedding server returns 384-dim vectors compatible with existing DB schema.
- If you want, I can add a lightweight npm script to start the Python server using cross-platform commands.
