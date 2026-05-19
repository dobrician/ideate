"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { generateShareToken, revokeShareToken } from "@/app/projects/actions";
import { toast } from "sonner";
import { useLocale } from "@/lib/use-locale";
import { getCsrfTokenClient } from "@/lib/csrf-client";
import { Share2, Copy, Link2Off, RotateCw } from "lucide-react";

interface ShareProjectDialogProps {
  projectId: string;
  initialToken: string | null;
}

export function ShareProjectDialog({ projectId, initialToken }: ShareProjectDialogProps) {
  const router = useRouter();
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(initialToken);
  const [busy, setBusy] = useState(false);

  const shareUrl =
    typeof window !== "undefined" && token
      ? `${window.location.origin}/p/${token}`
      : token
        ? `/p/${token}`
        : "";

  async function handleGenerate() {
    setBusy(true);
    try {
      const result = await generateShareToken(projectId, getCsrfTokenClient());
      if (result?.error) {
        toast.error(t(result.error));
      } else if (result?.success && result.token) {
        setToken(result.token);
        toast.success(t("project.share.generated"));
        router.refresh();
      }
    } catch {
      toast.error(t("common.errorOccurred"));
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke() {
    if (!confirm(t("project.share.confirmRevoke"))) return;
    setBusy(true);
    try {
      const result = await revokeShareToken(projectId, getCsrfTokenClient());
      if (result?.error) {
        toast.error(t(result.error));
      } else if (result?.success) {
        setToken(null);
        toast.success(t("project.share.revoked"));
        router.refresh();
      }
    } catch {
      toast.error(t("common.errorOccurred"));
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success(t("project.share.copied"));
    } catch {
      toast.error(t("common.errorOccurred"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Share2 className="mr-1 h-3 w-3" />
          {t("project.share.button")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("project.share.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("project.share.dialogDescription")}</DialogDescription>
        </DialogHeader>

        {token ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={shareUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="font-mono text-xs"
                aria-label={t("project.share.linkLabel")}
              />
              <Button type="button" variant="secondary" size="sm" onClick={handleCopy} disabled={busy}>
                <Copy className="mr-1 h-3 w-3" />
                {t("project.share.copy")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t("project.share.hint")}</p>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleGenerate} disabled={busy}>
                <RotateCw className="mr-1 h-3 w-3" />
                {t("project.share.rotate")}
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={handleRevoke} disabled={busy}>
                <Link2Off className="mr-1 h-3 w-3" />
                {t("project.share.revoke")}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("project.share.noLinkYet")}</p>
            <DialogFooter>
              <Button type="button" onClick={handleGenerate} disabled={busy}>
                <Share2 className="mr-1 h-3 w-3" />
                {t("project.share.generate")}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
