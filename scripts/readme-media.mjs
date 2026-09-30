// Regenera las capturas y animaciones del README (docs/media) desde la build de producción.
// Uso: npm run build && node scripts/readme-media.mjs
// Requiere el Chromium de Playwright (npx playwright install chromium), ffmpeg e img2webp (libwebp).
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { preview } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mediaDir = join(root, 'docs/media');
const workDir = join(root, 'test-results/readme-media');
rmSync(workDir, { recursive: true, force: true });
mkdirSync(workDir, { recursive: true });
mkdirSync(mediaDir, { recursive: true });

const keepFrames = process.argv.includes('--keep-frames');
const tokens = JSON.parse(readFileSync(join(root, 'src/styles/designTokens.json'), 'utf8'));

// Guiones de muestra: dominio público (Shakespeare) y un guion de canal.
const SCRIPTS = [
  {
    title: 'To be, or not to be',
    content: `# Hamlet, Act III

> Slow down. Let the question land.

To be, or not to be, that is the question.

--- 2s

Whether 'tis nobler in the mind to suffer the slings and arrows of outrageous fortune, or to take arms against a sea of troubles, and by opposing end them.

To die, to sleep; no more; and by a sleep to say we end the heart-ache and the thousand natural shocks that flesh is heir to.

## The undiscovered country

**Who would fardels bear,** to grunt and sweat under a weary life, but that the dread of something after death, the *undiscovered country* from whose bourn no traveller returns, puzzles the will.
`
  },
  {
    title: 'Channel trailer',
    content: `# Cold open

> Look at the lens. Breathe first.

I make videos about light, lenses, and the **small decisions** behind every frame.

--- 3s

## What you will find here

The gear I *actually* use, color grading, and the mistakes that taught me the most.

---

## Close

If that sounds like your kind of thing, stick around.
`
  },
  {
    title: 'Tomorrow, and tomorrow',
    content: `Tomorrow, and tomorrow, and tomorrow,
Creeps in this petty pace from day to day,
To the last syllable of recorded time;
And all our yesterdays have lighted fools
The way to dusty death. Out, out, brief candle!
`
  }
];

const PHONE = { width: 390, height: 844 };
const LANDSCAPE = { width: 844, height: 390 };
const DUALSHOCK_ID = 'Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)';
const BUTTON = { cross: 0, square: 2, triangle: 3, r2: 7, share: 8, dpadUp: 12 };
const RIGHT_STICK_Y = 3;

function woff2(pkg) {
  const files = join(root, 'node_modules/@fontsource-variable', pkg, 'files');
  const file = join(files, `${pkg}-latin-wght-normal.woff2`);
  return `data:font/woff2;base64,${readFileSync(file).toString('base64')}`;
}

const FONT_CSS = `
@font-face { font-family: 'Big Shoulders Display'; font-weight: 100 900;
  src: url(${woff2('big-shoulders-display')}) format('woff2'); }
@font-face { font-family: 'Atkinson Hyperlegible Next'; font-weight: 200 800;
  src: url(${woff2('atkinson-hyperlegible-next')}) format('woff2'); }
* { box-sizing: border-box; margin: 0; }
body { font-family: 'Atkinson Hyperlegible Next', sans-serif; color: ${tokens.text}; }
.label { font-family: 'Big Shoulders Display', sans-serif; font-weight: 800;
  text-transform: uppercase; letter-spacing: 0.02em; color: ${tokens.accent}; }
`;

const png = (file) => `data:image/png;base64,${readFileSync(file).toString('base64')}`;
const work = (name) => join(workDir, name);

function ffmpeg(args) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
    stdio: 'inherit'
  });
}

// El mando simulado sigue el contrato de tests/e2e/helpers.ts.
function installFakeGamepad(padId) {
  const pad = {
    id: padId,
    index: 0,
    connected: true,
    mapping: 'standard',
    timestamp: 0,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 18 }, () => ({ pressed: false, touched: false, value: 0 }))
  };
  window.__setButton = (index, pressed) => {
    pad.buttons[index] = { pressed, touched: pressed, value: pressed ? 1 : 0 };
    pad.timestamp = performance.now();
  };
  window.__setAxis = (index, value) => {
    pad.axes[index] = value;
    pad.timestamp = performance.now();
  };
  navigator.getGamepads = () => [pad];
}

