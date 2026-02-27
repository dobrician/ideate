"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocale } from "@/lib/use-locale";
import { toast } from "sonner";
import {
  Plus, Trash2, Eye, EyeOff, Send, Key, Webhook, MessageSquare,
  RefreshCw, Copy, BarChart3,
} from "lucide-react";

interface IntegrationItem {
  id: string;
  platform: string;
  name: string;
  webhookUrl: string;
  events: string[];
  active: boolean;
}

interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string;
  tier: string;
  rateLimit: number;
  rateLimitWindow: number;
  lastUsedAt: string | null;
  revoked: boolean;
  totalRequests: number;
  createdAt: string | null;
}

interface DeliveryStats {
  total: number;
  success: number;
  failed: number;
  pending: number;
}

export function IntegrationsDashboard() {
  const { t } = useLocale();
  const [integrationsList, setIntegrationsList] = useState<IntegrationItem[]>([]);
  const [apiKeysList, setApiKeysList] = useState<ApiKeyItem[]>([]);
  const [deliveryStats, setDeliveryStats] = useState<DeliveryStats | null>(null);
  const [keyStats, setKeyStats] = useState<{ totalKeys: number; activeKeys: number; totalRequests: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  // Integration form
  const [platform, setPlatform] = useState<string>("slack");
  const [intName, setIntName] = useState("");
  const [intUrl, setIntUrl] = useState("");
  const [intEvents, setIntEvents] = useState<string[]>([]);

  // API Key form
  const [keyName, setKeyName] = useState("");
  const [keyTier, setKeyTier] = useState("basic");

  const availableEvents = [
    "project.created", "project.updated", "project.archived", "project.deadline",
    "proposal.created", "proposal.updated", "proposal.status_changed",
    "vote.cast", "comment.created", "user.joined", "workflow.stage_changed",
  ];

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [intRes, keyRes, whRes] = await Promise.all([
        fetch("/api/admin/integrations"),
        fetch("/api/admin/api-keys"),
        fetch("/api/admin/webhooks"),
      ]);

      if (intRes.ok) {
        const data = await intRes.json();
        setIntegrationsList(data.integrations || []);
      }
      if (keyRes.ok) {
        const data = await keyRes.json();
        setApiKeysList(data.keys || []);
        setKeyStats(data.stats || null);
      }
      if (whRes.ok) {
        const data = await whRes.json();
        setDeliveryStats(data.deliveryStats || null);
      }
    } catch {
      toast.error(t("integrations.loadFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateIntegration() {
    if (!intName.trim() || !intUrl.trim() || intEvents.length === 0) return;
    try {
      const res = await fetch("/api/admin/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, name: intName, webhookUrl: intUrl, events: intEvents }),
      });
      if (res.ok) {
        toast.success(t("integrations.created"));
        setIntName("");
        setIntUrl("");
        setIntEvents([]);
        loadData();
      } else {
        const data = await res.json();
        toast.error(data.error || t("integrations.createFailed"));
      }
    } catch {
      toast.error(t("integrations.createFailed"));
    }
  }

  async function handleTestIntegration(id: string) {
    try {
      const res = await fetch("/api/admin/integrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", id }),
      });
      const data = await res.json();
      if (data.result?.ok) {
        toast.success(t("integrations.testSuccess"));
      } else {
        toast.error(t("integrations.testFailed"));
      }
    } catch {
      toast.error(t("integrations.testFailed"));
    }
  }

  async function handleToggleIntegration(id: string) {
    try {
      const res = await fetch("/api/admin/integrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", id }),
      });
      if (res.ok) {
        loadData();
      }
    } catch {
      toast.error(t("integrations.updateFailed"));
    }
  }

  async function handleDeleteIntegration(id: string) {
    try {
      const res = await fetch(`/api/admin/integrations?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setIntegrationsList((prev) => prev.filter((i) => i.id !== id));
        toast.success(t("integrations.deleted"));
      }
    } catch {
      toast.error(t("integrations.deleteFailed"));
    }
  }

  async function handleCreateApiKey() {
    if (!keyName.trim()) return;
    try {
      const res = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: keyName,
          scopes: ["read:projects", "read:proposals", "read:votes"],
          tier: keyTier,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setRevealedKey(data.rawKey);
        setKeyName("");
        toast.success(t("integrations.keyCreated"));
        loadData();
      } else {
        const data = await res.json();
        toast.error(data.error || t("integrations.keyCreateFailed"));
      }
    } catch {
      toast.error(t("integrations.keyCreateFailed"));
    }
  }

  async function handleRevokeKey(id: string) {
    try {
      const res = await fetch(`/api/admin/api-keys?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(t("integrations.keyRevoked"));
        loadData();
      }
    } catch {
      toast.error(t("integrations.keyRevokeFailed"));
    }
  }

  function toggleEvent(event: string) {
    setIntEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  }

  const platformIcons: Record<string, string> = { slack: "Slack", teams: "Teams", discord: "Discord" };

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">{t("common.loading")}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Webhook className="h-4 w-4" />
              {t("integrations.deliveriesTotal")}
            </div>
            <p className="mt-1 text-2xl font-bold">{deliveryStats?.total ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-green-600">
              <BarChart3 className="h-4 w-4" />
              {t("integrations.deliveriesSuccess")}
            </div>
            <p className="mt-1 text-2xl font-bold text-green-600">{deliveryStats?.success ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <RefreshCw className="h-4 w-4" />
              {t("integrations.deliveriesFailed")}
            </div>
            <p className="mt-1 text-2xl font-bold text-destructive">{deliveryStats?.failed ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Key className="h-4 w-4" />
              {t("integrations.activeKeys")}
            </div>
            <p className="mt-1 text-2xl font-bold">{keyStats?.activeKeys ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Platform Integrations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {t("integrations.platformTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Create form */}
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex gap-2">
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="slack">Slack</option>
                <option value="teams">Microsoft Teams</option>
                <option value="discord">Discord</option>
              </select>
              <Input
                value={intName}
                onChange={(e) => setIntName(e.target.value)}
                placeholder={t("integrations.namePlaceholder")}
                className="flex-1"
              />
            </div>
            <Input
              value={intUrl}
              onChange={(e) => setIntUrl(e.target.value)}
              placeholder={t("integrations.webhookUrlPlaceholder")}
              type="url"
            />
            <div className="flex flex-wrap gap-2">
              {availableEvents.map((event) => (
                <label key={event} className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={intEvents.includes(event)}
                    onChange={() => toggleEvent(event)}
                    className="rounded"
                  />
                  {event}
                </label>
              ))}
            </div>
            <Button
              size="sm"
              onClick={handleCreateIntegration}
              disabled={!intName.trim() || !intUrl.trim() || intEvents.length === 0}
            >
              <Plus className="mr-1 h-4 w-4" />
              {t("integrations.addIntegration")}
            </Button>
          </div>

          {/* Integrations list */}
          {integrationsList.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("integrations.noIntegrations")}</p>
          ) : (
            <div className="divide-y rounded-lg border">
              {integrationsList.map((integration) => (
                <div key={integration.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block h-2 w-2 rounded-full ${integration.active ? "bg-green-500" : "bg-gray-400"}`} />
                      <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium uppercase">
                        {platformIcons[integration.platform] || integration.platform}
                      </span>
                      <span className="truncate text-sm font-medium">{integration.name}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {integration.events.map((e) => (
                        <span key={e} className="rounded-full bg-muted px-2 py-0.5 text-xs">{e}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => handleTestIntegration(integration.id)} title={t("integrations.test")}>
                      <Send className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleToggleIntegration(integration.id)}>
                      {integration.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDeleteIntegration(integration.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            {t("integrations.apiKeysTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Create form */}
          <div className="flex gap-2 rounded-lg border p-4">
            <Input
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder={t("integrations.keyNamePlaceholder")}
              className="flex-1"
            />
            <select
              value={keyTier}
              onChange={(e) => setKeyTier(e.target.value)}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="basic">Basic (100/hr)</option>
              <option value="pro">Pro (1000/hr)</option>
              <option value="enterprise">Enterprise (10000/hr)</option>
            </select>
            <Button size="sm" onClick={handleCreateApiKey} disabled={!keyName.trim()}>
              <Plus className="mr-1 h-4 w-4" />
              {t("integrations.createKey")}
            </Button>
          </div>

          {/* Key reveal */}
          {revealedKey && (
            <div className="rounded-lg border border-amber-500 bg-amber-50 p-3 dark:bg-amber-950">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                {t("integrations.keyRevealMessage")}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 break-all rounded bg-amber-100 p-2 text-xs dark:bg-amber-900">
                  {revealedKey}
                </code>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => { navigator.clipboard.writeText(revealedKey); toast.success("Copied!"); }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => setRevealedKey(null)}>
                {t("integrations.dismissKey")}
              </Button>
            </div>
          )}

          {/* Keys list */}
          {apiKeysList.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("integrations.noKeys")}</p>
          ) : (
            <div className="divide-y rounded-lg border">
              {apiKeysList.map((key) => (
                <div key={key.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block h-2 w-2 rounded-full ${key.revoked ? "bg-red-500" : "bg-green-500"}`} />
                      <span className="text-sm font-medium">{key.name}</span>
                      <code className="rounded bg-muted px-2 py-0.5 text-xs">{key.keyPrefix}...</code>
                      <span className="rounded bg-muted px-2 py-0.5 text-xs uppercase">{key.tier}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {key.totalRequests} {t("integrations.requests")} | {key.rateLimit}/{t("integrations.perHour")}
                      {key.lastUsedAt ? ` | ${t("integrations.lastUsed")}: ${new Date(key.lastUsedAt).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  {!key.revoked && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      onClick={() => handleRevokeKey(key.id)}
                    >
                      {t("integrations.revoke")}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
