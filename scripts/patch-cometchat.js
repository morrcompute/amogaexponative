const fs = require('fs');
const path = require('path');

const targetCjs = path.resolve(__dirname, '../node_modules/@cometchat/calls-sdk-react-native/dist/index.js');
const targetMjs = path.resolve(__dirname, '../node_modules/@cometchat/calls-sdk-react-native/dist/index.mjs');
const targetWebRTC = path.resolve(__dirname, '../node_modules/react-native-webrtc/android/src/main/java/com/oney/WebRTCModule/WebRTCModuleOptions.java');
const targetMediaProjectionService = path.resolve(__dirname, '../node_modules/react-native-webrtc/android/src/main/java/com/oney/WebRTCModule/MediaProjectionService.java');
const targetGetUserMediaImpl = path.resolve(__dirname, '../node_modules/react-native-webrtc/android/src/main/java/com/oney/WebRTCModule/GetUserMediaImpl.java');

function patchFile(filePath, targetPattern, replacementStr) {
  if (!fs.existsSync(filePath)) {
    console.log(`[patch-cometchat] File not found: ${filePath}, skipping.`);
    return;
  }
  let code = fs.readFileSync(filePath, 'utf8');
  if (code.includes('CometChatCalls.startScreenSharing=')) {
    console.log(`[patch-cometchat] Already patched: ${filePath}`);
    return;
  }
  if (!code.includes(targetPattern)) {
    console.warn(`[patch-cometchat] Pattern not found in ${filePath}: ${targetPattern}`);
    return;
  }
  code = code.replace(targetPattern, replacementStr);
  fs.writeFileSync(filePath, code, 'utf8');
  console.log(`[patch-cometchat] Successfully patched: ${filePath}`);
}

// 1. Patch CJS for CometChatCalls screen sharing
patchFile(
  targetCjs,
  'exports.CometChatCalls=CometChatCalls;',
  'CometChatCalls.startScreenSharing=startScreenSharing;CometChatCalls.stopScreenSharing=stopScreenSharing;exports.CometChatCalls=CometChatCalls;'
);

// 2. Patch ESM for CometChatCalls screen sharing
patchFile(
  targetMjs,
  'export{CometChatCalls};',
  'CometChatCalls.startScreenSharing=startScreenSharing;CometChatCalls.stopScreenSharing=stopScreenSharing;export{CometChatCalls};'
);

// 3. Patch WebRTCModuleOptions to enable MediaProjectionService by default on Android
if (fs.existsSync(targetWebRTC)) {
  let webrtcCode = fs.readFileSync(targetWebRTC, 'utf8');
  if (webrtcCode.includes('public boolean enableMediaProjectionService;') && !webrtcCode.includes('enableMediaProjectionService = true;')) {
    webrtcCode = webrtcCode.replace(
      'public boolean enableMediaProjectionService;',
      'public boolean enableMediaProjectionService = true;'
    );
    fs.writeFileSync(targetWebRTC, webrtcCode, 'utf8');
    console.log('[patch-cometchat] Successfully patched WebRTCModuleOptions.enableMediaProjectionService = true');
  } else {
    console.log('[patch-cometchat] WebRTCModuleOptions already configured');
  }
}

// 4. Patch MediaProjectionService to track isRunning state and provide OnServiceStartedListener
if (fs.existsSync(targetMediaProjectionService)) {
  let serviceCode = fs.readFileSync(targetMediaProjectionService, 'utf8');
  if (!serviceCode.includes('public static volatile boolean isRunning')) {
    const isRunningSnippet = `    static final int NOTIFICATION_ID = new Random().nextInt(99999) + 10000;

    public static volatile boolean isRunning = false;

    public interface OnServiceStartedListener {
        void onStarted();
    }

    private static OnServiceStartedListener sListener;

    public static synchronized void setOnServiceStartedListener(OnServiceStartedListener listener) {
        if (isRunning && listener != null) {
            listener.onStarted();
        } else {
            sListener = listener;
        }
    }`;

    serviceCode = serviceCode.replace(
      'static final int NOTIFICATION_ID = new Random().nextInt(99999) + 10000;',
      isRunningSnippet
    );

    // Update onStartCommand to set isRunning = true and trigger listener
    serviceCode = serviceCode.replace(
      'return START_NOT_STICKY;',
      `isRunning = true;
        synchronized (MediaProjectionService.class) {
            if (sListener != null) {
                try {
                    sListener.onStarted();
                } catch (Exception e) {
                    Log.e(TAG, "Error in onStarted listener", e);
                }
                sListener = null;
            }
        }

        return START_NOT_STICKY;`
    );

    // Update abort to clear listener and reset isRunning
    serviceCode = serviceCode.replace(
      'public static void abort(Context context) {',
      `public static void abort(Context context) {
        isRunning = false;
        synchronized (MediaProjectionService.class) {
            sListener = null;
        }`
    );

    // Add onDestroy
    serviceCode = serviceCode.replace(
      'public IBinder onBind(Intent intent) {\n        return null;\n    }',
      `public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        isRunning = false;
        synchronized (MediaProjectionService.class) {
            sListener = null;
        }
        super.onDestroy();
    }`
    );

    fs.writeFileSync(targetMediaProjectionService, serviceCode, 'utf8');
    console.log('[patch-cometchat] Successfully patched MediaProjectionService with isRunning & OnServiceStartedListener');
  } else {
    console.log('[patch-cometchat] MediaProjectionService already patched');
  }
}

// 5. Patch GetUserMediaImpl to wait for MediaProjectionService foreground start before getMediaProjection (fixes Android 14 SecurityException on entire screen)
if (fs.existsSync(targetGetUserMediaImpl)) {
  let gumCode = fs.readFileSync(targetGetUserMediaImpl, 'utf8');
  const targetGumPattern = `                    ThreadUtils.runOnExecutor(() -> {
                        MediaProjectionService.launch(activity);
                        createScreenStream();
                    });`;

  const replacementGum = `                    ThreadUtils.runOnExecutor(() -> {
                        if (WebRTCModuleOptions.getInstance().enableMediaProjectionService) {
                            final java.util.concurrent.atomic.AtomicBoolean created = new java.util.concurrent.atomic.AtomicBoolean(false);
                            final Runnable doCreate = () -> {
                                if (created.compareAndSet(false, true)) {
                                    ThreadUtils.runOnExecutor(() -> {
                                        createScreenStream();
                                    });
                                }
                            };
                            MediaProjectionService.setOnServiceStartedListener(doCreate::run);
                            MediaProjectionService.launch(activity);
                            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(doCreate, 500);
                        } else {
                            createScreenStream();
                        }
                    });`;

  if (gumCode.includes(targetGumPattern)) {
    gumCode = gumCode.replace(targetGumPattern, replacementGum);
    fs.writeFileSync(targetGetUserMediaImpl, gumCode, 'utf8');
    console.log('[patch-cometchat] Successfully patched GetUserMediaImpl to wait for foreground service before creating screen stream');
  } else {
    console.log('[patch-cometchat] GetUserMediaImpl already patched or pattern changed');
  }
}
