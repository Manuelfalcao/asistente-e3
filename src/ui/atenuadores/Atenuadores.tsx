import { mensajeDeResultados } from '../../entrada/campo';
import { CampoEntradaValor, useCampoEntrada } from '../comun/CampoEntrada';
import { ATENUACION, FRECUENCIA, POTENCIA, Z1, Z2, Z_POR_DEFECTO } from './campos';

// La Calculadora de atenuadores (spec §10). Por ahora solo tiene sus campos con la Entrada
// flexible: todavía no calcula.
export function Atenuadores() {
  const a = useCampoEntrada(ATENUACION);
  const z1 = useCampoEntrada(Z1, Z_POR_DEFECTO);
  const z2 = useCampoEntrada(Z2, Z_POR_DEFECTO);
  const potencia = useCampoEntrada(POTENCIA);
  const frecuencia = useCampoEntrada(FRECUENCIA);

  const mensaje = mensajeDeResultados(
    [a, z1, z2, potencia, frecuencia].map((c) => ({
      nombre: c.spec.nombre,
      obligatorio: !!c.spec.obligatorio,
      estado: c.estado,
    })),
  );

  return (
    <div class="cuerpo-calculadora">
      <section class="entradas" aria-label="Entradas">
        <CampoEntradaValor id="atenuacion" etiqueta="Atenuación A" campo={a} unidadFija="dB" />
        <CampoEntradaValor id="z1" etiqueta="Z1 (fuente)" campo={z1} />
        <CampoEntradaValor id="z2" etiqueta="Z2 (carga)" campo={z2} />
        <CampoEntradaValor
          id="potencia"
          etiqueta="Potencia de entrada (opcional)"
          campo={potencia}
        />
        <CampoEntradaValor id="frecuencia" etiqueta="Frecuencia (opcional)" campo={frecuencia} />
      </section>
      <section class="resultados" aria-label="Resultados" aria-live="polite">
        {mensaje ? (
          <p class="sin-resultado corregir">{mensaje}</p>
        ) : (
          <p class="sin-resultado">
            Los campos están en orden. Esta Calculadora todavía no calcula.
          </p>
        )}
      </section>
    </div>
  );
}
