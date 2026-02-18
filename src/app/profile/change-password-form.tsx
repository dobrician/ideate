"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { changePassword } from "./actions";
import { toast } from "sonner";
import { useLocale } from "@/lib/use-locale";
import { getCsrfTokenClient } from "@/lib/csrf-client";

/**
 * Client form for changing user password with current password verification
 */
export function ChangePasswordForm() {
  const { t } = useLocale();
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsLoading(true);

    const result = await changePassword(formData);

    if (result.success) {
      toast.success(t("profile.passwordChanged"));
      // Reset form fields by finding the form element and resetting it
      const form = document.getElementById("change-password-form") as HTMLFormElement;
      form?.reset();
    } else {
      const errorKey = result.error;
      if (errorKey === "passwordMismatch") {
        toast.error(t("auth.passwordMismatch"));
      } else if (errorKey === "incorrectPassword") {
        toast.error(t("profile.incorrectPassword"));
      } else if (errorKey === "noPasswordSet") {
        toast.error(t("profile.noPasswordSet"));
      } else {
        toast.error(t(errorKey || "profile.passwordChangeFailed"));
      }
    }

    setIsLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("profile.changePassword")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form id="change-password-form" action={handleSubmit} className="space-y-4">
          <input type="hidden" name="csrfToken" value={getCsrfTokenClient()} />
          <div className="space-y-2">
            <Label htmlFor="currentPassword">{t("profile.currentPassword")}</Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">{t("profile.newPassword")}</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              {t("auth.passwordRequirements")}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t("profile.confirmNewPassword")}</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              disabled={isLoading}
            />
          </div>

          <Button type="submit" disabled={isLoading}>
            {isLoading ? t("profile.changingPassword") : t("profile.changePasswordBtn")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
