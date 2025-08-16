import OpenAI from "openai";

// Switched from OpenAI to Hugging Face Inference API for free/OSS models.
// Uses a multilingual sentence-transformers model for embeddings.

const HF_EMBED_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2";

function getHFKey() {
  return process.env.HUGGINGFACE_API_KEY || null;
}

function getLocalEmbeddingsUrl() {
  // Example: http://localhost:5001/embed
  // The local server should accept { texts: string[] } and return number[][]
  return process.env.LOCAL_EMBEDDINGS_URL || null;
}

// Local dev notes:
// 1) Create & activate venv and install deps:
//    python -m venv .venv
//    .\.venv\Scripts\Activate
//    pip install -r requirements_local.txt
// 2) Start the local embedding server:
//    python local_embed_server.py
//    (expects POST /embed { texts: string[] } -> number[][])
// 3) Start your local generation server per its docs (e.g. GPT4All or text-generation-webui).
// 4) Create .env.local in the project root with:
//    LOCAL_EMBEDDINGS_URL=http://localhost:5001/embed
//    LOCAL_GPT4ALL_URL=http://localhost:5000/generate
// 5) Restart Next.js dev server so server-side code picks up .env.local.

export async function embed(texts: string[]): Promise<number[][]> {
  const localUrl = getLocalEmbeddingsUrl();
  const hfKey = getHFKey();
  const DIM = 384; // dimension for the chosen model

  // Prefer a local embedding server if provided (zero ongoing spend & minimal ops)
  if (localUrl) {
    try {
      const res = await fetch(localUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts }),
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length === texts.length) {
          // Basic validation: each item should be a numeric array
          if (data.every((d: any) => Array.isArray(d) && typeof d[0] === "number")) {
            return data as number[][];
          }
        }
        console.error("Local embeddings returned unexpected shape, falling back:", data);
      } else {
        const txt = await res.text().catch(() => "");
        console.error("Local embeddings failed:", res.status, txt);
      }
    } catch (err) {
      console.error("Local embeddings call failed, falling back to HF or mock:", err);
    }
    // fall through to HF or mock
  }

  if (!hfKey) {
    // dev fallback: zero vectors
    return texts.map(() => new Array(DIM).fill(0));
  }

  try {
    const res = await fetch(`https://api-inference.huggingface.co/pipeline/feature-extraction/${HF_EMBED_MODEL}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hfKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(texts),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("HF embeddings failed:", res.status, txt);
      return texts.map(() => new Array(DIM).fill(0));
    }

    const data = await res.json();
    // HF returns either an array per input or nested arrays; normalize to number[][]
    return (Array.isArray(data) ? data : []).map((d: any) => {
      // if model returns token vectors, average them
      if (Array.isArray(d[0])) {
        const avg = new Array<number>(d[0].length).fill(0);
        for (const tokenVec of d) {
          for (let i = 0; i < tokenVec.length; i++) avg[i] += tokenVec[i];
        }
        for (let i = 0; i < avg.length; i++) avg[i] /= d.length;
        return avg;
      }
      return d as number[];
    });
  } catch (err) {
    console.error("HF embeddings error, returning mock vectors:", err);
    return texts.map(() => new Array(DIM).fill(0));
  }
}
