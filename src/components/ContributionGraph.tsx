import { useMemo, useRef, useState, useEffect } from "react";
import { format, startOfWeek, eachDayOfInterval, getDay, subDays } from "date-fns";

interface ContributionGraphProps {
  data: Map<string, { created: number; reviewed: number }>;
  startDate?: Date;
  endDate?: Date;
  selectedDay?: string | null;
  onDayClick?: (day: string | null) => void;
}

const LABEL_WIDTH = 30;
const GAP = 2;
const MIN_CELL = 10;
const MAX_CELL = 16;

function getIntensityColor(count: number, isDark: boolean): string {
  if (count === 0) return isDark ? "#27272a" : "#f4f4f5";
  if (count <= 1) return isDark ? "#0078d433" : "#0078d433";
  if (count <= 3) return isDark ? "#0078d466" : "#0078d466";
  if (count <= 5) return isDark ? "#0078d499" : "#0078d499";
  return "#0078d4";
}

export function ContributionGraph({
  data,
  startDate,
  endDate,
  selectedDay,
  onDayClick,
}: ContributionGraphProps) {
  const isDark = document.documentElement.classList.contains("dark");
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { grid, months, dateRange, cellSize } = useMemo(() => {
    const end = endDate ?? new Date();
    const start = startDate
      ? startOfWeek(startDate, { weekStartsOn: 0 })
      : startOfWeek(subDays(end, 52 * 7), { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start, end });

    const weeks: { date: Date; key: string; count: number; created: number; reviewed: number }[][] =
      [];
    let currentWeek: (typeof weeks)[0] = [];

    for (const day of days) {
      const key = format(day, "yyyy-MM-dd");
      const entry = data.get(key);
      const created = entry?.created ?? 0;
      const reviewed = entry?.reviewed ?? 0;

      if (getDay(day) === 0 && currentWeek.length > 0) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push({ date: day, key, count: created + reviewed, created, reviewed });
    }
    if (currentWeek.length > 0) weeks.push(currentWeek);

    const numWeeks = weeks.length;
    const available = containerWidth > 0 ? containerWidth - LABEL_WIDTH : 800;
    const computed = Math.floor(available / numWeeks) - GAP;
    const clamped = Math.max(MIN_CELL, Math.min(MAX_CELL, computed));

    const monthLabels: { label: string; x: number }[] = [];
    let lastMonth = -1;
    for (let w = 0; w < weeks.length; w++) {
      const firstDay = weeks[w]![0]!;
      const month = firstDay.date.getMonth();
      if (month !== lastMonth) {
        monthLabels.push({ label: format(firstDay.date, "MMM"), x: w * (clamped + GAP) });
        lastMonth = month;
      }
    }

    return {
      grid: weeks,
      months: monthLabels,
      dateRange: `${format(start, "MMM d, yyyy")} — ${format(end, "MMM d, yyyy")}`,
      cellSize: clamped,
    };
  }, [data, startDate, endDate, containerWidth]);

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

  const svgWidth = grid.length * (cellSize + GAP) + LABEL_WIDTH;
  const svgHeight = 7 * (cellSize + GAP) + 20;

  return (
    <div ref={containerRef}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
          <span>
            <strong className="text-zinc-700 dark:text-zinc-200">{totalCreated}</strong> PRs created
          </span>
          <span>
            <strong className="text-zinc-700 dark:text-zinc-200">{totalReviewed}</strong> PRs
            reviewed
          </span>
        </div>
        <span className="text-[11px] text-zinc-400">{dateRange}</span>
      </div>
      <div className="overflow-x-auto flex justify-center">
        <svg width={svgWidth} height={svgHeight} className="cursor-pointer">
          {months.map((m, i) => (
            <text
              key={i}
              x={m.x + LABEL_WIDTH}
              y={10}
              fill="currentColor"
              className="text-zinc-400 dark:text-zinc-500"
              fontSize={10}
            >
              {m.label}
            </text>
          ))}
          {["", "Mon", "", "Wed", "", "Fri", ""].map((label, i) => (
            <text
              key={i}
              x={0}
              y={18 + i * (cellSize + GAP) + cellSize / 2}
              fill="currentColor"
              className="text-zinc-400 dark:text-zinc-500"
              fontSize={9}
              dominantBaseline="middle"
            >
              {label}
            </text>
          ))}
          {grid.map((week, w) =>
            week.map((day, d) => {
              const isSelected = selectedDay === day.key;
              return (
                <g key={`${w}-${d}`} onClick={() => onDayClick?.(isSelected ? null : day.key)}>
                  <rect
                    x={w * (cellSize + GAP) + LABEL_WIDTH}
                    y={d * (cellSize + GAP) + 16}
                    width={cellSize}
                    height={cellSize}
                    rx={2}
                    fill={getIntensityColor(day.count, isDark)}
                    stroke={isSelected ? "#0078d4" : "none"}
                    strokeWidth={isSelected ? 2 : 0}
                  />
                  <title>
                    {format(day.date, "MMM d, yyyy")}: {day.created} created, {day.reviewed}{" "}
                    reviewed
                  </title>
                </g>
              );
            }),
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
