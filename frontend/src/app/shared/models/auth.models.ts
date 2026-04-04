export interface AuthIdentity {
  readonly customerId: string;
  readonly customerDataId: string;
  readonly login: string;
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
