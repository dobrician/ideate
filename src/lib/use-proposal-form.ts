"use client";

import { useActionState, useState, useCallback, useMemo, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { createProposal } from "@/app/projects/[id]/proposals/actions";
import { useLocale } from "@/lib/use-locale";

interface SimilarityMatch {
  id: string;
  similarity: number;
  explanation: string;
}

export interface ExistingProposal {
  id: string;
  title: string;
  description?: string;
  summary?: string;
}

export interface ProposalFormProps {
  projectId: string;
  projectTitle?: string;
  projectDescription?: string;
  existingProposals?: ExistingProposal[];
  availableTags?: { id: string; name: string }[];
}

/** Matches at or above this percentage trigger the duplicate-confirmation modal. */
const DUPLICATE_THRESHOLD = 40;

export type DuplicateModalState = "closed" | "validating" | "matches" | "saving";

export function useProposalForm({
  projectId,
  projectTitle,
  projectDescription,
  existingProposals,
  availableTags,
}: ProposalFormProps) {
  const { t } = useLocale();
  const [initialVote, setInitialVote] = useState<"1" | "-1">("1");
  const [state, formAction, isPending] = useActionState(createProposal, null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [modalState, setModalState] = useState<DuplicateModalState>("closed");
  const [duplicateMatches, setDuplicateMatches] = useState<SimilarityMatch[]>([]);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);

  const existingById = useMemo(() => {
    const m = new Map<string, ExistingProposal>();
    for (const p of existingProposals || []) m.set(p.id, p);
    return m;
  }, [existingProposals]);

  // Track the last action-state we've reacted to. Without this, a stale
  // `state.success = true` from a previous submit would close the modal
  // the moment a new submit transitions modalState to "validating".
  const lastHandledStateRef = useRef<typeof state>(null);

  useEffect(() => {
    if (!state) return;
    if (state === lastHandledStateRef.current) return;
    lastHandledStateRef.current = state;

    if (state.success) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to server-action result; modal cleanup must happen once per state transition.
      setModalState("closed");
      setDuplicateMatches([]);
      setPendingFormData(null);
    } else if (state.error) {
      // Server-action failed: keep matches view if we had any, otherwise close.
      setModalState(duplicateMatches.length > 0 ? "matches" : "closed");
    }
  }, [state, duplicateMatches.length]);

  /**
   * Submit pipeline. Designed for instant feedback:
   *   1. flushSync sets modalState="validating" → drawer closes, modal mounts
   *      with spinner in the same DOM commit. THEN the LLM fetch begins.
   *   2. Matches ≥ threshold → "matches" state.
   *      No matches / API error → "saving" state, submit immediately.
   *   3. Server-action success → effect above closes modal + toast fires.
   */
  const submitWithDuplicateCheck = useCallback(
    async (formData: FormData) => {
      if (!existingProposals?.length || !projectTitle) {
        flushSync(() => {
          setModalState("saving");
          setPendingFormData(formData);
        });
        formAction(formData);
        return;
      }
      flushSync(() => {
        setModalState("validating");
        setPendingFormData(formData);
      });
      try {
        const res = await fetch("/api/proposals/similarity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project: { title: projectTitle, description: projectDescription || "" },
            existing: existingProposals,
            proposal: { title, description },
          }),
        });
        if (!res.ok) {
          // Don't block on infra failure — submit anyway, keep modal in "saving"
          setModalState("saving");
          formAction(formData);
          return;
        }
        const data = await res.json();
        const matches: SimilarityMatch[] = (data.matches || [])
          .filter((m: SimilarityMatch) => m.similarity >= DUPLICATE_THRESHOLD)
          .sort((a: SimilarityMatch, b: SimilarityMatch) => b.similarity - a.similarity);
        if (matches.length === 0) {
          setModalState("saving");
          formAction(formData);
          return;
        }
        setDuplicateMatches(matches);
        setModalState("matches");
      } catch {
        setModalState("saving");
        formAction(formData);
      }
    },
    [existingProposals, projectTitle, projectDescription, title, description, formAction]
  );

  /**
   * Submit the proposal with the chosen vote, overriding any earlier
   * initialVote from the drawer. Transitions modal to "saving"; the
   * success effect closes it once createProposal finishes.
   */
  const confirmSubmitWithVote = useCallback(
    (vote: "1" | "-1") => {
      if (!pendingFormData) return;
      pendingFormData.set("initialVote", vote);
      setModalState("saving");
      formAction(pendingFormData);
    },
    [pendingFormData, formAction]
  );

  const cancelDuplicateModal = useCallback(() => {
    setModalState("closed");
    setDuplicateMatches([]);
    setPendingFormData(null);
  }, []);

  const resetForm = useCallback(() => {
    setTitle("");
    setDescription("");
    setSelectedTagIds([]);
    setModalState("closed");
    setDuplicateMatches([]);
    setPendingFormData(null);
  }, []);

  return {
    t,
    state,
    isPending,
    initialVote,
    setInitialVote,
    title,
    setTitle,
    description,
    setDescription,
    submitWithDuplicateCheck,
    resetForm,
    projectId,
    availableTags: availableTags || [],
    selectedTagIds,
    setSelectedTagIds,
    // Duplicate-detection modal
    modalState,
    modalOpen: modalState !== "closed",
    duplicateMatches,
    confirmSubmitWithVote,
    cancelDuplicateModal,
    existingById,
  };
}
