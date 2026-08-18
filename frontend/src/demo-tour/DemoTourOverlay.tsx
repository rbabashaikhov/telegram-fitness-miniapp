import { useEffect, useRef, useState } from 'react';
import { chooseTooltipPlacement } from './placement';
import type { TourStep } from './types';

export function DemoTourOverlay({
  step,
  stepIndex,
  stepCount,
  targetRect,
  onNext,
  onBack,
  onSkip,
}: {
  step: TourStep;
  stepIndex: number;
  stepCount: number;
  targetRect: { top: number; left: number; width: number; height: number; bottom: number } | null;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipHeight, setTooltipHeight] = useState(180);

  useEffect(() => {
    const node = tooltipRef.current;
    if (!node) return;
    setTooltipHeight(node.getBoundingClientRect().height);
  }, [step.id, targetRect?.top, targetRect?.height]);

  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 390;
  const placement = targetRect
    ? chooseTooltipPlacement({
        targetTop: targetRect.top,
        targetBottom: targetRect.bottom,
        tooltipHeight,
        viewportHeight,
        preferred: step.placement,
        bottomReserve: 28,
      })
    : 'bottom';

  const tooltipWidth = Math.min(360, viewportWidth - 32);
  let tooltipTop = targetRect
    ? placement === 'top'
      ? targetRect.top - tooltipHeight - 12
      : targetRect.bottom + 12
    : Math.max(24, viewportHeight * 0.28);
  tooltipTop = Math.min(Math.max(12, tooltipTop), viewportHeight - tooltipHeight - 16);
  const tooltipLeft = targetRect
    ? Math.min(Math.max(16, targetRect.left + targetRect.width / 2 - tooltipWidth / 2), viewportWidth - tooltipWidth - 16)
    : (viewportWidth - tooltipWidth) / 2;

  return (
    <div className="demo-tour-layer" role="dialog" aria-modal="true">
      {targetRect && (
        <div
          className="demo-tour-spotlight"
          style={{ top: targetRect.top, left: targetRect.left, width: targetRect.width, height: targetRect.height }}
        />
      )}
      <div ref={tooltipRef} className="demo-tour-tooltip" style={{ top: tooltipTop, left: tooltipLeft, width: tooltipWidth }}>
        <p className="demo-tour-progress">
          {stepIndex + 1} из {stepCount}
        </p>
        <h2>{step.title}</h2>
        <p>{step.description}</p>
        <div className="demo-tour-actions">
          <button type="button" className="btn btn-ghost" onClick={onSkip}>
            Пропустить
          </button>
          <div className="demo-tour-nav">
            {stepIndex > 0 && (
              <button type="button" className="btn btn-secondary" onClick={onBack}>
                Назад
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={onNext}>
              {stepIndex === stepCount - 1 ? 'Готово' : 'Далее'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
