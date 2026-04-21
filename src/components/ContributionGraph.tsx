import { useMemo } from 'react';
import { subDays, format, startOfWeek, eachDayOfInterval, getDay } from 'date-fns';

interface ContributionGraphProps {
  data: Map<string, { created: number; reviewed: number }>;
}

const CELL_SIZE = 12;
const GAP = 2;
const WEEKS = 52;

function getIntensityColor(count: number, isDark: boolean): string {
  if (count === 0) return isDark ? '#27272a' : '#f4f4f5';
  if (count <= 1) return isDark ? '#0078d433' : '#0078d433';
  if (count <= 3) return isDark ? '#0078d466' : '#0078d466';
  if (count <= 5) return isDark ? '#0078d499' : '#0078d499';
  return '#0078d4';
}

export function ContributionGraph({ data }: ContributionGraphProps) {
  const isDark = document.documentElement.classList.contains('dark');

  const { grid, months, dateRange } = useMemo(() => {
    const today = new Date();
    const start = startOfWeek(subDays(today, WEEKS * 7), { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start, end: today });

    const weeks: { date: Date; count: number; created: number; reviewed: number }[][] = [];
    let currentWeek: typeof weeks[0] = [];

    for (const day of days) {
      const key = format(day, 'yyyy-MM-dd');
      const entry = data.get(key);
      const created = entry?.created ?? 0;
      const reviewed = entry?.reviewed ?? 0;

      if (getDay(day) === 0 && currentWeek.length > 0) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push({ date: day, count: created + reviewed, created, reviewed });
    }
    if (currentWeek.length > 0) weeks.push(currentWeek);

    const monthLabels: { label: string; x: number }[] = [];
    let lastMonth = -1;
    for (let w = 0; w < weeks.length; w++) {
      const firstDay = weeks[w]![0]!;
      const month = firstDay.date.getMonth();
      if (month !== lastMonth) {
        monthLabels.push({ label: format(firstDay.date, 'MMM'), x: w * (CELL_SIZE + GAP) });
        lastMonth = month;
      }
    }

    return {
      grid: weeks,
      months: monthLabels,
      dateRange: `${format(start, 'MMM d, yyyy')} — ${format(today, 'MMM d, yyyy')}`,
    };
  }, [data]);

  const totalCreated = useMemo(() => {
    let sum = 0;
    for (const [, v] of data) sum += v.created;
    return sum;
  }, [data]);

  const totalReviewed = useMemo(() => {
    let sum = 0;
    for (const [, v] of data) sum += v.reviewed;
    return sum;
  }, [data]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
          <span><strong className="text-zinc-700 dark:text-zinc-200">{totalCreated}</strong> PRs created</span>
          <span><strong className="text-zinc-700 dark:text-zinc-200">{totalReviewed}</strong> PRs reviewed</span>
        </div>
        <span className="text-[11px] text-zinc-400">{dateRange}</span>
      </div>
      <div className="overflow-x-auto">
        <svg
          width={grid.length * (CELL_SIZE + GAP) + 30}
          height={7 * (CELL_SIZE + GAP) + 20}
        >
          {months.map((m, i) => (
            <text
              key={i}
              x={m.x + 30}
              y={10}
              fill="currentColor"
              className="text-zinc-400 dark:text-zinc-500"
              fontSize={10}
            >
              {m.label}
            </text>
          ))}
          {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((label, i) => (
            <text
              key={i}
              x={0}
              y={18 + i * (CELL_SIZE + GAP) + CELL_SIZE / 2}
              fill="currentColor"
              className="text-zinc-400 dark:text-zinc-500"
              fontSize={9}
              dominantBaseline="middle"
            >
              {label}
            </text>
          ))}
          {grid.map((week, w) =>
            week.map((day, d) => (
              <rect
                key={`${w}-${d}`}
                x={w * (CELL_SIZE + GAP) + 30}
                y={d * (CELL_SIZE + GAP) + 16}
                width={CELL_SIZE}
                height={CELL_SIZE}
                rx={2}
                fill={getIntensityColor(day.count, isDark)}
              >
                <title>
                  {format(day.date, 'MMM d, yyyy')}: {day.created} created, {day.reviewed} reviewed
                </title>
              </rect>
            ))
          )}
        </svg>
      </div>
      <div className="flex items-center gap-1 mt-2 text-[10px] text-zinc-400">
        <span>Less</span>
        {[0, 1, 2, 4, 6].map((n) => (
          <span
            key={n}
            className="inline-block w-3 h-3 rounded-sm"
            style={{ backgroundColor: getIntensityColor(n, isDark) }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
