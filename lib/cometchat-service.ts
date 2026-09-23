import { Platform } from 'react-native';

// CometChat Calls configuration from environment variables
export const COMETCHAT_CONFIG = {
  appId: process.env.EXPO_PUBLIC_COMETCHAT_APP_ID || '',
  region: process.env.EXPO_PUBLIC_COMETCHAT_REGION || 'in',
  authKey: process.env.EXPO_PUBLIC_COMETCHAT_AUTH_KEY || '',
  restApiKey: process.env.EXPO_PUBLIC_COMETCHAT_REST_API_KEY || process.env.COMETCHAT_REST_API_KEY || '',
  apiUrl: process.env.EXPO_PUBLIC_API_URL || '',
};

let CometChatCallsSDK: any = null;

// Dynamically and safely load @cometchat/calls-sdk-react-native only on native platforms
if (Platform.OS !== 'web') {
  try {
    const pkg = require('@cometchat/calls-sdk-react-native');
    CometChatCallsSDK = pkg.CometChatCalls || pkg.default || pkg;
  } catch (err) {
    console.warn(
      '[CometChat] Failed to load native calling SDK. Ensure you are using an Expo Development Build (WebRTC native modules are not available in Expo Go).',
      err
    );
  }
}

export interface CometChatInitResult {
  success: boolean;
  error?: any;
}

export interface CometChatUser {
  uid: string;
  name?: string;
  avatar?: string;
  [key: string]: any;
}

class CometChatService {
  private isInitialized = false;
  private currentLoggedInUid: string | null = null;

  public isSupported(): boolean {
    return Boolean(CometChatCallsSDK);
  }

  public getSDK(): any {
    return CometChatCallsSDK;
  }

