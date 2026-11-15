export interface AdminCallerContext {
  type: 'admin';
  username: string;
}

export interface ClientCallerContext {
  type: 'client';
  clientId: string;
  slug: string;
  name: string;
  scopes: string[];
}

export type MediaCallerContext = AdminCallerContext | ClientCallerContext;
