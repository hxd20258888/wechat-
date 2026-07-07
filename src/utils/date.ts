export interface DateOption {
  date: string;
  day: number;
  month: number;
  weekday: string;
}

export const WEEKDAYS = [
  '\u5468\u65e5',
  '\u5468\u4e00',
  '\u5468\u4e8c',
  '\u5468\u4e09',
  '\u5468\u56db',
  '\u5468\u4e94',
  '\u5468\u516d'
] as const;

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getDateOptions(startOffset = 0, count = 14): DateOption[] {
  const now = new Date();

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now);
    date.setDate(date.getDate() + startOffset + index);

    return {
      date: formatDateKey(date),
      day: date.getDate(),
      month: date.getMonth() + 1,
      weekday: WEEKDAYS[date.getDay()]
    };
  });
}
