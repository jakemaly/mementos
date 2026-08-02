'use client';

import { useEffect, useRef } from 'react';
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

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const box = new Image();
    box.src = BOX;

    const render = () => {
      context.clearRect(0, 0, WIDTH, HEIGHT);
      context.drawImage(box, 320, 234, 950, 266);
      context.font = `18pt "${FONT}"`;
      context.fillStyle = '#fff';
      context.textAlign = 'left';
      context.textBaseline = 'alphabetic';

      // These coordinates and the two-line offset come from the generator's
      // findTextCoords/main-box rendering path.
      const rows = text.split('\n').slice(0, 3);
      const y = rows.length === 2 ? [387, 417] : [373, 403, 433];
      rows.forEach((row, index) => context.fillText(row, 500, y[index]));
    };

    if (box.complete) render();
    else box.onload = render;
    document.fonts?.load(`18pt "${FONT}"`).then(render);

    return () => {
      box.onload = null;
    };
  }, [text]);

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
