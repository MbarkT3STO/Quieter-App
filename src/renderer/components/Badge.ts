/**
 * Badge component — colored risk level pill.
 */

import { Component } from '../core/Component.js';
import { RiskLevel } from '../../shared/types.js';

export class Badge extends Component {
  private readonly risk: RiskLevel;

  constructor(risk: RiskLevel) {
    super('span', 'badge');
    this.risk = risk;
  }

  protected render(): void {
    const classMap: Record<RiskLevel, string> = {
      [RiskLevel.Safe]: 'badge-safe',
      [RiskLevel.Moderate]: 'badge-moderate',
      [RiskLevel.Advanced]: 'badge-advanced',
    };

    const labelMap: Record<RiskLevel, string> = {
      [RiskLevel.Safe]: 'Safe',
      [RiskLevel.Moderate]: 'Moderate',
      [RiskLevel.Advanced]: 'Advanced',
    };

    this.element.className = `badge ${classMap[this.risk]}`;

    if (this.risk === RiskLevel.Advanced) {
      this.setHTML(`
        <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M8 1L1 14h14L8 1zm0 2.5l5.5 9.5H2.5L8 3.5zM7.25 7v3h1.5V7h-1.5zm0 4v1.5h1.5V11h-1.5z"/>
        </svg>
        ${labelMap[this.risk]}
      `);
    } else {
      this.element.textContent = labelMap[this.risk];
    }
  }
}
