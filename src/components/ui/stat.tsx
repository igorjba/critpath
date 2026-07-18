import * as React from "react";
import { cn, toneText, type Tone } from "@/lib/utils";
import { InfoTip } from "@/components/ui/info-tip";

// Caixa de estatística com rótulo e valor, usada nos painéis de risco e confiabilidade.
export function StatBox({
  label,
  value,
  tone = "default",
  help,
}: Readonly<{ label: string; value: React.ReactNode; tone?: Tone; help?: React.ReactNode }>) {
  return (
    <div className="rounded-md border border-border bg-card/60 p-2">
      <dt className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
        {help && <InfoTip label={`O que é ${label}`}>{help}</InfoTip>}
      </dt>
      <dd className={cn("font-medium", tone !== "default" && "font-semibold", toneText(tone))}>
        {value}
      </dd>
    </div>
  );
}
