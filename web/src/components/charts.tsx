"use client";

import { Fragment, useEffect, useId, useRef, useState } from "react";

interface TipState {
  x: number;
  y: number;
  value: string;
  label: string;
  detail?: string;
}

/** Tooltip: the value leads (strong), the label follows. Text is inserted as React text (never HTML). */
function Tooltip({ tip }: { tip: TipState | null }) {
  if (!tip) return null;
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-20 max-w-[16rem] -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-card"
      style={{ left: tip.x, top: tip.y - 8 }}
    >
      <div className="font-semibold text-ink">{tip.value}</div>
      <div className="text-ink-2">{tip.label}</div>
      {tip.detail ? <div className="mt-0.5 text-xs text-ink-3">{tip.detail}</div> : null}
    </div>
  );
}

export interface BarDatum {
  id: string;
  label: string;
  value: number;
  detail?: string;
}

/**
 * Single-series horizontal bars (one hue, no legend: the title names the series).
 * ≤24px thick, 4px rounded data-end, square at the baseline, value at the tip.
 */
export function HBarChart({ data, title, valueFormat = (v) => String(v) }: { data: BarDatum[]; title: string; valueFormat?: (v: number) => string }) {
  const [tip, setTip] = useState<TipState | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const max = Math.max(1, ...data.map((d) => d.value));

  const show = (target: HTMLElement, d: BarDatum) => {
    const box = ref.current?.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    if (!box) return;
    setTip({ x: r.left - box.left + r.width / 2, y: r.top - box.top, value: valueFormat(d.value), label: d.label, detail: d.detail });
  };

  return (
    <figure className="relative" ref={ref} aria-labelledby={titleId}>
      <figcaption id={titleId} className="mb-3 text-sm font-semibold text-ink-2">
        {title}
      </figcaption>
      <div className="grid grid-cols-[minmax(7rem,40%)_1fr] items-center gap-x-3 gap-y-2" aria-hidden="true">
        {data.map((d) => (
          <Fragment key={d.id}>
            <span className="truncate text-right text-sm text-ink-2" title={d.label}>
              {d.label}
            </span>
            <div
              className="group relative flex h-7 cursor-default items-center rounded-md outline-none"
              tabIndex={0}
              onPointerEnter={(e) => show(e.currentTarget, d)}
              onPointerLeave={() => setTip(null)}
              onFocus={(e) => show(e.currentTarget, d)}
              onBlur={() => setTip(null)}
            >
              <div className="absolute inset-y-0 left-0 w-px" style={{ background: "var(--axis)" }} />
              <div
                className="h-4 transition-[filter] group-hover:brightness-110 group-focus:brightness-110"
                style={{ width: `${Math.max(2, (d.value / max) * 85)}%`, background: "var(--series-1)", borderRadius: "0 4px 4px 0" }}
              />
              <span className="ml-2 text-sm font-semibold tabular-nums text-ink">{valueFormat(d.value)}</span>
            </div>
          </Fragment>
        ))}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.id}>
              <th scope="row">{d.label}</th>
              <td>{valueFormat(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Tooltip tip={tip} />
    </figure>
  );
}

export interface YearDatum {
  id: string;
  year: number;
  label: string;
  detail?: string;
}

/** Dot strip of publication years: ≥8px dots with a 2px surface ring, 24px hit targets, hairline axis. */
/** Width of an element in CSS pixels (charts render at true size: text never scales with the viewBox). */
function useWidth<T extends HTMLElement>(fallback = 600) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => entry && setWidth(Math.max(160, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

export function YearStrip({ data, title }: { data: YearDatum[]; title: string }) {
  const [tip, setTip] = useState<TipState | null>(null);
  const [ref, W] = useWidth<HTMLDivElement>();
  const titleId = useId();
  if (!data.length) return null;
  const years = data.map((d) => d.year);
  const min = Math.min(...years) - 1;
  const max = Math.max(...years) + 1;
  const span = Math.max(1, max - min);
  const maxTicks = Math.max(2, Math.floor(W / 56));
  const step = [1, 2, 5, 10, 20].find((st) => span / st <= maxTicks) ?? 25;
  const ticks: number[] = [];
  for (let y = Math.ceil(min / step) * step; y <= max; y += step) ticks.push(y);
  const stacks: Record<number, number> = {};
  const H = 34 + 14 * Math.max(...Object.values(data.reduce<Record<number, number>>((acc, d) => ({ ...acc, [d.year]: (acc[d.year] ?? 0) + 1 }), {})));
  const x = (year: number) => 16 + ((year - min) / span) * (W - 32);
  const baseline = H - 22;

  const show = (target: Element, d: YearDatum) => {
    const box = ref.current?.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    if (!box) return;
    setTip({ x: r.left - box.left + r.width / 2, y: r.top - box.top, value: String(d.year), label: d.label, detail: d.detail });
  };

  return (
    <figure className="relative" ref={ref} aria-labelledby={titleId}>
      <figcaption id={titleId} className="mb-2 text-sm font-semibold text-ink-2">
        {title}
      </figcaption>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block max-w-full" role="presentation">
        <line x1={8} x2={W - 8} y1={baseline} y2={baseline} stroke="var(--axis)" strokeWidth={1} />
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={x(tick)} x2={x(tick)} y1={baseline} y2={baseline + 4} stroke="var(--axis)" strokeWidth={1} />
            <text x={x(tick)} y={H - 4} textAnchor="middle" fontSize={11} fill="var(--ink-3)" style={{ fontVariantNumeric: "tabular-nums" }}>
              {tick}
            </text>
          </g>
        ))}
        {data.map((d) => {
          const level = (stacks[d.year] = (stacks[d.year] ?? 0) + 1);
          const cx = x(d.year);
          const cy = baseline - 10 - (level - 1) * 14;
          return (
            <g
              key={d.id}
              tabIndex={0}
              className="cursor-default outline-none [&:focus_.dot]:brightness-125"
              onPointerEnter={(e) => show(e.currentTarget, d)}
              onPointerLeave={() => setTip(null)}
              onFocus={(e) => show(e.currentTarget, d)}
              onBlur={() => setTip(null)}
              aria-label={`${d.year}: ${d.label}`}
            >
              <circle cx={cx} cy={cy} r={12} fill="transparent" />
              <circle className="dot" cx={cx} cy={cy} r={5} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />
            </g>
          );
        })}
      </svg>
      <ul className="sr-only">
        {data.map((d) => (
          <li key={d.id}>
            {d.year}: {d.label}
          </li>
        ))}
      </ul>
      <Tooltip tip={tip} />
    </figure>
  );
}

/** Stat tile: label · value (proportional figures) · optional detail. */
export function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="card p-4">
      <div className="text-sm text-ink-2">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-ink">{value}</div>
      {detail ? <div className="mt-0.5 text-xs text-ink-3">{detail}</div> : null}
    </div>
  );
}
