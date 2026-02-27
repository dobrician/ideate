"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, XCircle, Database } from "lucide-react";
import { useLocale } from "@/lib/use-locale";

interface ExplainPlan {
  name: string;
  query: string;
  plan: string[];
  usesIndex: boolean;
}

interface IndexInfo {
  name: string;
  tableName: string;
  sql: string | null;
}

export function QueryExplainPanel({
  explainPlans,
  indexes,
}: {
  explainPlans: ExplainPlan[];
  indexes: IndexInfo[];
}) {
  const { t } = useLocale();
  const indexedCount = explainPlans.filter((p) => p.usesIndex).length;
  const fullScanCount = explainPlans.length - indexedCount;
  const coveragePercent = explainPlans.length > 0
    ? Math.round((indexedCount / explainPlans.length) * 100)
    : 0;

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{explainPlans.length}</div>
            <p className="text-xs text-muted-foreground">{t("performance.totalQueries")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{indexedCount}</div>
            <p className="text-xs text-muted-foreground">{t("performance.indexed")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{coveragePercent}%</div>
            <p className="text-xs text-muted-foreground">{t("performance.indexCoverage")}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("performance.explainPlans")}</CardTitle>
          <CardDescription>
            {t("performance.explainDesc", { indexed: indexedCount, total: explainPlans.length })}
            {fullScanCount > 0 && ` (${fullScanCount} full scans)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {explainPlans.map((plan) => (
              <div key={plan.name} className="rounded-lg border p-4">
                <div className="mb-2 flex items-center gap-2">
                  {plan.usesIndex ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span className="font-medium">{plan.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {plan.usesIndex ? t("performance.indexed") : t("performance.fullScan")}
                  </span>
                </div>
                <pre className="mb-2 overflow-x-auto rounded bg-muted p-2 text-xs">{plan.query}</pre>
                <div className="space-y-1">
                  {plan.plan.map((line, i) => (
                    <p key={i} className="font-mono text-xs text-muted-foreground">{line}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            {t("performance.indexes")}
          </CardTitle>
          <CardDescription>
            {t("performance.indexCount", { count: indexes.length })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 pr-4 font-medium">{t("performance.indexName")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("performance.tableName")}</th>
                  <th className="pb-2 font-medium">{t("performance.definition")}</th>
                </tr>
              </thead>
              <tbody>
                {indexes.map((idx) => (
                  <tr key={idx.name} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-mono text-xs">{idx.name}</td>
                    <td className="py-2 pr-4">{idx.tableName}</td>
                    <td className="py-2 font-mono text-xs text-muted-foreground">
                      {idx.sql ?? "auto-generated"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
