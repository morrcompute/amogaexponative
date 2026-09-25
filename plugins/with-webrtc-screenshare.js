const { withAndroidManifest, withMainActivity, createRunOncePlugin } = require('@expo/config-plugins');

/**
 * Expo Config Plugin to configure Android for WebRTC Screen Sharing & Background Call Persistence
 * (Similar to WhatsApp, Zoom, Google Meet):
 * 1. Configures MediaProjectionService with android:foregroundServiceType="mediaProjection"
 * 2. Enables supportsPictureInPicture on MainActivity so app stays alive when navigating away
 * 3. Injects WebRTCModuleOptions.getInstance().enableMediaProjectionService = true into MainActivity
 */
function withWebRTCScreenShare(config) {
  // 1. AndroidManifest modifications
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const mainApplication = manifest.application[0];

    // Ensure permissions exist in manifest
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }

    const requiredPermissions = [
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION',
      'android.permission.FOREGROUND_SERVICE_MICROPHONE',
      'android.permission.FOREGROUND_SERVICE_CAMERA',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.WAKE_LOCK',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ];

    requiredPermissions.forEach((perm) => {
      const exists = manifest['uses-permission'].some(
        (p) => p.$ && p.$['android:name'] === perm
      );
      if (!exists) {
        manifest['uses-permission'].push({
          $: { 'android:name': perm },
        });
      }
    });

    // Ensure services array exists
    if (!mainApplication.service) {
      mainApplication.service = [];
    }

    // Add MediaProjectionService with foregroundServiceType="mediaProjection"
    const serviceName = 'com.oney.WebRTCModule.MediaProjectionService';
    const existingService = mainApplication.service.find(
      (s) => s.$ && s.$['android:name'] === serviceName
    );

    if (!existingService) {
      mainApplication.service.push({
        $: {
          'android:name': serviceName,
          'android:foregroundServiceType': 'mediaProjection',
          'android:exported': 'false',
        },
      });
    } else {
      existingService.$['android:foregroundServiceType'] = 'mediaProjection';
      existingService.$['android:exported'] = 'false';
    }

    // Enable Picture-in-Picture on MainActivity
    if (mainApplication.activity) {
      const mainActivity = mainApplication.activity.find(
        (a) => a.$ && a.$['android:name'] === '.MainActivity'
      );
      if (mainActivity) {
        mainActivity.$['android:supportsPictureInPicture'] = 'true';
      }
    }

    return config;
  });

  // 2. MainActivity modifications to enable WebRTC MediaProjectionService at runtime
  config = withMainActivity(config, (config) => {
    let content = config.modResults.contents;
    const isKotlin = config.modResults.language === 'kt';

    if (isKotlin) {
      if (!content.includes('com.oney.WebRTCModule.WebRTCModuleOptions')) {
        content = content.replace(
          /package [\w.]+/,
          (match) => `${match}\n\nimport com.oney.WebRTCModule.WebRTCModuleOptions`
        );
      }
      if (!content.includes('enableMediaProjectionService = true')) {
        content = content.replace(
          /super\.onCreate\((.*)\)/,
          (match) => `WebRTCModuleOptions.getInstance().enableMediaProjectionService = true\n    ${match}`
        );
      }
    } else {
      if (!content.includes('com.oney.WebRTCModule.WebRTCModuleOptions')) {
        content = content.replace(
          /package [\w.]+;/,
          (match) => `${match}\n\nimport com.oney.WebRTCModule.WebRTCModuleOptions;`
        );
      }
      if (!content.includes('enableMediaProjectionService = true')) {
        content = content.replace(
          /super\.onCreate\((.*)\);/,
          (match) => `WebRTCModuleOptions.getInstance().enableMediaProjectionService = true;\n    ${match}`
        );
      }
    }

    config.modResults.contents = content;
    return config;
  });

  return config;
}

module.exports = createRunOncePlugin(withWebRTCScreenShare, 'with-webrtc-screenshare', '1.0.0');
