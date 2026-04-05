import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-section-card',
  template: `
    <section>
      <header class="card__header">
        <p class="card__eyebrow">{{ eyebrow() }}</p>
        <h2>{{ title() }}</h2>
      </header>
      <ng-content />
    </section>
  `,
  styleUrl: './section-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SectionCardComponent {
  readonly title = input.required<string>();
  readonly eyebrow = input<string>('');
}