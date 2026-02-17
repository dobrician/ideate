"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/lib/use-locale";
import { Mail } from "lucide-react";
import { toast } from "sonner";

interface Invitation {
  id: string;
  email: string;
  status: string;
  expiresAt: string | number | null;
  createdAt: string | number | null;
  inviterEmail: string | null;
}

export function InvitationPanel({
  initialInvitations,
}: {
  initialInvitations: Invitation[];
}) {
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [invites, setInvites] = useState<Invitation[]>(initialInvitations);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setSending(true);
    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          toast.error(
            data.error?.includes("already exists")
              ? t("admin.inviteAlreadyExists")
              : t("admin.inviteAlreadyPending")
          );
        } else {
          toast.error(data.error || t("admin.inviteFailed"));
        }
        return;
      }

      toast.success(t("admin.inviteSent"));
      setEmail("");

      // Refresh invitation list
      const listRes = await fetch("/api/admin/invite");
      if (listRes.ok) {
        const listData = await listRes.json();
        setInvites(listData.invitations);
      }
    } catch {
      toast.error(t("admin.inviteFailed"));
    } finally {
      setSending(false);
    }
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline">{t("admin.inviteStatusPending")}</Badge>;
      case "accepted":
        return <Badge variant="secondary">{t("admin.inviteStatusAccepted")}</Badge>;
      case "expired":
        return <Badge variant="destructive">{t("admin.inviteStatusExpired")}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleInvite} className="flex gap-2">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("admin.inviteEmailPlaceholder")}
          required
          className="flex-1"
        />
        <Button type="submit" disabled={sending}>
          <Mail className="mr-2 h-4 w-4" />
          {sending ? t("admin.inviteSending") : t("admin.inviteSend")}
        </Button>
      </form>

      {invites.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("admin.noPendingInvitations")}
        </p>
      ) : (
        <div className="space-y-2">
          {invites.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{inv.email}</p>
                {inv.inviterEmail && (
                  <p className="text-xs text-muted-foreground">
                    {t("admin.invitedBy", { email: inv.inviterEmail })}
                  </p>
                )}
              </div>
              {statusBadge(inv.status)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
