import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  TrafficOverviewResponse,
  SourcePointDto,
  PagePointDto,
  ConversionPointDto,
  DevicePointDto,
  CountryPointDto,
  ReferrerPointDto,
  CampaignPointDto,
  FunnelStepDto,
  HeatmapPointDto,
  SiteDto,
  LiveStatsDto,
  CollectEventRequest,
} from '../models/analytics.types';

@Injectable({ providedIn: 'root' })
export class TrafficApiService {
  private readonly http = inject(HttpClient);

  listSites(): Observable<SiteDto[]> {
    return this.http.get<SiteDto[]>('/api/sites');
  }

  registerSite(url: string): Observable<SiteDto> {
    return this.http.post<SiteDto>('/api/sites', { url });
  }

  overview(siteId: string, days: number): Observable<TrafficOverviewResponse> {
    const params = new HttpParams().set('siteId', siteId).set('days', String(days));
    return this.http.get<TrafficOverviewResponse>('/api/traffic/overview', { params });
  }

  sources(siteId: string, days: number): Observable<SourcePointDto[]> {
    const params = new HttpParams().set('siteId', siteId).set('days', String(days));
    return this.http.get<SourcePointDto[]>('/api/traffic/sources', { params });
  }

  pages(siteId: string, days: number): Observable<PagePointDto[]> {
    const params = new HttpParams().set('siteId', siteId).set('days', String(days));
    return this.http.get<PagePointDto[]>('/api/traffic/pages', { params });
  }

  conversions(siteId: string, days: number): Observable<ConversionPointDto[]> {
    const params = new HttpParams().set('siteId', siteId).set('days', String(days));
    return this.http.get<ConversionPointDto[]>('/api/traffic/conversions', { params });
  }

  devices(siteId: string, days: number): Observable<DevicePointDto[]> {
    const params = new HttpParams().set('siteId', siteId).set('days', String(days));
    return this.http.get<DevicePointDto[]>('/api/traffic/devices', { params });
  }

  countries(siteId: string, days: number): Observable<CountryPointDto[]> {
    const params = new HttpParams().set('siteId', siteId).set('days', String(days));
    return this.http.get<CountryPointDto[]>('/api/traffic/countries', { params });
  }

  referrers(siteId: string, days: number, take = 20): Observable<ReferrerPointDto[]> {
    const params = new HttpParams()
      .set('siteId', siteId)
      .set('days', String(days))
      .set('take', String(take));
    return this.http.get<ReferrerPointDto[]>('/api/traffic/referrers', { params });
  }

  campaigns(siteId: string, days: number): Observable<CampaignPointDto[]> {
    const params = new HttpParams().set('siteId', siteId).set('days', String(days));
    return this.http.get<CampaignPointDto[]>('/api/traffic/campaigns', { params });
  }

  funnels(siteId: string, steps: string[], days: number): Observable<FunnelStepDto[]> {
    const stepsParam = steps.join(',');
    const params = new HttpParams()
      .set('siteId', siteId)
      .set('steps', stepsParam)
      .set('days', String(days));
    return this.http.get<FunnelStepDto[]>('/api/traffic/funnels', { params });
  }

  heatmap(siteId: string, pageUrl: string, days: number): Observable<HeatmapPointDto[]> {
    const params = new HttpParams()
      .set('siteId', siteId)
      .set('pageUrl', pageUrl)
      .set('days', String(days));
    return this.http.get<HeatmapPointDto[]>('/api/traffic/heatmap', { params });
  }

  liveStats(siteId: string): Observable<LiveStatsDto> {
    const params = new HttpParams().set('siteId', siteId);
    return this.http.get<LiveStatsDto>('/api/traffic/live', { params });
  }

  collectEvent(req: CollectEventRequest): Observable<{ eventId: string; sessionId: string; visitorId: string }> {
    return this.http.post<{ eventId: string; sessionId: string; visitorId: string }>('/api/collect', req);
  }
}
