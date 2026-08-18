import { NavLink } from 'react-router-dom';

export function TabBar() {
  return (
    <nav className="tabbar">
      <NavLink to="/" end className={({ isActive }) => (isActive ? 'tab is-active' : 'tab')}>
        Главная
      </NavLink>
      <NavLink to="/schedule" className={({ isActive }) => (isActive ? 'tab is-active' : 'tab')}>
        Расписание
      </NavLink>
      <NavLink to="/workouts" className={({ isActive }) => (isActive ? 'tab is-active' : 'tab')}>
        Тренировки
      </NavLink>
      <NavLink to="/club" className={({ isActive }) => (isActive ? 'tab is-active' : 'tab')}>
        Клуб
      </NavLink>
    </nav>
  );
}

export function StateBlock({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="state-block">
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}
