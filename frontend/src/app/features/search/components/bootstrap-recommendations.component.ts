import { ChangeDetectionStrategy, Component } from '@angular/core';

import { SectionCardComponent } from '../../../shared/ui/section-card/section-card.component';

@Component({
  standalone: true,
  selector: 'app-bootstrap-recommendations',
  imports: [SectionCardComponent],
  templateUrl: './bootstrap-recommendations.component.html',
  styleUrl: './bootstrap-recommendations.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BootstrapRecommendationsComponent {}
