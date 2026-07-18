# Critpath — otimizador de parada de manutenção

Programação de parada de manutenção (turnaround) modelada como **RCPSP**
(Resource-Constrained Project Scheduling Problem) e resolvida por um motor de
otimização compilado para **WebAssembly**, rodando numa **Web Worker** — 100% no
cliente. Sobre o cronograma otimizado, o app calcula o risco da data de partida por
**Monte Carlo** e o intervalo ótimo de manutenção por **Weibull com censura**.

Planejamento de parada é RCPSP na prática: milhares de ordens, precedências, equipes
limitadas, guindaste único como gargalo e janela de parada fixa. O problema é
NP-difícil; um solver de brinquedo ignora as restrições que decidem a data real.

![Dashboard do critpath: KPIs da parada, Gantt com caminho crítico destacado,
histograma de carga por recurso com o guindaste como gargalo e a tabela de ordens com
folgas](docs/screenshot.png)

## Funcionalidades

- **Solver RCPSP** — serial schedule generation scheme (serial SGS) sobre uma activity
  list mantida precedence-feasible, otimizada por simulated annealing com operador de
  realocação e *double justification* (forward-backward).
- **Caminho crítico e folgas** — passe CPM (ES/EF/LS/LF), folga total e folga livre,
  com o caminho crítico destacado no Gantt.
- **Nivelamento de recursos** — histograma de carga por recurso vs. capacidade, com
  detecção de gargalo (recurso saturado por fração relevante do horizonte).
- **Monte Carlo (PERT-beta)** — distribuição da duração por atividade propagada pela
  sequência ótima; a saída é a distribuição do makespan, com P50/P80/P90 e a curva
  "chance de partir até a data".
- **Weibull com censura** — ajuste por máxima verossimilhança com dados censurados à
  direita (a maioria dos equipamentos ainda não falhou), e o intervalo ótimo de
  substituição por idade minimizando custo de preventiva vs. risco de falha.
- **Importador IW39/IW49** — lê o export tabular do SAP PM; centro de trabalho vira
  recurso e a coluna de precedências monta a rede.
- **Validação PSPLIB J30** — roda o solver ao vivo contra instâncias com ótimo provado
  e mede o gap.
- **Cenários** — salva e compara execuções (makespan, esforço, P80) em IndexedDB.

## O motor e sua validação

O solver tem *ground truth* público: a biblioteca **PSPLIB** (Kolisch & Sprecher). O
conjunto J30 tem ótimo provado para todas as 480 instâncias (Demeulemeester &
Herroelen). O gap para o ótimo é medido, não declarado.

Resultado sobre a amostra das 48 famílias do J30 (primeira instância de cada
parâmetro), 30.000 iterações por instância, semente fixa:

| Métrica        | Valor         |
| -------------- | ------------- |
| Ótimo atingido | 44/48 (91,7%) |
| Gap médio      | 0,151%        |
| Pior gap       | 2,33%         |

Reproduzível com `npm run validate` após baixar o dataset (abaixo). O `--full` roda as
480 instâncias.

### Escolha de método: metaheurística vs. exato (comparação honesta)

A abordagem exata natural para RCPSP é **CP-SAT** (OR-Tools). Ela não é usada aqui por
uma razão de engenharia, não de preferência: OR-Tools não compila de forma limpa para
WebAssembly, e o requisito de arquitetura é rodar o solver inteiro no cliente. A
metaheurística (serial SGS + simulated annealing + double justification) foi escolhida
por ser compacta, determinística por semente e compilável para WASM sem dependências
nativas.

O tradeoff é real e assumido: um método exato fecharia o gap residual (as poucas
instâncias em ~1–2%) e provaria otimalidade, ao custo de um modelo bem mais pesado. A
metaheurística entrega gap médio abaixo de 0,2% no J30 com tempo de milissegundos por
instância — suficiente para a decisão de planejamento, e honesto quanto ao que é.

Um asterisco de honestidade: o PSPLIB valida o **motor**, não as restrições realistas
de domínio (espaço confinado, guindaste único, curva de aprendizado). Essas não têm
benchmark público; são modeladas de acordo com a prática de campo.

## Arquitetura

```
UI (React, main thread)
  └─ Comlink ──> Web Worker
                   └─ WebAssembly (AssemblyScript)
                        ├─ RCPSP: serial SGS + simulated annealing
                        ├─ Monte Carlo: PERT-beta + re-decodificação
                        └─ Weibull: MLE censurado
```

O motor numérico é pesado e roda por segundos a minutos. Isso é **inviável em uma
função serverless** (timeout), então ele não toca no serverless: roda em WASM numa
Web Worker, fora da main thread — a página não congela e a busca é cancelável, com
progresso ao vivo. Persistência de cenários é local (IndexedDB). O deploy resultante é
essencialmente estático.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · AssemblyScript (→ WASM) ·
Comlink · Dexie (IndexedDB).

## Desenvolvimento

```bash
npm install
npm run dev          # compila o WASM (predev) e sobe o Next em modo dev
```

O build de produção compila o WASM no passo `prebuild`:

```bash
npm run build
```

### Validar o motor no PSPLIB

```bash
node scripts/fetch-psplib.mjs   # baixa as 480 instâncias J30 + os ótimos para .psplib/
npm run validate                # amostra de 48 famílias, 30k iterações
npm run validate -- --full      # todas as 480 instâncias
```

O subconjunto empacotado no app (`src/lib/data/psplib-sample.json`) é gerado por
`node scripts/gen-psplib-sample.mjs` a partir do dataset local.

## Estrutura

```
assembly/            Motor numérico em AssemblyScript (compila para public/wasm/)
  rcpsp.ts           Serial SGS + simulated annealing + double justification + CPM
  montecarlo.ts      Amostragem PERT-beta e re-decodificação
  weibull.ts         MLE de Weibull com censura à direita
src/
  lib/engine/        Loader WASM, Web Worker e cliente Comlink
  lib/rcpsp/         Modelo de domínio, codificação e derivações de cronograma
  lib/psplib/        Parser do formato .sm e tabela de ótimos
  lib/sap/           Importador IW39/IW49
  lib/weibull/       Otimização de intervalo (substituição por idade)
  components/        UI (dashboard, Gantt, histogramas, Monte Carlo, Weibull)
scripts/             Validação e preparação do dataset
```

## Dados e atribuição

- **PSPLIB** — Kolisch, R.; Sprecher, A. *PSPLIB — a project scheduling problem
  library.* European Journal of Operational Research, 1997.
- **Ótimos do J30** — Demeulemeester, E.; Herroelen, W. As instâncias `.sm` são
  espelhadas de repositório público; os ótimos vêm do arquivo original preservado no
  Internet Archive. Os arquivos ficam em `.psplib/` (fora do versionamento) e são
  baixados por `scripts/fetch-psplib.mjs`.

## Deploy

Compatível com Vercel (plano Hobby). O `prebuild` gera o `.wasm` no build; nenhuma
função serverless é necessária, pois todo o cálculo roda no cliente.

## Licença

MIT.
