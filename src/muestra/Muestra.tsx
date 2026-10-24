import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { CALCULADORAS } from '../ui/calculadoras';
import { BotonesSegmentados } from '../ui/comun/BotonesSegmentados';
import { BotonPase } from '../ui/comun/BotonPase';
import { CampoValor } from '../ui/comun/CampoValor';
import { Esquema } from '../ui/comun/Esquema';
import { Aviso, FranjaLlegada, FranjaVersion } from '../ui/comun/Franjas';
import { IconoCalculadora } from '../ui/comun/Icono';
import { Rotulo, type TipoRotulo } from '../ui/comun/Rotulo';
import { TarjetaResultado, ValorResultado } from '../ui/comun/Tarjeta';
import { svgIconoAsistente } from '../ui/iconos';
import { PARES_DE_CONTRASTE, contraste, leerPaleta } from '../ui/paleta';
import tokens from '../ui/tokens.css?raw';
import { EJEMPLOS, RED_PI } from './ejemplos';

type Tema = 'sistema' | 'claro' | 'oscuro';

const PALETA = leerPaleta(tokens);
const OSCURO = '(prefers-color-scheme: dark)';

// Para ver los dos temas sin cambiar el del teléfono: pisa las variables en el <html>.
function aplicarTema(tema: Tema) {
  const raiz = document.documentElement;
  for (const nombre of Object.keys(PALETA.claro)) raiz.style.removeProperty(`--${nombre}`);
  raiz.style.removeProperty('color-scheme');
  if (tema === 'sistema') return;
  for (const [nombre, valor] of Object.entries(PALETA[tema])) {
    raiz.style.setProperty(`--${nombre}`, valor);
  }
  raiz.style.setProperty('color-scheme', tema === 'claro' ? 'light' : 'dark');
}

function useTemaDelSistema(): 'claro' | 'oscuro' {
  const consulta = () => (matchMedia(OSCURO).matches ? 'oscuro' : 'claro');
  const [tema, setTema] = useState<'claro' | 'oscuro'>(consulta);
  useEffect(() => {
    const m = matchMedia(OSCURO);
    const cambio = () => setTema(consulta());
    m.addEventListener('change', cambio);
    return () => m.removeEventListener('change', cambio);
  }, []);
  return tema;
}

function useAnchoVentana(): number {
  const [ancho, setAncho] = useState(window.innerWidth);
  useEffect(() => {
    const cambio = () => setAncho(window.innerWidth);
    addEventListener('resize', cambio);
    return () => removeEventListener('resize', cambio);
  }, []);
  return ancho;
}

const coma = (n: number, decimales: number) => n.toFixed(decimales).replace('.', ',');

