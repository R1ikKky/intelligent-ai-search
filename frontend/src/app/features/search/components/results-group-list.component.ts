import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';

import { SearchResponse, SearchResultItem, SteCardItem } from '../../../shared/models/search.models';
import { SectionCardComponent } from '../../../shared/ui/section-card/section-card.component';

export interface SteSpecRow {
  readonly label: string;
  readonly value: string;
}

@Component({
  standalone: true,
  selector: 'app-results-group-list',
  imports: [SectionCardComponent, DecimalPipe],
  templateUrl: './results-group-list.component.html',
  styleUrl: './results-group-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultsGroupListComponent {
  readonly response = input<SearchResponse | null>(null);
  readonly itemSelected = output<SearchResultItem>();
  /** Уникальный `steId` с intersectionRatio ≥ 0.5 непрерывно ≥ 200 ms. */
  readonly qualifiedCardView = output<string>();
  /** Видимость карточки ≥ 120 с при раскрытых характеристиках. */
  readonly deepCardInterest = output<{ readonly steId: string }>();

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  /** Ключ: `steId` или `item.id` — раскрыты ли все атрибуты в карточке. */
  private readonly expandedSpecIds = signal<ReadonlySet<string>>(new Set());

  private io: IntersectionObserver | null = null;
  private tickHandle: ReturnType<typeof setInterval> | null = null;
  private readonly qualifiedTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly lastRatio = new Map<string, number>();
  private readonly inViewSince = new Map<string, number>();
  private readonly visibleMs = new Map<string, number>();
  private readonly qualifiedOnce = new Set<string>();
  private readonly deepFired = new Set<string>();

  private readonly boundVis = () => this.onDocumentVisibilityChange();

  constructor() {
    document.addEventListener('visibilitychange', this.boundVis);
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', this.boundVis);
      this.teardownInstrumentation();
    });

    effect(() => {
      const r = this.response();
      untracked(() => {
        afterNextRender(() => this.attachInstrumentation(r), { injector: this.injector });
      });
    });
  }

  selectItem(item: SearchResultItem): void {
    this.itemSelected.emit(item);
  }

  isSpecsExpanded(id: string): boolean {
    return this.expandedSpecIds().has(id);
  }

  toggleSpecsExpanded(id: string, event: Event): void {
    event.stopPropagation();
    const prev = this.expandedSpecIds();
    const next = new Set(prev);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.expandedSpecIds.set(next);
  }

  steToResultItem(it: SteCardItem): SearchResultItem {
    const pm = it.personalizationMult ?? 1;
    return {
      id: it.steId,
      externalId: it.steId,
      name: it.name,
      description: it.attributes,
      category: it.category,
      unit: '',
      score: it.score,
      personalizedScore: it.score,
      isPersonalized: Math.abs(pm - 1) > 1e-5,
    };
  }

  parseSteSpecs(raw: string): SteSpecRow[] {
    if (!raw?.trim()) {
      return [];
    }
    const chunks = raw
      .split(/\s*(?:\||;)\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
    const rows: SteSpecRow[] = [];
    for (const chunk of chunks) {
      const idx = chunk.indexOf(':');
      if (idx > 0) {
        rows.push({ label: chunk.slice(0, idx).trim(), value: chunk.slice(idx + 1).trim() });
      } else {
        rows.push({ label: '', value: chunk });
      }
    }
    return rows;
  }

  private onDocumentVisibilityChange(): void {
    if (document.visibilityState !== 'visible') {
      for (const id of [...this.inViewSince.keys()]) {
        this.flushVisibleTime(id);
      }
    }
  }

  private teardownInstrumentation(): void {
    if (this.io) {
      this.io.disconnect();
      this.io = null;
    }
    for (const t of this.qualifiedTimers.values()) {
      window.clearTimeout(t);
    }
    this.qualifiedTimers.clear();
    if (this.tickHandle != null) {
      window.clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
    this.lastRatio.clear();
    this.inViewSince.clear();
    this.visibleMs.clear();
    this.qualifiedOnce.clear();
    this.deepFired.clear();
  }

  private attachInstrumentation(r: SearchResponse | null): void {
    this.teardownInstrumentation();
    if (!r || r.queryId === 'empty-query') {
      return;
    }
    const root = this.host.nativeElement;
    const nodes = root.querySelectorAll('[data-ste-observe]');
    if (!nodes.length) {
      return;
    }

    this.io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset['steObserve'];
          if (!id) {
            continue;
          }
          const ratio = entry.intersectionRatio;
          this.lastRatio.set(id, ratio);
          if (entry.isIntersecting && ratio >= 0.5) {
            if (!this.inViewSince.has(id)) {
              this.inViewSince.set(id, Date.now());
            }
            if (!this.qualifiedTimers.has(id) && !this.qualifiedOnce.has(id)) {
              const handle = window.setTimeout(() => {
                this.qualifiedTimers.delete(id);
                if ((this.lastRatio.get(id) ?? 0) >= 0.5 && !this.qualifiedOnce.has(id)) {
                  this.qualifiedOnce.add(id);
                  this.qualifiedCardView.emit(id);
                }
              }, 200);
              this.qualifiedTimers.set(id, handle);
            }
          } else {
            this.flushVisibleTime(id);
            const pending = this.qualifiedTimers.get(id);
            if (pending != null) {
              window.clearTimeout(pending);
              this.qualifiedTimers.delete(id);
            }
          }
        }
      },
      { root: null, threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    nodes.forEach((el: Element) => this.io!.observe(el));

    this.tickHandle = window.setInterval(() => this.tickDeepInterest(), 1000);
  }

  private flushVisibleTime(id: string): void {
    const t0 = this.inViewSince.get(id);
    if (t0 == null) {
      return;
    }
    this.visibleMs.set(id, (this.visibleMs.get(id) ?? 0) + (Date.now() - t0));
    this.inViewSince.delete(id);
  }

  private visibleMsWithOpenSegment(id: string): number {
    let ms = this.visibleMs.get(id) ?? 0;
    const t0 = this.inViewSince.get(id);
    if (t0 != null && document.visibilityState === 'visible' && (this.lastRatio.get(id) ?? 0) >= 0.5) {
      ms += Date.now() - t0;
    }
    return ms;
  }

  private tickDeepInterest(): void {
    if (document.visibilityState !== 'visible') {
      return;
    }
    const expanded = this.expandedSpecIds();
    for (const id of expanded) {
      if (this.deepFired.has(id)) {
        continue;
      }
      if ((this.lastRatio.get(id) ?? 0) < 0.5) {
        continue;
      }
      if (this.visibleMsWithOpenSegment(id) >= 120_000) {
        this.deepFired.add(id);
        this.deepCardInterest.emit({ steId: id });
      }
    }
  }
}
