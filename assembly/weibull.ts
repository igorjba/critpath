// Ajuste de Weibull por máxima verossimilhança com censura à direita.
//
// A maioria dos equipamentos não falhou quando os dados são coletados — o tempo em
// serviço é uma observação censurada, não uma falha. Ignorar isso enviesa a estimativa
// da vida característica para baixo. Aqui a censura entra na verossimilhança.
//
// Modelo: T ~ Weibull(k = forma, eta = escala).
//   falha  em t  contribui  f(t) = (k/eta)(t/eta)^{k-1} e^{-(t/eta)^k}
//   censura em t contribui  S(t) = e^{-(t/eta)^k}
//
// Perfil: dado k, o eta ótimo é fechado. Resolve-se k pela equação de verossimilhança
//   g(k) = [Σ_i t_i^k ln t_i / Σ_i t_i^k] - 1/k - (1/r) Σ_{falhas} ln t_i = 0
// (somatórios de potência sobre TODAS as observações; termo logarítmico só nas falhas).
// Bisseção robusta em k, com o eta correspondente:
//   eta = ( (1/r) Σ_i t_i^k )^{1/k}

// times: tempos observados; censored: 1 se censurado (não falhou), 0 se falha.
// Retorna [shape k, scale eta, logLik, nFailures].
export function fitWeibull(times: Float64Array, censored: Int32Array, n: i32): Float64Array {
  let r = 0; // número de falhas
  let sumLnFail = 0.0;
  for (let i = 0; i < n; i++) {
    if (censored[i] == 0) {
      r++;
      sumLnFail += Math.log(times[i]);
    }
  }
  const out = new Float64Array(4);
  if (r == 0) {
    // sem falhas observadas: verossimilhança não identifica k. Retorna sentinela.
    out[0] = NaN; out[1] = NaN; out[2] = NaN; out[3] = 0;
    return out;
  }

  const meanLnFail = sumLnFail / <f64>r;

  // g(k) é decrescente; procura raiz por bisseção em [lo, hi].
  let lo = 0.05;
  let hi = 100.0;
  let glo = gEquation(times, n, lo, meanLnFail);
  let ghi = gEquation(times, n, hi, meanLnFail);
  // Expande caso o sinal não esteja emparedado (raro).
  let guard = 0;
  while (glo * ghi > 0 && guard < 40) {
    hi *= 1.5;
    ghi = gEquation(times, n, hi, meanLnFail);
    guard++;
  }

  let k = 1.0;
  for (let iter = 0; iter < 200; iter++) {
    k = 0.5 * (lo + hi);
    const gk = gEquation(times, n, k, meanLnFail);
    if (Math.abs(gk) < 1e-10 || (hi - lo) < 1e-10) break;
    if (glo * gk < 0) {
      hi = k; ghi = gk;
    } else {
      lo = k; glo = gk;
    }
  }

  // eta pelo estimador de perfil.
  let sumTk = 0.0;
  for (let i = 0; i < n; i++) sumTk += Math.pow(times[i], k);
  const eta = Math.pow(sumTk / <f64>r, 1.0 / k);

  // log-verossimilhança no ótimo.
  let ll = 0.0;
  for (let i = 0; i < n; i++) {
    const z = Math.pow(times[i] / eta, k);
    if (censored[i] == 0) {
      ll += Math.log(k / eta) + (k - 1.0) * Math.log(times[i] / eta) - z;
    } else {
      ll += -z;
    }
  }

  out[0] = k; out[1] = eta; out[2] = ll; out[3] = <f64>r;
  return out;
}

function gEquation(times: Float64Array, n: i32, k: f64, meanLnFail: f64): f64 {
  let sumTk = 0.0;
  let sumTkLn = 0.0;
  for (let i = 0; i < n; i++) {
    const tk = Math.pow(times[i], k);
    sumTk += tk;
    sumTkLn += tk * Math.log(times[i]);
  }
  return sumTkLn / sumTk - 1.0 / k - meanLnFail;
}
