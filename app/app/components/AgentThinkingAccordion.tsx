'use client';

import { useState } from 'react';
import { SupervisorThought } from '@/app/lib/research-contracts';
import styles from '../page.module.css';

interface AgentThinkingAccordionProps {
  reasoningTrace?: string[];
  supervisorThoughts: SupervisorThought[];
  researching?: boolean;
}

export function AgentThinkingAccordion({
  reasoningTrace = [],
  supervisorThoughts = [],
  researching = false,
}: AgentThinkingAccordionProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (reasoningTrace.length === 0 && supervisorThoughts.length === 0 && !researching) {
    return null;
  }

  const totalSteps = reasoningTrace.length + supervisorThoughts.length;

  return (
    <div className={styles.collapsibleSection} style={{ marginTop: '0.75rem' }}>
      <div
        className={`${styles.collapsibleHeader} ${isOpen ? styles.collapsibleHeaderOpen : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        style={{ background: 'rgba(124, 58, 237, 0.05)' }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1rem' }}>🧠</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            Agent Thinking & Deliberation Trace
          </span>
          {researching && (
            <span
              className={styles.badge}
              style={{
                background: 'var(--md-sys-color-tertiary-container)',
                color: 'var(--md-sys-color-on-tertiary-container)',
                fontSize: '0.7rem',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            >
              Deliberating...
            </span>
          )}
          {totalSteps > 0 && !researching && (
            <span
              className={styles.badge}
              style={{ background: 'rgba(0,0,0,0.06)', color: 'var(--text-secondary)', fontSize: '0.7rem' }}
            >
              {totalSteps} thought {totalSteps === 1 ? 'step' : 'steps'}
            </span>
          )}
        </div>

        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>

      {isOpen && (
        <div className={styles.collapsibleContent} style={{ gap: '1rem', paddingTop: '0.75rem' }}>
          {/* Phase 1: Initial Research Strategy */}
          {reasoningTrace.length > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
                Phase 1: Query Analysis & Strategy
              </div>
              <ol style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                {reasoningTrace.map((step, i) => (
                  <li key={i} style={{ marginBottom: '0.25rem' }}>{step}</li>
                ))}
              </ol>
            </div>
          )}

          {/* Phase 2: Iterative Supervisor Deliberations */}
          {supervisorThoughts.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Phase 2: Supervisor Loop Deliberations
              </div>
              {supervisorThoughts.map((thought, idx) => {
                const isDone = thought.decision === 'done';
                const overviewQueries = thought.queries?.overview || [];
                const specificQueries = thought.queries?.specific || [];
                const allQueries = [...overviewQueries, ...specificQueries];

                return (
                  <div
                    key={idx}
                    style={{
                      background: isDone ? 'rgba(16, 185, 129, 0.04)' : 'rgba(168, 85, 247, 0.04)',
                      border: `1px solid ${isDone ? 'rgba(16, 185, 129, 0.2)' : 'rgba(168, 85, 247, 0.2)'}`,
                      borderRadius: '10px',
                      padding: '0.85rem 1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                          Iteration {thought.iteration}
                        </span>
                        {thought.tools && thought.tools.length > 0 && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            [{thought.tools.join(', ')}]
                          </span>
                        )}
                      </div>
                      <span
                        className={`${styles.md3Chip} ${isDone ? styles.md3ChipSuccess : styles.md3ChipPrimary}`}
                        style={{ fontSize: '0.7rem', padding: '0.2rem 0.6rem' }}
                      >
                        {isDone ? '✓ Decision: Done' : '🔄 Decision: Continue'}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontStyle: 'italic', lineHeight: '1.45', background: 'rgba(0,0,0,0.02)', padding: '0.5rem 0.75rem', borderRadius: '6px', borderLeft: `3px solid ${isDone ? '#10b981' : '#a855f7'}` }}>
                      "{thought.reasoning}"
                    </div>

                    {allQueries.length > 0 && (
                      <div style={{ marginTop: '0.25rem' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                          Target Queries Formulated:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          {allQueries.map((q, qIdx) => (
                            <span
                              key={qIdx}
                              style={{
                                fontSize: '0.75rem',
                                background: 'var(--md-sys-color-surface-container-high)',
                                color: 'var(--text-primary)',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px',
                                border: '1px solid var(--glass-border)',
                                fontFamily: 'monospace',
                              }}
                            >
                              {q}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
