"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { updateProject } from "../../actions";
import { toast } from "sonner";
import { useLocale } from "@/lib/use-locale";
import { getCsrfTokenClient } from "@/lib/csrf-client";

interface ProjectData {
  id: string;
  title: string;
  description: string | null;
  deadline: string | number;
  status: string;
}

/**
 * Edit project page with toast feedback
 */
export default function EditProjectPage() {
  const router = useRouter();
  const { t } = useLocale();
  const params = useParams();
  const projectId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [project, setProject] = useState<ProjectData | null>(null);

  useEffect(() => {
    async function fetchProject() {
      try {
        const response = await fetch(`/api/projects/${projectId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch project");
        }
        const data = await response.json();
        setProject(data);
      } catch {
        setError(t("projectForm.loadError"));
        toast.error(t("projectForm.loadError"));
      } finally {
        setIsLoading(false);
      }
    }

    fetchProject();
  }, [projectId]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSaving(true);
    setError("");

    try {
      const formData = new FormData(e.currentTarget);
      const result = await updateProject(projectId, formData);

      if (result?.error) {
        setError(result.error);
        toast.error(result.error);
        setIsSaving(false);
      } else if (result?.success) {
        toast.success(t("projectForm.projectUpdated"));
        router.push(`/projects/${projectId}`);
      }
    } catch {
      setError(t("common.errorOccurred"));
      toast.error(t("common.errorOccurred"));
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              {t("projectForm.loading")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-destructive">{error}</p>
            <div className="mt-4 text-center">
              <Button onClick={() => router.back()}>{t("projectForm.goBack")}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>{t("projectForm.editTitle")}</CardTitle>
          <CardDescription>{t("projectForm.editDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <input type="hidden" name="csrfToken" value={getCsrfTokenClient()} />
            <div className="space-y-2">
              <Label htmlFor="title">{t("projectForm.titleRequired")}</Label>
              <Input
                id="title"
                name="title"
                type="text"
                defaultValue={project?.title}
                required
                minLength={3}
                maxLength={200}
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t("projectForm.description")}</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={project?.description || ""}
                rows={6}
                maxLength={5000}
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deadline">{t("projectForm.deadlineRequired")}</Label>
              <Input
                id="deadline"
                name="deadline"
                type="date"
                defaultValue={
                  project?.deadline
                    ? new Date(project.deadline).toISOString().split("T")[0]
                    : ""
                }
                required
                min={new Date().toISOString().split("T")[0]}
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">{t("projectForm.status")}</Label>
              <select
                id="status"
                name="status"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                defaultValue={project?.status || "active"}
                disabled={isSaving}
              >
                <option value="active">{t("projects.status.active")}</option>
                <option value="draft">{t("projects.status.draft")}</option>
                <option value="archived">{t("projects.status.archived")}</option>
              </select>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-3 dark:bg-red-950">
                <p className="text-sm text-red-800 dark:text-red-200">
                  {error}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button type="submit" disabled={isSaving} className="flex-1">
                {isSaving ? t("projectForm.saving") : t("projectForm.update")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isSaving}
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
