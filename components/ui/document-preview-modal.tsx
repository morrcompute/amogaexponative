import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  Linking,
  Share,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import {
  X,
  Download,
  ExternalLink,
  FileText,
  FileSpreadsheet,
  FileCode,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  AlertCircle,
  Check,
  Share2,
} from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';

// Try to import react-native-webview safely
let WebView: any = null;
try {
  WebView = require('react-native-webview').WebView;
} catch (_) {}

// Try to import expo-sharing safely
let Sharing: any = null;
try {
  Sharing = require('expo-sharing');
} catch (_) {}

// Try to import expo-file-system safely
let FileSystem: any = null;
try {
  FileSystem = require('expo-file-system');
} catch (_) {}

export interface PreviewableFile {
  id?: string;
  name: string;
  url?: string;
  uri?: string;
  type?: string;
  size?: string;
  mimeType?: string;
  content?: string; // base64 string if available
  contentType?: string;
  category?: string;
  date?: string;
  path?: string;
}

export interface DocumentPreviewModalProps {
  visible: boolean;
  file: PreviewableFile | null;
  onClose: () => void;
  onDownload?: (file: PreviewableFile) => void;
}

/**
 * Universal file download & sharing helper for Web & Mobile
 */
export async function downloadOrShareFile(file: PreviewableFile): Promise<boolean> {
  if (!file) return false;

  const fileName = file.name || 'downloaded_file';
  const fileUrl = file.url || file.uri;

  try {
    // 1. Web browser download handling
    if (Platform.OS === 'web') {
      if (file.content) {
        // Base64 content
        const mime = file.contentType || file.mimeType || 'application/octet-stream';
        const link = document.createElement('a');
        link.href = file.content.startsWith('data:')
          ? file.content
          : `data:${mime};base64,${file.content}`;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return true;
      }

      if (fileUrl) {
        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = fileName;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return true;
      }

      // Fallback text download if no url
      const blob = new Blob([`Content of ${fileName}`], { type: 'text/plain' });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      return true;
    }

    // 2. Native Mobile (Android & iOS) download handling
    if (file.content && FileSystem && Sharing) {
      // Save base64 string to temporary cache file and share
      const base64Data = file.content.replace(/^data:.*?;base64,/, '');
      const localPath = `${FileSystem.cacheDirectory || ''}${Date.now()}_${fileName}`;
      await FileSystem.writeAsStringAsync(localPath, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(localPath, {
          mimeType: file.contentType || file.mimeType || 'application/octet-stream',
          dialogTitle: `Save ${fileName}`,
        });
        return true;
      }
    }

    if (fileUrl) {
      if (fileUrl.startsWith('file:') || fileUrl.startsWith('content:')) {
        if (Sharing && (await Sharing.isAvailableAsync())) {
          await Sharing.shareAsync(fileUrl, {
            mimeType: file.mimeType || 'application/octet-stream',
            dialogTitle: `Save ${fileName}`,
          });
          return true;
        }
        await Share.share({
          title: fileName,
          message: `Open: ${fileName}`,
          url: fileUrl,
        });
        return true;
      }

      if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
        // Remote URL - try in-app download / open browser
        if (FileSystem && Sharing) {
          try {
            const localPath = `${FileSystem.cacheDirectory || ''}${Date.now()}_${fileName}`;
            const downloadRes = await FileSystem.downloadAsync(fileUrl, localPath);
            if (downloadRes?.uri && (await Sharing.isAvailableAsync())) {
              await Sharing.shareAsync(downloadRes.uri, {
                mimeType: file.mimeType || 'application/octet-stream',
                dialogTitle: `Save ${fileName}`,
              });
              return true;
            }
          } catch (downloadErr) {
            console.warn('Direct file download error, falling back to browser:', downloadErr);
          }
        }

        await WebBrowser.openBrowserAsync(fileUrl);
        return true;
      }

      await Linking.openURL(fileUrl);
      return true;
    }

    // Fallback share message
    await Share.share({
      title: fileName,
      message: `File: ${fileName}`,
    });
    return true;
  } catch (error) {
    console.warn('Error downloading or sharing file:', error);
    if (fileUrl) {
      Linking.openURL(fileUrl).catch(() => {});
    }
    return false;
  }
}

