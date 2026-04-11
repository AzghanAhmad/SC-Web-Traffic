import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
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
  /** Starts browser interval for dashboard auto-refresh. */
  private readonly _refresh = inject(TrafficAutoRefreshService);
}
