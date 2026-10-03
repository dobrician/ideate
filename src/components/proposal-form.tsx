"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { toast } from "sonner";
import { useProposalForm } from "@/lib/use-proposal-form";
import type { ProposalFormProps } from "@/lib/use-proposal-form";
import { ProposalFormFields } from "./proposal-form-fields";
import { DuplicateMatchesModal } from "./duplicate-matches-modal";

/** Open a new-idea drawer and hand off to duplicate review on submit. */
export function ProposalForm(props: ProposalFormProps) {
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
          <Button size="sm">
            <span className="sm:hidden">{form.t("proposalForm.newProposalShort")}</span>
            <span className="hidden sm:inline">{form.t("proposalForm.newProposal")}</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
          <SheetHeader className="shrink-0">
            <SheetTitle>{form.t("proposalForm.title")}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 px-4 pb-4">
            <ProposalFormFields form={form} showCancel onCancel={
              <SheetClose asChild>
                <Button type="button" variant="outline" size="sm" disabled={form.isPending}>
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
