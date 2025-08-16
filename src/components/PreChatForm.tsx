"use client";
import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type Props = { chatId?: string; onDone?: () => void };

export default function PreChatForm({ chatId, onDone }: Props) {
  const supabase = createClientComponentClient();
  const [meta, setMeta] = useState<any>({});
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: chat } = await supabase
        .from("chats")
        .select("meta")
        .eq("id", chatId)
        .maybeSingle();
      setMeta(chat?.meta || {});
    };
    load();
  }, [chatId]);

  const send = async (message: string) => {
    setLoading(true);
    const res = await fetch("/api/triage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, message }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.error) return alert(data.error);
    setMeta(data.meta || {});
    setFollowUp(data.followUpQuestion || null);
    if (data.done) {
      setDone(true);
      onDone?.();
    }
  };

  if (done)
    return (
      <div className="p-4">
        Pre-chat complete. You may proceed to the chat.
      </div>
    );

  return (
    <div className="space-y-2 p-4 rounded-xl border border-zinc-800">
      <h3 className="text-lg font-semibold">Quick pre-chat triage</h3>

      <div className="mb-2">
        <label className="block text-sm text-gray-300">
          Your question (optional)
        </label>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="mt-1 p-2 w-full rounded bg-gray-700"
        />
      </div>

      {followUp && (
        <div className="mb-2 text-yellow-200">Follow-up: {followUp}</div>
      )}

      <div className="flex gap-2">
        <button
          className="px-4 py-2 bg-blue-600 rounded"
          onClick={() => send(question || "")}
          disabled={loading}
        >
          {loading ? "Asking..." : "Continue"}
        </button>
        <button
          className="px-4 py-2 bg-gray-600 rounded"
          onClick={async () => {
            await supabase
              .from("chats")
              .update({ meta })
              .eq("id", chatId);
            onDone?.();
          }}
        >
          Save & Continue (manual)
        </button>
      </div>
    </div>
  );
}
