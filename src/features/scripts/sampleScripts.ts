import type { Script } from '../../types';

export const SAMPLE_SCRIPTS: Pick<Script, 'title' | 'content' | 'format'>[] = [
  {
    title: 'Bienvenida al teleprompter',
    format: 'markdown',
    content: `# Bienvenida

Este es un guion de ejemplo. Puedes editarlo o eliminarlo cuando quieras.

## Cómo usarlo

Pulsa play para que el texto avance solo. Ajusta velocidad, tamaño de letra y márgenes desde el panel de ajustes.

## Secciones

Cada encabezado del guion crea una sección. Salta entre secciones con los botones en pantalla o con L1 y R1 del mando.

## Mando DualShock 4

Conecta un mando por Bluetooth y presiona un botón para activarlo. Cross reproduce o pausa, Triangle vuelve al inicio y los gatillos mueven el texto de forma manual.
`
  },
  {
    title: 'Notas rápidas',
    format: 'text',
    content: `Este guion es texto plano, sin encabezados, así que forma una única sección.

Importa tus propios guiones en formato Markdown o texto desde la pantalla de guiones.

Todo se guarda en tu dispositivo: no hay cuentas, servidores ni telemetría.
`
  }
];
