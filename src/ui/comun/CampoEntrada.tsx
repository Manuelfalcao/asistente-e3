import { useEffect, useMemo, useState } from 'preact/hooks';
import { almacen } from '../../almacen/almacen';
import { opcionesDelSelector } from '../../entrada/campos';
import {
  leerCampo,
  type EspecCampo,
  type EspecSinSelector,
  type EstadoCampo,
} from '../../entrada/campo';
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
// reabrir el Asistente (spec §4.4).
export function useCampoEntrada(
  spec: EspecSinSelector,
  textoInicial = '',
  guardado?: { calculadora: string; campo: string },
): CampoEntrada {
  const opciones = opcionesDelSelector(spec.magnitud, spec.dbm);
  const previa = guardado && almacen.entrada(guardado.calculadora, guardado.campo);
  // El Selector de unidad arranca en la primera opción de la magnitud (spec §5.1).
  const [unidad, setUnidad] = useState<string | undefined>(
    previa?.unidad !== undefined && opciones.includes(previa.unidad) ? previa.unidad : opciones[0],
  );
  const [texto, setTexto] = useState(previa ? previa.texto : textoInicial);
  useEffect(() => {
    if (guardado) {
      almacen.guardarEntrada(guardado.calculadora, guardado.campo, {
        texto,
        ...(unidad !== undefined && { unidad }),
      });
    }
  }, [texto, unidad]);
  const completa: EspecCampo = useMemo(() => ({ ...spec, unidad }), [spec, unidad]);
  const estado = useMemo(() => leerCampo(texto, completa), [texto, completa]);
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
export function useOpcionGuardada<V extends string>(
  opciones: readonly Opcion<V>[],
  porDefecto: V,
  guardado: { calculadora: string; campo: string },
): [V, (valor: V) => void] {
  const previa = almacen.entrada(guardado.calculadora, guardado.campo)?.texto;
  const [valor, setValor] = useState<V>(
    opciones.find((o) => o.valor === previa)?.valor ?? porDefecto,
  );
  useEffect(() => {
    almacen.guardarEntrada(guardado.calculadora, guardado.campo, { texto: valor });
  }, [valor]);
  return [valor, setValor];
}
