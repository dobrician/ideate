"use client";

import { useActionState, useState, useRef, useCallback, useEffect } from "react";
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
}

export function useProposalForm({
  projectId,
  projectTitle,
  projectDescription,
  existingProposals,
}: ProposalFormProps) {
  const { t } = useLocale();
  const [initialVote, setInitialVote] = useState<"1" | "-1">("1");
  const [state, formAction, isPending] = useActionState(createProposal, null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [similarMatches, setSimilarMatches] = useState<SimilarityMatch[]>([]);
  const [checkingSimilarity, setCheckingSimilarity] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkSimilarity = useCallback(
    async (t: string, d: string) => {
      if (!existingProposals?.length || !projectTitle || t.length < 5) {
        setSimilarMatches([]);
        return;
      }
      setCheckingSimilarity(true);
      try {
        const res = await fetch("/api/proposals/similarity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project: { title: projectTitle, description: projectDescription || "" },
            existing: existingProposals,
            proposal: { title: t, description: d },
          }),
        });
        const data = await res.json();
        const filtered = (data.matches || []).filter(
          (m: SimilarityMatch) => m.similarity > 40
        );
        setSimilarMatches(filtered);
      } catch {
        setSimilarMatches([]);
      } finally {
        setCheckingSimilarity(false);
      }
    },
    [existingProposals, projectTitle, projectDescription]
  );

  function handleFieldChange(newTitle: string, newDesc: string) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      checkSimilarity(newTitle, newDesc);
    }, 800);
  }

  const resetForm = useCallback(() => {
    setTitle("");
    setDescription("");
    setSimilarMatches([]);
  }, []);

  // Clear debounce timer on unmount to prevent leaked setTimeout
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const warnings = similarMatches;

  return {
    t,
    state,
    formAction,
    isPending,
    initialVote,
    setInitialVote,
    title,
    setTitle,
    description,
    setDescription,
    checkingSimilarity,
    warnings,
    handleFieldChange,
    resetForm,
    projectId,
  };
}
