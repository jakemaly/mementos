'use client';

import { useEffect, useRef } from 'react';
import styles from './deep-research.module.css';

const WIDTH = 1275;
const HEIGHT = 500;
const FONT = 'P5 Optima';
const BOX = '/p5-dialogue/images/db-main-medium.png';

function hash(text: string) {
  return [...text].reduce((value, char) => value + char.charCodeAt(0), 0);
}

export function DialogueCanvas({
  name,
  text,
  input,
}: {
  name: string;
  text: string;
  input: React.ReactNode;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const box = new Image();
    box.src = BOX;
    const render = () => {
      context.clearRect(0, 0, WIDTH, HEIGHT);
      context.drawImage(box, 320, 234, 950, 266);
      context.textBaseline = 'alphabetic';

      // These are the coordinates used by p5-dialogue-generator's main box.
      context.font = `18pt ${FONT}`;
      context.textAlign = 'left';
      context.fillStyle = '#000';
      const nameWidth = context.measureText(name).width;
      const nameX = 418;
      const nameY = 438;
      const startX = nameX - nameWidth / 2;
      context.fillText(name, startX, nameY);

      // Recreate the generator's black name tiles without putting HTML text over art.
      if (name.trim() && name.length > 1) {
        const positions = [
          hash(name) % name.length,
          name.length >= 8 ? Math.floor(name.length / 2) + (hash(name) % Math.max(1, Math.floor(name.length / 2))) : -1,
          name.length >= 16 ? Math.floor(name.length * 0.75) + (hash(name) % Math.max(1, Math.floor(name.length / 4))) : -1,
        ].map((position) => Math.min(name.length - 1, Math.max(0, position)));
        for (const position of positions) {
          if (position < 0 || name[position] === ' ') continue;
          const before = name.slice(0, position);
          const x = startX + context.measureText(before).width;
          const metrics = context.measureText(name[position]);
          context.fillStyle = '#000';
          context.fillRect(x, nameY - metrics.actualBoundingBoxAscent - 4, metrics.width, metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent + 7);
          context.fillStyle = '#fff';
          context.fillText(name[position], x, nameY);
        }
      }

      context.font = `18pt ${FONT}`;
      context.fillStyle = '#fff';
      context.textAlign = 'left';
      const rows = text.split('\n').slice(0, 3);
      const ys = rows.length === 2 ? [387, 417] : [373, 403, 433];
      rows.forEach((row, index) => context.fillText(row, 500, ys[index]));
    };

    if (box.complete) render();
    else box.onload = render;
    document.fonts?.load(`18pt "${FONT}"`).then(render);
    return () => { box.onload = null; };
  }, [name, text]);

  return (
    <div className={styles.dialogueVisual}>
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} aria-hidden="true" />
      {input}
    </div>
  );
}
