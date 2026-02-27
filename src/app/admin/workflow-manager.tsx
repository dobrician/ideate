"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useLocale } from "@/lib/use-locale";
import { getCsrfTokenClient } from "@/lib/csrf-client";
import { createWorkflowAction, deleteWorkflowAction } from "./workflow-actions";
import { Plus, Trash2, X } from "lucide-react";

interface WorkflowData {
  id: string;
  projectId: string;
  name: string;
  isDefault: boolean;
  stages: Array<{ id: string; name: string; order: number; allowedRoles: string[] }>;
}

interface ProjectOption {
  id: string;
  title: string;
}

interface WorkflowManagerProps {
  initialWorkflows: WorkflowData[];
  projects: ProjectOption[];
}

const AVAILABLE_ROLES = ["admin", "manager", "member", "viewer"];

export function WorkflowManager({ initialWorkflows, projects }: WorkflowManagerProps) {
  const { t } = useLocale();
  const [allWorkflows, setAllWorkflows] = useState(initialWorkflows);
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [stages, setStages] = useState([
    { name: "Draft", roles: ["admin", "manager", "member"] },
    { name: "Review", roles: ["admin", "manager"] },
    { name: "Approved", roles: ["admin"] },
  ]);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!name.trim() || !projectId || stages.length === 0) return;
    setLoading(true);
    const result = await createWorkflowAction(
      projectId,
      name,
      stages.map((s) => ({ name: s.name, allowedRoles: s.roles })),
      getCsrfTokenClient()
    );
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("workflow.created"));
      setName("");
      setProjectId("");
      // Refresh would come from revalidation; add optimistic update
      setAllWorkflows((prev) => [
        ...prev,
        {
          id: `temp-${Date.now()}`,
          projectId,
          name: name.trim(),
          isDefault: false,
          stages: stages.map((s, i) => ({ id: `s-${i}`, name: s.name, order: i, allowedRoles: s.roles })),
        },
      ]);
    }
  }

  async function handleDelete(workflowId: string) {
    const result = await deleteWorkflowAction(workflowId, getCsrfTokenClient());
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("workflow.deleted"));
      setAllWorkflows((prev) => prev.filter((w) => w.id !== workflowId));
    }
  }

  function addStage() {
    setStages((prev) => [...prev, { name: "", roles: ["admin", "manager"] }]);
  }

  function removeStage(index: number) {
    setStages((prev) => prev.filter((_, i) => i !== index));
  }

  function updateStageName(index: number, value: string) {
    setStages((prev) => prev.map((s, i) => (i === index ? { ...s, name: value } : s)));
  }

  function toggleRole(index: number, role: string) {
    setStages((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        const roles = s.roles.includes(role) ? s.roles.filter((r) => r !== role) : [...s.roles, role];
        return { ...s, roles };
      })
    );
  }

  // Find projects without a workflow
  const usedProjectIds = new Set(allWorkflows.map((w) => w.projectId));
  const availableProjects = projects.filter((p) => !usedProjectIds.has(p.id));

  return (
    <div className="space-y-6">
      {/* Create form */}
      <div className="space-y-4 rounded-lg border p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">{t("workflow.name")}</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("workflow.namePlaceholder")}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("workflow.project")}</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full rounded-md border bg-background text-foreground px-3 py-2 text-sm"
            >
              <option value="">{t("workflow.selectProject")}</option>
              {availableProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">{t("workflow.stages")}</label>
          <div className="space-y-2">
            {stages.map((stage, i) => (
              <div key={i} className="space-y-2 rounded border p-2 sm:flex sm:items-center sm:gap-2 sm:space-y-0">
                <span className="w-6 text-center text-xs text-muted-foreground">{i + 1}</span>
                <Input
                  value={stage.name}
                  onChange={(e) => updateStageName(i, e.target.value)}
                  placeholder={t("workflow.stageNamePlaceholder")}
                  className="flex-1"
                />
                <div className="flex flex-wrap gap-1">
                  {AVAILABLE_ROLES.map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => toggleRole(i, role)}
                      aria-pressed={stage.roles.includes(role)}
                      className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        stage.roles.includes(role)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
                {stages.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => removeStage(i)} aria-label={t("workflow.removeStage")}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={addStage} className="mt-2">
            <Plus className="mr-1 h-3 w-3" /> {t("workflow.addStage")}
          </Button>
        </div>

        <Button
          onClick={handleCreate}
          disabled={loading || !name.trim() || !projectId || stages.some((s) => !s.name.trim())}
        >
          {loading ? t("workflow.creating") : t("workflow.create")}
        </Button>
      </div>

      {/* Existing workflows */}
      {allWorkflows.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-4">{t("workflow.none")}</p>
      ) : (
        <div className="space-y-3">
          {allWorkflows.map((wf) => {
            const project = projects.find((p) => p.id === wf.projectId);
            return (
              <div key={wf.id} className="flex items-start justify-between rounded-lg border p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{wf.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {wf.isDefault ? t("workflow.default") : t("workflow.custom")}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {project?.title ?? wf.projectId}
                  </p>
                  <div className="mt-2 flex gap-1">
                    {wf.stages.map((s, i) => (
                      <Badge key={s.id} variant="secondary" className="text-xs">
                        {i + 1}. {s.name}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(wf.id)} aria-label={t("workflow.delete")}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
