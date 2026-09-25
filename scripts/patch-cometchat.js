const fs = require('fs');
const path = require('path');

const targetCjs = path.resolve(__dirname, '../node_modules/@cometchat/calls-sdk-react-native/dist/index.js');
const targetMjs = path.resolve(__dirname, '../node_modules/@cometchat/calls-sdk-react-native/dist/index.mjs');
const targetWebRTC = path.resolve(__dirname, '../node_modules/react-native-webrtc/android/src/main/java/com/oney/WebRTCModule/WebRTCModuleOptions.java');

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
