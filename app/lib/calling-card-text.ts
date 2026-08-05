/**
 * Render Persona 5-inspired calling-card lettering on a transparent canvas.
 *
 * Adapted from https://github.com/LzxHahaha/persona5. The original renderer's
 * circular red/black backdrop is intentionally omitted.
 */

const COLORS = {
  red: '#E5191C',
  white: '#FDFDFD',
  black: '#0F0F0F',
} as const;

const MAX_ANGLE = 10;

type CharMode = 'first' | 'white' | 'red' | 'space';

interface CallingCardGlyph {
  char: string;
  mode: CharMode;
  font: string;
  width: number;
  height: number;
  left: number;
  top: number;
  angle: number;
  outerWidth: number;
  outerHeight: number;
  color: string;
}

export interface CallingCardTextOptions {
  fontSize?: number;
  fontFamily?: string;
  gutter?: number;
  padding?: number;
}

interface ResolvedOptions {
  fontSize: number;
  fontFamily: string;
  gutter: number;
  padding: number;
}

interface CanvasAndContext {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
}

interface GlyphBounds {
  top: number;
  left: number;
  width: number;
  height: number;
}

function getCanvasAndContext(width: number, height: number): CanvasAndContext {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Failed to create canvas');
  }

  return { canvas, context };
}

function resolveOptions(options: CallingCardTextOptions): ResolvedOptions {
  const fontSize = options.fontSize ?? 60;
  const gutter = options.gutter ?? 5;
  const padding = options.padding ?? 30;

  if (!Number.isFinite(fontSize) || fontSize <= 0) {
    throw new RangeError('fontSize must be greater than zero');
  }
  if (!Number.isFinite(gutter) || gutter < 0) {
    throw new RangeError('gutter must not be negative');
  }
  if (!Number.isFinite(padding) || padding < 0) {
    throw new RangeError('padding must not be negative');
  }

  return {
    fontSize,
    fontFamily: options.fontFamily || 'sans-serif',
    gutter,
    padding,
  };
}

function getGlyphBounds(char: string, fontSize: number, fontFamily: string): GlyphBounds {
  const { canvas, context } = getCanvasAndContext(fontSize, fontSize);
  const font = `bold ${fontSize}px ${fontFamily}`;
  context.font = font;
  context.textBaseline = 'top';

  // Leave enough room for wide glyphs while retaining the source renderer's
  // pixel-bound measurement, which also works when font metrics are missing.
  const measuredWidth = context.measureText(char).width;
  canvas.width = Math.max(1, Math.ceil(measuredWidth + fontSize));
  canvas.height = Math.max(1, Math.ceil(fontSize * 1.5));
  const resizedContext = canvas.getContext('2d');
  if (!resizedContext) {
    throw new Error('Failed to create canvas');
  }
  resizedContext.font = font;
  resizedContext.textBaseline = 'top';
  resizedContext.fillText(char, 0, 0);

  const imageData = resizedContext.getImageData(0, 0, canvas.width, canvas.height).data;
  let top = canvas.height;
  let left = canvas.width;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      if (!imageData[(y * canvas.width + x) * 4 + 3]) {
        continue;
      }
      top = Math.min(top, y);
      left = Math.min(left, x);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  if (right < left || bottom < top) {
    return {
      top: 0,
      left: 0,
      width: Math.max(1, measuredWidth),
      height: Math.max(1, fontSize),
    };
  }

  return {
    top,
    left,
    width: right - left + 1,
    height: bottom - top + 1,
  };
}

function randomSign(): number {
  return Math.floor(Math.random() * 10) % 2 ? 1 : -1;
}

function rotatedSize(width: number, height: number, angle: number) {
  const radians = (angle * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));

  return {
    width: Math.ceil(width * cos) + Math.ceil(height * sin),
    height: Math.ceil(height * cos) + Math.ceil(width * sin),
  };
}

function createGlyph(
  char: string,
  mode: CharMode,
  options: ResolvedOptions,
): CallingCardGlyph {
  if (mode === 'space') {
    return {
      char: '',
      mode,
      font: '',
      width: 0,
      height: 0,
      left: 0,
      top: 0,
      angle: 0,
      outerWidth: 0,
      outerHeight: 0,
      color: COLORS.white,
    };
  }

  const angle = -(Math.round(Math.random() * 10) % MAX_ANGLE);
  const scale = mode === 'first'
    ? 1.1
    : 1 - (Math.floor(Math.random() * 10) % 3) / 10;
  const glyphFontSize = options.fontSize * scale;
  const bounds = getGlyphBounds(char, glyphFontSize, options.fontFamily);
  const glyphAngle = mode === 'first' ? angle : angle * randomSign();
  const rotated = rotatedSize(bounds.width, bounds.height, glyphAngle);
  const outerScale = mode === 'first' ? 1.4 : 1.2;

  return {
    char,
    mode,
    font: `bold ${glyphFontSize}px ${options.fontFamily}`,
    width: bounds.width,
    height: bounds.height,
    left: bounds.left,
    top: bounds.top,
    angle: glyphAngle,
    outerWidth: rotated.width * outerScale,
    outerHeight: rotated.height * outerScale,
    color: mode === 'red' ? COLORS.red : COLORS.white,
  };
}

