import { apiFetch } from "./client";

export interface AccessToken {
  id: string;
  name: string;
  token_prefix: string;
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
}

export interface CreatedAccessToken extends AccessToken {
  token: string;
}

export type AccessTokenExpiryDays = 30 | 90 | 365;

export interface CreateAccessTokenBody {
  name: string;
  expires_in_days?: AccessTokenExpiryDays;
}

export const tokensApi = {
  list: () => apiFetch<AccessToken[]>("/access-tokens"),
  create: (body: CreateAccessTokenBody) =>
    apiFetch<CreatedAccessToken>("/access-tokens", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  revoke: (id: string) =>
    apiFetch<void>(`/access-tokens/${id}`, {
      method: "DELETE",
    }),
};
