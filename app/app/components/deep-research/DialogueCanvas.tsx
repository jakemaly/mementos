'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './deep-research.module.css';

const WIDTH = 1275;
const HEIGHT = 500;
const BOX = '/p5-dialogue/images/db-main-medium.png';
const FONT = 'P5 Optima';

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
