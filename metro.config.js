const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;
// Look for sibling ../amogamobileds-v1 for local monorepos / workspaces,
// or fallback to node_modules/amogamobileds-v1 when installed from npm
const siblingDs = path.resolve(projectRoot, '..', 'amogamobileds-v1');
const centralRepoRoot = fs.existsSync(siblingDs) ? siblingDs : null;

const config = getDefaultConfig(projectRoot);

const hasCentralRepo = !!centralRepoRoot;
const dsRoot = centralRepoRoot || path.resolve(projectRoot, 'node_modules', 'amogamobileds-v1');

// 1. Watch central design system repository for local development (if present)
config.watchFolders = hasCentralRepo ? [centralRepoRoot] : [];

// 2. Resolve modules exclusively from project node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];

// 3. Block central repository's node_modules from being bundled
if (hasCentralRepo) {
  config.resolver.blockList = [
    new RegExp(
      `^${path.resolve(centralRepoRoot, 'node_modules').replace(/[/\\]/g, '[/\\\\]')}.*`
    ),
  ];
}

/**
 * Resolve a bare path to an existing file by trying common TS/JS extensions.
 * Returns the resolved filepath or null if nothing found.
 */
function resolveWithExtensions(basePath) {
  const extensions = [
    '', // exact file match
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    path.sep + 'index.ts',
    path.sep + 'index.tsx',
    path.sep + 'index.js',
  ];
  for (const ext of extensions) {
    const candidate = path.normalize(basePath + ext);
    if (fs.existsSync(candidate)) {
      try {
        if (fs.statSync(candidate).isFile()) {
          return candidate;
        }
      } catch (_) {}
    }
  }
  return null;
}

// 4. Resolve @/ and @ds/ path aliases and amogamobileds-v1 cleanly in Metro
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // @/ maps to the project root (amogamobiledev1/)
  if (moduleName.startsWith('@/')) {
    const relativePath = moduleName.slice(2); // e.g. "lib/supabase"
    const basePath = path.resolve(projectRoot, relativePath);
    const resolved = resolveWithExtensions(basePath);
    if (resolved) {
      return { type: 'sourceFile', filePath: resolved };
    }
  }

  // @ds/ maps to the central design system root
  if (moduleName.startsWith('@ds/')) {
    const relativePath = moduleName.slice(4);
    const basePath = path.resolve(dsRoot, relativePath);
    const resolved = resolveWithExtensions(basePath);
    if (resolved) {
      return { type: 'sourceFile', filePath: resolved };
    }
  }

  // amogamobileds-v1 maps to the central repo's index
  if (moduleName === 'amogamobileds-v1') {
    const directIndex = path.resolve(dsRoot, 'index.ts');
    if (fs.existsSync(directIndex)) {
      return { type: 'sourceFile', filePath: directIndex };
    }
  }

  // Handle semver subpath imports for react-native-reanimated
  if (moduleName.startsWith('semver/') || moduleName === 'semver') {
    const semverV7 = path.resolve(projectRoot, 'node_modules', 'react-native-reanimated', 'node_modules', 'semver');
    const rootSemverV7 = path.resolve(projectRoot, '..', 'node_modules', 'react-native-reanimated', 'node_modules', 'semver');
    const targetSemver = fs.existsSync(semverV7) ? semverV7 : (fs.existsSync(rootSemverV7) ? rootSemverV7 : null);
    if (targetSemver) {
      if (moduleName === 'semver') {
        return { type: 'sourceFile', filePath: path.resolve(targetSemver, 'index.js') };
      }
      const subpath = moduleName.replace(/^semver\//, '');
      const candidate = path.resolve(targetSemver, subpath + (subpath.endsWith('.js') ? '' : '.js'));
      if (fs.existsSync(candidate)) {
        return { type: 'sourceFile', filePath: candidate };
      }
    }
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

if (!config.resolver.assetExts.includes('ttf')) {
  config.resolver.assetExts.push('ttf');
}
if (!config.resolver.assetExts.includes('otf')) {
  config.resolver.assetExts.push('otf');
}

module.exports = config;
