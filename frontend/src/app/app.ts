import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GoogleAnalyticsService } from './services/google-analytics.service';
import { TrafficAutoRefreshService } from './services/traffic-auto-refresh.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet></router-outlet>`,
  styles: [`
    :host {
      display: block;
    }
  `],
})
export class App {
  /** Subscribes to router for SPA page_path hits. */
  private readonly _ga = inject(GoogleAnalyticsService);
  /** Starts browser interval for dashboard auto-refresh. */
  private readonly _refresh = inject(TrafficAutoRefreshService);
}
