// Reusable triage processor
import { generateHindi } from './llm';

export const TRIAGE_FIELDS = ['name', 'birth_date', 'birth_time', 'place', 'question'] as const;
export type TriageMeta = Partial<Record<typeof TRIAGE_FIELDS[number], string>>;

const TRIAGE_SYSTEM = `You are a triage assistant for collecting a user's details before a consultation. Return a JSON object with keys: name, birth_date (YYYY-MM-DD if known), birth_time (HH:MM or unknown), place (city, country), question (their short question). If you must ask a follow-up, reply primarily with a short JSON object containing the fields you know and nothing else, or a short plain-text follow-up question. Keep the follow-up question concise.`;

function tryParseJSON(text: string): any | null {
  // attempt direct parse
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch (e) {
    // continue
  }
  // attempt to extract first {...} block
  const re = /\{[\s\S]*?\}/m;
  const m = text.match(re);
  if (m) {
    try {
      const parsed = JSON.parse(m[0]);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (e) {
      // ignore
    }
  }
  // fallback: try key: value lines
  const obj: Record<string, any> = {};
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const kv = line.split(':').map(s => s.trim());
    if (kv.length >= 2) {
      const key = kv[0].toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const val = kv.slice(1).join(':').trim();
      obj[key] = val;
    }
  }
  if (Object.keys(obj).length > 0) return obj;
  return null;
}

export async function processTriage(currentMeta: TriageMeta, userMessage: string) {
  // Build user context combining current meta
  const metaContext = { ...currentMeta };
  const userStr = `USER_MESSAGE:\n${userMessage}\n\nCURRENT_META:\n${JSON.stringify(metaContext)}`;

  // Call LLM
  const reply = await generateHindi(TRIAGE_SYSTEM, userStr, 0.0);

  // Parse reply robustly
  const parsed = tryParseJSON(reply || '');

  const merged: TriageMeta = { ...currentMeta };
  if (parsed && typeof parsed === 'object') {
    for (const k of Object.keys(parsed)) {
      const key = k.toLowerCase();
      if ((TRIAGE_FIELDS as readonly string[]).includes(key)) {
        merged[key as keyof TriageMeta] = String(parsed[k]).trim();
      }
    }
  }

  // Determine missing fields
  const missing = (TRIAGE_FIELDS as readonly string[]).filter((f) => !merged[f as keyof TriageMeta] || merged[f as keyof TriageMeta] === '');

  if (missing.length === 0) {
    return { done: true as const, meta: merged };
  }

  // If parsed contained a plain-text follow-up question, use it; else craft one asking first missing
  let followUpQuestion: string | null = null;
  if (!parsed) {
    // no parse, ask for first missing
    followUpQuestion = `कृपया अपना ${missing[0]} बताइए।`;
  } else {
    // if parsed had a 'followUp' or 'question' or any short sentence, prefer that
    if (parsed.followUp) followUpQuestion = String(parsed.followUp);
    else if (parsed.question && typeof parsed.question === 'string' && parsed.question.length < 200) followUpQuestion = parsed.question;
    else followUpQuestion = `कृपया अपना ${missing[0]} बताइए।`;
  }

  return { done: false as const, followUpQuestion, meta: merged };
}
