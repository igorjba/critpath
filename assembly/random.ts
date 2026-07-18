// xoshiro128** — PRNG determinístico, rápido e de boa qualidade estatística.
// Semente fixa => execução reprodutível, condição para comparar cenários de forma honesta.
export class Rng {
  private s0: u32;
  private s1: u32;
  private s2: u32;
  private s3: u32;

  constructor(seed: u32) {
    // splitmix32 para dispersar a semente pelos quatro registradores de estado.
    let z: u32 = seed != 0 ? seed : 0x9e3779b9;
    this.s0 = this.splitmix(z); z += 0x9e3779b9;
    this.s1 = this.splitmix(z); z += 0x9e3779b9;
    this.s2 = this.splitmix(z); z += 0x9e3779b9;
    this.s3 = this.splitmix(z);
  }

  private splitmix(x: u32): u32 {
    let z: u32 = x + 0x9e3779b9;
    z = (z ^ (z >> 16)) * 0x21f0aaad;
    z = (z ^ (z >> 15)) * 0x735a2d97;
    return z ^ (z >> 15);
  }

  @inline private rotl(x: u32, k: i32): u32 {
    return (x << k) | (x >> (32 - k));
  }

  next(): u32 {
    const result: u32 = this.rotl(this.s1 * 5, 7) * 9;
    const t: u32 = this.s1 << 9;
    this.s2 ^= this.s0;
    this.s3 ^= this.s1;
    this.s1 ^= this.s2;
    this.s0 ^= this.s3;
    this.s2 ^= t;
    this.s3 = this.rotl(this.s3, 11);
    return result;
  }

  // [0, 1) com 53 bits de mantissa.
  nextFloat(): f64 {
    const hi: u64 = <u64>(this.next() >> 5); // 27 bits
    const lo: u64 = <u64>(this.next() >> 6); // 26 bits
    return <f64>((hi * 67108864) + lo) * (1.0 / 9007199254740992.0);
  }

  // Inteiro uniforme em [0, n) sem viés de módulo (rejeição de Lemire).
  nextRange(n: i32): i32 {
    if (n <= 1) return 0;
    const bound: u32 = <u32>n;
    let x: u32 = this.next();
    let m: u64 = <u64>x * <u64>bound;
    let l: u32 = <u32>m;
    if (l < bound) {
      const t: u32 = (0 - bound) % bound;
      while (l < t) {
        x = this.next();
        m = <u64>x * <u64>bound;
        l = <u32>m;
      }
    }
    return <i32>(m >> 32);
  }

  // Normal padrão via Box-Muller (uma amostra por chamada).
  nextGaussian(): f64 {
    let u1: f64 = this.nextFloat();
    const u2: f64 = this.nextFloat();
    if (u1 < 1e-12) u1 = 1e-12;
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(6.283185307179586 * u2);
  }
}
