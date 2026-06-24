import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ExecutionsSidebarComponent } from './executions-sidebar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ExecutionsSidebarComponent],
  template: `
    <div class="app-layout">
      <app-executions-sidebar />
      <main class="main-content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .app-layout {
      display: flex;
      min-height: 100vh;
    }
    .main-content {
      flex: 1;
      overflow-y: auto;
      background: var(--bg);
    }
  `],
})
export class AppComponent {
  title = 'AI PR Review';
}
