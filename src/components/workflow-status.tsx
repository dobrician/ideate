"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/lib/use-locale";
import { getCsrfTokenClient } from "@/lib/csrf-client";
import { advanceProposalAction, rejectProposalAction } from "@/app/admin/workflow-actions";
import { toast } from "sonner";
import { CheckCircle, XCircle, ArrowRight } from "lucide-react";

interface WorkflowStatusProps {
  proposalId: string;
  state: {
    currentStageName: string;
    status: "active" | "completed" | "rejected";
    stageIndex: number;
    totalStages: number;
  } | null;
  canAdvance: boolean;
  canReject: boolean;
}

export function WorkflowStatus({ proposalId, state, canAdvance, canReject }: WorkflowStatusProps) {
  const { t } = useLocale();
  const [comment, setComment] = useState("");
  const [advancing, setAdvancing] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  if (!state) return null;

  const statusColor = {
    active: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
    completed: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
    rejected: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  }[state.status];

  async function handleAdvance() {
    setAdvancing(true);
    const result = await advanceProposalAction(proposalId, comment || undefined, getCsrfTokenClient());
    setAdvancing(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("workflow.advanced", { stage: result.stageName ?? "" }));
      setComment("");
    }
  }

  async function handleReject() {
    setRejecting(true);
    const result = await rejectProposalAction(proposalId, comment || undefined, getCsrfTokenClient());
    setRejecting(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("workflow.rejected"));
      setComment("");
    }
  }

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{t("workflow.status")}</span>
        <Badge className={statusColor}>
          {state.status === "active" ? t("workflow.active") : state.status === "completed" ? t("workflow.completed") : t("workflow.rejected")}
        </Badge>
      </div>

      {/* Progress bar */}
      <div
        className="flex items-center gap-1"
        role="progressbar"
        aria-valuenow={state.stageIndex + 1}
        aria-valuemin={1}
        aria-valuemax={state.totalStages}
        aria-label={`Stage ${state.stageIndex + 1} of ${state.totalStages}`}
      >
        {Array.from({ length: state.totalStages }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${
              i < state.stageIndex
                ? "bg-green-500"
                : i === state.stageIndex
                  ? "bg-blue-500"
                  : "bg-muted"
            }`}
          />
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        {t("workflow.stage")}: <span className="font-medium text-foreground">{state.currentStageName}</span>
        <span className="ml-1">({state.stageIndex + 1}/{state.totalStages})</span>
      </p>

      {state.status === "active" && (canAdvance || canReject) && (
        <div className="space-y-2 pt-1">
          <Input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t("workflow.commentPlaceholder")}
            className="text-sm"
          />
          <div className="flex gap-2">
            {canAdvance && (
              <Button size="sm" onClick={handleAdvance} disabled={advancing}>
                {advancing ? t("workflow.advancing") : (
                  <><ArrowRight className="mr-1 h-3 w-3" /> {t("workflow.advance")}</>
                )}
              </Button>
            )}
            {canReject && (
              <Button size="sm" variant="destructive" onClick={handleReject} disabled={rejecting}>
                {rejecting ? t("workflow.rejecting") : (
                  <><XCircle className="mr-1 h-3 w-3" /> {t("workflow.reject")}</>
                )}
              </Button>
            )}
          </div>
        </div>
      )}

      {state.status === "completed" && (
        <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
          <CheckCircle className="h-4 w-4" /> {t("workflow.completed")}
        </div>
      )}
    </div>
  );
}
