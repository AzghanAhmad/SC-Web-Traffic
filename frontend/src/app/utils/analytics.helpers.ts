import type { SourcePointDto, TrendPointDto } from '../models/analytics.types';
import type { TrafficSource, KpiData, TimeSeriesPoint } from '../models/analytics.types';

const SOURCE_COLORS = ['#6366f1', '#a855f7', '#34d399', '#fbbf24', '#60a5fa', '#f87171', '#fb923c', '#94a3b8'];

export function timeRangeToDays(range: '24h' | '7d' | '30d'): number {
  switch (range) {
    case '24h':
      return 1;
    case '7d':
      return 7;
    case '30d':
      return 30;
    default:
      return 7;
  }
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Compare first half vs second half of a series (rough trend). */
export function pctChangeFromSeries(values: number[]): number {
  if (values.length < 2) return 0;
  const mid = Math.floor(values.length / 2);
  const a = average(values.slice(0, mid));
  const b = average(values.slice(mid));
  if (a === 0) return b > 0 ? 100 : 0;
  return Math.round(((b - a) / a) * 1000) / 10;
}

export function sparklineFromTrend(trend: TrendPointDto[], pick: keyof Pick<TrendPointDto, 'visitors' | 'sessions' | 'pageViews' | 'conversions'>): number[] {
  return trend.map(p => p[pick]);
}

export function trendToTimeSeries(trend: TrendPointDto[]): TimeSeriesPoint[] {
  return trend.map(t => ({
    date: t.date,
    visitors: t.visitors,
    sessions: t.sessions,
    pageviews: t.pageViews,
  }));
}

export function sourcesToTrafficSources(sources: SourcePointDto[]): TrafficSource[] {
  return sources.map((p, i) => ({
    name: p.source,
    value: Math.round(p.percentage * 10) / 10,
    color: SOURCE_COLORS[i % SOURCE_COLORS.length],
  }));
}

export function formatDurationSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

export function buildOverviewKpis(overview: { visitors: number; sessions: number; engagementRate: number; conversions: number; trendData: TrendPointDto[] }): KpiData[] {
  const t = overview.trendData;
  const vSpark = sparklineFromTrend(t, 'visitors');
  const sSpark = sparklineFromTrend(t, 'sessions');
  const pSpark = sparklineFromTrend(t, 'pageViews');
  const cSpark = sparklineFromTrend(t, 'conversions');
  return [
    {
      label: 'Total Visitors',
      value: overview.visitors,
      change: pctChangeFromSeries(vSpark),
      sparkline: vSpark.length ? vSpark : [0],
      icon: 'users',
    },
    {
      label: 'Sessions',
      value: overview.sessions,
      change: pctChangeFromSeries(sSpark),
      sparkline: sSpark.length ? sSpark : [0],
      icon: 'bar-chart',
    },
    {
      label: 'Engagement rate',
      value: Math.round(overview.engagementRate * 10) / 10,
      change: pctChangeFromSeries(t.map(x => x.sessions)),
      sparkline: pSpark.length ? pSpark : [0],
      suffix: '%',
      icon: 'activity',
    },
    {
      label: 'Conversions',
      value: overview.conversions,
      change: pctChangeFromSeries(cSpark),
      sparkline: cSpark.length ? cSpark : [0],
      icon: 'target',
    },
  ];
}

function requestUrl(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'url' in err) {
    const u = (err as { url?: string }).url;
    return typeof u === 'string' ? u : undefined;
  }
  return undefined;
}

/**
 * Maps API errors to user-facing text.
 * ASP.NET often returns ProblemDetails: { title, detail } — not { message }.
 */
export function httpErrorMessage(err: unknown): string {
  const e = err as {
    error?: { message?: string; title?: string; detail?: string };
    status?: number;
    message?: string;
  };
  const body = e.error;
  const msg = body?.message;
  if (typeof msg === 'string' && msg.trim()) return msg;
  const detail = body?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  const title = body?.title;
  if (typeof title === 'string' && title.trim() && title !== 'Unauthorized') return title;

  const url = (requestUrl(err) ?? '').toLowerCase();
  const isAuthForm =
    url.includes('/auth/login') || url.includes('/auth/signup');

  if (e?.status === 401) {
    if (isAuthForm) return 'Invalid email or password.';
    return 'Your session expired or you are not signed in. Please log in again.';
  }
  if (e?.status === 403) return 'You do not have access to this resource.';
  if (e?.status === 409) return 'An account with this email already exists.';
  if (e?.status === 404) {
    return 'API route not found. If you opened a production build, /api must be proxied to the backend (dev: use ng serve with proxy).';
  }
  if (e?.status === 0) {
    return 'Cannot reach the API (network or CORS). Keep the backend running, use the same origin as ng serve with proxy, or allow your site origin in API CORS.';
  }
  return 'Something went wrong. Please try again.';
}
