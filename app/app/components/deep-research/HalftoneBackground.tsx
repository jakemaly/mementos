import styles from './deep-research.module.css';

const ROWS = 30;
const DOT = '#fffaf0';

export function HalftoneBackground() {
  const rows = Array.from({ length: ROWS }, (_, row) => {
    const progress = row / (ROWS - 1);
    const spacing = 7 - progress * 3.5;
    const radius = 0.25 + Math.pow(progress, 1.5) * 1.55;
    const y = ((row + 0.5) * 100) / ROWS;
    const dots = Array.from({ length: Math.ceil(100 / spacing) + 2 }, (_, column) => (
      <circle key={column} cx={column * spacing - spacing} cy={y} r={radius} />
    ));

    return <g key={row} fill={DOT}>{dots}</g>;
  });

  return (
    <div className={styles.halftoneBackground} aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        {rows}
      </svg>
    </div>
  );
}
