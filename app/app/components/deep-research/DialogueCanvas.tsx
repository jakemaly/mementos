'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './deep-research.module.css';

const WIDTH = 1275;
const HEIGHT = 500;
const BOX = '/p5-dialogue/images/db-main-medium.png';
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
  const [imageReady, setImageReady] = useState(false);
  const [fontReady, setFontReady] = useState(false);

  // Load the box and custom font once. The box is drawn immediately; query
  // text waits for the font so fallback metrics cannot move or resize it.
  useEffect(() => {
    const box = new Image();
    const showBox = () => {
      boxRef.current = box;
      setImageReady(true);
    };
    box.onload = showBox;
    box.src = BOX;
    if (box.complete && box.naturalWidth > 0) showBox();

    void (document.fonts?.load(`18pt "${FONT}"`) ?? Promise.resolve()).then(() => setFontReady(true));

    return () => {
      box.onload = null;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    const box = boxRef.current;
    if (!canvas || !context || !box || !imageReady) return;

    context.clearRect(0, 0, WIDTH, HEIGHT);
    context.drawImage(box, 320, 234, 950, 266);
    if (!fontReady) return;

    // The generator centers the speaker name at x=418, baseline y=438.
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

    context.font = `18pt "${FONT}"`;
    context.fillStyle = '#fff';
    context.textAlign = 'left';
    context.textBaseline = 'alphabetic';

    // These coordinates and the two-line offset come from the generator's
    // findTextCoords/main-box rendering path.
    const rows = text.split('\n').slice(0, 3);
    const y = rows.length === 2 ? [387, 417] : [373, 403, 433];
    rows.forEach((row, index) => context.fillText(row, 500, y[index]));
  }, [text, imageReady, fontReady]);

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
      {input}
    </div>
  );
}
