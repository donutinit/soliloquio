import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { Parent, PhrasingContent, Root, RootContent } from 'mdast';
import type { HeadingLevel, PrompterBlock, Script } from '../../types';

const parser = unified().use(remarkParse).use(remarkGfm);

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Texto visible de contenido inline: enlaces → su texto, imágenes → su `alt`,
 * énfasis/negrita/tachado/código → texto plano, HTML inline → eliminado.
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

export function scriptToBlocks(script: Pick<Script, 'content' | 'format'>): PrompterBlock[] {
  return script.format === 'markdown'
    ? markdownToBlocks(script.content)
    : textToBlocks(script.content);
}
