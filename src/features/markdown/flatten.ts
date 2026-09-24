import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { Parent, PhrasingContent, Root, RootContent } from 'mdast';
import type { HeadingLevel, InlineRun, PrompterBlock, Script } from '../../types';
import { isolateTimedPauses, timedPauseSeconds } from './timedPause';

const parser = unified().use(remarkParse).use(remarkGfm);
const LARGE_SCRIPT_CHARS = 200_000;
const MAX_TEXT_CHUNK_CHARS = 4_096;

function pushTextChunks(blocks: PrompterBlock[], text: string): void {
  let offset = 0;
  while (offset < text.length) {
    const end = Math.min(offset + MAX_TEXT_CHUNK_CHARS, text.length);
    blocks.push({
      type: 'text',
      text: text.slice(offset, end),
      ...(offset > 0 ? { continuation: true as const } : {})
    });
    offset = end;
  }
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Texto visible de contenido inline: enlaces → su texto, imágenes → su `alt`,
 * énfasis/negrita/tachado/código → texto plano, HTML inline → separador.
 */
function inlineText(nodes: PhrasingContent[]): string {
  let out = '';
  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        out += node.value;
        break;
      case 'inlineCode':
        out += node.value;
        break;
      case 'break':
        out += ' ';
        break;
      case 'image':
      case 'imageReference':
        out += node.alt ?? '';
        break;
      case 'html':
        out += ' ';
        break;
      case 'footnoteReference':
        break;
      default:
        if ('children' in node) {
          out += inlineText((node as Parent).children as PhrasingContent[]);
        }
        break;
    }
  }
  return out;
}

type RunMarks = { strong?: true; emphasis?: true };

/**
 * Como `inlineText`, pero conserva negrita y cursiva como tramos: sirven de
 * guía de entonación al leer. Tachado, código y enlaces quedan como texto.
 */
function inlineRuns(nodes: PhrasingContent[], marks: RunMarks = {}): InlineRun[] {
  const runs: InlineRun[] = [];
  for (const node of nodes) {
    if (node.type === 'strong' || node.type === 'emphasis') {
      const nested: RunMarks =
        node.type === 'strong' ? { ...marks, strong: true } : { ...marks, emphasis: true };
      runs.push(...inlineRuns(node.children, nested));
    } else {
      const text = inlineText([node]);
      if (text) runs.push({ text, ...marks });
    }
  }
  return runs;
}

function sameMarks(a: InlineRun, b: InlineRun): boolean {
  return a.strong === b.strong && a.emphasis === b.emphasis;
}

/**
 * Colapsa espacios a través de los tramos exactamente como `collapseWhitespace`
 * sobre el texto unido, y fusiona tramos contiguos con las mismas marcas.
 */
export function normalizeRuns(runs: InlineRun[]): InlineRun[] {
  const out: InlineRun[] = [];
  let endsWithSpace = true;
  for (const run of runs) {
    let text = run.text.replace(/\s+/g, ' ');
    if (endsWithSpace) text = text.replace(/^ /, '');
    if (!text) continue;
    endsWithSpace = text.endsWith(' ');
    const previous = out[out.length - 1];
    if (previous && sameMarks(previous, run)) previous.text += text;
    else out.push({ ...run, text });
  }
  const last = out[out.length - 1];
  if (last) {
    last.text = last.text.replace(/ $/, '');
    if (!last.text) out.pop();
  }
  return out;
}

/**
 * Aplana Markdown a bloques de lectura: los headings conservan semántica
 * (nivel + id de sección), los blockquotes se vuelven notas que no se leen en
 * voz alta, los separadores (`---`) se vuelven pausas y la negrita/cursiva se
 * conserva como tramos. Una línea `--- 5s` es una pausa que solo retiene el
 * scroll esos segundos. Todo lo demás se convierte en texto plano. El HTML
 * embebido se descarta por completo y nunca se ejecuta.
 */