export function Muestra() {
  const [tema, setTema] = useState<Tema>('sistema');
  const delSistema = useTemaDelSistema();
  const ancho = useAnchoVentana();
  useEffect(() => aplicarTema(tema), [tema]);
  const efectivo = tema === 'sistema' ? delSistema : tema;

  return (
    <div class="m-pagina">
      <header class="m-cabecera">
        <h1>Sistema visual del Asistente</h1>
        <p>
          Página de muestra para que el Ayudante de cátedra apruebe la propuesta. No forma parte del
          Asistente que reciben los Alumnos.
        </p>
        <BotonesSegmentados
          etiqueta="Tema"
          nombre="tema"
          opciones={[
            { valor: 'sistema', texto: 'Del sistema' },
            { valor: 'claro', texto: 'Claro' },
            { valor: 'oscuro', texto: 'Oscuro' },
          ]}
          valor={tema}
          onCambio={setTema}
        />
        <p class="m-nota">
          Ancho de la ventana: {ancho} px. El Asistente sigue el tema del sistema; este selector es
          solo para la revisión.
        </p>
      </header>

      <Seccion titulo="Paleta">
        <p>
          Colores del tema {efectivo}. Cada combinación que usa el Asistente, con su contraste:
          4,5:1 para texto y rótulos y 3:1 para bordes de campos y puntos de aviso (WCAG AA).
        </p>
        <div class="m-colores">
          {Object.entries(PALETA[efectivo]).map(([nombre, valor]) => (
            <div key={nombre} class="m-color">
              <span class="m-pastilla" style={{ background: `var(--${nombre})` }} />
              <code>--{nombre}</code>
              <span class="m-hex">{valor}</span>
            </div>
          ))}
        </div>
        <table class="m-tabla">
          <thead>
            <tr>
              <th>Muestra</th>
              <th>Uso</th>
              <th>Contraste</th>
            </tr>
          </thead>
          <tbody>
            {PARES_DE_CONTRASTE.map((p) => {
              const r = contraste(PALETA[efectivo][p.frente], PALETA[efectivo][p.fondo]);
              return (
                <tr key={p.frente + p.fondo}>
                  <td>
                    <span
                      class="m-par"
                      style={{ color: `var(--${p.frente})`, background: `var(--${p.fondo})` }}
                    >
                      {p.minimo === 3 ? '●' : 'Aa 4,7 nH'}
                    </span>
                  </td>
                  <td>
                    {p.uso}
                    <br />
                    <code>
                      --{p.frente} / --{p.fondo}
                    </code>
                  </td>
                  <td class="numero">
                    {coma(r, 2)}:1 {r >= p.minimo ? '✓' : '✗'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Seccion>

      <Seccion titulo="Tipografía">
        <p>
          Texto y números con la fuente del sistema (Roboto en Android, San Francisco en iPhone,
          Segoe UI en Windows): no suma peso al HTML único y se lee bien en el celular. Las fórmulas
          van en Latin Modern Math, un 15 % más grandes para que las x de las dos fuentes queden a
          la misma altura.
        </p>
        <div class="m-escala">
          {[
            ['1', '12 px', 'Nombre de las pestañas'],
            ['2', '13 px', 'Rótulos, eco y esquemas'],
            ['3', '14 px', 'Texto secundario, referencias, motivos'],
            ['4', '16 px', 'Texto, campos y botones'],
            ['5', '18 px', 'Títulos de tarjeta y encabezado'],
            ['6', '22 px', 'Valor principal de un resultado'],
          ].map(([n, px, uso]) => (
            <div key={n} class="m-tam">
              <span style={{ fontSize: `var(--tam-${n})` }}>Calculá la bobina de 47 nH</span>
              <small>
                --tam-{n} · {px} · {uso}
              </small>
            </div>
          ))}
        </div>
        <TarjetaResultado
          titulo="Atenuador T de 10 dB, de 50 a 50 Ω"
          destacada
          pasos={
            <>
              <Formula mathml={MATHML_K} />
              <p>Con los valores sustituidos y 4 cifras, como en los pasos intermedios.</p>
            </>
          }
        >
          <span class="valor-principal">R3 = 35,1 Ω</span>
          <Formula mathml={MATHML_R3} />
          <p class="referencia">
            <em>Reference Data for Radio Engineers</em>, 4.ª ed. (ITT, 1956), cap. 9, pág. 253.
          </p>
          <ValorResultado nombre="R1" valor="26,0 Ω" />
          <ValorResultado nombre="R2" valor="26,0 Ω" />
          <ValorResultado nombre="R3" valor="35,1 Ω" />
        </TarjetaResultado>
        <p class="m-nota">
          Cifras tabulares: los números ocupan el mismo ancho y las columnas quedan alineadas (11,1
          y 88,8).
        </p>
      </Seccion>

      <Seccion titulo="Espaciado y objetivos táctiles">
        <p>Pasos de 4 px. Todo lo que se toca mide al menos 44 px de alto.</p>
        <div class="m-espacios">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} class="m-espacio">
              <span style={{ width: `var(--esp-${n})` }} />
              <code>--esp-{n}</code>
            </div>
          ))}
        </div>
        <div class="m-toque">
          <span class="m-cuadro-toque">44 px</span>
          <BotonPase destino="bobinas" />
          <button type="button" class="pase">
            ‹ Volver a Filtros
          </button>
        </div>
      </Seccion>

      <Seccion titulo="Íconos">
        <p>
          Cinco íconos de trazo, del color del texto, para las pestañas del celular y el menú
          lateral de PC (el menú se ve en el Asistente, con la ventana ancha).
        </p>
        <div class="m-iconos">
          {CALCULADORAS.map((c) => (
            <figure key={c.id}>
              <IconoCalculadora id={c.id} tam={48} />
              <figcaption>{c.nombreCorto}</figcaption>
            </figure>
          ))}
        </div>
        <nav class="pestanas m-estatica" aria-label="Pestañas de ejemplo">
          {CALCULADORAS.map((c, i) => (
            <button key={c.id} type="button" class={i === 0 ? 'activa' : ''}>
              <span class="icono">
                <IconoCalculadora id={c.id} />
              </span>
              <span class="nombre">{c.nombreCorto}</span>
            </button>
          ))}
        </nav>
        <p>
          Ícono del Asistente instalado: con esquinas redondeadas (PC y navegador), recortado en
          círculo como lo hace Android (maskable) y cuadrado como lo redondea el iPhone.
        </p>
        <div class="m-iconos-app">
          <figure>
            <span dangerouslySetInnerHTML={{ __html: svgIconoAsistente({ redondeado: true }) }} />
            <figcaption>192 y 512 px</figcaption>
          </figure>
          <figure>
            <span
              class="m-circulo"
              dangerouslySetInnerHTML={{ __html: svgIconoAsistente({ redondeado: false }) }}
            />
            <figcaption>maskable</figcaption>
          </figure>
          <figure>
            <span
              class="m-ios"
              dangerouslySetInnerHTML={{ __html: svgIconoAsistente({ redondeado: false }) }}
            />
            <figcaption>apple-touch (180 px)</figcaption>
          </figure>
        </div>
      </Seccion>

      <Seccion titulo="Componentes">
        <h3>Tarjeta de resultado</h3>
        <p class="m-nota">Datos de ejemplo, sin cálculo: una red π a 145 MHz.</p>
        <TarjetaResultado
          titulo="Red π pasa bajos"
          pasos={<p>Q mínimo, Resistencia virtual y cada sección L con su transformación.</p>}
          motivos={[
            {
              nivel: 'dudoso',
              texto: 'C1: cerca de su autorresonancia (ESL de 2,8 nH) → 22 % de error a 145 MHz.',
            },
            {
              nivel: 'impracticable',
              texto: 'C2: suponiendo montaje Manhattan, ±0,5 pF → 62 % de error.',
            },
          ]}
          sugerencia="Probá otra variante o bajá el Q de diseño."
        >
          <Esquema escalera={RED_PI} />
          <ValorResultado
            nombre="C1"
            valor="87,4 pF"
            rotulos={<Rotulo tipo="dudoso" />}
            detalle="X = −12,6 Ω"
            pase={<BotonPase destino="arreglos" nivel="dudoso" />}
          />
          <ValorResultado
            nombre="L1"
            valor="145 nH"
            detalle="X = 132 Ω"
            pase={<BotonPase destino="bobinas" />}
          />
          <ValorResultado
            nombre="C2"
            valor="0,8 pF"
            rotulos={<Rotulo tipo="impracticable" />}
            detalle="X = −1,37 kΩ"
            pase={<BotonPase destino="arreglos" nivel="impracticable" />}
          />
          <ValorResultado
            nombre="Pérdida"
            valor="0,21 dB"
            rotulos={<Rotulo tipo="estimacion" />}
            detalle="con Q = 100 en la bobina"
          />
        </TarjetaResultado>

        <h3>Botones segmentados</h3>
        <Segmentados />

        <h3>Campos de valor</h3>
        <Campos />

        <h3>Rótulos</h3>
        <div class="m-fila">
          {(
            [
              'dudoso',
              'impracticable',
              'estimacion',
              'criterio-practico',
              'criterio-diseno',
              'deduccion-propia',
            ] as TipoRotulo[]
          ).map((t) => (
            <Rotulo key={t} tipo={t} />
          ))}
        </div>

        <h3>Botones de pase</h3>
        <div class="m-fila">
          <BotonPase destino="bobinas" />
          <BotonPase destino="arreglos" nivel="dudoso" />
          <BotonPase destino="arreglos" nivel="impracticable" />
        </div>

        <h3>Franja de llegada</h3>
        <FranjaLlegada origen="redes" valor="L1 = 145 nH" />
        <FranjaLlegada
          origen="redes"
          valor="C1 = 87,4 pF"
          nivel="dudoso"
          motivo="Cerca de su autorresonancia (ESL de 2,8 nH) → 22 % de error a 145 MHz."
        />

        <h3>Franja de versión nueva</h3>
        <div class="m-franja-version">
          <FranjaVersion />
        </div>

        <h3>Avisos de la Calculadora</h3>
        <Aviso>
          Este filtro no adapta: tiene una pérdida plana de 3,10 dB, igual a la desadaptación
          directa, 4r/(1+r)².
        </Aviso>
        <Aviso fuerte>
          Con Bessel y R<sub>s</sub> ≠ R<sub>L</sub> en π o T no se calcula.
        </Aviso>
      </Seccion>

      <Seccion titulo="Esquemas">
        <p>
          Un esquema de cada Calculadora que dibuja una red en escalera. Si no entra a lo ancho, se
          parte en filas unidas por conectores numerados. Bobinas y Arreglos equivalentes no dibujan
          esquemas.
        </p>
        {EJEMPLOS.map((grupo) => (
          <div key={grupo.calculadora}>
            <h3>{grupo.calculadora}</h3>
            <div class="grilla-tarjetas">
              {grupo.ejemplos.map((e) => (
                <TarjetaResultado key={e.titulo} titulo={e.titulo}>
                  <Esquema escalera={e.escalera} />
                  <p class="referencia">{e.nota}</p>
                </TarjetaResultado>
              ))}
            </div>
          </div>
        ))}
      </Seccion>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: ComponentChildren }) {
  return (
    <section class="m-seccion">
      <h2>{titulo}</h2>
      {children}
    </section>
  );
}

function Formula({ mathml }: { mathml: string }) {
  return <div class="formula" dangerouslySetInnerHTML={{ __html: mathml }} />;
}

function Segmentados() {
  const [tipo, setTipo] = useState('pasa-banda');
  const [aprox, setAprox] = useState('chebyshev');
  const [serie, setSerie] = useState('E12');
  return (
    <div class="m-entradas">
      <BotonesSegmentados
        etiqueta="Tipo de filtro"
        nombre="tipo"
        opciones={[
          { valor: 'pasa-bajos', texto: 'Pasa bajos' },
          { valor: 'pasa-altos', texto: 'Pasa altos' },
          { valor: 'pasa-banda', texto: 'Pasa banda' },
          { valor: 'rechaza-banda', texto: 'Rechaza banda' },
        ]}
        valor={tipo}
        onCambio={setTipo}
      />
      <BotonesSegmentados
        etiqueta="Aproximación"
        nombre="aproximacion"
        opciones={[
          { valor: 'butterworth', texto: 'Butterworth' },
          { valor: 'chebyshev', texto: 'Chebyshev' },
          { valor: 'bessel', texto: 'Bessel' },
        ]}
        valor={aprox}
        onCambio={setAprox}
      />
      <BotonesSegmentados
        etiqueta="Serie"
        nombre="serie"
        opciones={[
          { valor: 'E6', texto: 'E6' },
          { valor: 'E12', texto: 'E12' },
          { valor: 'E24', texto: 'E24' },
        ]}
        valor={serie}
        onCambio={setSerie}
      />
    </div>
  );
}

function Campos() {
  const [l, setL] = useState('4n7');
  const [uL, setUL] = useState('nH');
  const [r, setR] = useState('1.000');
  const [uR, setUR] = useState('Ω');
  const [f, setF] = useState('4,7x');
  const [uF, setUF] = useState('MHz');
  const [d, setD] = useState('0,8');
  return (
    <div class="m-entradas">
      <p class="m-nota">Las lecturas son de ejemplo: leer el texto es de la Entrada flexible.</p>
      <CampoValor
        id="m-l"
        etiqueta="Inductancia buscada"
        texto={l}
        onTexto={setL}
        selector={{ unidades: ['nH', 'µH'], unidad: uL, onUnidad: setUL }}
        lectura={{ tipo: 'eco', texto: '= 4,7 nH' }}
      />
      <CampoValor
        id="m-r"
        etiqueta="Z1 (fuente)"
        texto={r}
        onTexto={setR}
        selector={{ unidades: ['Ω', 'kΩ', 'MΩ'], unidad: uR, onUnidad: setUR }}
        lectura={{ tipo: 'aviso', texto: 'Se leyó 1 Ω. Para mil, escribí 1000 o 1k.' }}
      />
      <CampoValor
        id="m-f"
        etiqueta="Frecuencia de trabajo (opcional)"
        texto={f}
        onTexto={setF}
        selector={{ unidades: ['MHz', 'kHz', 'GHz'], unidad: uF, onUnidad: setUF }}
        lectura={{ tipo: 'error', texto: 'No entiendo «4,7x»' }}
      />
      <CampoValor
        id="m-d"
        etiqueta="Diámetro del cable (con esmalte)"
        texto={d}
        onTexto={setD}
        unidadFija="mm"
        lectura={{ tipo: 'eco', texto: '= 0,8 mm' }}
      />
    </div>
  );
}

// MathML escrito a mano para la muestra: las fórmulas del Asistente las arma Temml (ticket 28).
const sub = (base: string, i: string) => `<msub><mi>${base}</mi><mn>${i}</mn></msub>`;
const MATHML_R3 =
  '<math><mrow>' +
  sub('R', '3') +
  '<mo>=</mo><mfrac><mrow><mn>2</mn><mi>K</mi><msqrt>' +
  sub('Z', '1') +
  sub('Z', '2') +
  '</msqrt></mrow><mrow><msup><mi>K</mi><mn>2</mn></msup><mo>−</mo><mn>1</mn></mrow></mfrac>' +
  '<mo>=</mo><mfrac><mrow><mn>2</mn><mo>·</mo><mn>3,162</mn><mo>·</mo><mn>50</mn></mrow>' +
  '<mrow><mn>10,00</mn><mo>−</mo><mn>1</mn></mrow></mfrac><mo>=</mo><mn>35,14</mn>' +
  '<mspace width="0.17em"/><mi mathvariant="normal">Ω</mi></mrow></math>';
const MATHML_K =
  '<math><mrow><mi>K</mi><mo>=</mo><msup><mn>10</mn><mrow><mi>A</mi><mo>/</mo><mn>20</mn></mrow></msup>' +
  '<mo>=</mo><msup><mn>10</mn><mrow><mn>10</mn><mo>/</mo><mn>20</mn></mrow></msup><mo>=</mo>' +
  '<mn>3,162</mn></mrow></math>';
