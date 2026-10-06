/** IDs são validados no servidor contra business_members; nunca autorizam acesso sozinhos. */
export type BusinessId = string & { readonly __brand: 'BusinessId' };
export type BusinessRole = 'owner' | 'member';
export interface BusinessContext { businessId: BusinessId; userId: string; role: BusinessRole }
