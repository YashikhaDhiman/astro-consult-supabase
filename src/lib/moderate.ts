export function redact(text: string) {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email redacted]")
    .replace(/\b(\+?\d[\d\s-]{7,})\b/g, "[phone redacted]");
}

export function isSensitive(text: string) {
  const banned = [/suicide/i, /self-harm/i];
  return banned.some(r => r.test(text));
}
