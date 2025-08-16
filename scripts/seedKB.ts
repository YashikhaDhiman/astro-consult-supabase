import { createClient } from "@supabase/supabase-js";
import { embed } from "../src/lib/embeddings";

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const docs = [
  {
    title: "परामर्श नीति",
    source: "internal",
    lang: "hi",
    body:
`• यह AI सहायक केवल सामान्य मार्गदर्शन देता है।
• अंतिम सलाह मानव ज्योतिषी देंगे।
• मूल्य, समय-सारणी, और गोपनीयता नीति यहाँ दी गई है…`
  },
  {
    title: "सेवा सीमाएँ",
    source: "internal",
    lang: "hi",
    body:
`• चिकित्सा/कानूनी/वित्तीय निश्चित दावे नहीं।
• संवेदनशील व्यक्तिगत डेटा साझा न करें।
• आपातकाल में स्थानीय सेवाओं से संपर्क करें।`
  }
];

async function main() {
  for (const d of docs) {
    const { data: doc } = await supa.from("kb_docs").insert(d).select().single();
    if (!doc) continue;

    // naive chunking ~1000 chars
    const chunks: string[] = [];
    const CH = 1000;
    for (let i = 0; i < d.body.length; i += CH) chunks.push(d.body.slice(i, i+CH));

    const embs = await embed(chunks);
    const rows = chunks.map((content, i) => ({
      doc_id: doc.id,
      content,
      embedding: embs[i] as unknown as any
    }));

    await supa.from("kb_chunks").insert(rows);
  }
  console.log("Seeded KB.");
}
main();