function createGlyphs(text: string, options: ResolvedOptions): CallingCardGlyph[] {
  const chars = Array.from(text.toUpperCase());
  const modes: CharMode[] = chars.map((_, index) => (index === 0 ? 'first' : 'white'));

  // Match the source generator: at most one red glyph in each short run.
  for (let start = 1; start < chars.length; start += 5) {
    for (let index = start; index < start + 4 && index < chars.length; index += 1) {
      if (Math.random() * 10 > 6) {
        modes[index] = 'red';
        break;
      }
    }
  }

  return chars.map((char, index) => createGlyph(
    char,
    /^\s$/u.test(char) ? 'space' : modes[index],
    options,
  ));
}

function rotate(context: CanvasRenderingContext2D, angle: number, x: number, y: number) {
  context.translate(x, y);
  context.rotate((Math.PI * angle) / 180);
  context.translate(-x, -y);
}

function drawGlyph(
  context: CanvasRenderingContext2D,
  glyph: CallingCardGlyph,
  drawOffset: number,
  canvasHeight: number,
  padding: number,
) {
  const { outerWidth, outerHeight } = glyph;
  const rotateX = drawOffset + outerWidth / 2;
  const rotateY = padding + outerHeight / 2;
  const outerTop = (canvasHeight - outerHeight) / 2;

  context.save();
  context.fillStyle = COLORS.black;
  context.textBaseline = 'top';

  if (glyph.mode === 'first') {
    rotate(context, glyph.angle - 5, rotateX, rotateY);
    context.fillRect(drawOffset, outerTop, outerWidth, outerHeight);

    rotate(context, 3, rotateX, rotateY);
    const innerWidth = outerWidth * 0.85;
    const innerHeight = outerHeight * 0.85;
    context.fillStyle = COLORS.red;
    context.fillRect(
      drawOffset + (outerWidth - innerWidth) / 2,
      (canvasHeight - innerHeight) / 2,
      innerWidth,
      innerHeight,
    );

    rotate(context, 2, rotateX, rotateY);
  } else {
    rotate(context, glyph.angle + 1, rotateX, rotateY);
    context.fillRect(drawOffset, outerTop, outerWidth, outerHeight);
    rotate(context, -1, rotateX, rotateY);
  }

  const textLeft = drawOffset + (outerWidth - glyph.width) / 2 - glyph.left;
  const textTop = (canvasHeight - glyph.height) / 2 - glyph.top;
  context.fillStyle = glyph.color;
  context.font = glyph.font;
  context.fillText(glyph.char, textLeft, textTop);
  context.restore();
}

function addWhiteHalo(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const halo = context.createImageData(canvas.width, canvas.height);
  const radius = 5;

  for (let y = 0; y < imageData.height; y += 1) {
    for (let x = 0; x < imageData.width; x += 1) {
      const sourceAlpha = imageData.data[(y * imageData.width + x) * 4 + 3];
      if (!sourceAlpha) {
        continue;
      }

      const minY = Math.max(0, y - radius);
      const maxY = Math.min(imageData.height - 1, y + radius);
      const minX = Math.max(0, x - radius);
      const maxX = Math.min(imageData.width - 1, x + radius);
      for (let haloY = minY; haloY <= maxY; haloY += 1) {
        for (let haloX = minX; haloX <= maxX; haloX += 1) {
          const index = (haloY * imageData.width + haloX) * 4;
          halo.data[index] = 255;
          halo.data[index + 1] = 255;
          halo.data[index + 2] = 255;
          halo.data[index + 3] = Math.min(255, halo.data[index + 3] + sourceAlpha / 4);
        }
      }
    }
  }

  const { canvas: haloCanvas, context: haloContext } = getCanvasAndContext(
    canvas.width,
    canvas.height,
  );
  haloContext.putImageData(halo, 0, 0);
  context.save();
  context.globalCompositeOperation = 'destination-over';
  context.drawImage(haloCanvas, 0, 0);
  context.restore();
}

/**
 * Draw calling-card text onto an existing canvas. The canvas background stays
 * transparent; only the tiled lettering and its white halo are painted.
 */
export function drawCallingCardText(
  canvas: HTMLCanvasElement,
  text: string,
  options: CallingCardTextOptions = {},
): void {
  if (!text.trim()) {
    throw new Error('Calling-card text must contain a non-whitespace character.');
  }

  const resolvedOptions = resolveOptions(options);
  const glyphs = createGlyphs(text, resolvedOptions);
  let canvasWidth = resolvedOptions.padding * 2;
  let canvasHeight = 0;

  for (const glyph of glyphs) {
    if (glyph.mode === 'space') {
      canvasWidth += resolvedOptions.gutter * 2;
    } else {
      canvasWidth += glyph.outerWidth + resolvedOptions.gutter;
      canvasHeight = Math.max(canvasHeight, glyph.outerHeight);
    }
  }

  canvas.width = Math.max(1, Math.ceil(canvasWidth));
  canvas.height = Math.max(1, Math.ceil(canvasHeight + resolvedOptions.padding * 2));
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Failed to create canvas');
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.textBaseline = 'top';

  let drawOffset = resolvedOptions.padding;
  for (const glyph of glyphs) {
    if (glyph.mode === 'space') {
      drawOffset += resolvedOptions.gutter * 2;
      continue;
    }
    drawGlyph(context, glyph, drawOffset, canvas.height, resolvedOptions.padding);
    drawOffset += glyph.outerWidth + resolvedOptions.gutter;
  }

  addWhiteHalo(canvas, context);
}

/** Create a transparent canvas containing calling-card text. */
export function createCallingCardText(
  text: string,
  options: CallingCardTextOptions = {},
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  drawCallingCardText(canvas, text, options);
  return canvas;
}
