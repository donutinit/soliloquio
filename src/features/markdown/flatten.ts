import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { Parent, PhrasingContent, Root, RootContent } from 'mdast';
import type { HeadingLevel, PrompterBlock, Script } from '../../types';

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

/**
 * Aplana Markdown a bloques de lectura: solo los headings conservan semántica
 * (nivel + id de sección); todo lo demás se convierte en texto plano. El HTML
 * embebido se descarta por completo y nunca se ejecuta.
 */
export function markdownToBlocks(content: string): PrompterBlock[] {
  const tree = parser.parse(content) as Root;
  const blocks: PrompterBlock[] = [];
  let headingCount = 0;

  const pushText = (text: string) => {
    const clean = collapseWhitespace(text);
    if (clean) blocks.push({ type: 'text', text: clean });
  };

  const visit = (nodes: RootContent[]) => {
    for (const node of nodes) {
      switch (node.type) {
        case 'heading': {
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
          pushText(inlineText(node.children));
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
        case 'list':
        case 'listItem':
        case 'footnoteDefinition':
          visit(node.children as RootContent[]);
          break;
        case 'html':
        case 'thematicBreak':
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

/** Keep large scripts readable without creating one DOM element per short paragraph. */
export function compactTextBlocks(blocks: PrompterBlock[]): PrompterBlock[] {
  const compacted: PrompterBlock[] = [];
  let text = '';
  const flush = () => {
    if (text) pushTextChunks(compacted, text);
    text = '';
  };
  for (const block of blocks) {
    if (block.type === 'heading') {
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
