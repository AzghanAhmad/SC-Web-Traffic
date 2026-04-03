/** API-aligned and UI helper types (no mock data). */

export interface TrendPointDto {
  date: string;
  visitors: number;
  sessions: number;
  pageViews: number;
  conversions: number;
}

export interface TrafficOverviewResponse {
  visitors: number;
  sessions: number;
  engagementRate: number;
  conversions: number;
  trendData: TrendPointDto[];
}

export interface SourcePointDto {
  source: string;
  sessions: number;
  percentage: number;
}

export interface PagePointDto {
  pageUrl: string;
  views: number;
  avgTimeOnPageSeconds: number;
}

export interface ConversionPointDto {
  type: string;
  count: number;
  valueSum: number | null;
}

export interface DevicePointDto {
  deviceType: string;
  sessions: number;
}

export interface CountryPointDto {
  country: string;
  sessions: number;
  percentage: number;
}

export interface ReferrerPointDto {
  source: string;
  visits: number;
}

export interface CampaignPointDto {
  name: string;
  visits: number;
  conversions: number;
}

export interface FunnelStepDto {
  step: string;
  entered: number;
  completed: number;
  conversionRate: number;
  dropOffRate: number;
}

export interface HeatmapPointDto {
  x: number;
  y: number;
  count: number;
  avgScrollDepth: number;
}

export interface SiteDto {
  siteId: string;
  domain: string;
  name: string;
}

export interface AuthResultDto {
  accessToken: string;
  expiresAtUtc: string;
  userId: string;
  email: string;
  displayName: string;
}

/** KPI card input (sparkline optional). */
export interface KpiData {
  label: string;
  value: number;
  change: number;
  sparkline: number[];
  prefix?: string;
  suffix?: string;
  icon: string;
}

export interface TrafficSource {
  name: string;
  value: number;
  color: string;
}

export interface TimeSeriesPoint {
  date: string;
  visitors: number;
  sessions: number;
  pageviews: number;
}

export interface Insight {
  icon: string;
  text: string;
  highlight: string;
  type: 'success' | 'warning' | 'danger' | 'info';
}

export interface WhatChanged {
  icon: string;
  title: string;
  description: string;
  metric: string;
  type: 'spike' | 'drop' | 'milestone';
}

export interface ConversionMetric {
  label: string;
  value: number;
  change: number;
  icon: string;
}

export interface FunnelStep {
  label: string;
  visitors: number;
  percentage: number;
  dropOff: number;
}

export interface PagePerformance {
  url: string;
  views: number;
  avgTime: string;
  bounceRate: number;
  conversions: number;
}

export interface Campaign {
  name: string;
  visits: number;
  engagement: string;
  conversions: number;
  revenue: number;
  status: 'active' | 'paused' | 'completed';
}

export interface DeviceData {
  device: string;
  percentage: number;
  sessions: number;
  conversionRate: number;
  color: string;
}

export interface CountryTraffic {
  country: string;
  visits: number;
  percentage: number;
}

export interface Referrer {
  source: string;
  visits: number;
  engagement: string;
  conversion: number;
}
