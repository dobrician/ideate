"use client";
import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { toast } from "sonner";
import { useProposalForm } from "@/lib/use-proposal-form";
import type { ProposalFormProps } from "@/lib/use-proposal-form";
import { ProposalFormFields } from "./proposal-form-fields";
import { DuplicateMatchesModal } from "./duplicate-matches-modal";

/** Open a new-idea drawer and hand off to duplicate review on submit. */
export function ProposalForm(props: ProposalFormProps & { compact?: boolean }) {
  const form = useProposalForm(props);
  const [open, setOpen] = useState(false);
  const { state, t, resetForm, modalOpen } = form;

  // Close drawer as soon as the validation/matches modal takes over.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing drawer visibility to modal state; can't be derived in render because Sheet is a controlled child.
    if (modalOpen) setOpen(false);
  }, [modalOpen]);

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      toast.success(t("proposalForm.created"));
      resetForm();
      requestAnimationFrame(() => setOpen(false));
    }
    if (state.error) toast.error(state.error);
  }, [state, t, resetForm]);

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button size={props.compact ? "icon" : "sm"} variant={props.compact ? "ghost" : "default"} aria-label={props.compact ? form.t("proposalForm.newProposal") : undefined}>
            {props.compact ? <Plus className="size-5" aria-hidden="true" /> : <>
              <span className="sm:hidden">{form.t("proposalForm.newProposalShort")}</span>
              <span className="hidden sm:inline">{form.t("proposalForm.newProposal")}</span>
            </>}
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex h-dvh w-full flex-col gap-0 overflow-hidden sm:max-w-[480px]">
          <SheetHeader className="shrink-0 border-b px-5 py-5 pr-16">
            <SheetTitle className="text-lg">{form.t("proposalForm.title")}</SheetTitle>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col">
            <ProposalFormFields form={form} showCancel onCancel={
              <SheetClose asChild>
                <Button type="button" variant="ghost" disabled={form.isPending}>
                  {form.t("common.cancel")}
                </Button>
              </SheetClose>
            } />
          </div>
        </SheetContent>
      </Sheet>
      <DuplicateMatchesModal form={form} projectId={form.projectId} />
    </>
  );
}
