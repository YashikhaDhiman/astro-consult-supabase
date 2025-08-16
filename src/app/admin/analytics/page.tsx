"use client";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useEffect, useState } from "react";

export default function Analytics() {
  const supabase = createClientComponentClient();
  const [rows, setRows] = useState<any[]>([]);
  const [counts, setCounts] = useState<{ total: number, today: number }>({ total: 0, today: 0 });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("ai_events").select("*").order("created_at", { ascending: false }).limit(100);
      setRows(data || []);
      const { count: total } = await supabase.from("ai_events").select("*", { count: "exact", head: true });
      const { count: today } = await supabase.from("ai_events")
        .select("*", { count: "exact", head: true })
        .gte("created_at", new Date(new Date().setHours(0,0,0,0)).toISOString());
      setCounts({ total: total || 0, today: today || 0 });
    })();
  }, []);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">AI Analytics</h1>
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border">Total Events: {counts.total}</div>
        <div className="p-4 rounded-xl border">Today: {counts.today}</div>
      </div>
      <table className="w-full text-sm">
        <thead><tr><th>Time</th><th>Role</th><th>Latency</th><th>Prompt (trunc)</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-b border-zinc-800">
              <td>{new Date(r.created_at).toLocaleString()}</td>
              <td>{r.role}</td>
              <td>{r.latency_ms} ms</td>
              <td className="max-w-[520px] truncate">{r.prompt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
