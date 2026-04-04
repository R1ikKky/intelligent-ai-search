import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-group-list',
  templateUrl: './group-list.component.html',
  styleUrl: './group-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupListComponent {
  readonly items = input<readonly unknown[]>([]);
}
