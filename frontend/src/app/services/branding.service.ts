import { Injectable, signal } from '@angular/core';

export interface BrandingState {
  brandName: string;
  accentColor: string; // comma separated RGB values
}

@Injectable({ providedIn: 'root' })
export class BrandingService {
  readonly brandName = signal('ScribeCount');
  readonly accentColor = signal('59, 130, 246');

  private static readonly storageKey = 'scribecount_branding';

  constructor() {
    this.load();
    this.applyAccentColor();
  }

  setBrandName(value: string): void {
    this.brandName.set(value.trim() || 'ScribeCount');
    this.save();
  }

  setAccentColor(value: string): void {
    const rgb = BrandingService.normalizeAccentColor(value);
    if (!rgb) return;
    this.accentColor.set(rgb);
    this.applyAccentColor();
    this.save();
  }

  private applyAccentColor(): void {
    if (typeof document === 'undefined') return;
    document.documentElement.style.setProperty('--color-accent', this.accentColor());
  }

  private save(): void {
    if (typeof localStorage === 'undefined') return;
    const state: BrandingState = {
      brandName: this.brandName(),
      accentColor: this.accentColor(),
    };
    try {
      localStorage.setItem(BrandingService.storageKey, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }

  private load(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(BrandingService.storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<BrandingState> | null;
      if (!parsed) return;
      if (parsed.brandName) {
        this.brandName.set(parsed.brandName);
      }
      if (parsed.accentColor && BrandingService.normalizeAccentColor(parsed.accentColor)) {
        this.accentColor.set(parsed.accentColor);
      }
    } catch {
      /* ignore */
    }
  }

  private static normalizeAccentColor(value: string): string | null {
    const hex = String(value).trim();
    if (/^#?[0-9A-Fa-f]{6}$/.test(hex)) {
      const sanitized = hex.replace('#', '');
      const r = parseInt(sanitized.slice(0, 2), 16);
      const g = parseInt(sanitized.slice(2, 4), 16);
      const b = parseInt(sanitized.slice(4, 6), 16);
      return `${r}, ${g}, ${b}`;
    }
    const rgb = hex.replace(/\s+/g, '');
    if (/^\d{1,3},\d{1,3},\d{1,3}$/.test(rgb)) {
      const parts = rgb.split(',').map(Number);
      if (parts.every(p => p >= 0 && p <= 255)) {
        return `${parts[0]}, ${parts[1]}, ${parts[2]}`;
      }
    }
    return null;
  }
}
