import type { ResultadoFiltro } from '../../calculo/filtros/filtros';
import type { ResultadoResonadores } from '../../calculo/filtros/resonadores';
import { type PaseARedes, type PaseDeValor, paseDeComponente } from '../pases';

// Los pases desde la Calculadora de filtros (spec §5.5): cada L a Bobinas y cada C a Arreglos
// equivalentes, y el aviso de pérdida plana a redes de adaptación.

type FiltroCalculado = Extract<ResultadoFiltro, { estado: 'calculado' }>;
type ResonadoresCalculado = Extract<ResultadoResonadores, { estado: 'calculado' }>;

// Uno por elemento, en el mismo orden. Las L llevan como frecuencia de trabajo la de evaluación del
// valor impracticable: fc, o f2 en pasa banda y rechaza banda (spec §12.2).
export function pasesDelFiltro(r: FiltroCalculado): PaseDeValor[] {
  return r.elementos.map((e) =>
    paseDeComponente(
      'filtros',
      e,
      r.revision.marcados,
      e.componente === 'L' ? { frecuencia: r.frecuenciaRevision } : {},
    ),
  );
}

// La L de los resonadores con la Frecuencia de sintonía, y los Capacitores de extremo y de acople por
// nombre. Los Capacitores de sintonía no se pasan: van con trimmer.
export function pasesDeResonadores(r: ResonadoresCalculado): {
  l: PaseDeValor;
  capacitores: ReadonlyMap<string, PaseDeValor>;
} {
  const { marcados } = r.revision;
  return {
    l: paseDeComponente('filtros', r.inductancia, marcados, { frecuencia: r.sintonia.f0 }),
    capacitores: new Map(
      [...r.extremos, ...r.acoples].map(({ capacitor: c }) => [
        c.nombre,
        paseDeComponente('filtros', c, marcados),
      ]),
    ),
  };
}

// Rs y RL; f₀ solo si el filtro es pasa banda (spec §9.7).
export function paseDePerdidaPlana(
  { rs, rl }: { rs: number; rl: number },
  { tipo, banda }: Pick<FiltroCalculado, 'tipo' | 'banda'>,
): PaseARedes {
  return {
    origen: 'filtros',
    destino: 'redes',
    rs,
    rl,
    ...(tipo === 'pasa-banda' && banda && { f0: banda.f0 }),
  };
}
