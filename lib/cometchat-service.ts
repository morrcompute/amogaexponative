import { Platform } from 'react-native';

// CometChat Calls configuration from environment variables
export const COMETCHAT_CONFIG = {
  appId: process.env.EXPO_PUBLIC_COMETCHAT_APP_ID || '',
  region: process.env.EXPO_PUBLIC_COMETCHAT_REGION || 'us',
  authKey: process.env.EXPO_PUBLIC_COMETCHAT_AUTH_KEY || '',
};

let CometChatCallsSDK: any = null;

// Dynamically and safely load @cometchat/calls-sdk-react-native only on native platforms
if (Platform.OS !== 'web') {
  try {
    const pkg = require('@cometchat/calls-sdk-react-native');
    CometChatCallsSDK = pkg.CometChatCalls || pkg.default || pkg;
  } catch (err) {
    console.warn('[CometChat] Failed to load native calling SDK. Ensure you are using an Expo Development Build (WebRTC native modules are not available in Expo Go).', err);
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
   * Initialize the CometChat Calls SDK with App Credentials
   */
  public async init(): Promise<CometChatInitResult> {
    if (!this.isSupported()) {
      return { success: false, error: 'CometChat Calls SDK is only available in native development builds.' };
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
        console.log('[CometChat] SDK initialized successfully');
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
   * Authenticate a user into CometChat Calls
   */
  public async login(uid: string, authKey?: string): Promise<{ success: boolean; user?: CometChatUser; error?: any }> {
    if (!this.isSupported()) {
      return { success: false, error: 'Calling SDK not loaded' };
    }

    const effectiveAuthKey = authKey || COMETCHAT_CONFIG.authKey;

    try {
      // If already logged in as this user, return existing user
      if (this.currentLoggedInUid === uid && CometChatCallsSDK.isUserLoggedIn && CometChatCallsSDK.isUserLoggedIn()) {
        const user = CometChatCallsSDK.getLoggedInUser();
        return { success: true, user: user || { uid } };
      }

      let user: any;
      if (effectiveAuthKey) {
        user = await CometChatCallsSDK.login(uid, effectiveAuthKey);
      } else {
        user = await CometChatCallsSDK.login(uid);
      }

      this.currentLoggedInUid = uid;
      console.log('[CometChat] Logged in successfully:', uid);
      return { success: true, user };
    } catch (error) {
      console.error('[CometChat] Login failed:', error);
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
  public async generateToken(sessionId: string): Promise<{ success: boolean; token?: string; error?: any }> {
    if (!this.isSupported()) {
      return { success: false, error: 'Calling SDK not loaded on this platform.' };
    }

    try {
      const response = await CometChatCallsSDK.generateToken(sessionId);
      if (response && response.token) {
        return { success: true, token: response.token };
      }
      return { success: false, error: 'No token received from CometChat.' };
    } catch (error) {
      console.error('[CometChat] Failed to generate call token:', error);
      return { success: false, error };
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
