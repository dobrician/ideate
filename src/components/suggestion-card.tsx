import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThumbsUp, ThumbsDown, Eye } from "lucide-react";

export interface Suggestion {
  title: string;
  details: string;
  summary: string;
}

export interface SuggestionWithVote extends Suggestion {
  vote: 1 | -1 | null;
}

export function SuggestionCard({
  suggestion,
  onVote,
  onViewDetails,
  t,
}: {
  suggestion: SuggestionWithVote;
  onVote: (v: 1 | -1) => void;
  onViewDetails: () => void;
  t: (key: string) => string;
}) {
  return (
    <Card className="group relative" role="article" aria-label={suggestion.title}>
      <CardContent className="p-3 sm:p-4">
        <h3 className="font-medium text-sm sm:text-base">{suggestion.title}</h3>
        <p className="mt-1 line-clamp-2 text-xs sm:text-sm text-muted-foreground">
          {suggestion.summary || t("suggestions.noSummary")}
        </p>
        <div className="mt-2 sm:mt-3 flex items-center gap-1.5 sm:gap-1">
          <Button
            variant={suggestion.vote === 1 ? "default" : "outline"}
            size="sm"
            aria-label={t("vote.pro")}
            aria-pressed={suggestion.vote === 1}
            className={suggestion.vote === 1 ? "bg-green-600 hover:bg-green-700" : ""}
            onClick={() => onVote(1)}
          >
            <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            variant={suggestion.vote === -1 ? "default" : "outline"}
            size="sm"
            aria-label={t("vote.contra")}
            aria-pressed={suggestion.vote === -1}
            className={suggestion.vote === -1 ? "bg-red-600 hover:bg-red-700" : ""}
            onClick={() => onVote(-1)}
          >
            <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewDetails}
            aria-label={t("suggestions.viewDetails")}
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="text-xs">{t("suggestions.viewDetails")}</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
