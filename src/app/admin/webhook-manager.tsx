"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/lib/use-locale";
import { toast } from "sonner";
import { Plus, Trash2, Eye, EyeOff } from "lucide-react";

interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  createdAt: string | null;
}

const ALL_EVENTS = [
  "project.created",
  "project.updated",
  "project.archived",
  "project.deadline",
  "proposal.created",
  "proposal.updated",
  "proposal.status_changed",
  "vote.cast",
  "comment.created",
  "user.joined",
  "workflow.stage_changed",
] as const;

export function WebhookManager({
  initialWebhooks,
}: {
  initialWebhooks: Webhook[];
}) {
  const { t } = useLocale();
  const [webhooksList, setWebhooksList] = useState<Webhook[]>(initialWebhooks);
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!url.trim() || selectedEvents.length === 0) return;

    setCreating(true);
    try {
      const res = await fetch("/api/admin/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), events: selectedEvents }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || t("webhooks.createFailed"));
        return;
      }

      const data = await res.json();
      // Show the secret once on creation
      setRevealedSecret(data.webhook.secret);
      setWebhooksList((prev) => [
        ...prev,
        {
          ...data.webhook,
          createdAt: data.webhook.createdAt
            ? new Date(data.webhook.createdAt * 1000).toISOString()
            : null,
        },
      ]);
      setUrl("");
      setSelectedEvents([]);
      toast.success(t("webhooks.created"));
    } catch {
      toast.error(t("webhooks.createFailed"));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/webhooks/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setWebhooksList((prev) => prev.filter((wh) => wh.id !== id));
        toast.success(t("webhooks.deleted"));
      }
    } catch {
      toast.error(t("webhooks.deleteFailed"));
    }
  };

  const handleToggle = async (id: string, active: boolean) => {
    try {
      const res = await fetch(`/api/admin/webhooks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      if (res.ok) {
        setWebhooksList((prev) =>
          prev.map((wh) => (wh.id === id ? { ...wh, active: !active } : wh))
        );
      }
    } catch {
      toast.error(t("webhooks.updateFailed"));
    }
  };

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) =>
      prev.includes(event)
        ? prev.filter((e) => e !== event)
        : [...prev, event]
    );
  };

  return (
    <div className="space-y-4">
      {/* Create form */}
      <div className="space-y-3 rounded-lg border p-4">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t("webhooks.urlPlaceholder")}
          type="url"
        />
        <div className="flex flex-wrap gap-2">
          {ALL_EVENTS.map((event) => (
            <label key={event} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={selectedEvents.includes(event)}
                onChange={() => toggleEvent(event)}
                className="rounded"
              />
              {event}
            </label>
          ))}
        </div>
        <Button
          size="sm"
          onClick={handleCreate}
          disabled={creating || !url.trim() || selectedEvents.length === 0}
        >
          <Plus className="mr-1 h-4 w-4" />
          {creating ? t("webhooks.creating") : t("webhooks.add")}
        </Button>
      </div>

      {/* Secret reveal banner */}
      {revealedSecret && (
        <div className="rounded-lg border border-amber-500 bg-amber-50 p-3 dark:bg-amber-950">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            {t("webhooks.secretReveal")}
          </p>
          <code className="mt-1 block break-all rounded bg-amber-100 p-2 text-xs dark:bg-amber-900">
            {revealedSecret}
          </code>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() => setRevealedSecret(null)}
          >
            {t("webhooks.dismissSecret")}
          </Button>
        </div>
      )}

      {/* Webhook list */}
      {webhooksList.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("webhooks.none")}</p>
      ) : (
        <div className="divide-y rounded-lg border">
          {webhooksList.map((wh) => (
            <div key={wh.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      wh.active ? "bg-green-500" : "bg-gray-400"
                    }`}
                  />
                  <span className="truncate text-sm font-medium">{wh.url}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {wh.events.map((e) => (
                    <span
                      key={e}
                      className="rounded-full bg-muted px-2 py-0.5 text-xs"
                    >
                      {e}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleToggle(wh.id, wh.active)}
                  title={wh.active ? t("webhooks.disable") : t("webhooks.enable")}
                >
                  {wh.active ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => handleDelete(wh.id)}
                  title={t("webhooks.delete")}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
