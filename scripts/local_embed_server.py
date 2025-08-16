"""
Lightweight local embedding server for development.
- Endpoint: POST /embed
- Request body: { "texts": ["...", "..."] }
- Response: JSON array of embeddings: [[...], [...]]

Uses sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2 (384-dim).
"""
from flask import Flask, request, jsonify
from sentence_transformers import SentenceTransformer
import numpy as np

app = Flask(__name__)

# load model once on startup
model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")

@app.route("/embed", methods=["POST"])
def embed():
    data = request.get_json(force=True) or {}
    texts = data.get("texts") or data.get("text")
    if texts is None:
        return jsonify({"error": "missing 'texts' in request body"}), 400

    if isinstance(texts, str):
        texts = [texts]

    if not isinstance(texts, list):
        return jsonify({"error": "'texts' must be a list or string"}), 400

    # encode -> numpy array (n, dim)
    try:
        embs = model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
        # convert to python lists for JSON
        return jsonify(embs.tolist())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    # default port matches recommended LOCAL_EMBEDDINGS_URL in README
    app.run(host="0.0.0.0", port=5001)
