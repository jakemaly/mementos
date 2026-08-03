'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './deep-research.module.css';

const GRID_STEP = 14;
const DOT = '#F5F1E6';

export function HalftoneBackground() {
  const backgroundRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = backgroundRef.current;
    if (!element) return;

    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const rows = Array.from({ length: Math.ceil(size.height / GRID_STEP) + 1 }, (_, row) => {
    const y = row * GRID_STEP;
    const progress = size.height ? Math.min(1, y / size.height) : 0;
    const offset = row % 2 === 0 ? 0 : GRID_STEP / 2;
    const radius = 0.1 + Math.pow(progress, 1.7) * 8.2;
    const dots = Array.from({ length: Math.ceil(size.width / GRID_STEP) + 2 }, (_, column) => (
      <circle key={column} cx={column * GRID_STEP - GRID_STEP + offset} cy={y} r={radius} />
    ));

    return <g key={row} fill={DOT}>{dots}</g>;
  });

  return (
    <div ref={backgroundRef} className={styles.halftoneBackground} aria-hidden="true">
      <svg viewBox={`0 0 ${size.width || 1} ${size.height || 1}`} preserveAspectRatio="none">
        {rows}
      </svg>
    </div>
  );
}
