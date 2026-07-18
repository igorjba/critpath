import type { NextConfig } from "next";

// Content-Security-Policy calibrada para o app:
// - 'wasm-unsafe-eval': WebAssembly.instantiate a partir de ArrayBuffer (o motor)
// - 'unsafe-inline' em script: bootstrap de hidratação do Next + script de tema (static
//   render nao permite nonce); mitigado pelas demais diretivas
// - 'unsafe-inline' em style: atributos style inline dos graficos (Gantt/charts)
// - worker-src 'self' blob:: Web Worker do motor
// - connect-src 'self': fetch do .wasm (mesma origem); nenhuma conexao externa
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // O .wasm é servido estático de /public/wasm e carregado por fetch no worker;
  // nenhum bundling especial é necessário. Sem SharedArrayBuffer => sem COOP/COEP.
  outputFileTracingIncludes: {
    "/": ["./public/wasm/**"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
