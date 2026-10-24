import { useMemo } from 'preact/hooks';
import temml from 'temml';
import 'temml/dist/Temml-Local.css';
import './formulas.css';

// Una fórmula escrita en LaTeX por el cálculo (spec §5.4). En modo en línea, Temml corta después de
// cada = y de cada operador de primer nivel; lo que no se puede cortar tiene scroll propio.
export function Formula({ latex }: { latex: string }) {
  const mathml = useMemo(
    () => temml.renderToString(latex, { displayMode: false, wrap: 'tex' }),
    [latex],
  );
  return <div class="formula" dangerouslySetInnerHTML={{ __html: mathml }} />;
}
