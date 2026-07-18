"use client";
import * as React from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

// Ícone de ajuda com explicação em linguagem simples. Acessível: aparece no hover e no
// foco de teclado, anunciado por leitores de tela via aria-describedby. A posição é
// ajustada ao viewport para nunca vazar a borda da tela (inclusive no mobile).
export function InfoTip({
  children,
  label = "Mais informação",
  side = "top",
  className,
}: Readonly<{
  children: React.ReactNode;
  label?: string;
  side?: "top" | "bottom";
  className?: string;
}>) {
  const id = React.useId();
  const tipRef = React.useRef<HTMLSpanElement>(null);
  const [shown, setShown] = React.useState(false);
  const [dx, setDx] = React.useState(0);

  React.useLayoutEffect(() => {
    if (!shown || !tipRef.current) return;
    const r = tipRef.current.getBoundingClientRect();
    const m = 8;
    let d = 0;
    if (r.left < m) d = m - r.left;
    else if (r.right > window.innerWidth - m) d = window.innerWidth - m - r.right;
    if (d !== 0) setDx((prev) => prev + d);
  }, [shown]);

  const hide = () => {
    setShown(false);
    setDx(0);
  };

  return (
    <span
      className={cn("group/tip relative inline-flex align-middle", className)}
      onPointerEnter={() => setShown(true)}
      onPointerLeave={hide}
    >
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        onFocus={() => setShown(true)}
        onBlur={hide}
        className="inline-grid size-3.5 cursor-help place-items-center rounded-full text-muted-foreground/60 transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <Info className="size-3.5" />
      </button>
      {/* renderizado só quando visível: um tooltip oculto ainda ocuparia layout e
          poderia estourar a viewport no mobile */}
      {shown && (
        <span
          id={id}
          ref={tipRef}
          role="tooltip"
          style={{ transform: `translateX(calc(-50% + ${dx}px))` }}
          className={cn(
            "pointer-events-none absolute left-1/2 z-50 w-[min(14rem,calc(100vw-1rem))] rounded-lg border border-border bg-popover p-2.5 text-xs font-normal normal-case leading-relaxed tracking-normal text-popover-foreground shadow-xl",
            side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5",
          )}
        >
          {children}
        </span>
      )}
    </span>
  );
}
