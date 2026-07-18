"use client";
import * as React from "react";
import { Sun, Moon } from "lucide-react";

// Alterna a classe `dark` no <html> e persiste em localStorage. O tema é aplicado antes
// do paint por um script inline no layout (evita flash), então aqui só sincronizamos.
export function ThemeToggle() {
  const [dark, setDark] = React.useState(true);

  React.useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // localStorage indisponível (ex.: modo privado) — sem persistência, tudo bem
    }
  };

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Ativar tema claro" : "Ativar tema escuro"}
      title={dark ? "Tema claro" : "Tema escuro"}
      className="grid size-8 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary"
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
