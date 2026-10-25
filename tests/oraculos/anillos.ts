// Oráculo de suma de anillos (spec §13.4): la L de una bobina de una o de dos capas como la suma de
// las inductancias de sus anillos coaxiales, cada uno al centro de su vuelta, con la fórmula exacta
// de Maxwell para dos anillos (integrales elípticas K y E, por la media aritmético-geométrica). La
// autoinductancia de cada anillo es la mutua con otro a la distancia media geométrica de la
// superficie del cable, d/2: la externa, la de VHF. Es el método de Knight, Solenoid Inductance
// Calculation, sección 10c. En dos capas, la segunda va apilada sobre la primera, con las vueltas a
// las mismas alturas. Trae también la lámina de corriente exacta de Lorenz, contra la que se mide
// Wheeler. Se escribe aparte y no importa nada de src/: no comparte ni kL ni ks ni km con las
// fórmulas de Rosa y Nagaoka que verifica, ni Bs ni la corrección de Maxwell con las de Rosa y
// Grover.

const MU0 = 4 * Math.PI * 1e-7;

// K(k) y E(k), integrales elípticas completas de módulo k, por la media aritmético-geométrica
// (Abramowitz y Stegun, 17.6): E/K = 1 − k²/2 − S, con S = Σ_{n≥1} 2^(n−1)·c_n². Cada c_n sale
// de c_(n−1)²/(4·a_n), sin restar números parecidos, y S va aparte porque (1 − k²/2)·K − E = K·S
// es lo que pide la mutua de dos anillos lejanos.
export function integralesElipticas(k: number): { K: number; E: number; S: number } {
  let a = 1;
  let b = Math.sqrt(1 - k * k);
  let c = k;
  let s = 0;
  let potencia = 0.5;
  for (let i = 0; i < 60 && c > 1e-300; i++) {
    const siguiente = (a + b) / 2;
    c = (c * c) / (4 * siguiente);
    b = Math.sqrt(a * b);
    a = siguiente;
    potencia *= 2;
    const termino = potencia * c * c;
    s += termino;
    if (termino <= 1e-18 * s) break;
  }
  const K = Math.PI / (2 * a);
  return { K, E: K * (1 - (k * k) / 2 - s), S: s };
}

// Inductancia mutua de dos anillos coaxiales de radios r1 y r2 separados z, en H (Maxwell):
// M = μ0·√(r1·r2)·[(2/k − k)·K − (2/k)·E] = μ0·√(r1·r2)·(2/k)·K·S, con
// k² = 4·r1·r2 / ((r1 + r2)² + z²).
export function mutuaDeAnillos(r1: number, r2: number, z: number): number {
  const k = Math.sqrt((4 * r1 * r2) / ((r1 + r2) ** 2 + z * z));
  const { K, S } = integralesElipticas(k);
  return MU0 * Math.sqrt(r1 * r2) * (2 / k) * K * S;
}

// La L de N vueltas enteras de diámetro `diametro` (al centro del cable), con `entreCentros` entre
// los centros de dos vueltas vecinas y cable de diámetro `cable`, en H: N autoinductancias más
// 2·Σ (N − m)·M(r, r, m·entreCentros).
export function sumaDeAnillos(
  diametro: number,
  vueltas: number,
  entreCentros: number,
  cable: number,
) {
  if (!Number.isInteger(vueltas) || vueltas < 1) {
    throw new Error(`la suma de anillos necesita vueltas enteras: ${vueltas}`);
  }
  const r = diametro / 2;
  let suma = vueltas * mutuaDeAnillos(r, r, cable / 2);
  for (let m = 1; m < vueltas; m++)
    suma += 2 * (vueltas - m) * mutuaDeAnillos(r, r, m * entreCentros);
  return suma;
}

// La L de dos capas apiladas de n vueltas enteras cada una sobre un carrete de diámetro `carrete`,
// bobinadas en el mismo sentido, en H: la primera capa al radio carrete/2 + d/2 y la segunda, encima,
// a carrete/2 + 3d/2, con las vueltas de las dos a las mismas alturas. Cada capa suma como una de una
// capa, y entre las dos se suman 2·Σ M(r1, r2, z) sobre todos los pares, con z = 0 entre una vuelta
// y la que tiene encima.
export function sumaDeAnillosDosCapas(
  carrete: number,
  vueltasPorCapa: number,
  entreCentros: number,
  cable: number,
) {
  const r1 = carrete / 2 + cable / 2;
  const r2 = r1 + cable;
  const n = vueltasPorCapa;
  let entreCapas = n * mutuaDeAnillos(r1, r2, 0);
  for (let m = 1; m < n; m++) entreCapas += 2 * (n - m) * mutuaDeAnillos(r1, r2, m * entreCentros);
  return (
    sumaDeAnillos(2 * r1, n, entreCentros, cable) +
    sumaDeAnillos(2 * r2, n, entreCentros, cable) +
    2 * entreCapas
  );
}

// Coeficiente de Nagaoka exacto de la lámina de corriente (Lorenz), con x = D/ℓ:
// kL = 4x/(3π)·[(2k² − 1)/k³·E + (1 − k²)/k³·K − 1], con k² = x²/(1 + x²).
export function kLorenz(x: number): number {
  const k2 = (x * x) / (1 + x * x);
  const k = Math.sqrt(k2);
  const { K, E } = integralesElipticas(k);
  const k3 = k2 * k;
  return ((4 * x) / (3 * Math.PI)) * (((2 * k2 - 1) / k3) * E + ((1 - k2) / k3) * K - 1);
}

// La L de la lámina de corriente de diámetro D y largo ℓ con N vueltas, en H: μ0·π·D²·N²·kL/(4ℓ).
export function laminaExacta(diametro: number, largo: number, vueltas: number): number {
  return (
    (MU0 * Math.PI * diametro * diametro * vueltas * vueltas * kLorenz(diametro / largo)) /
    (4 * largo)
  );
}