const setButton = (page, index, pressed) =>
  page.evaluate(([i, p]) => window.__setButton(i, p), [index, pressed]);
const setAxis = (page, index, value) =>
  page.evaluate(([i, v]) => window.__setAxis(i, v), [index, value]);

async function press(page, index, holdMs = 120) {
  await setButton(page, index, true);
  await page.waitForTimeout(holdMs);
  await setButton(page, index, false);
}

const server = await preview({
  root,
  logLevel: 'warn',
  preview: { host: '127.0.0.1', port: 4176, strictPort: true }
});
const baseURL = 'http://127.0.0.1:4176/';
const browser = await chromium.launch();

// Siembra la biblioteca una vez y reutiliza su IndexedDB en cada contexto.
async function seedLibrary() {
  const context = await browser.newContext({ viewport: PHONE, serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.goto(baseURL);
  for (const script of SCRIPTS) {
    await page.getByTestId('new-script').click();
    await page.getByTestId('editor-title').fill(script.title);
    await page.getByTestId('editor-content').fill(script.content);
    await page.getByTestId('editor-close').click();
    await page.getByText(script.title, { exact: true }).waitFor();
  }
  const state = await context.storageState({ indexedDB: true });
  await context.close();
  return state;
}

const storageState = await seedLibrary();

async function openApp({ viewport = PHONE, gamepad = false } = {}) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: 'block',
    storageState
  });
  if (gamepad) await context.addInitScript(installFakeGamepad, DUALSHOCK_ID);
  const page = await context.newPage();
  await page.goto(baseURL);
  await page.getByTestId('script-card').first().waitFor();
  return { context, page };
}

async function openReader(page, title) {
  await page.getByText(title, { exact: true }).click();
  await page.getByTestId('prompter-page').waitFor();
  await page.waitForTimeout(600);
}

async function capture(page, name) {
  const file = work(`${name}.png`);
  await page.screenshot({ path: file, animations: 'disabled' });
  return file;
}

