import { PermissionsAndroid, Platform } from 'react-native';

/**
 * Request runtime permissions on Android for Camera and Microphone.
 * WebRTC requires both permissions to capture audio and video hardware.
 */
export async function requestCallPermissions(callType: 'audio' | 'video' = 'video'): Promise<boolean> {
  if (Platform.OS === 'android') {
    try {
      const permissionsToRequest: any[] = [
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        PermissionsAndroid.PERMISSIONS.CAMERA,
      ];

      // If Android 12+ (API 31+), include Bluetooth Connect permission for headsets
      if (Platform.Version >= 31 && PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT) {
        permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
      }

      console.log('[CallPermissions] Requesting permissions for call type:', callType);
      const results = await PermissionsAndroid.requestMultiple(permissionsToRequest);

      const audioGranted =
        results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
      const cameraGranted =
        results[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED;

      console.log('[CallPermissions] Results - Audio:', audioGranted, 'Camera:', cameraGranted);

      if (callType === 'audio') {
        return audioGranted;
      }

      return audioGranted && cameraGranted;
    } catch (err) {
      console.warn('[CallPermissions] Error requesting permissions:', err);
      return false;
    }
  }

  // iOS permissions are handled via Info.plist and system prompts
  return true;
}
