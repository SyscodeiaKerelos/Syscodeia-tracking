import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface UserContext {
  id: number;
  departmentId: number;
  userType: number;
  name: string;
  username: string;
  nickName: string;
  headImg: string;
  email: string;
  phone: string;
  status: number;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly USER_KEY = 'traxbean_user';
  private userSubject = new BehaviorSubject<UserContext | null>(this.getStoredUser());
  public user$ = this.userSubject.asObservable();

  constructor() {}

  setUser(user: UserContext): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this.userSubject.next(user);
  }

  getUser(): UserContext | null {
    return this.userSubject.value;
  }

  getUserId(): string | null {
    const user = this.getUser();    
    return user ? user.id.toString() : null;
  }

  getUserIdAsNumber(): number | null {
    const user = this.getUser();
    return user ? user.id : null;
  }

  clearUser(): void {
    localStorage.removeItem(this.USER_KEY);
    this.userSubject.next(null);
  }

  private getStoredUser(): UserContext | null {
    try {
      const stored = localStorage.getItem(this.USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Failed to parse stored user:', error);
      return null;
    }
  }
} 