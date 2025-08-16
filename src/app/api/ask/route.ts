import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { embed } from "@/lib/embeddings";
import { generateHindi } from "@/lib/llm";
import { redact, isSensitive } from "@/lib/moderate";

const RAG_SYSTEM = `
आपको केवल दिए गए संदर्भ से उत्तर देना है। संदर्भ में न हो तो कहें:
"इस विषय पर मेरे पास निश्चित जानकारी नहीं है।"
हमेशा हिंदी में, संक्षेप में, और अंत में 2-3 संदर्भ [1][2] जैसे दिखाएँ。
`;

export async function POST(req: NextRequest) {
  const { chatId, question } = await req.json();

  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const [qEmb] = await embed([question]);

  const { data: chunks, error } = await supa.rpc("match_kb_chunks", {
    query_embedding: qEmb,
    match_count: 4
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ctx = (chunks || []).map((c: any, i: number) => `【${i+1}】${c.content}`).join("\n\n");
  const user = `प्रश्न: ${question}\n\nसंदर्भ:\n${ctx}`;

  const t0 = Date.now();
  const answer = await generateHindi(RAG_SYSTEM, user, 0.3);
  const latency = Date.now() - t0;

  // moderation: redact sensitive pieces before saving/displaying
  const sensitive = isSensitive(answer);
  const redactedAnswer = sensitive ? "[Content removed for safety]" : redact(answer);

  // log event (store redacted response)
  await supa.from("ai_events").insert({
    chat_id: chatId,
    role: "assistant",
    prompt: user,
    response: redactedAnswer,
    retrieved_chunk_ids: (chunks || []).map((c: any) => c.id),
    latency_ms: latency
  });

  // (optional) store AI reply as a message (store redacted)
  if (chatId && redactedAnswer) {
    await supa.from("messages").insert({
      chat_id: chatId,
      sender_id: null,   // leave null or use a fixed 'AI' uuid if you prefer
      role: "assistant",
      content: redactedAnswer
    });
  }

  return NextResponse.json({ answer: redactedAnswer, citations: (chunks || []).map((c: any, i: number) => ({ n: i+1, id: c.id, doc_id: c.doc_id })) });
}
