import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GoogleAnalyticsService } from './services/google-analytics.service';

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
}