// Graba la página con el screencast de CDP: PNG sin pérdida y marca de tiempo por cuadro.
async function record(page, name, script) {
  const dir = work(name);
  mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const file = join(dir, `${String(frames.length).padStart(5, '0')}.png`);
    writeFileSync(file, Buffer.from(data, 'base64'));
    frames.push({ file, time: metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  const viewport = page.viewportSize();
  await cdp.send('Page.startScreencast', {
    format: 'png',
    maxWidth: viewport.width * 2,
    maxHeight: viewport.height * 2
  });
  const marks = await script();
  await page.waitForTimeout(100);
  await cdp.send('Page.stopScreencast');
  const end = Date.now() / 1000;
  await cdp.detach();

  // Lista ffconcat: cada cuadro dura hasta el siguiente; el último, hasta el final.
  const lines = ['ffconcat version 1.0'];
  frames.forEach((frame, index) => {
    const next = frames[index + 1]?.time ?? end;
    lines.push(`file '${frame.file}'`, `duration ${Math.max(next - frame.time, 0.001).toFixed(4)}`);
  });
  lines.push(`file '${frames.at(-1).file}'`);
  const list = join(dir, 'frames.txt');
  writeFileSync(list, `${lines.join('\n')}\n`);
  // Las marcas usan el mismo reloj que los cuadros: tiempo desde el primer cuadro.
  return { list, marks: (marks ?? []).map((mark) => ({ ...mark, at: mark.at - frames[0].time })) };
}

// Renderiza HTML con las fuentes de la app y lo guarda como PNG.
async function renderHtml(html, { width, height, file }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.setContent(`<!doctype html><style>${FONT_CSS}</style>${html}`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: file });
  await context.close();
  return file;
}

// Composición estática: pantallas en fila, con borde recto y rótulo.
async function sheet(name, screens, { screenWidth = 250, gap = 28, pad = 36 } = {}) {
  const items = screens
    .map(
      ({ file, caption }) => `<figure>
        <img src="${png(file)}" style="width:${screenWidth}px">
        <figcaption class="label">${caption}</figcaption>
      </figure>`
    )
    .join('');
  const html = `<style>
    body { background: ${tokens.chrome}; }
    main { display: flex; gap: ${gap}px; padding: ${pad}px ${pad}px ${pad - 8}px; align-items: flex-start; }
    img { display: block; border: 1px solid ${tokens.border}; }
    figcaption { font-size: 22px; margin-top: 14px; }
  </style><main>${items}</main>`;
  const width = pad * 2 + screens.length * screenWidth + (screens.length - 1) * gap;
  const height = Math.round(pad * 2 + (screenWidth * PHONE.height) / PHONE.width + 2 + 36);
  return renderHtml(html, { width, height, file: join(mediaDir, `${name}.png`) });
}

// Compone los cuadros sobre el fondo con ffmpeg y codifica WebP animado con img2webp.
// El modo mixto elige, cuadro a cuadro, con o sin pérdida; con calidad 85 los
// desvanecidos no dejan restos visibles del cuadro anterior.
function animate(name, { inputs, filter, fps = 15, quality = 85 }) {
  const dir = work(`${name}-out`);
  mkdirSync(dir, { recursive: true });
  ffmpeg([...inputs, '-filter_complex', `${filter};[out]fps=${fps}[cfr]`, '-map', '[cfr]', join(dir, '%04d.png')]);
  const frames = readdirSync(dir)
    .filter((file) => file.endsWith('.png'))
    .sort()
    .map((file) => join(dir, file));
  execFileSync('img2webp', [
    '-loop', '0', '-mixed', '-sharp_yuv', '-kmin', '1000', '-kmax', '1001',
    '-d', String(Math.round(1000 / fps)), '-q', String(quality), '-m', '6',
    ...frames,
    '-o', join(mediaDir, `${name}.webp`)
  ]);
  if (!keepFrames) rmSync(dir, { recursive: true, force: true });
}

async function setSlider(page, testId, value) {
  await page.getByTestId('settings-toggle').click();
  await page.getByTestId(`${testId}-slider`).fill(String(value));
  await page.keyboard.press('Escape');
  await page.getByTestId('settings-panel').waitFor({ state: 'detached' });
  await page.evaluate(() => document.activeElement?.blur());
}

const jobs = {
  // Recorrido: biblioteca, lector y panel Display.
  async tour() {
    const { context, page } = await openApp();
    const library = await capture(page, 'library');
    await openReader(page, 'To be, or not to be');
    const reader = await capture(page, 'reader');
    await page.getByTestId('prompter-viewport').hover();
    await page.mouse.wheel(0, 420);
    await page.getByTestId('settings-toggle').click();
    await page.waitForTimeout(400);
    const display = await capture(page, 'display');
    await context.close();
    await sheet('tour', [
      { file: library, caption: 'Library' },
      { file: reader, caption: 'Reader' },
      { file: display, caption: 'Display' }
    ]);
  },

  // Sintaxis de entrega: el mismo guion en el editor y en el lector.
  async syntax() {
    const { context, page } = await openApp();
    await page
      .getByTestId('script-card')
      .filter({ hasText: 'Channel trailer' })
      .getByTestId('card-menu')
      .click();
    await page.getByTestId('menu-edit').click();
    await page.getByTestId('editor-content').waitFor();
    await page.waitForTimeout(400);
    const editor = await capture(page, 'editor');
    await page.getByTestId('editor-open-prompter').click();
    await page.getByTestId('prompter-page').waitFor();
    await setSlider(page, 'font', 30);
    const viewport = page.getByTestId('prompter-viewport');
    await viewport.hover();
    await page.mouse.wheel(0, 330);
    await page.waitForTimeout(400);
    const rendered = await capture(page, 'rendered');
    await context.close();
    await sheet(
      'syntax',
      [
        { file: editor, caption: 'What you type' },
        { file: rendered, caption: 'What you read' }
      ],
      { screenWidth: 300 }
    );
  },

  // Portada animada: el lector corriendo sobre el telón.
  async hero() {
    const { context, page } = await openApp();
    await openReader(page, 'To be, or not to be');
    await setSlider(page, 'speed', 160);
    const { list } = await record(page, 'hero', async () => {
      await page.waitForTimeout(1000);
      await page.getByTestId('play-pause').click();
      await page.waitForTimeout(10800);
    });
    await context.close();

    const W = 880;
    const H = 500;
    const screen = { x: 626, y: 38, width: 194, height: 420 };
    const favicon = readFileSync(join(root, 'public/favicon.svg'), 'utf8');
    const background = await renderHtml(
      `<style>
        body { background: ${tokens.bg}; width: ${W}px; height: ${H}px; position: relative; overflow: hidden; }
        .copy { position: absolute; left: 64px; top: 0; bottom: 18px; width: 500px;
          display: flex; flex-direction: column; justify-content: center; }
        .icon svg { width: 80px; height: 80px; display: block; }
        h1 { font-size: 124px; line-height: 0.86; margin: 30px 0 18px; }
        .tagline { font-size: 25px; color: ${tokens.text}; }
        .meta { font-size: 16px; color: ${tokens['text-muted']}; margin-top: 12px; line-height: 1.45; }
        .screen { position: absolute; left: ${screen.x - 2}px; top: ${screen.y - 2}px;
          width: ${screen.width + 4}px; height: ${screen.height + 4}px;
          border: 2px solid ${tokens.border}; background: #000; }
        .floor { position: absolute; left: 0; right: 0; bottom: 0; height: 18px; background: ${tokens.chrome};
          border-top: 2px solid ${tokens['gold-shade']}; }
      </style>
      <div class="copy">
        <div class="icon">${favicon}</div>
        <h1 class="label">Soliloquio</h1>
        <p class="tagline">A teleprompter for your soliloquy.</p>
        <p class="meta">Offline PWA for iPhone and Safari.<br>Driven by a Bluetooth controller.</p>
      </div>
      <div class="screen"></div>
      <div class="floor"></div>`,
      { width: W, height: H, file: work('hero-background.png') }
    );
    animate('hero', {
      fps: 12,
      inputs: ['-loop', '1', '-i', background, '-f', 'concat', '-safe', '0', '-i', list],
      filter:
        `[1:v]scale=${screen.width * 2}:${screen.height * 2}:flags=lanczos[s];` +
        `[0:v][s]overlay=${screen.x * 2}:${screen.y * 2}:shortest=1[out]`
    });
  },

  // Guía del mando dentro del lector y reasignación de botones.
  async guide() {
    const { context, page } = await openApp({ gamepad: true });
    await press(page, BUTTON.dpadUp);
    await openReader(page, 'To be, or not to be');
    await press(page, BUTTON.share);
    await page.getByTestId('controller-guide').waitFor();
    await page.waitForTimeout(500);
    const guide = await capture(page, 'guide');
    await page.getByTestId('controller-guide').getByRole('button', { name: 'Done' }).click();
    await page.getByTestId('back-to-scripts').click();
    await page.getByTestId('app-settings-button').click();
    await page.getByTestId('open-gamepad-settings').click();
    await page.getByTestId('gamepad-settings-panel').waitFor();
    await page.getByTestId('bind-toggleSections').click();
    await page.waitForTimeout(400);
    const remap = await capture(page, 'remap');
    await context.close();
    await sheet(
      'controller-guide',
      [
        { file: guide, caption: 'Controller guide' },
        { file: remap, caption: 'Remap any action' }
      ],
      { screenWidth: 300 }
    );
  },

  // Animación del mando: cada acción con su rótulo debajo de la pantalla.
  async controller() {
    const { context, page } = await openApp({ viewport: LANDSCAPE, gamepad: true });
    await press(page, BUTTON.dpadUp);
    await openReader(page, 'Channel trailer');
    await page.waitForTimeout(400);
    const now = () => page.evaluate(() => (performance.timeOrigin + performance.now()) / 1000);
    const { list, marks } = await record(page, 'controller', async () => {
      const steps = [];
      const step = async (button, action, run) => {
        steps.push({ at: await now(), button, action });
        await run();
      };
      await page.waitForTimeout(900);
      await step('Square', 'Hide the controls', async () => {
        await press(page, BUTTON.square);
        await page.waitForTimeout(1300);
      });
      await step('Hold D-pad up', 'Larger text', async () => {
        await press(page, BUTTON.dpadUp, 1500);
        await page.waitForTimeout(1100);
      });
      await step('Hold R2', 'Faster', async () => {
        await press(page, BUTTON.r2, 1300);
        await page.waitForTimeout(1100);
      });
      await step('Cross', 'Play', async () => {
        await press(page, BUTTON.cross);
        await page.waitForTimeout(2600);
      });
      await step('Right stick up', 'Brake, down to a full stop', async () => {
        await setAxis(page, RIGHT_STICK_Y, -1);
        await page.waitForTimeout(1600);
        await setAxis(page, RIGHT_STICK_Y, 0);
        await page.waitForTimeout(1200);
      });
      await step('Cross', 'Pause', async () => {
        await press(page, BUTTON.cross);
        await page.waitForTimeout(1000);
      });
      await step('Hold Triangle', 'Back to start', async () => {
        await press(page, BUTTON.triangle, 900);
        await page.waitForTimeout(1500);
      });
      steps.push({ at: await now() });
      return steps;
    });
    await context.close();

    const W = 880;
    const screen = { x: 40, y: 40, width: 800, height: Math.round((800 * LANDSCAPE.height) / LANDSCAPE.width) };
    const bar = { y: screen.y + screen.height + 22, height: 64 };
    const H = bar.y + bar.height + 26;
    const background = await renderHtml(
      `<style>
        body { background: ${tokens.chrome}; width: ${W}px; height: ${H}px; position: relative; }
        .screen { position: absolute; left: ${screen.x - 1}px; top: ${screen.y - 1}px;
          width: ${screen.width + 2}px; height: ${screen.height + 2}px; border: 1px solid ${tokens.border}; }
      </style><div class="screen"></div>`,
      { width: W, height: H, file: work('controller-background.png') }
    );
    const captionFiles = [];
    for (const [index, mark] of marks.slice(0, -1).entries()) {
      captionFiles.push(
        await renderHtml(
          `<style>
            body { background: ${tokens.chrome}; width: ${screen.width}px; height: ${bar.height}px;
              display: flex; align-items: center; gap: 22px; }
            .button { font-size: 30px; padding: 6px 14px 4px; border: 2px solid ${tokens.accent}; line-height: 1; }
            .action { font-size: 24px; }
          </style>
          <span class="label button">${mark.button}</span><span class="action">${mark.action}</span>`,
          { width: screen.width, height: bar.height, file: work(`caption-${index}.png`) }
        )
      );
    }
    const inputs = ['-loop', '1', '-i', background, '-f', 'concat', '-safe', '0', '-i', list];
    for (const file of captionFiles) inputs.push('-loop', '1', '-i', file);
    let filter =
      `[1:v]scale=${screen.width * 2}:${screen.height * 2}:flags=lanczos[s];` +
      `[0:v][s]overlay=${screen.x * 2}:${screen.y * 2}:shortest=1[v0]`;
    captionFiles.forEach((_, index) => {
      const from = marks[index].at.toFixed(3);
      const to = marks[index + 1].at.toFixed(3);
      const last = index === captionFiles.length - 1;
      filter +=
        `;[v${index}][${index + 2}:v]overlay=${screen.x * 2}:${bar.y * 2}:` +
        `shortest=1:enable='between(t,${from},${to})'[${last ? 'out' : `v${index + 1}`}]`;
    });
    animate('controller', { inputs, filter });
  }
};

const selected = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
for (const [name, job] of Object.entries(jobs)) {
  if (selected.length && !selected.includes(name)) continue;
  console.log(`readme-media: ${name}`);
  await job();
}

await browser.close();
await server.close();
