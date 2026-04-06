import axios from 'axios';

const apiClient = axios.create({ baseURL: '/api' });


export function setAuthToken(token: string | null) {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
  }
}

type SigninSilentFn = () => Promise<{ access_token: string } | null | undefined>;
type SignoutFn = () => Promise<void>;
let _signinSilent: SigninSilentFn | null = null;
let _signout: SignoutFn | null = null;

export function setupAuthHandlers(signinSilent: SigninSilentFn, signout: SignoutFn) {
  _signinSilent = signinSilent;
  _signout = signout;
}

apiClient.interceptors.response.use(
  res => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && _signinSilent) {
      original._retry = true;
      try {
        const user = await _signinSilent();
        if (user?.access_token) {
          setAuthToken(user.access_token);
          original.headers['Authorization'] = `Bearer ${user.access_token}`;
          return apiClient(original);
        }
      } catch {
        await _signout?.();
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export interface Space {
  id: number;
  name: string;
  slug: string;
  description: string;
  ownerId: string;
  visibility: 'Public' | 'Private';
  createdAt: string;
}

export interface Resource {
  id: number;
  spaceId: number;
  name: string;
  description: string;
  resourceType: string;
  slotDurationMinutes: number;
  maxAdvanceDays: number;
  isActive: boolean;
}

export interface Booking {
  id: number;
  resourceId: number;
  spaceId: number;
  userId: string;
  userName: string;
  userFirstName: string;
  userLastName: string;
  userPhone: string;
  date: string;
  startTime: string;
  endTime: string;
  createdAt: string;
  resourceName: string;
  resourceType: string;
  spaceName: string;
  spaceSlug: string;
}

export interface ResourceBooking {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  userId: string;
  userName: string;
  userFirstName: string;
  userLastName: string;
  userPhone: string;
}

export interface CreateBookingRequest {
  resourceId: number;
  date: string;
  startTime: string;
}

export interface UserProfile {
  firstName?: string;
  lastName?: string;
  email?: string;
  attributes?: Record<string, string[]>;
}

export interface AdminUser {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  roles: string[];
}

export interface AdminCreateUserRequest {
  firstName?: string;
  lastName?: string;
  email: string;
  phoneNumber?: string;
  temporaryPassword: string;
  roles: string[];
}

export interface AdminUpdateUserRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  roles: string[];
}

export interface Member {
  userId: string;
  role: 'Member' | 'Admin';
  joinedAt: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface AddMemberRequest {
  userId?: string;
  email?: string;
  role?: 'Member' | 'Admin';
  firstName?: string;
  lastName?: string;
  create?: boolean;
}

export interface UserSearchResult {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export const spacesApi = {
  getAll: () => apiClient.get<Space[]>('/spaces').then(r => r.data),
  getById: (idOrSlug: string | number) => apiClient.get<Space>(`/spaces/${idOrSlug}`).then(r => r.data),
  create: (req: { name: string; slug: string; description?: string }) =>
    apiClient.post<Space>('/spaces', req).then(r => r.data),
  update: (id: number, req: { name?: string; description?: string }) =>
    apiClient.put<Space>(`/spaces/${id}`, req).then(r => r.data),
  delete: (id: number) => apiClient.delete(`/spaces/${id}`),
};

export const membersApi = {
  getAll: (spaceId: number) => apiClient.get<Member[]>(`/spaces/${spaceId}/members`).then(r => r.data),
  searchByEmail: (spaceId: number, email: string) =>
    apiClient.get<UserSearchResult>(`/spaces/${spaceId}/members/search`, { params: { email } }).then(r => r.data),
  add: (spaceId: number, req: AddMemberRequest) =>
    apiClient.post<Member>(`/spaces/${spaceId}/members`, req).then(r => r.data),
  remove: (spaceId: number, userId: string) =>
    apiClient.delete(`/spaces/${spaceId}/members/${userId}`),
  join: (spaceId: number) =>
    apiClient.post<Member>(`/spaces/${spaceId}/join`).then(r => r.data),
  leave: (spaceId: number) =>
    apiClient.delete(`/spaces/${spaceId}/leave`),
};

export const resourcesApi = {
  getAll: (spaceId: number) =>
    apiClient.get<Resource[]>(`/spaces/${spaceId}/resources`).then(r => r.data),
  getById: (spaceId: number, resourceId: number) =>
    apiClient.get<Resource>(`/spaces/${spaceId}/resources/${resourceId}`).then(r => r.data),
  create: (spaceId: number, req: { name: string; description?: string; resourceType: string; slotDurationMinutes: number; maxAdvanceDays: number }) =>
    apiClient.post<Resource>(`/spaces/${spaceId}/resources`, req).then(r => r.data),
  update: (spaceId: number, resourceId: number, req: Partial<Resource>) =>
    apiClient.put<Resource>(`/spaces/${spaceId}/resources/${resourceId}`, req).then(r => r.data),
  delete: (spaceId: number, resourceId: number) =>
    apiClient.delete(`/spaces/${spaceId}/resources/${resourceId}`),
  getBookings: (spaceId: number, resourceId: number, from: string, to: string) =>
    apiClient.get<ResourceBooking[]>(`/spaces/${spaceId}/resources/${resourceId}/bookings`, { params: { from, to } }).then(r => r.data),
};

export const bookingsApi = {
  getMine: () => apiClient.get<Booking[]>('/bookings').then(r => r.data),
  create: (req: CreateBookingRequest) => apiClient.post<Booking>('/bookings', req).then(r => r.data),
  cancel: (id: number) => apiClient.delete(`/bookings/${id}`),
};

export const profileApi = {
  get: () => apiClient.get<UserProfile>('/profile').then(r => r.data),
  update: (profile: UserProfile) => apiClient.post<void>('/profile', profile),
};

export const adminApi = {
  getUsers: () => apiClient.get<AdminUser[]>('/admin/users').then(r => r.data),
  createUser: (req: AdminCreateUserRequest) => apiClient.post<{ id: string }>('/admin/users', req).then(r => r.data),
  updateUser: (id: string, req: AdminUpdateUserRequest) => apiClient.put<void>(`/admin/users/${id}`, req),
};

export function getUserRoles(accessToken: string | undefined): string[] {
  if (!accessToken) return [];
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1]));
    return (payload?.realm_access?.roles as string[]) ?? [];
  } catch {
    return [];
  }
}

