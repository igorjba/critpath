import * as React from "react";
import { cn, toneText, type Tone } from "@/lib/utils";

// Caixa de estatística com rótulo e valor, usada nos painéis de risco e confiabilidade.
export function StatBox({
  label,
  value,
  tone = "default",
}: Readonly<{ label: string; value: React.ReactNode; tone?: Tone }>) {
  return (
    <div className="rounded-md border border-border bg-card/60 p-2">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn("font-medium", tone !== "default" && "font-semibold", toneText(tone))}>
        {value}
      </dd>
    </div>
  );
}
