import { parse } from 'node-html-parser';
import { BASE_URL } from '../api/client';
import { StorageService } from './storage';

export const AuthService = {
  /**
   * Fetches the login page and parses ASP.NET hidden fields using native fetch
   */
  async getLoginTokens(): Promise<{
    viewState: string;
    viewStateGenerator: string;
    previousPage: string;
  }> {
    try {
      console.log('[AuthService] Fetching login page to extract tokens...');
      // Using native fetch to bypass Axios interceptors/headers configurations
      const response = await fetch(BASE_URL + 'Security/LogIn.aspx');
      const html = await response.text();
      const root = parse(html);

      const viewState = root.querySelector('#__VIEWSTATE')?.getAttribute('value') || '';
      const viewStateGenerator = root.querySelector('#__VIEWSTATEGENERATOR')?.getAttribute('value') || '';
      const previousPage = root.querySelector('#__PREVIOUSPAGE')?.getAttribute('value') || '';

      console.log('[AuthService] Extracted ASP.NET tokens:', {
        viewState: viewState ? `${viewState.substring(0, 15)}...` : 'empty',
        viewStateGenerator,
        previousPage: previousPage ? `${previousPage.substring(0, 15)}...` : 'empty',
      });

      return {
        viewState,
        viewStateGenerator,
        previousPage,
      };
    } catch (error) {
      console.error('[AuthService] Error fetching login tokens:', error);
      throw new Error('Failed to reach UCAM portal. Please check your internet connection.');
    }
  },

  /**
   * Logs into UCAM using native fetch. Native redirects automatically update the system cookie jar.
   */
  async login(studentId: string, password: string): Promise<boolean> {
    try {
      await StorageService.addScraperLog('info', `Attempting login for Student ID: ${studentId}`);
      
      // 1. Get ASP.NET form state tokens
      const tokens = await this.getLoginTokens();

      // 2. Prepare Form Body
      const formData = new URLSearchParams();
      formData.append('__VIEWSTATE', tokens.viewState);
      formData.append('__VIEWSTATEGENERATOR', tokens.viewStateGenerator);
      formData.append('__PREVIOUSPAGE', tokens.previousPage);
      formData.append('__VIEWSTATEENCRYPTED', '');
      formData.append('logMain$UserName', studentId);
      formData.append('logMain$Password', password);
      formData.append('logMain$Button1', 'LOG IN');

      console.log('[AuthService] Posting login credentials via native fetch...');
      
      // 3. Send POST Login Request via native fetch to allow smooth OkHttp redirect handling
      const response = await fetch(BASE_URL + 'Security/LogIn.aspx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      // 4. Validate successful login
      const responseHtml = await response.text();
      const root = parse(responseHtml);
      
      const hasLoginUsernameInput = root.querySelector('#logMain_UserName') !== null;
      
      if (hasLoginUsernameInput) {
        let errorMessage = 'Invalid Student ID or Password.';
        const errorEl = root.querySelector('.alert-danger, .validation-summary-errors, #logMain_FailureText');
        const errorText = errorEl ? errorEl.text.trim() : '';
        if (errorText) {
          errorMessage = errorText;
        }
        
        console.warn('[AuthService] Login failed:', errorMessage);
        await StorageService.addScraperLog('warning', `Login failed: ${errorMessage}`);
        return false;
      }

      // Save credentials for auto-relogin in background tasks
      await StorageService.saveCredentials(studentId, password);
      await StorageService.addScraperLog('success', 'Logged in successfully!');
      
      return true;
    } catch (error: any) {
      console.error('[AuthService] Login execution error:', error);
      await StorageService.addScraperLog('error', `Login system error: ${error.message || error}`);
      throw error;
    }
  },

  /**
   * Checks if current session cookies are still valid by requesting a secure page
   */
  async checkSessionValidity(): Promise<boolean> {
    try {
      console.log('[AuthService] Checking if current session is valid...');
      
      // Request Default page via native fetch
      const response = await fetch(BASE_URL + 'Default.aspx');
      const html = await response.text();
      
      const root = parse(html);
      const isLoginPage = root.querySelector('#logMain_UserName') !== null;
      
      if (isLoginPage) {
        console.log('[AuthService] Session cookie expired or invalid.');
        return false;
      }
      
      console.log('[AuthService] Session cookie is valid.');
      return true;
    } catch (error) {
      console.warn('[AuthService] Session check failed, treating as invalid:', error);
      return false;
    }
  },

  /**
   * Attempts auto-login using saved credentials if current session is expired
   */
  async ensureAuthenticated(): Promise<boolean> {
    const isValid = await this.checkSessionValidity();
    if (isValid) {
      return true;
    }

    console.log('[AuthService] Session invalid. Attempting auto-relogin...');
    const credentials = await StorageService.getCredentials();
    if (!credentials) {
      console.warn('[AuthService] Auto-login aborted: No credentials stored.');
      await StorageService.addScraperLog('warning', 'Auto-login aborted: No saved credentials.');
      return false;
    }

    try {
      const loginSuccess = await this.login(credentials.studentId, credentials.password);
      if (loginSuccess) {
        await StorageService.addScraperLog('info', 'Auto-login succeeded.');
        return true;
      }
      return false;
    } catch (error) {
      console.error('[AuthService] Auto-login failed with error:', error);
      return false;
    }
  }
};
