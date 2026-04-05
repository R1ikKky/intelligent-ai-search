import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';

import { TelemetrySessionService } from '../../../core/services/telemetry-session.service';
import { TelemetryEvent } from '../../../shared/models/telemetry.models';
import { SearchApi, SteProductDetail } from '../data-access/search.api';
import { SearchFacade } from '../data-access/search.facade';

const LONG_ENGAGED_MS = 120_000;

@Component({
  standalone: true,
  selector: 'app-ste-product-page',
  imports: [RouterLink],
  templateUrl: './ste-product-page.component.html',
  styleUrls: ['./ste-product-page.component.css', '../components/results-group-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SteProductPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly searchApi = inject(SearchApi);
  private readonly searchFacade = inject(SearchFacade);
  private readonly telemetrySession = inject(TelemetrySessionService);
  private readonly destroyRef = inject(DestroyRef);

  readonly detail = signal<SteProductDetail | null>(null);
  readonly error = signal<string | null>(null);
  readonly loading = signal(true);

  private readonly steId = this.route.snapshot.paramMap.get('steId') ?? '';

  private pageEnteredAt = Date.now();
  private visibleSegmentStart: number | null = null;
  private activeVisibleMs = 0;
  private longEngageSent = false;
  private readonly boundVis = () => this.onVisibilityChange();

  constructor() {
    this.telemetrySession.ensureSearchSessionId();
    document.addEventListener('visibilitychange', this.boundVis);
    this.onVisibilityChange();

    this.emitTelemetry('ste_page_enter', { steId: this.steId }, this.steId, {});

    const tick = window.setInterval(() => this.checkLongEngage(), 1000);

    this.searchApi
      .getSteById(this.steId)
      .pipe(
        takeUntilDestroyed(),
        catchError((err: unknown) => {
          const status = err instanceof HttpErrorResponse ? err.status : 0;
          this.error.set(status === 404 ? 'СТЕ не найдено.' : 'Не удалось загрузить карточку СТЕ.');
          return of(null);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe((d) => {
        if (d) {
          this.detail.set(d);
        } else if (!this.error()) {
          this.error.set('СТЕ не найдено.');
        }
      });

    this.destroyRef.onDestroy(() => {
      window.clearInterval(tick);
      document.removeEventListener('visibilitychange', this.boundVis);
      this.flushVisibleSegment();
      const dwell = Date.now() - this.pageEnteredAt;
      this.emitTelemetry(
        'ste_page_leave',
        { steId: this.steId, dwellMs: dwell, activeTimeMs: this.activeVisibleMs },
        this.steId,
        { dwellMs: dwell, activeTimeMs: this.activeVisibleMs },
      );
    });
  }

  private onVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      this.visibleSegmentStart = Date.now();
    } else {
      this.flushVisibleSegment();
    }
  }

  private flushVisibleSegment(): void {
    const t0 = this.visibleSegmentStart;
    if (t0 == null) {
      return;
    }
    this.activeVisibleMs += Date.now() - t0;
    this.visibleSegmentStart = null;
  }

  private visibleMsNow(): number {
    let ms = this.activeVisibleMs;
    const t0 = this.visibleSegmentStart;
    if (t0 != null && document.visibilityState === 'visible') {
      ms += Date.now() - t0;
    }
    return ms;
  }

  private checkLongEngage(): void {
    if (this.longEngageSent || !this.steId) {
      return;
    }
    if (document.visibilityState !== 'visible') {
      return;
    }
    if (this.visibleMsNow() >= LONG_ENGAGED_MS) {
      this.longEngageSent = true;
      this.emitTelemetry(
        'ste_product_long_engaged',
        { steId: this.steId, activeTimeMs: this.visibleMsNow() },
        this.steId,
        { activeTimeMs: this.visibleMsNow() },
      );
    }
  }

  private emitTelemetry(
    eventType: string,
    payload: Record<string, unknown>,
    steId?: string,
    timing?: { dwellMs?: number; activeTimeMs?: number },
  ): void {
    const event: TelemetryEvent = {
      eventId: this.generateId(),
      eventType,
      steId,
      eventAt: new Date().toISOString(),
      payload,
      dwellMs: timing?.dwellMs,
      activeTimeMs: timing?.activeTimeMs,
    };
    this.searchFacade.flushTelemetry({
      sessionId: this.telemetrySession.ensureSearchSessionId(),
      events: [event],
    });
  }

  private generateId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
