# Critpath

Encontra o cronograma que deixa uma unidade industrial parada para manutenção o menor
tempo possível, respeitando equipes e equipamentos limitados.

[![CI](https://github.com/igorjba/critpath/actions/workflows/ci.yml/badge.svg)](https://github.com/igorjba/critpath/actions/workflows/ci.yml)
[![Licença MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-blue)](LICENSE)
![PSPLIB J30](https://img.shields.io/badge/PSPLIB%20J30-44%2F48%20%C3%B3timo%20%C2%B7%20gap%200.151%25-brightgreen)

![Painel do Critpath com a parada de exemplo resolvida: indicadores no topo, Gantt com o
caminho crítico em vermelho, histograma de carga por recurso com o guindaste saturado como
gargalo, e a tabela de ordens com folgas.](docs/screenshot.png)

Rodar: [Como rodar](#como-rodar) · Garantias verificáveis: [Garantias](#garantias)

## Visão geral

Quando uma unidade industrial para para manutenção (uma _turnaround_), ela deixa de
produzir. Cada dia parada custa caro, então a pergunta é sempre a mesma: qual a ordem de
executar centenas de tarefas — que dependem umas das outras e disputam as mesmas equipes e
o mesmo guindaste — que termina tudo no menor tempo? O problema é NP-difícil: o número de
ordens possíveis cresce rápido demais para testar todas.

Formalmente, isso é o **RCPSP** (Resource-Constrained Project Scheduling Problem). O
Critpath resolve o RCPSP com um motor de otimização compilado para WebAssembly que roda no
navegador, dentro de uma Web Worker. Sobre o cronograma encontrado, calcula ainda o risco
da data de partida por simulação de **Monte Carlo** e o intervalo ótimo de troca de peças
por ajuste de **Weibull com dados censurados**.

O valor de um otimizador está inteiramente na qualidade e na validade do que ele produz.
Por isso o documento abre pelas garantias verificáveis, antes da lista de funcionalidades.

## Garantias

Cada invariante abaixo é verificada por um comando do repositório.

| Invariante                                                                                        | Prova                             |
| ------------------------------------------------------------------------------------------------- | --------------------------------- |
| Todo cronograma respeita as precedências e em nenhum instante excede a capacidade de um recurso   | `npm test`                        |
| Na instância J30 1-1, o solver encontra o ótimo provado (makespan 43)                             | `npm test`                        |
| Um import IW39/IW49 com ciclo de precedências é rejeitado, sem corromper o estado                 | `npm test`                        |
| O ajuste de Weibull com censura recupera o regime de desgaste (forma _k_ > 1) na amostra de selos | `npm test`                        |
| Sobre 48 famílias do J30, atinge o ótimo em 44 e fica a 0,151% dele em média (pior caso 2,33%)    | `npm run validate -- --iters 30000` † |

† Requer baixar o dataset uma vez: `node scripts/fetch-psplib.mjs`. As linhas provadas por
`npm test` não dependem do dataset — usam o subconjunto empacotado em
`src/lib/data/psplib-sample.json`.

## Como rodar

```bash
npm install
npm run dev      # o passo predev compila o WASM (AssemblyScript) antes de subir o Next
```

Build de produção (o passo prebuild compila o WASM):

```bash
npm run build
```

Rodar os testes de invariante:

```bash
npm test
```

Medir o gap contra os ótimos provados do PSPLIB J30:

```bash
node scripts/fetch-psplib.mjs        # baixa as 480 instâncias + os ótimos para .psplib/
npm run validate -- --iters 30000    # amostra de 48 famílias
npm run validate -- --full           # as 480 instâncias
```

## Arquitetura

```text
UI (React, thread principal)
  └─ Comlink ─▶ Web Worker
                 └─ WebAssembly (AssemblyScript)
                      ├─ RCPSP: serial SGS + simulated annealing + double justification
                      ├─ Monte Carlo: amostragem PERT-beta + re-decodificação
                      └─ Weibull: máxima verossimilhança com censura à direita
```

O motor numérico é pesado e roda por segundos a minutos. Ele executa em WebAssembly dentro
de uma Web Worker, fora da thread principal: a página não congela, a busca é cancelável e
reporta progresso ao vivo. Nenhum cálculo acontece no servidor, então o deploy é
essencialmente estático e a persistência de cenários é local (IndexedDB, via Dexie). O
cronograma é otimizado sobre uma _activity list_ mantida sempre viável quanto a
precedências; o serial SGS a decodifica em cronograma, e o simulated annealing com operador
de realocação e _double justification_ a melhora.

**Stack.** Next.js 16 · React 19 · TypeScript 5.9 · Tailwind CSS v4 · AssemblyScript 0.28
(→ WASM) · Comlink · Dexie · Zustand.

## Alternativas consideradas

- **CP-SAT (OR-Tools) em vez da metaheurística.** A abordagem exata natural para o RCPSP é
  a programação por restrições. Ela não é usada porque OR-Tools não compila de forma limpa
  para WebAssembly, e o requisito é rodar o solver inteiro no cliente. A metaheurística
  (serial SGS + simulated annealing + double justification) é compacta, determinística por
  semente e compilável sem dependências nativas. O tradeoff é assumido: ela não prova
  otimalidade, e sobra um gap residual de ~1–2% em poucas instâncias.
- **Função serverless em vez de Web Worker.** Uma função serverless tem timeout de dezenas
  de segundos; o solver roda por minutos. Rodando em WASM numa worker, não há esse limite —
  e a escolha deixa de ser otimização para ser viabilidade.
- **Rust em vez de AssemblyScript.** Rust geraria WASM mais rápido, ao custo de uma
  toolchain nativa no build. AssemblyScript compila para WASM apenas com npm, o que mantém o
  build reprodutível no ambiente do Vercel sem passos extras.
- **Postgres em vez de IndexedDB.** Sem backend, não há onde hospedar o banco no plano
  gratuito; os cenários vivem no navegador.

## Benchmarks

O solver tem _ground truth_ público: a biblioteca **PSPLIB** (Kolisch & Sprecher), cujo
conjunto J30 tem ótimo provado para todas as 480 instâncias (Demeulemeester & Herroelen). O
gap ao ótimo é medido, não declarado.

Resultado sobre a amostra das 48 famílias (primeira instância de cada), 30.000 iterações por
instância, semente fixa `12345` — reproduzível bit a bit com o comando abaixo:

| Métrica        | Valor         |
| -------------- | ------------- |
| Ótimo atingido | 44/48 (91,7%) |
| Gap médio      | 0,151%        |
| Pior gap       | 2,33%         |

```bash
npm run validate -- --iters 30000
```

O número é determinístico por semente e independe de hardware.

## Testes

- **Invariantes (Vitest, `npm test`).** Carregam o mesmo `.wasm` que o app usa e exercitam o
  motor de verdade: viabilidade do cronograma (precedência e capacidade), ótimo provado na
  J30 1-1, rejeição de import com ciclo, e o ajuste de Weibull censurado. Não dependem do
  dataset externo.
- **Validação contra ground truth (`npm run validate`).** Mede o gap ao ótimo provado sobre
  o J30. Requer o dataset baixado.
- **Estático.** `npm run lint`, `npm run typecheck` e `npm run build`.

## Limitações

- O solver é metaheurístico: não prova otimalidade. Sobra gap residual de ~1–2% em poucas
  instâncias do J30.
- O modelo de otimização considera precedências e recursos renováveis com capacidade — o
  guindaste único é um recurso de capacidade 1 e aparece como gargalo real. Os marcadores de
  espaço confinado e de guindaste no Gantt são informativos: restrições de adjacência de
  espaço confinado, curva de aprendizado, turno/hora extra e disponibilidade de sobressalente
  não entram no modelo.
- O PSPLIB valida o motor de agendamento, não as escolhas de modelagem de domínio — essas
  não têm benchmark público.
- Roda inteiramente no cliente: não há backend nem sincronização entre dispositivos. Os
  cenários ficam no navegador (IndexedDB).

## Dados e atribuição

- **PSPLIB** — Kolisch, R.; Sprecher, A. _PSPLIB — a project scheduling problem library._
  European Journal of Operational Research, 1997.
- **Ótimos do J30** — Demeulemeester, E.; Herroelen, W. As instâncias `.sm` são espelhadas de
  repositório público; os ótimos vêm do arquivo original preservado no Internet Archive.
  Ambos são baixados por `scripts/fetch-psplib.mjs` para `.psplib/`, fora do versionamento.

## Licença

MIT — ver [LICENSE](LICENSE). Autoria: Igor Bahia.
