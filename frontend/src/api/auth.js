import { request } from './client.js';

export const login = (email, password) =>
  request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
export const register = payload =>
  request('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
export const getCurrentUser = () => request('/auth/me');
export const getMyRegistrations = () => request('/auth/me/registrations');
export const getDepartments = () => request('/api/departments');
