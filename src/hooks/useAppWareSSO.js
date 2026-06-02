import { useEffect } from 'react';
import { supabase } from '../supabaseClient';

const AUTH_PORTAL_URL = 'https://authappware.netlify.app';

export function useAppWareSSO() {
  useEffect(() => {
    const ingestIncomingSession = async () => {
      // Check hash first (implicit flow), then query params (PKCE / manual redirect)
      const hashStr = window.location.hash.substring(1);
      const queryStr = window.location.search.substring(1);
      const source = hashStr.includes('access_token=') ? hashStr : queryStr;
      const params = new URLSearchParams(source);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (!accessToken || !refreshToken) return;

      try {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) throw error;
      } catch (err) {
        console.error('AppWare SSO error:', err.message);
        alert('Could not sign in with AppWare. Please try again or use email/password.');
      } finally {
        // Always clean tokens from the address bar regardless of outcome
        window.history.replaceState(null, '', window.location.pathname);
      }
    };

    ingestIncomingSession();
  }, []);

  const triggerAppWareRedirect = () => {
    const callbackOrigin = import.meta.env.VITE_APP_URL || window.location.origin;
    window.location.href = `${AUTH_PORTAL_URL}?redirect_to=${encodeURIComponent(callbackOrigin)}`;
  };

  return { triggerAppWareRedirect };
}
