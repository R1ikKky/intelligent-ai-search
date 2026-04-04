import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthFacade } from '../../features/auth/data-access/auth.facade';

@Component({
  standalone: true,
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
  private readonly authFacade = inject(AuthFacade);

  logout(): void {
    this.authFacade.logout();
  }
}
