"use client";
import * as React from "react";
import { Upload, X, FileUp } from "lucide-react";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { parseSapExport } from "@/lib/sap/import";
import { sampleIwExport } from "@/lib/sap/sample";

export function ImportDialog() {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const loadProject = useApp((s) => s.loadProject);

  const doImport = () => {
    try {
      const project = parseSapExport(text, "Import IW39/IW49");
      if (project.numJobs <= 2) throw new Error("Nenhuma operação válida encontrada.");
      loadProject(project, `Import IW39/IW49 · ${project.numJobs - 2} operações`, "import");
      setOpen(false);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao interpretar o arquivo.");
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setText(await file.text());
  };

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload /> Importar SAP
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Importar export IW39/IW49"
            className="w-full max-w-2xl rounded-xl border border-border bg-card p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Importar export IW39/IW49</h2>
                <p className="text-xs text-muted-foreground">
                  Cole o CSV (ordens/operações) ou carregue um arquivo. Centro de trabalho vira
                  recurso; a coluna Predecessoras define a rede.
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ordem;Operacao;Texto breve;Centro trab.;Trabalho;Cap;Predecessoras"
              spellCheck={false}
              className="scrollbar-thin h-56 w-full resize-none rounded-md border border-input bg-background p-2.5 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="cursor-pointer">
                  <input type="file" accept=".csv,.txt,.tsv" onChange={onFile} className="hidden" />
                  <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs hover:bg-secondary">
                    <FileUp className="size-3.5" /> Arquivo
                  </span>
                </label>
                <Button variant="ghost" size="sm" onClick={() => setText(sampleIwExport)}>
                  Carregar exemplo
                </Button>
              </div>
              <Button onClick={doImport} disabled={!text.trim()}>
                Importar rede
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
