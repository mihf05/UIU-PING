import axios, { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { StorageService } from '../services/storage';

export const BASE_URL = 'https://ucam.uiu.ac.bd/';

export const client = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  withCredentials: true,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive',
  },
});

// Helper to merge cookies securely
export function mergeCookies(oldCookieStr: string | null, setCookieHeader: string | string[] | undefined): string {
  if (!setCookieHeader) return oldCookieStr || '';
  const headers = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  
  const cookieMap = new Map<string, string>();
  
  // 1. Parse old cookies
  if (oldCookieStr) {
    oldCookieStr.split(';').forEach(cookie => {
      const parts = cookie.trim().split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        if (key) cookieMap.set(key, value);
      }
    });
  }
  
  // 2. Parse new set-cookie headers
  for (const header of headers) {
    // A Set-Cookie header typically has: "cookieName=value; path=/; ..."
    // The first segment contains the cookie key-value pair.
    const firstPart = header.split(';')[0];
    const parts = firstPart.trim().split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join('=').trim();
      const lowerKey = key.toLowerCase();
      // Filter out cookies directives
      if (!['path', 'domain', 'expires', 'secure', 'httponly', 'samesite'].includes(lowerKey)) {
        if (value && value !== 'deleted' && value !== 'EXPIRED') {
          cookieMap.set(key, value);
        } else {
          cookieMap.delete(key);
        }
      }
    }
  }
  
  // 3. Rebuild the cookie string
  const merged: string[] = [];
  cookieMap.forEach((value, key) => {
    merged.push(`${key}=${value}`);
  });
  
  return merged.join('; ');
}

// Request Interceptor: Inject cookies from SecureStore
client.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // We let the native network manager (OkHttp/NSURLSession) handle and inject
    // session cookies automatically to ensure intermediate HttpOnly redirect cookies
    // (such as .ASPXAUTH) are correctly transmitted without being stripped.
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Capture Set-Cookie headers
client.interceptors.response.use(
  async (response: AxiosResponse) => {
    try {
      // Axios headers are lowercase. We check for 'set-cookie'
      const setCookieHeader = response.headers['set-cookie'];
      if (setCookieHeader) {
        console.log('[AxiosClient] Capture raw Set-Cookie headers:', setCookieHeader);
        const oldCookie = await StorageService.getCookie();
        const mergedCookie = mergeCookies(oldCookie, setCookieHeader);
        if (mergedCookie && mergedCookie !== oldCookie) {
          await StorageService.saveCookie(mergedCookie);
          await StorageService.addScraperLog('info', `Session cookies updated. Current cookie count: ${mergedCookie.split(';').length}`);
        }
      }
    } catch (e) {
      console.error('[AxiosClient] Error saving set-cookie:', e);
    }
    return response;
  },
  async (error) => {
    // If the error response has a Set-Cookie, save it anyway (e.g. 302 redirects or 401s)
    if (error.response && error.response.headers) {
      const setCookieHeader = error.response.headers['set-cookie'];
      if (setCookieHeader) {
        try {
          const oldCookie = await StorageService.getCookie();
          const mergedCookie = mergeCookies(oldCookie, setCookieHeader);
          if (mergedCookie && mergedCookie !== oldCookie) {
            await StorageService.saveCookie(mergedCookie);
          }
        } catch (e) {
          console.error('[AxiosClient] Error capturing Set-Cookie on error response:', e);
        }
      }
    }
    return Promise.reject(error);
  }
);