export function markdownToBlocks(content: string): PrompterBlock[] {
  const tree = parser.parse(isolateTimedPauses(content)) as Root;
  const blocks: PrompterBlock[] = [];
  let headingCount = 0;

  let noteDepth = 0;

  // Consecutive separators or one at the very start never stop twice in a row.
  const pushPause = (seconds?: number) => {
    if (blocks.length === 0 || blocks[blocks.length - 1].type === 'pause') return;
    blocks.push(seconds ? { type: 'pause', seconds } : { type: 'pause' });
  };

  const pushText = (text: string) => {
    const clean = collapseWhitespace(text);
    if (!clean) return;
    blocks.push(noteDepth > 0 ? { type: 'note', text: clean } : { type: 'text', text: clean });
  };

  const pushParagraph = (children: PhrasingContent[]) => {
    if (noteDepth > 0) {
      pushText(inlineText(children));
      return;
    }
    const runs = normalizeRuns(inlineRuns(children));
    const text = runs.map((run) => run.text).join('');
    if (!text) return;
    const pauseSeconds = timedPauseSeconds(text);
    if (pauseSeconds !== undefined) {
      pushPause(pauseSeconds);
      return;
    }
    const emphasized = runs.some((run) => run.strong || run.emphasis);
    blocks.push(emphasized ? { type: 'text', text, runs } : { type: 'text', text });
  };

  const visit = (nodes: RootContent[]) => {
    for (const node of nodes) {
      switch (node.type) {
        case 'heading': {
          if (noteDepth > 0) {
            pushText(inlineText(node.children));
            break;
          }
          const text = collapseWhitespace(inlineText(node.children));
          if (text) {
            blocks.push({
              type: 'heading',
              level: node.depth as HeadingLevel,
              text,
              sectionId: `section-${headingCount++}`
            });
          }
          break;
        }
        case 'paragraph':
          pushParagraph(node.children);
          break;
        case 'code':
          pushText(node.value);
          break;
        case 'table':
          for (const row of node.children) {
            const cells = row.children
              .map((cell) => collapseWhitespace(inlineText(cell.children)))
              .filter(Boolean);
            if (cells.length > 0) pushText(cells.join(' — '));
          }
          break;
        case 'blockquote':
          noteDepth += 1;
          visit(node.children as RootContent[]);
          noteDepth -= 1;
          break;
        case 'thematicBreak':
          pushPause();
          break;
        case 'list':
        case 'listItem':
        case 'footnoteDefinition':
          visit(node.children as RootContent[]);
          break;
        case 'html':
        case 'definition':
          break;
        default:
          if ('children' in node) {
            visit((node as Parent).children as RootContent[]);
          } else if ('value' in node && typeof node.value === 'string') {
            pushText(node.value);
          }
          break;
      }
    }
  };

  visit(tree.children);
  // A pause after the last spoken line has nothing left to hold.
  while (blocks.length > 0 && blocks[blocks.length - 1].type === 'pause') blocks.pop();
  return blocks;
}

/** Texto plano: cada párrafo (separado por líneas en blanco) es un bloque. */
export function textToBlocks(content: string): PrompterBlock[] {
  return content
    .split(/\n\s*\n/)
    .map((paragraph) => collapseWhitespace(paragraph))
    .filter(Boolean)
    .map((text) => ({ type: 'text' as const, text }));
}

/**
 * Keep large scripts readable without creating one DOM element per short
 * paragraph. Merged text drops its emphasis runs; notes and pauses stay apart.
 */
export function compactTextBlocks(blocks: PrompterBlock[]): PrompterBlock[] {
  const compacted: PrompterBlock[] = [];
  let text = '';
  const flush = () => {
    if (text) pushTextChunks(compacted, text);
    text = '';
  };
  for (const block of blocks) {
    if (block.type !== 'text') {
      flush();
      compacted.push(block);
      continue;
    }
    if (block.text.length > MAX_TEXT_CHUNK_CHARS) {
      flush();
      pushTextChunks(compacted, block.text);
      continue;
    }
    if (text && text.length + block.text.length + 2 > MAX_TEXT_CHUNK_CHARS) flush();
    text += text ? `\n\n${block.text}` : block.text;
  }
  flush();
  return compacted;
}

function largeTextToBlocks(content: string): PrompterBlock[] {
  const compacted: PrompterBlock[] = [];
  let text = '';
  let start = 0;
  const flush = () => {
    if (text) pushTextChunks(compacted, text);
    text = '';
  };
  const addParagraph = (value: string) => {
    const paragraph = collapseWhitespace(value);
    if (!paragraph) return;
    if (paragraph.length > MAX_TEXT_CHUNK_CHARS) {
      flush();
      pushTextChunks(compacted, paragraph);
      return;
    }
    if (text && text.length + paragraph.length + 2 > MAX_TEXT_CHUNK_CHARS) flush();
    text += text ? `\n\n${paragraph}` : paragraph;
  };
  const separator = /\n\s*\n/g;
  for (let match = separator.exec(content); match; match = separator.exec(content)) {
    addParagraph(content.slice(start, match.index));
    start = separator.lastIndex;
  }
  addParagraph(content.slice(start));
  flush();
  return compacted;
}

export function scriptToBlocks(script: Pick<Script, 'content' | 'format'>): PrompterBlock[] {
  if (script.format === 'text') {
    return script.content.length > LARGE_SCRIPT_CHARS
      ? largeTextToBlocks(script.content)
      : textToBlocks(script.content);
  }
  const blocks = markdownToBlocks(script.content);
  return script.content.length > LARGE_SCRIPT_CHARS ? compactTextBlocks(blocks) : blocks;
}
