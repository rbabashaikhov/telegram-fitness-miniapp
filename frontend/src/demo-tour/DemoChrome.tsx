import { Link } from 'react-router-dom';

export function DemoChrome({
  showTour,
  showAdmin,
  onStartTour,
}: {
  showTour: boolean;
  showAdmin: boolean;
  onStartTour: () => void;
}) {
  return (
    <div className="demo-chrome">
      <span className="demo-badge">Демо</span>
      {showTour && (
        <button type="button" className="demo-chrome-link" onClick={onStartTour}>
          Как это работает?
        </button>
      )}
      {showAdmin && (
        <Link className="demo-chrome-cta" to="/demo/admin">
          Кабинет администратора
        </Link>
      )}
    </div>
  );
}
