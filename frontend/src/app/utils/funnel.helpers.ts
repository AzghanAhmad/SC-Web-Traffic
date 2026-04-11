import type { FunnelStep, FunnelStepDto } from '../models/analytics.types';

/** Top pages by views (API order) → ordered funnel URLs, no duplicate consecutive paths. */
export function funnelStepsFromPageUrls(pageUrls: string[]): string[] {
  const urls = pageUrls.map(u => u.trim()).filter(Boolean);
  if (urls.length === 0) return [];
  const deduped: string[] = [];
  for (const u of urls)
    if (deduped.length === 0 || !urlsEqual(deduped[deduped.length - 1], u)) deduped.push(u);
  return deduped.slice(0, 6);
}

function urlsEqual(a: string, b: string): boolean {
  return a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0;
}

/** Map API funnel rows to UI: bar = share of baseline; drop-off = loss to next step. */
export function funnelDtoToDisplaySteps(dto: FunnelStepDto[]): FunnelStep[] {
  if (!dto.length) return [];
  const baseline = dto[0]?.entered ?? 0;
  const out: FunnelStep[] = dto.map((f, i) => {
    const pct =
      baseline > 0 ? Math.min(100, Math.round((f.completed / baseline) * 1000) / 10) : 0;
    const next = dto[i + 1];
    let drop = 0;
    if (next && f.completed > 0) {
      const raw = ((f.completed - next.completed) / f.completed) * 100;
      drop = Math.round(Math.max(0, raw) * 10) / 10;
    }
    return {
      label: f.step,
      visitors: f.completed,
      percentage: pct,
      dropOff: drop,
    };
  });
  return out;
}