export interface PasskeyCredential {
  id: string;
  type: string;
  userLabel: string;
  createdDate: number;
}

export interface Invitation {
  id: string;
  email: string;
  role: string;
  token: string;
  status: 'Pending' | 'Accepted' | 'Expired' | 'Revoked';
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
  acceptedByUserId?: string;
}

export interface InviteDetails {
  id: string;
  email: string;
  role: string;
  status: 'Pending' | 'Accepted' | 'Expired' | 'Revoked';
  expiresAt: string;
  spaceName: string;
  spaceSlug: string;
}

export const keycloakAccountApi = {
  async listPasskeys(): Promise<PasskeyCredential[]> {
    return apiClient.get<PasskeyCredential[]>('/profile/passkeys').then(r => r.data);
  },

  async deletePasskey(id: string): Promise<void> {
    await apiClient.delete(`/profile/passkeys/${id}`);
  },
};

export const invitationsApi = {
  create: (slug: string, emails: string[], role?: string) =>
    apiClient.post<Invitation[]>(`/spaces/${slug}/invitations`, { emails, role }).then(r => r.data),
  getAll: (slug: string) =>
    apiClient.get<Invitation[]>(`/spaces/${slug}/invitations`).then(r => r.data),
  revoke: (slug: string, invitationId: string) =>
    apiClient.delete(`/spaces/${slug}/invitations/${invitationId}`),
  getDetails: (token: string) =>
    apiClient.get<InviteDetails>(`/invitations/${token}`).then(r => r.data),
  accept: (token: string) =>
    apiClient.post<{ spaceName: string; spaceSlug: string }>(`/invitations/${token}/accept`).then(r => r.data),
};
