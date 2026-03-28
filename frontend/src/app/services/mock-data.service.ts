import { Injectable } from '@angular/core';

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

export interface Insight {
  icon: string;
  text: string;
  highlight: string;
  type: 'success' | 'warning' | 'danger' | 'info';
}

export interface TimeSeriesPoint {
  date: string;
  visitors: number;
  sessions: number;
  pageviews: number;
}

export interface CountryTraffic {
  country: string;
  flag: string;
  visits: number;
  percentage: number;
}

export interface Referrer {
  source: string;
  visits: number;
  engagement: string;
  conversion: number;
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

export interface WhatChanged {
  icon: string;
  title: string;
  description: string;
  metric: string;
  type: 'spike' | 'drop' | 'milestone';
}

@Injectable({ providedIn: 'root' })
export class MockDataService {

  private generateSparkline(count: number, min: number, max: number): number[] {
    const data: number[] = [];
    let current = min + Math.random() * (max - min);
    for (let i = 0; i < count; i++) {
      current += (Math.random() - 0.45) * (max - min) * 0.15;
      current = Math.max(min, Math.min(max, current));
      data.push(Math.round(current));
    }
    return data;
  }

  getKpiData(): KpiData[] {
    return [
      {
        label: 'Total Visitors',
        value: 24853,
        change: 12.5,
        sparkline: this.generateSparkline(14, 600, 2200),
        icon: '👥',
      },
      {
        label: 'Sessions',
        value: 38291,
        change: 8.3,
        sparkline: this.generateSparkline(14, 1200, 3500),
        icon: '📊',
      },
      {
        label: 'Engagement Rate',
        value: 67.4,
        change: -2.1,
        sparkline: this.generateSparkline(14, 55, 80),
        suffix: '%',
        icon: '⚡',
      },
      {
        label: 'Conversions',
        value: 1247,
        change: 24.7,
        sparkline: this.generateSparkline(14, 40, 120),
        icon: '🎯',
      },
    ];
  }

  getTrafficSources(): TrafficSource[] {
    return [
      { name: 'Direct', value: 35, color: '#6366f1' },
      { name: 'Email', value: 28, color: '#a855f7' },
      { name: 'Social', value: 18, color: '#34d399' },
      { name: 'Ads', value: 12, color: '#fbbf24' },
      { name: 'Organic', value: 7, color: '#60a5fa' },
    ];
  }

  getInsights(): Insight[] {
    return [
      {
        icon: '📈',
        text: 'Traffic increased by',
        highlight: '24% from email campaigns',
        type: 'success',
      },
      {
        icon: '⚠️',
        text: 'Most users drop off on the',
        highlight: 'pricing page (38% bounce)',
        type: 'warning',
      },
      {
        icon: '📱',
        text: 'Mobile users convert',
        highlight: '30% less than desktop',
        type: 'danger',
      },
      {
        icon: '🚀',
        text: 'Newsletter signup rate is at an',
        highlight: 'all-time high this week',
        type: 'success',
      },
      {
        icon: '🌍',
        text: 'Organic search traffic grew by',
        highlight: '18% over last month',
        type: 'info',
      },
    ];
  }

