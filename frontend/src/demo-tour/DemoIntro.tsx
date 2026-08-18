import type { DemoTourDefinition } from './types';

export function DemoIntro({
  intro,
  onStart,
  onSkip,
}: {
  intro: DemoTourDefinition['intro'];
  onStart: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="demo-sheet-backdrop" role="presentation">
      <div className="demo-sheet" role="dialog" aria-modal="true">
        <p className="eyebrow">Sales demo</p>
        <h2>{intro.title}</h2>
        <p className="lead">{intro.lead}</p>
        <ul className="demo-sheet-list">
          {intro.bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="demo-sheet-actions">
          <button type="button" className="btn btn-primary btn-block" onClick={onStart}>
            {intro.startLabel}
          </button>
          <button type="button" className="btn btn-secondary btn-block" onClick={onSkip}>
            {intro.skipLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
