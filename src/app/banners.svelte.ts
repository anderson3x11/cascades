import type { BannerOptions } from '../api';

export class Banner {
  readonly message: string;
  readonly kind: 'info' | 'warning';
  readonly tabId: string | undefined;
  readonly actions: { label: string; run: () => void }[];

  constructor(options: BannerOptions) {
    this.message = options.message;
    this.kind = options.kind ?? 'info';
    this.tabId = options.tabId;
    this.actions = options.actions ?? [];
  }
}

export class BannerModel {
  banners = $state<Banner[]>([]);

  show(options: BannerOptions): { dispose(): void } {
    const banner = new Banner(options);
    this.banners = [...this.banners, banner];
    return { dispose: () => this.remove(banner) };
  }

  remove(banner: Banner): void {
    this.banners = this.banners.filter((b) => b !== banner);
  }
}
