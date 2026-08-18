const MONTHS = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

export function formatDateLabel(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${d} ${MONTHS[(m || 1) - 1]}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} минут`;
  const h = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${h} ч ${rest} мин` : `${h} ч`;
}

export function greeting(name: string): string {
  return `Добрый день, ${name}`;
}

export function visitWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'тренировка';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'тренировки';
  return 'тренировок';
}

export function formatBookingStatus(status: string): string {
  if (status === 'ATTENDED') return 'Посещена';
  if (status === 'CANCELLED') return 'Отменена';
  if (status === 'NO_SHOW') return 'Не пришёл';
  return 'Запись';
}

export function formatMembershipStatus(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: 'Активен',
    FROZEN: 'Заморожен',
    EXPIRED: 'Истёк',
    EXHAUSTED: 'Исчерпан',
    CANCELLED: 'Отменён',
  };
  return map[status] ?? status;
}

export function isToday(dateStr: string): boolean {
  const now = new Date();
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return dateStr === iso;
}

export function dayChipLabel(dateStr: string, index: number): string {
  if (index === 0) return 'Сегодня';
  if (index === 1) return 'Завтра';
  const [y, m, d] = dateStr.split('-').map(Number);
  const weekday = new Date(y, m - 1, d).toLocaleDateString('ru-RU', { weekday: 'short' });
  return weekday.replace('.', '');
}