  /**
   * Auto-provision or register user on CometChat via REST API / serverless endpoint
   */
  public async syncUser(
    uid: string,
    name?: string,
    avatar?: string
  ): Promise<{ success: boolean; error?: string }> {
    const { appId, region, restApiKey, apiUrl, authKey } = COMETCHAT_CONFIG;
    const effectiveKey = restApiKey || authKey;

    if (!appId || !uid) {
      return { success: false, error: 'App ID and UID are required to sync user.' };
    }

    // 1. First try backend serverless sync route if apiUrl is available
    if (apiUrl) {
      try {
        const res = await fetch(`${apiUrl}/api/cometchat/sync-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid, name, avatar }),
        });
        const json = await res.json();
        if (json.success) {
          console.log('[CometChat] User synced successfully via API route:', uid);
          return { success: true };
        }
      } catch (err) {
        console.warn('[CometChat] Backend sync route unreachable, attempting direct sync:', err);
      }
    }

    // 2. Direct REST API call if key is available
    if (effectiveKey) {
      try {
        const url = `https://${appId}.api-${region.toLowerCase()}.cometchat.io/v3/users`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            apiKey: effectiveKey,
            appId: appId,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            uid: uid,
            name: name || `User ${uid.slice(0, 6)}`,
            avatar: avatar || undefined,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (res.ok || data?.error?.code === 'ERR_UID_ALREADY_EXISTS') {
          console.log('[CometChat] User provisioned/verified directly:', uid);
          return { success: true };
        }
      } catch (err) {
        console.warn('[CometChat] Direct user provisioning failed:', err);
      }
    }

    return { success: false, error: 'User could not be provisioned automatically.' };
  }

  /**
   * Initialize the CometChat Calls SDK with App Credentials
   */
  public async init(): Promise<CometChatInitResult> {
    if (!this.isSupported()) {
      return {
        success: false,
        error: 'CometChat Calls SDK is only available in native development builds.',
      };
    }

    if (this.isInitialized) {
      return { success: true };
    }

    const { appId, region, authKey } = COMETCHAT_CONFIG;
    if (!appId || !region) {
      console.warn('[CometChat] Missing EXPO_PUBLIC_COMETCHAT_APP_ID or EXPO_PUBLIC_COMETCHAT_REGION');
      return { success: false, error: 'CometChat App ID and Region are required.' };
    }

    try {
      const callAppSettings: any = { appId, region };
      if (authKey) {
        callAppSettings.authKey = authKey;
      }

      const result = await CometChatCallsSDK.init(callAppSettings);
      if (result && result.success !== false) {
        this.isInitialized = true;
        console.log('[CometChat] Calls SDK initialized successfully');
        return { success: true };
      } else {
        console.error('[CometChat] Initialization error:', result?.error);
        return { success: false, error: result?.error };
      }
    } catch (error) {
      console.error('[CometChat] Exception during init:', error);
      return { success: false, error };
    }
  }

  /**
   * Authenticate a user into CometChat Calls with auto-provision fallback
   */
  public async login(
    uid: string,
    authKey?: string,
    userDetails?: { name?: string; avatar?: string }
  ): Promise<{ success: boolean; user?: CometChatUser; error?: any }> {
    if (!this.isSupported()) {
      return { success: false, error: 'Calling SDK not loaded' };
    }

    const effectiveAuthKey = authKey || COMETCHAT_CONFIG.authKey;

    try {
      // If already logged in as this user, return existing user
      if (
        this.currentLoggedInUid === uid &&
        CometChatCallsSDK.isUserLoggedIn &&
        CometChatCallsSDK.isUserLoggedIn()
      ) {
        const user = CometChatCallsSDK.getLoggedInUser();
        return { success: true, user: user || { uid } };
      }

      let user: any;
      try {
        if (effectiveAuthKey) {
          user = await CometChatCallsSDK.login(uid, effectiveAuthKey);
        } else {
          user = await CometChatCallsSDK.login(uid);
        }
      } catch (loginErr: any) {
        // If user does not exist in CometChat, try provisioning them and retrying login
        const isNotFound =
          loginErr?.errorCode === 'ERR_UID_NOT_FOUND' ||
          loginErr?.code === 'ERR_UID_NOT_FOUND' ||
          loginErr?.message?.includes('not exist');

        if (isNotFound) {
          console.log('[CometChat] UID not found, attempting auto-provisioning for:', uid);
          await this.syncUser(uid, userDetails?.name, userDetails?.avatar);
          if (effectiveAuthKey) {
            user = await CometChatCallsSDK.login(uid, effectiveAuthKey);
          } else {
            user = await CometChatCallsSDK.login(uid);
          }
        } else {
          throw loginErr;
        }
      }

      this.currentLoggedInUid = uid;
      console.log('[CometChat] Logged in successfully:', uid);
      return { success: true, user };
    } catch (error: any) {
      console.error('[CometChat] Login failed:', error?.message || error);
      return { success: false, error };
    }
  }

  /**
   * Log out the current user
   */
  public async logout(): Promise<void> {
    if (!this.isSupported()) return;
    try {
      await CometChatCallsSDK.logout();
      this.currentLoggedInUid = null;
    } catch (error) {
      console.warn('[CometChat] Logout error:', error);
    }
  }

  /**
   * Generate token for a call session
   */
  public async generateToken(
    sessionId: string
  ): Promise<{ success: boolean; token?: string; error?: any }> {
    if (!this.isSupported()) {
      return { success: false, error: 'Calling SDK not loaded on this platform.' };
    }

    try {
      console.log('[CometChat] Generating call token for session:', sessionId);
      const response = await CometChatCallsSDK.generateToken(sessionId);
      if (response && response.token) {
        console.log('[CometChat] Generated call token successfully');
        return { success: true, token: response.token };
      }
      return { success: false, error: 'No token received from CometChat.' };
    } catch (error: any) {
      console.error('[CometChat] Failed to generate call token:', error?.message || error);
      return { success: false, error: error?.message || error };
    }
  }

  /**
   * Leave the active call session
   */
  public leaveSession(): void {
    if (!this.isSupported()) return;
    try {
      CometChatCallsSDK.leaveSession();
    } catch (error) {
      console.warn('[CometChat] Error leaving session:', error);
    }
  }

  /**
   * Add a call event listener with optional AbortSignal
   */
  public addEventListener(
    eventType: string,
    listener: (data?: any) => void,
    options?: { signal?: AbortSignal }
  ): () => void {
    if (!this.isSupported() || !CometChatCallsSDK.addEventListener) {
      return () => {};
    }
    return CometChatCallsSDK.addEventListener(eventType, listener, options);
  }
}

export const cometchatService = new CometChatService();
