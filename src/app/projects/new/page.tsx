"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createProject } from "../actions";
import { toast } from "sonner";
import { useLocale } from "@/lib/use-locale";

/**
 * New project page
 * Form to create a new project
 */
export default function NewProjectPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  /**
   * Handle form submission
   */
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const formData = new FormData(e.currentTarget);
      const result = await createProject(formData);

      if (result?.error) {
        setError(result.error);
        toast.error(result.error);
        setIsLoading(false);
      }
      // If successful, createProject redirects automatically
    } catch {
      setError(t("common.errorOccurred"));
      toast.error(t("common.errorOccurred"));
      setIsLoading(false);
    }
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>{t("projectForm.createTitle")}</CardTitle>
          <CardDescription>
            {t("projectForm.createDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">{t("projectForm.titleRequired")}</Label>
              <Input
                id="title"
                name="title"
                type="text"
                placeholder="Q1 2026 Product Roadmap"
                required
                minLength={3}
                maxLength={200}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                {t("projectForm.titleHint")}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t("projectForm.description")}</Label>
              <Textarea
                id="description"
                name="description"
                placeholder={t("projectForm.descriptionPlaceholder")}
                rows={6}
                maxLength={5000}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                {t("projectForm.descriptionHint")}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deadline">{t("projectForm.deadlineRequired")}</Label>
              <Input
                id="deadline"
                name="deadline"
                type="date"
                required
                min={new Date().toISOString().split("T")[0]}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                {t("projectForm.deadlineHint")}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">{t("projectForm.status")}</Label>
              <select
                id="status"
                name="status"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isLoading}
                defaultValue="active"
              >
                <option value="active">{t("projects.status.active")}</option>
                <option value="draft">{t("projects.status.draft")}</option>
                <option value="archived">{t("projects.status.archived")}</option>
              </select>
              <p className="text-xs text-muted-foreground">
                {t("projectForm.statusHint")}
              </p>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-3 dark:bg-red-950">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <Button type="submit" disabled={isLoading} className="flex-1">
                {isLoading ? t("projectForm.creating") : t("projectForm.create")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isLoading}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
