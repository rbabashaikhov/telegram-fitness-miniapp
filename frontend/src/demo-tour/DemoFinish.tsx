import type { DemoTourDefinition } from './types';

export function DemoFinish({
  finish,
  showAdmin,
  onAdmin,
  onContinue,
}: {
  finish: DemoTourDefinition['finish'];
  showAdmin: boolean;
  onAdmin: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="demo-sheet-backdrop" role="presentation">
      <div className="demo-sheet" role="dialog" aria-modal="true">
        <p className="eyebrow">Sales demo</p>
        <h2>{finish.title}</h2>
        <p className="lead">{finish.lead}</p>
        <ul className="demo-sheet-checks">
          {finish.bullets.map((item) => (
            <li key={item}>✓ {item}</li>
          ))}
        </ul>
        <div className="demo-sheet-actions">
          {showAdmin && (
            <button type="button" className="btn btn-primary btn-block" onClick={onAdmin}>
              {finish.adminLabel}
            </button>
          )}
          <button type="button" className="btn btn-secondary btn-block" onClick={onContinue}>
            {finish.continueLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
