import { getCurrentUser } from "@/lib/auth";
import { OnboardingModal } from "@/components/onboarding-modal";

export async function OnboardingCheck() {
  const user = await getCurrentUser();
  if (!user || user.onboardingCompleted) return null;

  return (
    <OnboardingModal
      defaultFirstName={user.firstName ?? ""}
      defaultLastName={user.lastName ?? ""}
    />
  );
}
