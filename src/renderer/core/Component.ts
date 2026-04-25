/**
 * Abstract base component class.
 * Manages DOM lifecycle: mount, unmount, update.
 * All UI components extend this class.
 */

export abstract class Component {
  protected element: HTMLElement;
  private readonly unsubscribers: Array<() => void> = [];
  private mounted = false;

  constructor(tagName: string = 'div', className?: string) {
    this.element = document.createElement(tagName);
    if (className !== undefined) {
      this.element.className = className;
    }
  }

  /**
   * Return the root DOM element of this component.
   */
  public getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Mount this component into a parent element.
   * Calls render() and onMount() lifecycle hooks.
   */
  public mount(parent: HTMLElement): void {
    if (this.mounted) return;
    this.render();
    parent.appendChild(this.element);
    this.mounted = true;
    this.onMount();
  }

  /**
   * Mount this component before a reference element.
   */
  public mountBefore(sibling: HTMLElement): void {
    if (this.mounted) return;
    this.render();
    sibling.parentElement?.insertBefore(this.element, sibling);
    this.mounted = true;
    this.onMount();
  }

  /**
   * Unmount and clean up this component.
   */
  public unmount(): void {
    if (!this.mounted) return;
    this.onUnmount();
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers.length = 0;
    this.element.remove();
    this.mounted = false;
  }

  /**
   * Re-render the component in place.
   */
  public update(): void {
    if (!this.mounted) return;
    this.render();
  }

  /**
   * Register a cleanup function to run on unmount.
   * Use this for event listeners, store subscriptions, etc.
   */
  protected addCleanup(fn: () => void): void {
    this.unsubscribers.push(fn);
  }

  /**
   * Set inner HTML safely (no user-provided content should use this).
   */
  protected setHTML(html: string): void {
    this.element.innerHTML = html;
  }

  /**
   * Query a child element — throws if not found.
   */
  protected query<T extends HTMLElement>(selector: string): T {
    const el = this.element.querySelector<T>(selector);
    if (el === null) {
      throw new Error(`Component: element not found: "${selector}"`);
    }
    return el;
  }

  /**
   * Query a child element — returns null if not found.
   */
  protected queryOptional<T extends HTMLElement>(selector: string): T | null {
    return this.element.querySelector<T>(selector);
  }

  /**
   * Query all matching child elements.
   */
  protected queryAll<T extends HTMLElement>(selector: string): NodeListOf<T> {
    return this.element.querySelectorAll<T>(selector);
  }

  /**
   * Render the component's HTML. Called on mount and update.
   * Subclasses must implement this.
   */
  protected abstract render(): void;

  /**
   * Called after the component is mounted to the DOM.
   * Override to attach event listeners, start timers, etc.
   */
  protected onMount(): void {}

  /**
   * Called before the component is removed from the DOM.
   * Override to clean up resources.
   */
  protected onUnmount(): void {}
}
