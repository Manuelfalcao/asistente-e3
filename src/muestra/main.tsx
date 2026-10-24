// Página de muestra del sistema visual, para que el Ayudante de cátedra la apruebe en el celular.
// No llega al Asistente: la sirve `npm run dev` en /muestra.html y la arma `npm run build:muestra`.
import { render } from 'preact';
import { Muestra } from './Muestra';
import '../ui/estilos.css';
import './muestra.css';

render(<Muestra />, document.getElementById('app')!);
