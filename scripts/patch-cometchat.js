const fs = require('fs');
const path = require('path');

const targetCjs = path.resolve(__dirname, '../node_modules/@cometchat/calls-sdk-react-native/dist/index.js');
const targetMjs = path.resolve(__dirname, '../node_modules/@cometchat/calls-sdk-react-native/dist/index.mjs');

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

// Patch CJS
patchFile(
  targetCjs,
  'exports.CometChatCalls=CometChatCalls;',
  'CometChatCalls.startScreenSharing=startScreenSharing;CometChatCalls.stopScreenSharing=stopScreenSharing;exports.CometChatCalls=CometChatCalls;'
);

// Patch ESM
patchFile(
  targetMjs,
  'export{CometChatCalls};',
  'CometChatCalls.startScreenSharing=startScreenSharing;CometChatCalls.stopScreenSharing=stopScreenSharing;export{CometChatCalls};'
);
