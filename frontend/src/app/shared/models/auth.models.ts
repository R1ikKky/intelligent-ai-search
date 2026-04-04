export interface AuthIdentity {
  readonly customerId: string;
  readonly login: string;
}

export interface UserProfile {
  readonly userId: number;
  readonly customerInn: string;
  readonly login: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly isActive: boolean;
  readonly isStaff: boolean;
  readonly dateJoined: string;
  readonly lastLogin: string | null;
  readonly customerName: string | null;
  readonly customerRegion: string | null;
}

export interface RegisterRequest {
  readonly customerInn: string;
  readonly customerName: string;
  readonly customerRegion: string;
  readonly password: string;
}

export interface LoginRequest {
  readonly customerInn: string;
  readonly password: string;
}

export interface AuthResponse extends AuthIdentity {
  readonly accessToken: string;
}

export interface RefreshResponse {
  readonly accessToken: string;
}
