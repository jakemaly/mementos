'use client';

import React, { useState } from 'react';
import { SubQuestion, SupervisorEvaluation } from '@/app/lib/research-contracts';
import styles from '../page.module.css';

interface SupervisorChecklistProps {
  evaluations: SupervisorEvaluation[];
  subQuestions: SubQuestion[];
  confidenceScore: number;
  isResearching: boolean;
}

export function SupervisorChecklist({
  evaluations,
  subQuestions,
  confidenceScore,
  isResearching,
}: SupervisorChecklistProps) {
  const [expandedIter, setExpandedIter] = useState<number | null>(
    evaluations.length > 0 ? evaluations[evaluations.length - 1].iteration : null
  );

  if (evaluations.length === 0 && subQuestions.length === 0 && !isResearching) {
    return null;
  }

  const latestEval = evaluations.length > 0 ? evaluations[evaluations.length - 1] : null;

  return (
    <div style={{
      marginTop: '1.25rem',
      padding: '1.25rem',
      borderRadius: '12px',
      background: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
    }}>
      {/* Header & Confidence Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>🛡️ ODR Supervisor Observability</span>
          {isResearching && (
            <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '12px', background: '#3b82f6', color: '#fff' }}>
              Evaluating...
            </span>
          )}
        </h4>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: confidenceScore >= 80 ? '#10b981' : confidenceScore >= 50 ? '#f59e0b' : '#3b82f6' }}>
          Coverage Confidence: {confidenceScore}%
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ width: '100%', height: '8px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.1)', overflow: 'hidden', marginBottom: '1rem' }}>
        <div
          style={{
            height: '100%',
            width: `${confidenceScore}%`,
            background: confidenceScore >= 80 ? '#10b981' : confidenceScore >= 50 ? '#f59e0b' : '#3b82f6',
            transition: 'width 0.4s ease',
          }}
        />
      </div>

      {/* Sub-questions Checklist */}
      {subQuestions.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.7, marginBottom: '0.5rem' }}>
            Sub-Question Checklist
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {subQuestions.map((sq) => {
              const isResolved = sq.status === 'resolved';
              const isPartial = sq.status === 'partially_resolved';
              const icon = isResolved ? '✅' : isPartial ? '🟡' : '⏳';
              const badgeBg = isResolved ? 'rgba(16, 185, 129, 0.15)' : isPartial ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.05)';
              const badgeBorder = isResolved ? '#10b981' : isPartial ? '#f59e0b' : 'rgba(255, 255, 255, 0.15)';

              return (
                <div
                  key={sq.id}
                  style={{
                    padding: '0.6rem 0.8rem',
                    borderRadius: '8px',
                    background: badgeBg,
                    border: `1px solid ${badgeBorder}`,
                    fontSize: '0.85rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
                    <span>{icon}</span>
                    <span>{sq.question}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.75rem', opacity: 0.8, textTransform: 'capitalize' }}>
                      {sq.status.replace('_', ' ')}
                    </span>
                  </div>
                  {sq.evidence_summary && (
                    <div style={{ marginTop: '0.35rem', fontSize: '0.78rem', opacity: 0.75, fontStyle: 'italic', paddingLeft: '1.5rem' }}>
                      "{sq.evidence_summary}"
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Iteration Reflections & Gap Analysis */}
      {evaluations.length > 0 && (
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.7, marginBottom: '0.5rem' }}>
            Iteration History & Reflection
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {evaluations.map((ev) => {
              const isExpanded = expandedIter === ev.iteration;
              return (
                <div
                  key={ev.iteration}
                  style={{
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    background: 'rgba(0, 0, 0, 0.2)',
                    overflow: 'hidden',
                  }}
                >
                  <button
                    onClick={() => setExpandedIter(isExpanded ? null : ev.iteration)}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      background: 'none',
                      border: 'none',
                      color: 'inherit',
                      display: 'flex',
                      justify: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                    }}
                  >
                    <span><strong>Iteration {ev.iteration}</strong> — {ev.reason}</span>
                    <span>{isExpanded ? '▲' : '▼'}</span>
                  </button>
                  {isExpanded && (
                    <div style={{ padding: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div>
                        <strong>Reflection:</strong> {ev.reflection}
                      </div>
                      <div>
                        <strong>Gap Analysis:</strong> {ev.gap_analysis}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
