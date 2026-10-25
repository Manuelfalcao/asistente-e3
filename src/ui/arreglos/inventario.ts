import { useRef, useState } from 'preact/hooks';
import { almacen } from '../../almacen/almacen';
import {
  type Inventario,
  type TipoComponente,
  leerInventario,
} from '../../calculo/arreglos/inventario';

// El Inventario de cada tipo de componente, leído del almacén al abrir y guardado con cada cambio
// (spec §8.2 y §4.4). Lo guardado se valida al leerlo. Cada cambio se escribe sobre el Inventario
// más nuevo: dos cambios antes del próximo dibujo no se pisan.

const TIPOS: readonly TipoComponente[] = ['capacitor', 'resistencia'];

type Todos = Record<TipoComponente, Inventario>;

export function useInventario(
  componente: TipoComponente,
): [Inventario, (cambio: (previo: Inventario) => Inventario) => void] {
  const [todos, setTodos] = useState<Todos>(
    () =>
      Object.fromEntries(
        TIPOS.map((tipo) => [tipo, leerInventario(almacen.inventario(tipo), tipo)]),
      ) as Todos,
  );
  const ultimos = useRef(todos);
  const cambiar = (cambio: (previo: Inventario) => Inventario) => {
    const nuevo = cambio(ultimos.current[componente]);
    ultimos.current = { ...ultimos.current, [componente]: nuevo };
    setTodos(ultimos.current);
    almacen.guardarInventario(componente, nuevo);
  };
  return [todos[componente], cambiar];
}
