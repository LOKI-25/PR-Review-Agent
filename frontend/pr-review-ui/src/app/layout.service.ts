import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly mobileMenuOpen = new BehaviorSubject(false);
  readonly mobileMenuOpen$ = this.mobileMenuOpen.asObservable();

  openMobileMenu(): void {
    this.mobileMenuOpen.next(true);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.next(false);
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.next(!this.mobileMenuOpen.value);
  }
}
