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

  if (Platform.OS === 'web') {
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        console.log('[CallPermissions Web] Checking browser media permissions for:', callType);
        let stream: any = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: callType === 'video',
          });
        } catch (firstErr: any) {
          console.warn(
            '[CallPermissions Web] Video+Audio permission prompt not granted, trying audio-only fallback:',
            firstErr?.name || firstErr
          );
          // If video failed (e.g. system denied camera or no camera connected), fall back to audio
          if (callType === 'video') {
            try {
              stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false,
              });
            } catch (audioErr: any) {
              console.warn('[CallPermissions Web] Audio-only fallback error:', audioErr?.name || audioErr);
            }
          }
        }

        if (stream) {
          stream.getTracks().forEach((track: any) => {
            try {
              track.stop();
            } catch (_) {}
          });
        }
        // Always return true on web so pre-flight check doesn't reject incoming or outgoing calls.
        // CometChat's in-call WebRTC engine manages in-session device permissions.
        return true;
      }
      return true;
    } catch (err: any) {
      console.warn('[CallPermissions Web] Error during permission check:', err);
      return true;
    }
  }


  // iOS permissions are handled via Info.plist and system prompts
  return true;
}
