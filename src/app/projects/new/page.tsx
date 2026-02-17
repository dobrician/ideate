"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createProject } from "../actions";
import { toast } from "sonner";
import { useLocale } from "@/lib/use-locale";
import { getCsrfTokenClient } from "@/lib/csrf-client";

interface Template {
  id: string;
  name: string;
  description: string | null;
  titlePrefix: string | null;
  deadlineOffset: number | null;
  defaultTags: string[];
}

/**
 * New project page
 * Form to create a new project
 */
export default function NewProjectPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; deadline?: string }>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    fetch("/api/admin/templates")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.templates) setTemplates(data.templates);
      })
      .catch(() => {});
  }, []);

  function applyTemplate(templateId: string) {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;

    const form = document.querySelector<HTMLFormElement>("form");
    if (!form) return;

    const titleInput = form.querySelector<HTMLInputElement>("#title");
    const descInput = form.querySelector<HTMLTextAreaElement>("#description");
    const deadlineInput = form.querySelector<HTMLInputElement>("#deadline");

    if (titleInput && tpl.titlePrefix) {
      titleInput.value = tpl.titlePrefix + " ";
      titleInput.focus();
    }
    if (descInput && tpl.description) {
      descInput.value = tpl.description;
    }
    if (deadlineInput && tpl.deadlineOffset) {
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + tpl.deadlineOffset);
      deadlineInput.value = deadline.toISOString().split("T")[0];
    }
  }

  function validateTitle(v: string) {
    if (!v.trim()) return t("projectForm.titleRequiredError");
    if (v.trim().length < 3) return t("projectForm.titleMinLength");
    return undefined;
  }

  function validateDeadline(v: string) {
    if (!v) return t("projectForm.deadlineRequiredError");
    return undefined;
  }

  function handleBlur(field: string, value: string) {
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (field === "title") setFieldErrors((prev) => ({ ...prev, title: validateTitle(value) }));
    if (field === "deadline") setFieldErrors((prev) => ({ ...prev, deadline: validateDeadline(value) }));
  }

  /**
   * Handle form submission
   */
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const titleVal = formData.get("title") as string;
    const deadlineVal = formData.get("deadline") as string;
    const tErr = validateTitle(titleVal);
    const dErr = validateDeadline(deadlineVal);
    setFieldErrors({ title: tErr, deadline: dErr });
    setTouched({ title: true, deadline: true });
    if (tErr || dErr) return;

    setIsLoading(true);
    setError("");

    try {
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
    <div className="mx-auto max-w-2xl py-4 sm:py-8">
      <Card className="dark:border-white/10">
        <CardHeader>
          <CardTitle>{t("projectForm.createTitle")}</CardTitle>
          <CardDescription>
            {t("projectForm.createDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <input type="hidden" name="csrfToken" value={getCsrfTokenClient()} />

            {templates.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="template">{t("templates.fromTemplate")}</Label>
                <select
                  id="template"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) applyTemplate(e.target.value);
                  }}
                >
                  <option value="">{t("templates.selectTemplate")}</option>
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="title">{t("projectForm.titleRequired")}</Label>
              <Input
                id="title"
                name="title"
                type="text"
                placeholder={t("projectForm.titlePlaceholder")}
                maxLength={200}
                disabled={isLoading}
                onBlur={(e) => handleBlur("title", e.target.value)}
                aria-invalid={touched.title && !!fieldErrors.title}
                aria-describedby={touched.title && fieldErrors.title ? "project-title-error" : undefined}
              />
              {touched.title && fieldErrors.title ? (
                <p id="project-title-error" className="text-xs text-red-700 dark:text-red-400">{fieldErrors.title}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t("projectForm.titleHint")}
                </p>
              )}
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
                min={new Date().toISOString().split("T")[0]}
                disabled={isLoading}
                onBlur={(e) => handleBlur("deadline", e.target.value)}
                aria-invalid={touched.deadline && !!fieldErrors.deadline}
                aria-describedby={touched.deadline && fieldErrors.deadline ? "project-deadline-error" : undefined}
              />
              {touched.deadline && fieldErrors.deadline ? (
                <p id="project-deadline-error" className="text-xs text-red-700 dark:text-red-400">{fieldErrors.deadline}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t("projectForm.deadlineHint")}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">{t("projectForm.status")}</Label>
              <select
                id="status"
                name="status"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
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
              <div className="rounded-md bg-red-50 p-3 dark:bg-red-950" role="alert">
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