/**
 * Get Google Docs embedded viewer URL for documents
 */
export function getDocumentViewerUrl(fileUrl: string, fileName?: string): string {
  if (!fileUrl) return '';
  if (fileUrl.startsWith('https://')) {
    const isDocOrPdf = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|rtf)$/i.test(
      fileName || fileUrl
    );
    if (isDocOrPdf) {
      return `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(fileUrl)}`;
    }
  }
  return fileUrl;
}

export function DocumentPreviewModal({
  visible,
  file,
  onClose,
  onDownload,
}: DocumentPreviewModalProps) {
  const { colors, resolvedMode } = useTheme();
  const isDark = resolvedMode === 'dark';
  const screenWidth = Dimensions.get('window').width;
  const isDesktop = screenWidth >= 768;

  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [loadError, setLoadError] = useState(false);

  if (!visible || !file) return null;

  const fileName = file.name || 'Attachment';
  const fileUrl = file.url || file.uri || '';
  const fileExt = fileName.split('.').pop()?.toLowerCase() || '';

  const isImage =
    file.type === 'IMG' ||
    file.type === 'image' ||
    ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'heic'].includes(fileExt) ||
    file.mimeType?.startsWith('image/') ||
    file.contentType?.startsWith('image/');

  const isPdf =
    file.type === 'PDF' ||
    file.type === 'pdf' ||
    fileExt === 'pdf' ||
    file.mimeType?.includes('pdf');

  const isDoc =
    file.type === 'DOC' ||
    file.type === 'doc' ||
    ['doc', 'docx', 'txt', 'rtf', 'odt'].includes(fileExt);

  const isXls =
    file.type === 'XLS' ||
    file.type === 'xls' ||
    ['xls', 'xlsx', 'csv', 'ods'].includes(fileExt);

  const isMedia =
    file.type === 'VIDEO' ||
    file.type === 'AUDIO' ||
    ['mp4', 'mov', 'avi', 'mkv', 'mp3', 'm4a', 'wav'].includes(fileExt);

  const viewerUrl = getDocumentViewerUrl(fileUrl, fileName);

  const handleDownloadPress = async () => {
    setDownloadSuccess(true);
    if (onDownload) {
      onDownload(file);
    } else {
      await downloadOrShareFile(file);
    }
    setTimeout(() => setDownloadSuccess(false), 2000);
  };

  const handleOpenExternal = async () => {
    if (fileUrl) {
      if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
        await WebBrowser.openBrowserAsync(fileUrl);
      } else {
        await Linking.openURL(fileUrl);
      }
    } else {
      await downloadOrShareFile(file);
    }
  };

  const getBadgeColor = () => {
    if (isPdf) return { bg: isDark ? 'rgba(239, 68, 68, 0.18)' : '#fee2e2', text: '#ef4444', icon: FileText };
    if (isXls) return { bg: isDark ? 'rgba(16, 185, 129, 0.18)' : '#d1fae5', text: '#10b981', icon: FileSpreadsheet };
    if (isDoc) return { bg: isDark ? 'rgba(59, 130, 246, 0.18)' : '#dbeafe', text: '#3b82f6', icon: FileText };
    if (isImage) return { bg: isDark ? 'rgba(139, 92, 246, 0.18)' : '#ede9fe', text: '#8b5cf6', icon: ImageIcon };
    if (isMedia) return { bg: isDark ? 'rgba(249, 115, 22, 0.18)' : '#ffedd5', text: '#f97316', icon: Film };
    return { bg: isDark ? 'rgba(100, 116, 139, 0.18)' : '#f1f5f9', text: '#64748b', icon: FileCode };
  };

  const badge = getBadgeColor();
  const IconComponent = badge.icon;

  return (
    <Modal
      visible={visible}
      transparent={isDesktop}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={
          isDesktop
            ? styles.modalBackdrop
            : [
                styles.modalBackdropMobile,
                { backgroundColor: isDark ? '#09090b' : '#ffffff' },
              ]
        }
      >
        <SafeAreaView
          style={[
            isDesktop ? styles.previewModalBox : styles.previewModalBoxMobile,
            {
              backgroundColor: isDark ? '#121216' : '#ffffff',
              borderColor: isDark ? '#27272a' : '#e4e4e7',
            },
          ]}
        >
          {/* Header Row */}
          <View
            style={[
              styles.modalHeaderRow,
              {
                borderBottomColor: isDark ? '#27272a' : '#e4e4e7',
                paddingTop: !isDesktop && Platform.OS !== 'web' ? 12 : 0,
              },
            ]}
          >
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.badgeBox,
                  { backgroundColor: badge.bg },
                ]}
              >
                <IconComponent size={16} color={badge.text} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.headerTitleText,
                    { color: isDark ? '#fafafa' : '#09090b' },
                  ]}
                  numberOfLines={1}
                >
                  {fileName}
                </Text>
                {file.size ? (
                  <Text
                    style={[
                      styles.headerSubText,
                      { color: isDark ? '#94a3b8' : '#64748b' },
                    ]}
                  >
                    {file.size}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Header Right Action Buttons */}
            <View style={styles.headerRightActions}>
              <TouchableOpacity
                onPress={handleDownloadPress}
                style={[
                  styles.headerActionBtn,
                  {
                    backgroundColor: downloadSuccess
                      ? isDark
                        ? '#064e3b'
                        : '#d1fae5'
                      : isDark
                      ? '#1e1e24'
                      : '#f1f5f9',
                  },
                ]}
                accessibilityLabel="Download File"
              >
                {downloadSuccess ? (
                  <Check size={16} color="#10b981" strokeWidth={2.5} />
                ) : (
                  <Download
                    size={16}
                    color={isDark ? '#fafafa' : '#09090b'}
                    strokeWidth={2}
                  />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onClose}
                style={[
                  styles.headerCloseBtn,
                  { backgroundColor: isDark ? '#1e1e24' : '#f1f5f9' },
                ]}
                accessibilityLabel="Close Preview"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X
                  size={18}
                  color={isDark ? '#fafafa' : '#09090b'}
                  strokeWidth={2.2}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Main Preview Body */}
          <View style={styles.modalBody}>
            {isImage && fileUrl ? (
              <View style={styles.imageCanvas}>
                <ExpoImage
                  source={{ uri: fileUrl }}
                  style={styles.fullImage}
                  contentFit="contain"
                  transition={200}
                />
              </View>
            ) : fileUrl && !loadError ? (
              Platform.OS === 'web' ? (
                <iframe
                  src={viewerUrl}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    backgroundColor: isDark ? '#18181b' : '#f8fafc',
                  }}
                  title={fileName}
                />
              ) : WebView ? (
                <WebView
                  source={{ uri: viewerUrl }}
                  style={styles.webView}
                  startInLoadingState={true}
                  renderLoading={() => (
                    <View style={styles.loadingWrap}>
                      <ActivityIndicator
                        size="large"
                        color={isDark ? '#818cf8' : '#6366f1'}
                      />
                      <Text
                        style={[
                          styles.loadingText,
                          { color: isDark ? '#fafafa' : '#09090b' },
                        ]}
                      >
                        Loading Document Preview...
                      </Text>
                    </View>
                  )}
                  onError={() => setLoadError(true)}
                  originWhitelist={['*']}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                  scalesPageToFit={true}
                />
              ) : (
                <View style={styles.fallbackWrap}>
                  <IconComponent size={56} color={badge.text} strokeWidth={1.8} />
                  <Text
                    style={[
                      styles.fallbackTitle,
                      { color: isDark ? '#fafafa' : '#09090b' },
                    ]}
                  >
                    {fileName}
                  </Text>
                  <Text
                    style={[
                      styles.fallbackSub,
                      { color: isDark ? '#94a3b8' : '#64748b' },
                    ]}
                  >
                    Tap below to open or view this document in your preferred reader.
                  </Text>
                  <TouchableOpacity
                    onPress={handleOpenExternal}
                    style={styles.openExternalBtn}
                  >
                    <ExternalLink size={16} color="#ffffff" />
                    <Text style={styles.openExternalBtnText}>Open Document</Text>
                  </TouchableOpacity>
                </View>
              )
            ) : (
              <View style={styles.fallbackWrap}>
                <IconComponent size={56} color={badge.text} strokeWidth={1.8} />
                <Text
                  style={[
                    styles.fallbackTitle,
                    { color: isDark ? '#fafafa' : '#09090b' },
                  ]}
                >
                  {fileName}
                </Text>
                <Text
                  style={[
                    styles.fallbackSub,
                    { color: isDark ? '#94a3b8' : '#64748b' },
                  ]}
                >
                  Document details ready. You can download or open it using an external viewer.
                </Text>
                <TouchableOpacity
                  onPress={handleOpenExternal}
                  style={styles.openExternalBtn}
                >
                  <ExternalLink size={16} color="#ffffff" />
                  <Text style={styles.openExternalBtnText}>Open Document</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Footer Bar with Download / Open Button */}
          <View
            style={[
              styles.modalFooter,
              {
                backgroundColor: isDark ? '#121216' : '#ffffff',
                borderTopColor: isDark ? '#27272a' : '#e4e4e7',
              },
            ]}
          >
            <TouchableOpacity
              onPress={handleDownloadPress}
              activeOpacity={0.85}
              style={[
                styles.primaryDownloadBtn,
                { backgroundColor: downloadSuccess ? '#10b981' : isDark ? '#6366f1' : '#4f46e5' },
              ]}
            >
              {downloadSuccess ? (
                <>
                  <Check size={17} color="#ffffff" strokeWidth={2.5} />
                  <Text style={styles.primaryDownloadBtnText}>Downloaded / Shared</Text>
                </>
              ) : (
                <>
                  <Download size={17} color="#ffffff" strokeWidth={2.2} />
                  <Text style={styles.primaryDownloadBtnText}>Download File</Text>
                </>
              )}
            </TouchableOpacity>

            {fileUrl ? (
              <TouchableOpacity
                onPress={handleOpenExternal}
                activeOpacity={0.85}
                style={[
                  styles.secondaryOpenBtn,
                  {
                    backgroundColor: isDark ? '#1e1e24' : '#f1f5f9',
                    borderColor: isDark ? '#27272a' : '#e4e4e7',
                  },
                ]}
              >
                <ExternalLink
                  size={16}
                  color={isDark ? '#fafafa' : '#09090b'}
                  strokeWidth={2}
                />
                <Text
                  style={[
                    styles.secondaryOpenBtnText,
                    { color: isDark ? '#fafafa' : '#09090b' },
                  ]}
                >
                  Open in App
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBackdropMobile: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  previewModalBox: {
    width: '100%',
    maxWidth: 780,
    height: '85%',
    maxHeight: 720,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 20,
  },
  previewModalBoxMobile: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  modalHeaderRow: {
    height: 60,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 10,
  },
  badgeBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleText: {
    fontSize: 14.5,
    fontWeight: '700',
    fontFamily: 'Open Sans',
  },
  headerSubText: {
    fontSize: 11.5,
    fontFamily: 'Open Sans',
    marginTop: 1,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    flex: 1,
    position: 'relative',
  },
  imageCanvas: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Open Sans',
  },
  fallbackWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 12,
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Open Sans',
    textAlign: 'center',
    maxWidth: 320,
  },
  fallbackSub: {
    fontSize: 13,
    fontFamily: 'Open Sans',
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 18,
  },
  openExternalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 6,
  },
  openExternalBtnText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '600',
    fontFamily: 'Open Sans',
  },
  modalFooter: {
    height: 64,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  primaryDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  primaryDownloadBtnText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '700',
    fontFamily: 'Open Sans',
  },
  secondaryOpenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  secondaryOpenBtnText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Open Sans',
  },
});
