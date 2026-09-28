/** Keys typed so far in an unfinished sequence, and what can follow (the hint bar). */
export class KeyHintModel {
  /** Formatted keys typed so far, e.g. "Ctrl+Espace". Empty when no sequence is pending. */
  typed = $state('');
  items = $state<{ key: string; title: string; prefix: boolean }[]>([]);

  show(typed: string, items: { key: string; title: string; prefix: boolean }[]): void {
    this.typed = typed;
    this.items = items;
  }

  clear(): void {
    this.typed = '';
    this.items = [];
  }
}
