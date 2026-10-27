import { useEffect, useMemo, useState } from 'preact/hooks';
import { almacen } from '../../almacen/almacen';
import { opcionesDelSelector } from '../../entrada/campos';
import {
  leerCampo,
  type EspecCampo,
  type EspecSinSelector,
  type EstadoCampo,
} from '../../entrada/campo';
import { type Precarga, conValorCompleto } from '../pases';
import type { Opcion } from './BotonesSegmentados';
import { CampoValor, type Lectura } from './CampoValor';

// El texto de un campo de valor y su Selector de unidad, leídos con la Entrada flexible. La
// Calculadora usa `estado` para calcular y para decidir qué muestra el área de resultados.
export interface CampoEntrada {
  spec: EspecCampo;
  texto: string;
  setTexto: (texto: string) => void;
  unidad: string | undefined;
  setUnidad: (unidad: string) => void;
  estado: EstadoCampo;
}

// `guardado` ubica el campo en el almacén (Calculadora e id del campo): lo escrito vuelve al
// reabrir el Asistente (spec §4.4). `llegada` es el valor que trae un pase desde otra Calculadora
// (spec §4.2): manda sobre lo guardado al abrir, y mientras no se edite el campo vale completo.
export function useCampoEntrada(
  spec: EspecSinSelector,
  textoInicial = '',
  guardado?: { calculadora: string; campo: string },
  llegada?: Precarga,
): CampoEntrada {
  const opciones = opcionesDelSelector(spec.magnitud, spec.dbm);
  const previa = guardado && almacen.entrada(guardado.calculadora, guardado.campo);
  const [completo, setCompleto] = useState<Precarga | null>(llegada ?? null);
  const unidadInicial = llegada ? llegada.unidad : previa?.unidad;
  // El Selector de unidad arranca en la primera opción de la magnitud (spec §5.1).
  const [unidad, setUnidadElegida] = useState<string | undefined>(
    unidadInicial !== undefined && opciones.includes(unidadInicial) ? unidadInicial : opciones[0],
  );
  const [texto, setTextoEscrito] = useState(
    llegada ? llegada.texto : previa ? previa.texto : textoInicial,
  );
  // Editar el texto o el Selector de unidad suelta el valor completo del pase.
  const setTexto = (t: string) => {
    setCompleto(null);
    setTextoEscrito(t);
  };
  const setUnidad = (u: string) => {
    setCompleto(null);
    setUnidadElegida(u);
  };
  useEffect(() => {
    if (guardado) {
      almacen.guardarEntrada(guardado.calculadora, guardado.campo, {
        texto,
        ...(unidad !== undefined && { unidad }),
      });
    }
  }, [texto, unidad]);
  const completa: EspecCampo = useMemo(() => ({ ...spec, unidad }), [spec, unidad]);
  const estado = useMemo(
    () => conValorCompleto(leerCampo(texto, completa), completo, texto, unidad),
    [texto, completa, completo, unidad],
  );
  return { spec: completa, texto, setTexto, unidad, setUnidad, estado };
}

function lecturaDe(estado: EstadoCampo): Lectura | undefined {
  switch (estado.estado) {
    case 'invalido':
      return { tipo: 'error', texto: estado.motivo };
    case 'valido':
      return estado.aviso
        ? { tipo: 'aviso', texto: estado.aviso }
        : { tipo: 'eco', texto: estado.eco };
    default:
      return undefined;
  }
}

// Campo de valor con la Entrada flexible: el eco en vivo debajo, o el motivo en rojo si no se lee.
export function CampoEntradaValor({
  id,
  etiqueta,
  campo,
  unidadFija,
  ayuda,
}: {
  id: string;
  etiqueta: string;
  campo: CampoEntrada;
  // Una línea fija debajo de la lectura, como el mínimo de un campo.
  ayuda?: string;
  // Para los campos sin Selector de unidad, como los dB o los largos en mm.
  unidadFija?: string;
}) {
  const { spec, unidad } = campo;
  const opciones = opcionesDelSelector(spec.magnitud, spec.dbm);
  // Con una sola unidad (los largos, en mm) no hay nada que elegir: va fija, sin desplegable.
  const conSelector = opciones.length > 1;
  return (
    <CampoValor
      id={id}
      etiqueta={etiqueta}
      texto={campo.texto}
      onTexto={campo.setTexto}
      selector={
        conSelector && unidad !== undefined
          ? { unidades: opciones, unidad, onUnidad: campo.setUnidad }
          : undefined
      }
      unidadFija={conSelector ? undefined : (unidadFija ?? opciones[0])}
      lectura={lecturaDe(campo.estado)}
      ayuda={ayuda}
    />
  );
}

// El ⇄ entre la fuente y la carga: cambia el texto y el Selector de unidad de los dos campos.
export function intercambiar(a: CampoEntrada, b: CampoEntrada) {
  const [textoA, unidadA] = [a.texto, a.unidad];
  a.setTexto(b.texto);
  b.setTexto(textoA);
  if (b.unidad !== undefined) a.setUnidad(b.unidad);
  if (unidadA !== undefined) b.setUnidad(unidadA);
}

// La opción elegida, guardada como el texto de un campo: vuelve al reabrir el Asistente (spec §4.4).
// Si lo guardado ya no es una opción, vale la opción por defecto.
// `llegada` es la opción que deja elegida un pase (spec §4.2) y manda sobre lo guardado.
export function useOpcionGuardada<V extends string>(
  opciones: readonly Opcion<V>[],
  porDefecto: V,
  guardado: { calculadora: string; campo: string },
  llegada?: V,
): [V, (valor: V) => void] {
  const previa = almacen.entrada(guardado.calculadora, guardado.campo)?.texto;
  const [valor, setValor] = useState<V>(
    llegada ?? opciones.find((o) => o.valor === previa)?.valor ?? porDefecto,
  );
  useEffect(() => {
    almacen.guardarEntrada(guardado.calculadora, guardado.campo, { texto: valor });
  }, [valor]);
  return [valor, setValor];
}
