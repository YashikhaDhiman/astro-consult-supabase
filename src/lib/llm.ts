const HF_GEN_MODEL = "google/mt5-small"; // multilingual text-to-text model

function getHFKey() {
  return process.env.HUGGINGFACE_API_KEY || null;
}

function getLocalGptUrl() {
  // Set to e.g. http://localhost:5000/generate or http://localhost:7860/api/generate
  return process.env.LOCAL_GPT4ALL_URL || null;
}

export async function generateHindi(system: string, user: string, temperature = 0.4) {
  const localUrl = getLocalGptUrl();
  const hfKey = getHFKey();
  const prompt = `${system}\n\n${user}`;

  // If a local GPT4All / text-generation-webui HTTP endpoint is provided, prefer it
  if (localUrl) {
    try {
      const res = await fetch(localUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt, temperature, max_new_tokens: 200 }),
      });

      if (res.ok) {
        // support flexible response shapes from local servers
        const data = await res.json().catch(async () => {
          // if not JSON, return raw text
          const txt = await res.text().catch(() => "");
          return txt;
        });

        if (typeof data === "string") return data;
        if (Array.isArray(data) && data.length > 0) {
          // some servers return [{generated_text: "..."}]
          return data[0].generated_text || data[0].text || "";
        }
        if (data.generated_text) return data.generated_text;
        if (data.text) return data.text;
        if (data.output) {
          // webui-like responses
          if (typeof data.output === "string") return data.output;
          if (Array.isArray(data.output)) return data.output.map((o: any) => o.generated_text || o.text || "").join("\n");
        }

        // fallback: stringify whatever came back
        return String(data);
      }

      const txt = await res.text();
      console.error("Local GPT4All server error:", res.status, txt);
    } catch (err) {
      console.error("Local GPT4All call failed:", err);
    }
    // if local call failed, fall through to HF or canned fallback
  }

  if (!hfKey) {
    // dev fallback: canned Hindi reply
    return "यह डमी उत्तर है — HugginFace API कुंजी गायब है।";
  }

  try {
    const res = await fetch(`https://api-inference.huggingface.co/models/${HF_GEN_MODEL}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hfKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { temperature, max_new_tokens: 200 }
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("HF generation failed:", res.status, txt);
      return "इस विषय पर मेरे पास निश्चित जानकारी नहीं है।";
    }

    const data = await res.json();
    // HF typically returns [{generated_text: "..."}]
    if (Array.isArray(data) && data.length > 0) {
      return data[0].generated_text || data[0].summary_text || "";
    }
    return data.generated_text || "";
  } catch (err) {
    console.error("HF generation error:", err);
    return "इस विषय पर मेरे पास निश्चित जानकारी नहीं है।";
  }
}
