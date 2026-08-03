/**
 * Convierte entre el orden canónico por posición de la app
 * (Sur/Este/Oeste/Norte) y el orden crudo por letra A/B/X/Y que reportan
 * algunos mandos 8BitDo con serigrafía Nintendo. El intercambio es simétrico,
 * por lo que sirve tanto al leer acciones como al guardar un remapeo.
 */
export function translateNintendoFaceButtonIndex(index: number): number {
  switch (index) {
    case 0:
      return 1;
    case 1:
      return 0;
    case 2:
      return 3;
    case 3:
      return 2;
    default:
      return index;
  }
}
