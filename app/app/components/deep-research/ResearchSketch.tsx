'use client';

import { Sketch, ResearchBrief } from '@/app/lib/research-contracts';
import styles from './deep-research.module.css';

interface ResearchSketchProps {
  sketch: Sketch | null;
  brief: ResearchBrief | null;
}

export function ResearchSketch({ sketch, brief }: ResearchSketchProps) {
  if (!sketch) {
    return <div className={styles.sketchEmpty}>Generating concept sketch...</div>;
  }

  const sections: Array<{ label: string; items: string[] }> = [
    { label: 'Expected Concepts', items: sketch.expected_concepts || [] },
    { label: 'Discriminative Terms', items: sketch.discriminative_terms || [] },
    { label: 'Search Queries', items: [...(brief?.queries.overview || []), ...(brief?.queries.specific || [])] },
    { label: 'Expected Patterns', items: sketch.expected_patterns || [] },
    { label: 'Preferred Domains', items: sketch.preferred_domains || [] },
  ].filter((s) => s.items.length > 0);

  if (sections.length === 0) {
    return <div className={styles.sketchEmpty}>No sketch data available.</div>;
  }

  return (
    <div className={styles.sketchContent}>
      {sections.map((section) => (
        <div key={section.label} className={styles.sketchSection}>
          <h3 className={styles.sketchLabel}>{section.label}</h3>
          <ul className={styles.sketchList}>
            {section.items.map((item, i) => (
              <li key={i} className={styles.sketchItem}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
