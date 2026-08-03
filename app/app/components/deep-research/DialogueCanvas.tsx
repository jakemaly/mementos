'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './deep-research.module.css';

const WIDTH = 1275;
const HEIGHT = 500;
const BOX = '/p5-dialogue/images/db-main-medium.png';
const PORTRAIT = '/p5-dialogue/images/protagonist.png';
const FONT = 'P5 Optima';
const SPEAKER = 'DEEP RESEARCH';

export function DialogueCanvas({
  text,
  input,
}: {
  text: string;
  input: React.ReactNode;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLImageElement | null>(null);
  const portraitRef = useRef<HTMLImageElement | null>(null);
  const [imageReady, setImageReady] = useState(false);
  const [portraitReady, setPortraitReady] = useState(false);
  const [fontReady, setFontReady] = useState(false);

  // Load the box and custom font once. The box is drawn immediately; query
  // text waits for the font so fallback metrics cannot move or resize it.
  useEffect(() => {
    const box = new Image();
    const portrait = new Image();
    const showBox = () => {
      boxRef.current = box;
      setImageReady(true);
    };
    const showPortrait = () => {
      portraitRef.current = portrait;
      setPortraitReady(true);
    };
    box.onload = showBox;
    portrait.onload = showPortrait;
    box.src = BOX;
    portrait.src = PORTRAIT;
    if (box.complete && box.naturalWidth > 0) showBox();
    if (portrait.complete && portrait.naturalWidth > 0) showPortrait();

    void (document.fonts?.load(`18pt "${FONT}"`) ?? Promise.resolve()).then(() => setFontReady(true));

    return () => {
      box.onload = null;
      portrait.onload = null;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    const box = boxRef.current;
    const portrait = portraitRef.current;
    if (!canvas || !context || !box || !portrait || !imageReady || !portraitReady) return;

    context.clearRect(0, 0, WIDTH, HEIGHT);
    // Match the generator's Joker placement: 500px portrait at (65, 30).
    context.drawImage(portrait, 65, 30, 500, 500);
    context.drawImage(box, 320, 234, 950, 266);
    if (!fontReady) return;

    // ImageCanvas in the generator rotates the name and tile canvases before
    // drawing the main-box name. Keep that transform; it is why the name is
    // not aligned like ordinary horizontal canvas text.
    context.save();
    context.rotate(-14.65 * Math.PI / 180);
    context.font = `18pt "${FONT}"`;
    context.textAlign = 'left';
    context.textBaseline = 'alphabetic';
    const speakerWidth = context.measureText(SPEAKER).width;
    const speakerX = 418 - speakerWidth / 2;
    context.fillStyle = '#000';
    context.fillText(SPEAKER, speakerX, 438);

    // Keep the generator's black name tiles, using stable positions so the
    // name does not jump while the query is being edited.
    for (const position of [2, 8]) {
      const before = SPEAKER.slice(0, position);
      const x = speakerX + context.measureText(before).width;
      const metrics = context.measureText(SPEAKER[position]);
      context.fillStyle = '#000';
      context.fillRect(
        x,
        438 - metrics.actualBoundingBoxAscent - 4,
        metrics.width,
        metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent + 7,
      );
      context.fillStyle = '#fff';
      context.fillText(SPEAKER[position], x, 438);
    }
    context.restore();

    context.font = `18pt "${FONT}"`;
    context.fillStyle = '#fff';
    context.textAlign = 'left';
    context.textBaseline = 'alphabetic';

    if (!text) {
      context.fillStyle = 'rgba(255, 255, 255, 0.58)';
      context.fillText('click to begin typing…', 500, 373);
    }

    // These coordinates and the two-line offset come from the generator's
    // findTextCoords/main-box rendering path.
    const rows = text.split('\n').slice(0, 3);
    const y = rows.length === 2 ? [387, 417] : [373, 403, 433];
    rows.forEach((row, index) => context.fillText(row, 500, y[index]));
  }, [text, imageReady, portraitReady, fontReady]);

  return (
    <div
      className={styles.dialogueVisual}
      onMouseDown={(event) => {
        if (event.target instanceof HTMLCanvasElement) {
          event.currentTarget.querySelector('textarea')?.focus();
        }
      }}
    >
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} aria-hidden="true" />
      {!text && (
        <span className={styles.dialogueCaret} data-dialogue-caret aria-hidden="true" />
      )}
      {input}
    </div>
  );
}
