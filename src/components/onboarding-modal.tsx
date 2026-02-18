"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { completeOnboarding } from "@/app/profile/actions";
import { toast } from "sonner";
import { useLocale } from "@/lib/use-locale";
import { getCsrfTokenClient } from "@/lib/csrf-client";
import { FolderPlus, MessageSquarePlus, Vote, ChevronRight, ChevronLeft, Check } from "lucide-react";

interface OnboardingModalProps {
  defaultFirstName?: string;
  defaultLastName?: string;
}

const TOTAL_STEPS = 3;

export function OnboardingModal({ defaultFirstName, defaultLastName }: OnboardingModalProps) {
  const router = useRouter();
  const { t } = useLocale();
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState(defaultFirstName ?? "");
  const [lastName, setLastName] = useState(defaultLastName ?? "");
  const [isSaving, setIsSaving] = useState(false);

  async function handleComplete(e?: FormEvent) {
    e?.preventDefault();
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.set("csrfToken", getCsrfTokenClient());
      formData.set("firstName", firstName);
      formData.set("lastName", lastName);
      const result = await completeOnboarding(formData);
      if (result && "error" in result) {
        toast.error(t(result.error));
        setIsSaving(false);
      } else {
        toast.success(t("onboarding.completed"));
        setOpen(false);
        router.refresh();
      }
    } catch {
      toast.error(t("common.errorOccurred"));
      setIsSaving(false);
    }
  }

  async function handleSkip() {
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.set("csrfToken", getCsrfTokenClient());
      formData.set("firstName", firstName);
      formData.set("lastName", lastName);
      const result = await completeOnboarding(formData);
      if (result && "error" in result) {
        toast.error(t(result.error));
      } else {
        setOpen(false);
        router.refresh();
      }
    } catch {
      setOpen(false);
    }
    setIsSaving(false);
  }

  const steps = [
    {
      icon: <FolderPlus className="mx-auto mb-3 h-10 w-10 text-primary" />,
      title: t("onboarding.step1Title"),
      description: t("onboarding.step1Desc"),
    },
    {
      icon: <MessageSquarePlus className="mx-auto mb-3 h-10 w-10 text-primary" />,
      title: t("onboarding.step2Title"),
      description: t("onboarding.step2Desc"),
    },
    {
      icon: <Vote className="mx-auto mb-3 h-10 w-10 text-primary" />,
      title: t("onboarding.step3Title"),
      description: t("onboarding.step3Desc"),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent showCloseButton={false} className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{step === TOTAL_STEPS ? t("onboarding.profileTitle") : t("onboarding.title")}</DialogTitle>
          <DialogDescription>
            {step === TOTAL_STEPS ? t("onboarding.profileDesc") : t("onboarding.subtitle")}
          </DialogDescription>
        </DialogHeader>

        {step < TOTAL_STEPS ? (
          <div className="py-4 text-center">
            {steps[step].icon}
            <h3 className="mb-2 text-base font-semibold">{steps[step].title}</h3>
            <p className="text-sm text-muted-foreground">{steps[step].description}</p>

            <div className="mt-6 flex items-center justify-center gap-1.5">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 w-8 rounded-full transition-colors ${
                    i === step ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
          </div>
        ) : (
          <form onSubmit={handleComplete} className="space-y-4 py-2" id="onboarding-form">
            <div className="space-y-1.5">
              <Label htmlFor="onboarding-firstName">{t("profile.firstName")}</Label>
              <Input
                id="onboarding-firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                maxLength={100}
                disabled={isSaving}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="onboarding-lastName">{t("profile.lastName")}</Label>
              <Input
                id="onboarding-lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                maxLength={100}
                disabled={isSaving}
              />
            </div>
          </form>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            disabled={isSaving}
          >
            {t("onboarding.skip")}
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStep(step - 1)}
                disabled={isSaving}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                {t("onboarding.back")}
              </Button>
            )}
            {step < TOTAL_STEPS ? (
              <Button
                type="button"
                size="sm"
                onClick={() => setStep(step + 1)}
              >
                {t("onboarding.next")}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                form="onboarding-form"
                size="sm"
                disabled={isSaving}
              >
                <Check className="mr-1 h-4 w-4" />
                {isSaving ? t("onboarding.finishing") : t("onboarding.finish")}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
