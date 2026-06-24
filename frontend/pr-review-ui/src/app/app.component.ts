import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ExecutionsSidebarComponent } from './executions-sidebar.component';
import { LayoutService } from './layout.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, ExecutionsSidebarComponent],
  template: `
    <div class="app-layout">
      <header class="mobile-header">
        <button
          type="button"
          class="menu-btn"
          (click)="layout.toggleMobileMenu()"
          aria-label="Toggle executions menu"
        >
          <span class="menu-icon" aria-hidden="true"></span>
          <span>Runs</span>
        </button>
        <a routerLink="/submit" class="mobile-brand" (click)="layout.closeMobileMenu()">
          AI PR Review
        </a>
        <a routerLink="/submit" class="mobile-new" (click)="layout.closeMobileMenu()">+ New</a>
      </header>

      <div
        class="backdrop"
        *ngIf="menuOpen"
        (click)="layout.closeMobileMenu()"
        aria-hidden="true"
      ></div>

      <app-executions-sidebar [class.open]="menuOpen" />
      <main class="main-content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .app-layout {
      display: flex;
      min-height: 100vh;
      min-height: 100dvh;
      position: relative;
    }
    .main-content {
      flex: 1;
      min-width: 0;
      overflow-y: auto;
      background: var(--bg);
    }
    .mobile-header {
      display: none;
    }
    .backdrop {
      display: none;
    }

    @media (max-width: 768px) {
      .app-layout {
        flex-direction: column;
      }
      .mobile-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem 1rem;
        background: #fff;
        border-bottom: 1px solid #e2e8f0;
        position: sticky;
        top: 0;
        z-index: 30;
      }
      .menu-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0.45rem 0.7rem;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        background: #f8fafc;
        color: #0f172a;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
      }
      .menu-icon {
        width: 14px;
        height: 2px;
        background: currentColor;
        border-radius: 1px;
        box-shadow: 0 -5px 0 currentColor, 0 5px 0 currentColor;
      }
      .mobile-brand {
        flex: 1;
        font-weight: 700;
        font-size: 0.95rem;
        color: #0f172a;
        text-decoration: none;
      }
      .mobile-new {
        font-size: 0.8rem;
        padding: 0.35rem 0.65rem;
        background: #0f172a;
        color: #fff;
        text-decoration: none;
        border-radius: 6px;
        font-weight: 600;
      }
      .backdrop {
        display: block;
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.45);
        z-index: 40;
      }
    }
  `],
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'AI PR Review';
  menuOpen = false;
  private sub: Subscription | null = null;

  constructor(readonly layout: LayoutService) {}

  ngOnInit() {
    this.sub = this.layout.mobileMenuOpen$.subscribe((open) => {
      this.menuOpen = open;
      document.body.style.overflow = open ? 'hidden' : '';
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    document.body.style.overflow = '';
  }
}
