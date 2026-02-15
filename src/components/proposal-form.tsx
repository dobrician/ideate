"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createProposal } from "@/app/projects/[id]/proposals/actions";
import { ThumbsUp, ThumbsDown } from "lucide-react";

interface ProposalFormProps {
  projectId: string;
}

/**
 * Form for creating a new proposal with initial vote
 */
export function ProposalForm({ projectId }: ProposalFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialVote, setInitialVote] = useState<"1" | "-1">("1");
  const [state, formAction, isPending] = useActionState(createProposal, null);

  if (state?.success) {
    setIsOpen(false);
  }

  if (!isOpen) {
    return (
      <Button onClick={() => setIsOpen(true)} className="w-full sm:w-auto">
        + New Proposal
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">New Proposal</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="initialVote" value={initialVote} />

          <div className="space-y-2">
            <Label htmlFor="proposal-title">Title</Label>
            <Input
              id="proposal-title"
              name="title"
              placeholder="What do you propose?"
              required
              minLength={5}
              maxLength={200}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="proposal-description">Description (optional)</Label>
            <Textarea
              id="proposal-description"
              name="description"
              placeholder="Explain your proposal in detail..."
              rows={4}
              maxLength={5000}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label>Your initial vote</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={initialVote === "1" ? "default" : "outline"}
                size="sm"
                onClick={() => setInitialVote("1")}
                className={initialVote === "1" ? "bg-green-600 hover:bg-green-700" : ""}
              >
                <ThumbsUp className="mr-1 h-4 w-4" />
                Pro
              </Button>
              <Button
                type="button"
                variant={initialVote === "-1" ? "default" : "outline"}
                size="sm"
                onClick={() => setInitialVote("-1")}
                className={initialVote === "-1" ? "bg-red-600 hover:bg-red-700" : ""}
              >
                <ThumbsDown className="mr-1 h-4 w-4" />
                Contra
              </Button>
            </div>
          </div>

          {state?.error && (
            <div className="rounded-md bg-red-50 p-3 dark:bg-red-950">
              <p className="text-sm text-red-800 dark:text-red-200">{state.error}</p>
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Submit Proposal"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
