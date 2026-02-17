"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateProfile } from "./actions";
import { toast } from "sonner";
import { useLocale } from "@/lib/use-locale";
import { getCsrfTokenClient } from "@/lib/csrf-client";

interface ProfileFormProps {
  firstName: string;
  lastName: string;
}

/**
 * Client form for updating user profile name with toast feedback
 */
export function ProfileForm({ firstName, lastName }: ProfileFormProps) {
  const { t } = useLocale();
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsLoading(true);

    const result = await updateProfile(formData);

    if (result.success) {
      toast.success(t("profile.updated"));
    } else {
      toast.error(result.error || t("profile.updateFailed"));
    }

    setIsLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("profile.editProfile")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <input type="hidden" name="csrfToken" value={getCsrfTokenClient()} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">{t("profile.firstName")}</Label>
              <Input
                id="firstName"
                name="firstName"
                defaultValue={firstName}
                placeholder={t("profile.firstName")}
                maxLength={100}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">{t("profile.lastName")}</Label>
              <Input
                id="lastName"
                name="lastName"
                defaultValue={lastName}
                placeholder={t("profile.lastName")}
                maxLength={100}
                disabled={isLoading}
              />
            </div>
          </div>

          <Button type="submit" disabled={isLoading}>
            {isLoading ? t("profile.updating") : t("profile.update")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
