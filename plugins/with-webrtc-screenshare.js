const { withAndroidManifest, withMainActivity, createRunOncePlugin } = require('@expo/config-plugins');

/**
 * Expo Config Plugin to configure Android for:
 * 1. WebRTC Screen Sharing & MediaProjectionService (foregroundServiceType="mediaProjection")
 * 2. Full-Screen Incoming Call Intent & Auto Screen Wake (showWhenLocked, turnScreenOn, USE_FULL_SCREEN_INTENT)
 * 3. Picture-in-Picture & resizeableActivity on MainActivity
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
      'android.permission.FOREGROUND_SERVICE_PHONE_CALL',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION',
      'android.permission.FOREGROUND_SERVICE_MICROPHONE',
      'android.permission.FOREGROUND_SERVICE_CAMERA',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.WAKE_LOCK',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.USE_FULL_SCREEN_INTENT',
      'android.permission.DISABLE_KEYGUARD',
      'android.permission.VIBRATE',
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

    // Enable Picture-in-Picture, resizeableActivity & Full-Screen Lock Screen display on MainActivity
    if (mainApplication.activity) {
      const mainActivity = mainApplication.activity.find(
        (a) => a.$ && a.$['android:name'] === '.MainActivity'
      );
      if (mainActivity) {
        mainActivity.$['android:supportsPictureInPicture'] = 'true';
        mainActivity.$['android:resizeableActivity'] = 'true';
        mainActivity.$['android:showWhenLocked'] = 'true';
        mainActivity.$['android:turnScreenOn'] = 'true';
        mainActivity.$['android:showOnLockScreen'] = 'true';

        // Ensure configChanges contains all necessary flags for smooth transitions
        let configChanges = mainActivity.$['android:configChanges'] || '';
        const needed = ['screenSize', 'smallestScreenSize', 'screenLayout', 'orientation', 'uiMode'];
        needed.forEach((n) => {
          if (!configChanges.includes(n)) {
            configChanges = configChanges ? `${configChanges}|${n}` : n;
          }
        });
        mainActivity.$['android:configChanges'] = configChanges;
      }
    }

    return config;
  });

  // 2. MainActivity modifications: enable MediaProjectionService, turn on screen when locked, and PiP handler
  config = withMainActivity(config, (config) => {
    let content = config.modResults.contents;
    const isKotlin = config.modResults.language === 'kt';

    if (isKotlin) {
      if (!content.includes('com.oney.WebRTCModule.WebRTCModuleOptions')) {
        content = content.replace(
          /package [\w.]+/,
          (match) => `${match}\n\nimport com.oney.WebRTCModule.WebRTCModuleOptions\nimport com.oney.WebRTCModule.MediaProjectionService\nimport android.os.Build\nimport android.view.WindowManager`
        );
      }
      if (!content.includes('enableMediaProjectionService = true')) {
        content = content.replace(
          /super\.onCreate\((.*)\)/,
          (match) => `WebRTCModuleOptions.getInstance().enableMediaProjectionService = true\n    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {\n      setShowWhenLocked(true)\n      setTurnScreenOn(true)\n    } else {\n      window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)\n    }\n    ${match}`
        );
      }
      if (!content.includes('onUserLeaveHint()')) {
        content = content.replace(
          /class MainActivity :[^{]+{/,
          (match) => `${match}\n  override fun onUserLeaveHint() {\n    super.onUserLeaveHint()\n    // Enter Picture-in-Picture ONLY when entire screen sharing is currently active\n    if (com.oney.WebRTCModule.MediaProjectionService.isRunning) {\n      if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {\n        try {\n          val pipBuilder = android.app.PictureInPictureParams.Builder()\n          pipBuilder.setAspectRatio(android.util.Rational(9, 16))\n          enterPictureInPictureMode(pipBuilder.build())\n        } catch (e: Exception) {}\n      }\n    }\n  }\n`
        );
      }
    } else {
      if (!content.includes('com.oney.WebRTCModule.WebRTCModuleOptions')) {
        content = content.replace(
          /package [\w.]+;/,
          (match) => `${match}\n\nimport com.oney.WebRTCModule.WebRTCModuleOptions;\nimport com.oney.WebRTCModule.MediaProjectionService;\nimport android.os.Build;\nimport android.view.WindowManager;`
        );
      }
      if (!content.includes('enableMediaProjectionService = true')) {
        content = content.replace(
          /super\.onCreate\((.*)\);/,
          (match) => `WebRTCModuleOptions.getInstance().enableMediaProjectionService = true;\n    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {\n      setShowWhenLocked(true);\n      setTurnScreenOn(true);\n    } else {\n      getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);\n    }\n    ${match}`
        );
      }
      if (!content.includes('onUserLeaveHint()')) {
        content = content.replace(
          /public class MainActivity extends[^{]+{/,
          (match) => `${match}\n  @Override\n  public void onUserLeaveHint() {\n    super.onUserLeaveHint();\n    // Enter Picture-in-Picture ONLY when entire screen sharing is currently active\n    if (com.oney.WebRTCModule.MediaProjectionService.isRunning) {\n      if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {\n        try {\n          android.app.PictureInPictureParams.Builder pipBuilder = new android.app.PictureInPictureParams.Builder();\n          pipBuilder.setAspectRatio(new android.util.Rational(9, 16));\n          enterPictureInPictureMode(pipBuilder.build());\n        } catch (Exception e) {}\n      }\n    }\n  }\n`
        );
      }
    }

    config.modResults.contents = content;
    return config;
  });

  return config;
}

module.exports = createRunOncePlugin(withWebRTCScreenShare, 'with-webrtc-screenshare', '1.0.0');