  getTimeSeriesData(range: '24h' | '7d' | '30d'): TimeSeriesPoint[] {
    const data: TimeSeriesPoint[] = [];
    const count = range === '24h' ? 24 : range === '7d' ? 7 : 30;

    for (let i = count - 1; i >= 0; i--) {
      const date = new Date();
      if (range === '24h') {
        date.setHours(date.getHours() - i);
        data.push({
          date: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          visitors: Math.floor(200 + Math.random() * 800),
          sessions: Math.floor(300 + Math.random() * 1200),
          pageviews: Math.floor(500 + Math.random() * 2000),
        });
      } else {
        date.setDate(date.getDate() - i);
        data.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          visitors: Math.floor(500 + Math.random() * 2000),
          sessions: Math.floor(800 + Math.random() * 3000),
          pageviews: Math.floor(1500 + Math.random() * 5000),
        });
      }
    }
    return data;
  }

  getCountryTraffic(): CountryTraffic[] {
    return [
      { country: 'United States', flag: '🇺🇸', visits: 8420, percentage: 33.8 },
      { country: 'United Kingdom', flag: '🇬🇧', visits: 4215, percentage: 16.9 },
      { country: 'Canada', flag: '🇨🇦', visits: 3180, percentage: 12.8 },
      { country: 'Germany', flag: '🇩🇪', visits: 2340, percentage: 9.4 },
      { country: 'Australia', flag: '🇦🇺', visits: 1890, percentage: 7.6 },
      { country: 'France', flag: '🇫🇷', visits: 1450, percentage: 5.8 },
      { country: 'India', flag: '🇮🇳', visits: 1200, percentage: 4.8 },
      { country: 'Brazil', flag: '🇧🇷', visits: 980, percentage: 3.9 },
    ];
  }

  getTopReferrers(): Referrer[] {
    return [
      { source: 'google.com', visits: 5280, engagement: '4m 32s', conversion: 3.8 },
      { source: 'newsletter.scribecount.com', visits: 3420, engagement: '6m 18s', conversion: 8.2 },
      { source: 'twitter.com', visits: 2150, engagement: '2m 45s', conversion: 2.1 },
      { source: 'facebook.com', visits: 1890, engagement: '3m 12s', conversion: 1.9 },
      { source: 'reddit.com', visits: 1420, engagement: '5m 06s', conversion: 4.5 },
      { source: 'youtube.com', visits: 1100, engagement: '3m 48s', conversion: 3.2 },
      { source: 'linkedin.com', visits: 890, engagement: '4m 22s', conversion: 5.1 },
      { source: 'pinterest.com', visits: 620, engagement: '2m 15s', conversion: 1.4 },
    ];
  }

  getConversionMetrics(): ConversionMetric[] {
    return [
      { label: 'Newsletter Signups', value: 842, change: 15.3, icon: '📧' },
      { label: 'Buy Clicks', value: 356, change: 8.7, icon: '🛒' },
      { label: 'Purchases', value: 124, change: 22.1, icon: '💰' },
      { label: 'Trial Starts', value: 89, change: -4.2, icon: '🚀' },
    ];
  }

  getFunnelData(): FunnelStep[] {
    return [
      { label: 'Landing Page', visitors: 24853, percentage: 100, dropOff: 0 },
      { label: 'Product Page', visitors: 14912, percentage: 60, dropOff: 40 },
      { label: 'Pricing Page', visitors: 7456, percentage: 30, dropOff: 50 },
      { label: 'Buy Click', visitors: 3728, percentage: 15, dropOff: 50 },
      { label: 'Purchase', visitors: 1247, percentage: 5, dropOff: 66.5 },
    ];
  }

  getPagePerformance(): PagePerformance[] {
    return [
      { url: '/home', views: 12450, avgTime: '2m 34s', bounceRate: 32.1, conversions: 520 },
      { url: '/books', views: 8920, avgTime: '4m 12s', bounceRate: 24.5, conversions: 380 },
      { url: '/pricing', views: 6780, avgTime: '1m 48s', bounceRate: 45.2, conversions: 290 },
      { url: '/blog', views: 5420, avgTime: '5m 36s', bounceRate: 18.3, conversions: 150 },
      { url: '/about', views: 3210, avgTime: '1m 22s', bounceRate: 52.1, conversions: 45 },
      { url: '/contact', views: 2180, avgTime: '2m 05s', bounceRate: 38.7, conversions: 89 },
      { url: '/faq', views: 1890, avgTime: '3m 15s', bounceRate: 22.4, conversions: 35 },
      { url: '/signup', views: 1540, avgTime: '1m 58s', bounceRate: 28.9, conversions: 420 },
    ];
  }

  getCampaigns(): Campaign[] {
    return [
      { name: 'Spring Book Launch', visits: 4520, engagement: '5m 12s', conversions: 342, revenue: 8550, status: 'active' },
      { name: 'Newsletter Promo', visits: 3280, engagement: '3m 45s', conversions: 215, revenue: 5375, status: 'active' },
      { name: 'Social Media Blitz', visits: 2890, engagement: '2m 18s', conversions: 156, revenue: 3900, status: 'active' },
      { name: 'Holiday Special', visits: 5120, engagement: '4m 32s', conversions: 489, revenue: 12225, status: 'completed' },
      { name: 'Author Spotlight', visits: 1850, engagement: '6m 08s', conversions: 98, revenue: 2450, status: 'paused' },
      { name: 'Webinar Follow-up', visits: 1240, engagement: '4m 55s', conversions: 167, revenue: 4175, status: 'completed' },
    ];
  }

  getDeviceData(): DeviceData[] {
    return [
      { device: 'Desktop', percentage: 52, sessions: 19911, conversionRate: 5.8, color: '#6366f1' },
      { device: 'Mobile', percentage: 38, sessions: 14551, conversionRate: 3.2, color: '#a855f7' },
      { device: 'Tablet', percentage: 10, sessions: 3829, conversionRate: 4.1, color: '#34d399' },
    ];
  }

  getWhatChanged(): WhatChanged[] {
    return [
      {
        icon: '🔥',
        title: 'Traffic Spike Detected',
        description: 'Incoming visitors surged from email campaign',
        metric: '+340% in last 2 hours',
        type: 'spike',
      },
      {
        icon: '📉',
        title: 'Pricing Page Drop-off',
        description: 'Bounce rate on pricing page increased significantly',
        metric: '+12% bounce rate',
        type: 'drop',
      },
      {
        icon: '🏆',
        title: 'Top Campaign Today',
        description: 'Spring Book Launch is driving the most traffic',
        metric: '4,520 visits today',
        type: 'milestone',
      },
    ];
  }

  getSites(): string[] {
    return [
      'scribecount.com',
      'blog.scribecount.com',
      'shop.scribecount.com',
      'docs.scribecount.com',
    ];
  }
}
