"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useLocale } from "@/lib/use-locale";
import { getCsrfTokenClient } from "@/lib/csrf-client";
import { updateNotificationPreferences } from "./actions";

interface NotificationSettingsProps {
  prefs: {
    emailNewProposal: boolean;
    emailVoteOnMine: boolean;
    emailCommentReply: boolean;
  };
}

export function NotificationSettings({ prefs }: NotificationSettingsProps) {
  const { t } = useLocale();
  const [emailNewProposal, setEmailNewProposal] = useState(prefs.emailNewProposal);
  const [emailVoteOnMine, setEmailVoteOnMine] = useState(prefs.emailVoteOnMine);
  const [emailCommentReply, setEmailCommentReply] = useState(prefs.emailCommentReply);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    const result = await updateNotificationPreferences(
      { emailNewProposal, emailVoteOnMine, emailCommentReply },
      getCsrfTokenClient()
    );
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("notifications.saved"));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("notifications.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t("notifications.description")}
        </p>

        <div className="space-y-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={emailNewProposal}
              onChange={(e) => setEmailNewProposal(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <div>
              <p className="text-sm font-medium">{t("notifications.newProposal")}</p>
              <p className="text-xs text-muted-foreground">
                {t("notifications.newProposalDesc")}
              </p>
            </div>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={emailVoteOnMine}
              onChange={(e) => setEmailVoteOnMine(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <div>
              <p className="text-sm font-medium">{t("notifications.voteOnMine")}</p>
              <p className="text-xs text-muted-foreground">
                {t("notifications.voteOnMineDesc")}
              </p>
            </div>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={emailCommentReply}
              onChange={(e) => setEmailCommentReply(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <div>
              <p className="text-sm font-medium">{t("notifications.commentReply")}</p>
              <p className="text-xs text-muted-foreground">
                {t("notifications.commentReplyDesc")}
              </p>
            </div>
          </label>
        </div>

        <Button onClick={handleSave} disabled={loading} className="mt-2">
          {loading ? t("notifications.saving") : t("notifications.save")}
        </Button>
      </CardContent>
    </Card>
  );
}
