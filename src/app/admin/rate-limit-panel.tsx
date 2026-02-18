"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface RateLimitKey {
  key: string;
  hitCount: number;
  oldestHit: number;
}

interface RateLimitStats {
  totalKeys: number;
  keys: RateLimitKey[];
}

export function RateLimitPanel() {
  const [stats, setStats] = useState<RateLimitStats | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/rate-limits");
      if (res.ok) setStats(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {stats ? `${stats.totalKeys} active key${stats.totalKeys !== 1 ? "s" : ""}` : "Loading..."}
        </p>
        <Button size="sm" variant="outline" onClick={fetchStats} disabled={loading} aria-label="Refresh rate-limit stats">
          <RefreshCw className={`mr-1 h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>
      {stats && stats.keys.length > 0 ? (
        <div className="max-h-64 overflow-auto rounded border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-left">
              <tr>
                <th className="px-3 py-2">Key</th>
                <th className="px-3 py-2 text-right">Hits</th>
                <th className="px-3 py-2 text-right">Age</th>
              </tr>
            </thead>
            <tbody>
              {stats.keys.map((k) => (
                <tr key={k.key} className="border-t">
                  <td className="px-3 py-1.5 font-mono text-xs break-all">{k.key}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{k.hitCount}</td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground">
                    {Math.round((Date.now() - k.oldestHit) / 60_000)}m
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : stats ? (
        <p className="text-sm italic text-muted-foreground">No active rate-limit entries.</p>
      ) : null}
    </div>
  );
}
