/**
 * ThemeManager — applies and persists the UI theme.
 * Sets data-theme="dark"|"light" on <html> based on the setting.
 * Handles the "system" option by reading prefers-color-scheme.
 * Singleton.
 */

import type { AppSettings } from '../../shared/types.js';

type ThemeSetting = AppSettings['theme'];
type ResolvedTheme = 'dark' | 'light';

class ThemeManager {
  private static instance: ThemeManager;
  private currentSetting: ThemeSetting = 'dark';
  private mediaQuery: MediaQueryList;

  private constructor() {
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  }

  public static getInstance(): ThemeManager {
    if (ThemeManager.instance === undefined) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }

  /**
   * Apply a theme setting. Call this on startup and whenever the user changes it.
   * @param setting - 'dark' | 'light' | 'system'
   */
  public apply(setting: ThemeSetting): void {
    this.currentSetting = setting;

    // Remove any previous system listener
    this.mediaQuery.removeEventListener('change', this.handleSystemChange);

    if (setting === 'system') {
      // Apply immediately based on current system preference
      this.applyResolved(this.resolveSystem());
      // Watch for system changes
      this.mediaQuery.addEventListener('change', this.handleSystemChange);
    } else {
      this.applyResolved(setting);
    }
  }

  /** Get the currently active resolved theme ('dark' or 'light') */
  public getResolved(): ResolvedTheme {
    if (this.currentSetting === 'system') return this.resolveSystem();
    return this.currentSetting;
  }

  /** Get the current setting (may be 'system') */
  public getSetting(): ThemeSetting {
    return this.currentSetting;
  }

  private resolveSystem(): ResolvedTheme {
    return this.mediaQuery.matches ? 'dark' : 'light';
  }

  private applyResolved(theme: ResolvedTheme): void {
    const html = document.documentElement;

    // Add transition class for smooth switch
    html.classList.add('theme-transitioning');

    html.setAttribute('data-theme', theme);

    // Remove transition class after animation completes
    setTimeout(() => {
      html.classList.remove('theme-transitioning');
    }, 300);
  }

  private readonly handleSystemChange = (): void => {
    if (this.currentSetting === 'system') {
      this.applyResolved(this.resolveSystem());
    }
  };
}

export const themeManager = ThemeManager.getInstance();
