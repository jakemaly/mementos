import styles from './deep-research.module.css';

const GRID_STEP = 14;
const ROWS = Math.ceil(1000 / GRID_STEP) + 1;
const DOT = '#F5F1E6';

export function HalftoneBackground() {
  const rows = Array.from({ length: ROWS }, (_, row) => {
    const progress = row / (ROWS - 1);
    const offset = row % 2 === 0 ? 0 : GRID_STEP / 2;
    const radius = 0.1 + Math.pow(progress, 1.7) * 8.2;
    const y = row * GRID_STEP;
    const dots = Array.from({ length: Math.ceil(1000 / GRID_STEP) + 2 }, (_, column) => (
      <circle key={column} cx={column * GRID_STEP - GRID_STEP + offset} cy={y} r={radius} />
    ));

    return <g key={row} fill={DOT}>{dots}</g>;
  });

  return (
    <div className={styles.halftoneBackground} aria-hidden="true">
      <svg viewBox="0 0 1000 1000" preserveAspectRatio="none">
        {rows}
      </svg>
    </div>
  );
}
