"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requestEmailChange } from "./actions";
import { toast } from "sonner";
import { useLocale } from "@/lib/use-locale";
import { getCsrfTokenClient } from "@/lib/csrf-client";

export function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const { t } = useLocale();
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsLoading(true);
    const result = await requestEmailChange(formData);

    if (result.success) {
      toast.success(t("profile.emailChangeSent"));
      const form = document.getElementById("change-email-form") as HTMLFormElement;
      form?.reset();
    } else {
      const errorMap: Record<string, string> = {
        sameEmail: "profile.sameEmail",
        emailInUse: "profile.emailInUse",
      };
      const key = errorMap[result.error || ""];
      toast.error(key ? t(key) : (result.error || t("profile.emailChangeFailed")));
    }
    setIsLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("profile.changeEmail")}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          {t("profile.currentEmailLabel")}: <strong>{currentEmail}</strong>
        </p>
        <form id="change-email-form" action={handleSubmit} className="space-y-4">
          <input type="hidden" name="csrfToken" value={getCsrfTokenClient()} />
          <div className="space-y-2">
            <Label htmlFor="newEmail">{t("profile.newEmail")}</Label>
            <Input
              id="newEmail"
              name="newEmail"
              type="email"
              autoComplete="email"
              required
              disabled={isLoading}
              placeholder={t("profile.newEmailPlaceholder")}
            />
            <p className="text-xs text-muted-foreground">
              {t("profile.emailChangeHint")}
            </p>
          </div>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? t("profile.sendingVerification") : t("profile.sendVerification")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
