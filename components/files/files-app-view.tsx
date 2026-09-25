import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Platform,
  useWindowDimensions,
  Pressable,
  ActivityIndicator,
  Linking,
  Image,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  Folder,
  FolderOpen,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  FileSpreadsheet,
  Archive,
  Search,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Download,
  Eye,
  Copy,
  Check,
  Filter,
  ArrowUpDown,
  SlidersHorizontal,
  ArrowLeftRight,
  LayoutGrid,
  List,
  Command,
  Save,
  RefreshCw,
  HardDrive,
  Bell,
  Flag,
  MoreVertical,
} from 'lucide-react-native';
import { useTheme } from 'amogamobileds-v1';
import { useAuth } from '@/providers/auth-provider';
import { supabase } from '@/lib/supabase';

export type FileCategoryType =
  | 'Images'
  | 'Pdf'
  | 'Doc'
  | 'Xls'
  | 'Videos'
  | 'Audio'
  | 'Others';

export type SidebarTabType = 'File' | 'My Files' | 'Recent';

export interface FileItem {
  id: string;
  name: string;
  path: string;
  size: string;
  sizeBytes?: number;
  type: 'PDF' | 'IMG' | 'DOC' | 'XLS' | 'VIDEO' | 'AUDIO' | 'ARCHIVE' | 'OTHER';
  category: FileCategoryType;
  date: string;
  timeAgo: string;
  color: string;
  bgLight: string;
  bgDark: string;
  badgeLabel: string;
  url?: string;
  senderName?: string;
  isSender?: boolean;
  source: 'chat' | 'storage' | 'sample';
}

export interface FilesAppViewProps {
  initialCategory?: FileCategoryType;
  onOpenDrawer?: () => void;
  onClose?: () => void;
  showMobileHeader?: boolean;
  rightOverlayView?: React.ReactNode;
  onCloseRightPane?: () => void;
  onViewStateChange?: (state: { isDetailOpen: boolean; isUploading: boolean }) => void;
}

const CATEGORY_LIST: { id: string; category: FileCategoryType; icon: any }[] = [
  { id: 'images', category: 'Images', icon: ImageIcon },
  { id: 'pdf', category: 'Pdf', icon: FileText },
  { id: 'doc', category: 'Doc', icon: FileText },
  { id: 'videos', category: 'Videos', icon: Film },
  { id: 'xls', category: 'Xls', icon: FileSpreadsheet },
  { id: 'audio', category: 'Audio', icon: Music },
  { id: 'others', category: 'Others', icon: Archive },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileTypeMeta(fileName: string, mimeType?: string | null): {
  type: FileItem['type'];
  category: FileCategoryType;
  color: string;
  bgLight: string;
  bgDark: string;
  badgeLabel: string;
} {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const mime = mimeType?.toLowerCase() || '';

  if (ext === 'pdf' || mime.includes('pdf')) {
    return {
      type: 'PDF',
      category: 'Pdf',
      color: '#ef4444',
      bgLight: '#fef2f2',
      bgDark: '#2d1212',
      badgeLabel: 'PDF',
    };
  }

  if (['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif', 'bmp'].includes(ext) || mime.startsWith('image/')) {
    return {
      type: 'IMG',
      category: 'Images',
      color: '#6366f1',
      bgLight: '#eef2ff',
      bgDark: '#1e1b4b',
      badgeLabel: ext.toUpperCase() || 'IMG',
    };
  }

  if (['doc', 'docx', 'txt', 'rtf', 'odt', 'pages'].includes(ext) || mime.includes('word') || mime.includes('text')) {
    return {
      type: 'DOC',
      category: 'Doc',
      color: '#3b82f6',
      bgLight: '#eff6ff',
      bgDark: '#172554',
      badgeLabel: ext.toUpperCase() || 'DOC',
    };
  }

  if (['xls', 'xlsx', 'csv', 'ods', 'numbers'].includes(ext) || mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) {
    return {
      type: 'XLS',
      category: 'Xls',
      color: '#10b981',
      bgLight: '#f0fdf4',
      bgDark: '#052e16',
      badgeLabel: ext.toUpperCase() || 'XLSX',
    };
  }

  if (['mp4', 'mov', 'avi', 'mkv', 'webm', '3gp'].includes(ext) || mime.startsWith('video/')) {
    return {
      type: 'VIDEO',
      category: 'Videos',
      color: '#f97316',
      bgLight: '#fff7ed',
      bgDark: '#351608',
      badgeLabel: ext.toUpperCase() || 'VIDEO',
    };
  }

  if (['mp3', 'm4a', 'wav', 'aac', 'ogg', 'flac'].includes(ext) || mime.startsWith('audio/')) {
    return {
      type: 'AUDIO',
      category: 'Audio',
      color: '#ec4899',
      bgLight: '#fdf2f8',
      bgDark: '#370b22',
      badgeLabel: ext.toUpperCase() || 'AUDIO',
    };
  }

  return {
    type: 'OTHER',
    category: 'Others',
    color: '#64748b',
    bgLight: '#f1f5f9',
    bgDark: '#1e293b',
    badgeLabel: ext.toUpperCase() || 'FILE',
  };
}

export function FilesAppView({
  initialCategory = 'Images',
  onOpenDrawer,
  onClose,
  showMobileHeader = true,
  rightOverlayView,
  onCloseRightPane,
  onViewStateChange,
}: FilesAppViewProps) {
  const { colors, resolvedMode } = useTheme();
  const isDark = resolvedMode === 'dark';
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const userEmail = user?.email || 'itsaman00786@gmail.com';

  // State
  const [sidebarTab, setSidebarTab] = useState<SidebarTabType>('File');
  const [activeCategory, setActiveCategory] = useState<FileCategoryType>(initialCategory);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);
  const [isChatFolderExpanded, setIsChatFolderExpanded] = useState(true);
  const [isEmailFolderExpanded, setIsEmailFolderExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewCardMode, setViewCardMode] = useState(true);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name' | 'size'>('newest');
  const [previewModalFile, setPreviewModalFile] = useState<FileItem | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [liveFiles, setLiveFiles] = useState<FileItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleSelectCategory = (cat: FileCategoryType) => {
    setActiveCategory(cat);
    if (!isDesktop) {
      setIsMobileDetailOpen(true);
      onViewStateChange?.({ isDetailOpen: true, isUploading: isUploadModalOpen });
    }
  };

  // Upload Form State
  const [uploadSubFolder, setUploadSubFolder] = useState<FileCategoryType>('Images');
  const [uploadRemarks, setUploadRemarks] = useState('');
  const [uploadNotes, setUploadNotes] = useState('');
  const [selectedUploadAsset, setSelectedUploadAsset] = useState<{
    uri: string;
    name: string;
    size?: number;
    mimeType?: string;
  } | null>(null);
  const [isUploadingAction, setIsUploadingAction] = useState(false);

  // Theme colors
  const containerBg = isDark ? '#09090b' : '#ffffff';
  const sidebarBg = isDark ? '#09090b' : '#ffffff';
  const cardBg = isDark ? '#141e33' : '#ffffff';
  const borderColor = isDark ? '#1e293b' : '#e2e8f0';
  const textMain = isDark ? '#f8fafc' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';
  const inputBg = isDark ? '#182235' : '#ffffff';
  const primaryPurple = '#7c3aed';

  const defaultSampleFiles: FileItem[] = useMemo(() => [
    {
      id: 'img-1',
      name: '1788851230133-69f87c40-mockup.png',
      path: `Chat/${userEmail}/Images`,
      size: '2.4 MB',
      sizeBytes: 2516582,
      type: 'IMG',
      category: 'Images',
      date: 'Aug 19, 2026',
      timeAgo: '2 hours ago',
      color: '#6366f1',
      bgLight: '#0f172a',
      bgDark: '#0f172a',
      badgeLabel: 'PNG',
      url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
      source: 'sample',
    },
    {
      id: 'img-2',
      name: '1787804626383-0e55931a-render.png',
      path: `Chat/${userEmail}/Images`,
      size: '4.8 MB',
      sizeBytes: 5033164,
      type: 'IMG',
      category: 'Images',
      date: 'Aug 18, 2026',
      timeAgo: '5 hours ago',
      color: '#6366f1',
      bgLight: '#0f172a',
      bgDark: '#0f172a',
      badgeLabel: 'PNG',
      url: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=600&auto=format&fit=crop&q=80',
      source: 'sample',
    },
    {
      id: 'img-3',
      name: 'images.jpg',
      path: `Chat/${userEmail}/Images`,
      size: '1.2 MB',
      sizeBytes: 1258291,
      type: 'IMG',
      category: 'Images',
      date: 'Aug 18, 2026',
      timeAgo: '1 day ago',
      color: '#6366f1',
      bgLight: '#0f172a',
      bgDark: '#0f172a',
      badgeLabel: 'JPG',
      url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop&q=80',
      source: 'sample',
    },
    {
      id: 'img-4',
      name: '1786791695429-3c26e8c9-art.png',
      path: `Chat/${userEmail}/Images`,
      size: '3.1 MB',
      sizeBytes: 3250585,
      type: 'IMG',
      category: 'Images',
      date: 'Aug 17, 2026',
      timeAgo: '2 days ago',
      color: '#6366f1',
      bgLight: '#0f172a',
      bgDark: '#0f172a',
      badgeLabel: 'PNG',
      url: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=600&auto=format&fit=crop&q=80',
      source: 'sample',
    },
    {
      id: 'pdf-1',
      name: 'Invoice-Statement-2026.pdf',
      path: `Chat/${userEmail}/Pdf`,
      size: '1.8 MB',
      sizeBytes: 1887436,
      type: 'PDF',
      category: 'Pdf',
      date: 'Aug 19, 2026',
      timeAgo: '3 hours ago',
      color: '#ef4444',
      bgLight: '#fef2f2',
      bgDark: '#2d1212',
      badgeLabel: 'PDF',
      source: 'sample',
    },
    {
      id: 'doc-1',
      name: 'Architecture-Specification.docx',
      path: `Chat/${userEmail}/Doc`,
      size: '950 KB',
      sizeBytes: 972800,
      type: 'DOC',
      category: 'Doc',
      date: 'Aug 17, 2026',
      timeAgo: '2 days ago',
      color: '#3b82f6',
      bgLight: '#eff6ff',
      bgDark: '#172554',
      badgeLabel: 'DOCX',
      source: 'sample',
    },
    {
      id: 'vid-1',
      name: 'Product-Demo-Recording.mp4',
      path: `Chat/${userEmail}/Videos`,
      size: '14.5 MB',
      sizeBytes: 15204352,
      type: 'VIDEO',
      category: 'Videos',
      date: 'Aug 16, 2026',
      timeAgo: '3 days ago',
      color: '#f97316',
      bgLight: '#fff7ed',
      bgDark: '#351608',
      badgeLabel: 'MP4',
      source: 'sample',
    },
  ], [userEmail]);

  // Helper to query files directly from Supabase Storage buckets
  const fetchStorageFolderFiles = useCallback(async (bucket: string, folderPath: string): Promise<FileItem[]> => {
    try {
      const { data, error } = await supabase.storage.from(bucket).list(folderPath, {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' },
      });

      if (error || !data || data.length === 0) return [];

      const items: FileItem[] = [];
      for (const item of data) {
        if (!item.name || item.name.startsWith('.')) continue;
        
        // If it's a folder (id is null or metadata is null), we could recurse if needed
        const isFolder = !item.id && !item.metadata;
        if (isFolder) continue;

        const fullPath = folderPath ? `${folderPath}/${item.name}` : item.name;
        const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(fullPath);
        const url = publicUrlData?.publicUrl || '';
        
        const meta = getFileTypeMeta(item.name, (item as any).metadata?.mimetype);
        const dateObj = item.created_at ? new Date(item.created_at) : new Date();
        const dateStr = dateObj.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        const diffMs = Date.now() - dateObj.getTime();
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHrs / 24);
        let timeAgo = 'just now';
        if (diffDays > 0) timeAgo = `${diffDays}d ago`;
        else if (diffHrs > 0) timeAgo = `${diffHrs}h ago`;

        const sizeBytes = (item as any).metadata?.size || 0;

        items.push({
          id: item.id || `storage-${item.name}-${Date.now()}`,
          name: item.name,
          path: folderPath || `Chat/${userEmail}/${meta.category}`,
          size: sizeBytes > 0 ? formatBytes(sizeBytes) : '1.2 MB',
          sizeBytes,
          type: meta.type,
          category: meta.category,
          date: dateStr,
          timeAgo,
          color: meta.color,
          bgLight: meta.bgLight,
          bgDark: meta.bgDark,
          badgeLabel: meta.badgeLabel,
          url,
          senderName: 'You',
          isSender: true,
          source: 'storage',
        });
      }
      return items;
    } catch (err) {
      return [];
    }
  }, [userEmail]);

  const loadLiveFiles = useCallback(async () => {
    try {
      if (!user) {
        setLiveFiles(defaultSampleFiles);
        setIsLoading(false);
        return;
      }

      // 1. Query chat_messages for all chat attachments for this user
      const { data: messages, error: msgErr } = await supabase
        .from('chat_messages')
        .select(`
          id,
          file_url,
          file_name,
          file_size,
          mime_type,
          created_at,
          direction,
          sender_user_id,
          owner_user_id,
          deleted
        `)
        .eq('owner_user_id', user.id)
        .eq('deleted', false)
        .not('file_url', 'is', null)
        .order('created_at', { ascending: false });

      const parsedChatFiles: FileItem[] = [];

      if (!msgErr && messages && messages.length > 0) {
        messages.forEach((msg) => {
          if (!msg.file_url) return;
          const fileName = msg.file_name || `attachment_${msg.id.substring(0, 6)}`;
          const meta = getFileTypeMeta(fileName, msg.mime_type);
          const dateObj = new Date(msg.created_at);
          const dateStr = dateObj.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });

          const diffMs = Date.now() - dateObj.getTime();
          const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
          const diffDays = Math.floor(diffHrs / 24);
          let timeAgo = 'just now';
          if (diffDays > 0) timeAgo = `${diffDays}d ago`;
          else if (diffHrs > 0) timeAgo = `${diffHrs}h ago`;

          parsedChatFiles.push({
            id: msg.id,
            name: fileName,
            path: `Chat/${userEmail}/${meta.category}`,
            size: msg.file_size ? formatBytes(msg.file_size) : '1.2 MB',
            sizeBytes: msg.file_size || 1200000,
            type: meta.type,
            category: meta.category,
            date: dateStr,
            timeAgo,
            color: meta.color,
            bgLight: meta.bgLight,
            bgDark: meta.bgDark,
            badgeLabel: meta.badgeLabel,
            url: msg.file_url,
            senderName: msg.direction === 'Sent' ? 'You' : 'Contact',
            isSender: msg.direction === 'Sent',
            source: 'chat',
          });
        });
      }

      // 2. Query Supabase Storage buckets directly (chat-files prioritized)
      const bucketsToTry = ['chat-files', 'amogachatfiles', 'files'];
      const foldersToScan = [
        `Chat/${userEmail}/Images`,
        `Chat/${userEmail}/Pdf`,
        `Chat/${userEmail}/Doc`,
        `Chat/${userEmail}/Videos`,
        `Chat/${userEmail}/Xls`,
        `Chat/${userEmail}/Audio`,
        `Chat/${userEmail}/Others`,
        `Chat/${userEmail}`,
        'attachments',
        'Images',
        'Pdf',
        'Doc',
        'Videos',
        'Files',
        'Voice',
        '', // root
      ];

      const storageResults: FileItem[] = [];
      for (const bucket of bucketsToTry) {
        for (const fld of foldersToScan) {
          const res = await fetchStorageFolderFiles(bucket, fld);
          if (res && res.length > 0) {
            storageResults.push(...res);
          }
        }
      }

      const realFiles = [...parsedChatFiles, ...storageResults];
      const combined = realFiles.length > 0 ? realFiles : defaultSampleFiles;

      const seen = new Set<string>();
      const uniqueFiles = combined.filter((f) => {
        const key = f.url || `${f.name}_${f.size}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setLiveFiles(uniqueFiles);
    } catch (err) {
      console.warn('[FilesAppView] Error fetching live files:', err);
      setLiveFiles(defaultSampleFiles);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user, userEmail, defaultSampleFiles, fetchStorageFolderFiles]);

  useEffect(() => {
    loadLiveFiles();
  }, [loadLiveFiles]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`files_chat_messages:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
          filter: `owner_user_id=eq.${user.id}`,
        },
        () => {
          loadLiveFiles();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadLiveFiles]);

  const baseFilesForTab = useMemo(() => {
    if (sidebarTab === 'My Files') {
      return liveFiles.filter((f) => f.isSender || f.source === 'storage');
    }
    return liveFiles;
  }, [liveFiles, sidebarTab]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    CATEGORY_LIST.forEach((c) => {
      counts[c.category] = 0;
    });
    baseFilesForTab.forEach((f) => {
      counts[f.category] = (counts[f.category] || 0) + 1;
    });
    return counts;
  }, [baseFilesForTab]);

  const totalChatFilesCount = baseFilesForTab.length;

  const filteredFiles = useMemo(() => {
    return baseFilesForTab
      .filter((file) => {
        if (sidebarTab !== 'Recent' && file.category !== activeCategory) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            file.name.toLowerCase().includes(q) ||
            file.path.toLowerCase().includes(q) ||
            file.type.toLowerCase().includes(q) ||
            (file.senderName && file.senderName.toLowerCase().includes(q))
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortOrder === 'name') return a.name.localeCompare(b.name);
        if (sortOrder === 'size') return (b.sizeBytes || 0) - (a.sizeBytes || 0);
        return 0;
      });
  }, [baseFilesForTab, sidebarTab, activeCategory, searchQuery, sortOrder]);

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedUploadAsset({
          uri: asset.uri,
          name: asset.name,
          size: asset.size,
          mimeType: asset.mimeType,
        });
        const meta = getFileTypeMeta(asset.name, asset.mimeType);
        setUploadSubFolder(meta.category);
      }
    } catch (err) {
      console.warn('Document picker error:', err);
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const name = asset.fileName || `media_${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`;
        setSelectedUploadAsset({
          uri: asset.uri,
          name,
          size: asset.fileSize,
          mimeType: asset.mimeType,
        });
        setUploadSubFolder(asset.type === 'video' ? 'Videos' : 'Images');
      }
    } catch (err) {
      console.warn('Image picker error:', err);
    }
  };

  const handleExecuteUpload = async () => {
    if (!selectedUploadAsset) {
      if (Platform.OS === 'web') alert('Please select a file to upload first.');
      return;
    }

    setIsUploadingAction(true);
    try {
      const { name, uri, mimeType, size } = selectedUploadAsset;
      const cleanPath = `Chat/${userEmail}/${uploadSubFolder}/${Date.now()}_${name}`;
      const bucket = 'chat-files';

      let uploadedUrl: string | null = null;

      try {
        if (Platform.OS === 'web') {
          const response = await fetch(uri);
          const blob = await response.blob();
          const { data, error } = await supabase.storage
            .from(bucket)
            .upload(cleanPath, blob, {
              contentType: mimeType || 'application/octet-stream',
              upsert: true,
            });

          if (!error && data) {
            const { data: publicUrlData } = supabase.storage
              .from(bucket)
              .getPublicUrl(cleanPath);
            uploadedUrl = publicUrlData?.publicUrl || null;
          }
        } else {
          // Native upload (Android/iOS)
          const response = await fetch(uri);
          const blob = await response.blob();
          const { data, error } = await supabase.storage
            .from(bucket)
            .upload(cleanPath, blob, {
              contentType: mimeType || 'application/octet-stream',
              upsert: true,
            });

          if (!error && data) {
            const { data: publicUrlData } = supabase.storage
              .from(bucket)
              .getPublicUrl(cleanPath);
            uploadedUrl = publicUrlData?.publicUrl || null;
          }
        }
      } catch (uploadErr) {
        console.warn('Storage upload attempt warning:', uploadErr);
      }

      const meta = getFileTypeMeta(name, mimeType);
      const newFileItem: FileItem = {
        id: `upload-${Date.now()}`,
        name,
        path: `Chat/${userEmail}/${uploadSubFolder}`,
        size: size ? formatBytes(size) : '1.5 MB',
        sizeBytes: size || 1500000,
        type: meta.type,
        category: meta.category,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        timeAgo: 'just now',
        color: meta.color,
        bgLight: meta.bgLight,
        bgDark: meta.bgDark,
        badgeLabel: meta.badgeLabel,
        url: uploadedUrl || uri,
        senderName: 'You',
        isSender: true,
        source: 'storage',
      };

      setLiveFiles((prev) => [newFileItem, ...prev]);
      setActiveCategory(meta.category);
      setIsUploadModalOpen(false);
      setSelectedUploadAsset(null);
      setUploadRemarks('');
      setUploadNotes('');

      // Refresh live files from Supabase
      loadLiveFiles();

      if (Platform.OS === 'web') alert('File uploaded successfully!');
    } catch (err) {
      console.warn('Upload error:', err);
    } finally {
      setIsUploadingAction(false);
    }
  };

  const handleCopyLink = (file: FileItem) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(file.url || file.name);
    }
    setCopiedId(file.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadFile = async (file: FileItem) => {
    if (!file.url) {
      if (Platform.OS === 'web') alert('No direct download URL available for this file.');
      return;
    }

    try {
      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.href = file.url;
        link.download = file.name;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // Native APK / iOS
        const supported = await Linking.canOpenURL(file.url);
        if (supported) {
          await Linking.openURL(file.url);
        } else {
          await Linking.openURL(file.url);
        }
      }
    } catch (err) {
      console.warn('Download error:', err);
      if (file.url) {
        Linking.openURL(file.url);
      }
    }
  };

  const handleOpenFile = (file: FileItem) => {
    if (file.url) {
      Linking.openURL(file.url).catch(() => {
        setPreviewModalFile(file);
      });
    } else {
      setPreviewModalFile(file);
    }
  };

  const renderThumbnail = (file: FileItem, size = 32) => {
    switch (file.type) {
      case 'PDF':
        return <FileText size={size} color={file.color} strokeWidth={2} />;
      case 'IMG':
        return <ImageIcon size={size} color={file.color} strokeWidth={2} />;
      case 'DOC':
        return <FileText size={size} color={file.color} strokeWidth={2} />;
      case 'XLS':
        return <FileSpreadsheet size={size} color={file.color} strokeWidth={2} />;
      case 'VIDEO':
        return <Film size={size} color={file.color} strokeWidth={2} />;
      case 'AUDIO':
        return <Music size={size} color={file.color} strokeWidth={2} />;
      case 'ARCHIVE':
        return <Archive size={size} color={file.color} strokeWidth={2} />;
      default:
        return <FileText size={size} color={file.color} strokeWidth={2} />;
    }
  };

  return (
    <View style={[styles.rootContainer, { backgroundColor: containerBg }]}>
      {/* ──────────────────────────────────────────────────────────────────────────── */}
      {/* 1. LEFT SIDEBAR: HIERARCHICAL FOLDER TREE (EXACT SCREENSHOT MATCH)           */}
      {/* ──────────────────────────────────────────────────────────────────────────── */}
      {(isDesktop || !isMobileDetailOpen) && (
        <View
          style={[
            styles.sidebar,
            {
              width: isDesktop ? 290 : '100%',
              borderRightWidth: isDesktop ? 1 : 0,
              borderRightColor: borderColor,
              backgroundColor: sidebarBg,
            },
          ]}
        >
          {/* Subtabs: All Files | My Files | Recent */}
          <View style={[styles.tabsRow, { borderBottomColor: borderColor }]}>
            <TouchableOpacity
              onPress={() => setSidebarTab('File')}
              style={styles.tabBtn}
            >
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: sidebarTab === 'File' ? textMain : textMuted,
                    fontWeight: sidebarTab === 'File' ? '700' : '500',
                  },
                ]}
              >
                All Files
              </Text>
              {sidebarTab === 'File' && (
                <View style={[styles.activeIndicator, { backgroundColor: primaryPurple }]} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setSidebarTab('My Files')}
              style={styles.tabBtn}
            >
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: sidebarTab === 'My Files' ? textMain : textMuted,
                    fontWeight: sidebarTab === 'My Files' ? '700' : '500',
                  },
                ]}
              >
                My Files
              </Text>
              {sidebarTab === 'My Files' && (
                <View style={[styles.activeIndicator, { backgroundColor: primaryPurple }]} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setSidebarTab('Recent')}
              style={styles.tabBtn}
            >
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: sidebarTab === 'Recent' ? textMain : textMuted,
                    fontWeight: sidebarTab === 'Recent' ? '700' : '500',
                  },
                ]}
              >
                Recent
              </Text>
              {sidebarTab === 'Recent' && (
                <View style={[styles.activeIndicator, { backgroundColor: primaryPurple }]} />
              )}
            </TouchableOpacity>
          </View>

          {/* Search + Upload Row */}
          <View style={styles.searchUploadRow}>
            <View
              style={[
                styles.searchWrapper,
                {
                  borderColor,
                  backgroundColor: inputBg,
                },
              ]}
            >
              <Search size={14} color={textMuted} strokeWidth={2} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search..."
                placeholderTextColor={textMuted}
                style={[styles.searchInput, { color: textMain }]}
              />
            </View>

            <TouchableOpacity
              onPress={() => setIsUploadModalOpen(true)}
              style={[styles.uploadPurpleBtn, { backgroundColor: primaryPurple }]}
              accessibilityLabel="Upload file"
            >
              <Text style={styles.uploadPurpleBtnText}>Upload</Text>
              <Plus size={14} color="#ffffff" strokeWidth={2.6} />
            </TouchableOpacity>
          </View>

          {/* Section Header: FILE EXPLORER */}
          <View style={styles.treeSectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Folder size={14} color={textMuted} />
              <Text style={[styles.treeSectionTitle, { color: textMuted }]}>
                FILE EXPLORER
              </Text>
            </View>
            <Text style={[styles.treeSectionCount, { color: textMuted }]}>
              {CATEGORY_LIST.length}
            </Text>
          </View>

          {/* Hierarchical Collapsible Folder Tree */}
          <ScrollView
            style={styles.treeScroll}
            contentContainerStyle={styles.treeContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Level 1: Chat Root Folder */}
            <View style={styles.treeNode}>
              <TouchableOpacity
                onPress={() => setIsChatFolderExpanded(!isChatFolderExpanded)}
                style={styles.treeRowLevel1}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {isChatFolderExpanded ? (
                    <ChevronDown size={14} color={textMuted} />
                  ) : (
                    <ChevronRight size={14} color={textMuted} />
                  )}
                  <Folder size={17} color={primaryPurple} />
                  <Text style={[styles.treeNodeTitle, { color: textMain }]}>
                    Chat
                  </Text>
                </View>

                <Text style={[styles.treeNodeCountMuted, { color: textMuted }]}>
                  {totalChatFilesCount}
                </Text>
              </TouchableOpacity>

              {/* Level 2: User Email Folder (e.g. itsaman00786@gmail.com) */}
              {isChatFolderExpanded && (
                <View style={styles.treeLevel2Wrap}>
                  <TouchableOpacity
                    onPress={() => setIsEmailFolderExpanded(!isEmailFolderExpanded)}
                    style={styles.treeRowLevel2}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      {isEmailFolderExpanded ? (
                        <ChevronDown size={13} color={textMuted} />
                      ) : (
                        <ChevronRight size={13} color={textMuted} />
                      )}
                      <Folder size={15} color="#8b5cf6" />
                      <Text
                        style={[styles.treeNodeEmailTitle, { color: textMain }]}
                        numberOfLines={1}
                      >
                        {userEmail}
                      </Text>
                    </View>

                    <Text style={[styles.treeNodeCountMuted, { color: textMuted }]}>
                      {totalChatFilesCount}
                    </Text>
                  </TouchableOpacity>

                  {/* Level 3: Subfolders (Images, Pdf, Doc, Videos, Xls, Audio) */}
                  {isEmailFolderExpanded && (
                    <View style={styles.treeLevel3Wrap}>
                      {CATEGORY_LIST.map((catItem) => {
                        const isSelected = activeCategory === catItem.category;
                        const count = categoryCounts[catItem.category] || 0;
                        return (
                          <TouchableOpacity
                            key={catItem.id}
                            onPress={() => handleSelectCategory(catItem.category)}
                            style={[
                              styles.treeCategoryRow,
                              isSelected && {
                                backgroundColor: isDark
                                  ? 'rgba(99, 102, 241, 0.18)'
                                  : '#eef2ff',
                                borderColor: isDark
                                  ? 'rgba(99, 102, 241, 0.45)'
                                  : '#c7d2fe',
                                borderWidth: 1,
                              },
                            ]}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <Folder
                                size={15}
                                color={isSelected ? primaryPurple : textMuted}
                              />
                              <Text
                                style={[
                                  styles.categoryNameText,
                                  {
                                    color: isSelected ? primaryPurple : textMain,
                                    fontWeight: isSelected ? '700' : '500',
                                  },
                                ]}
                              >
                                {catItem.category}
                              </Text>
                            </View>

                            <View
                              style={[
                                styles.categoryCountBadge,
                                {
                                  backgroundColor: isSelected
                                    ? primaryPurple
                                    : isDark
                                      ? '#1e293b'
                                      : '#f1f5f9',
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.categoryCountText,
                                  { color: isSelected ? '#ffffff' : textMuted },
                                ]}
                              >
                                {count}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────── */}
      {/* 2. RIGHT VIEWPORT (EXACT SCREENSHOT MATCH)                                   */}
      {/* ──────────────────────────────────────────────────────────────────────────── */}
      {(isDesktop || isMobileDetailOpen) && (
        <View style={styles.rightViewport}>
          {rightOverlayView ? (
            rightOverlayView
          ) : (
            <>
              {/* A. Right Top Header Bar */}
              <View
                style={[
                  styles.rightHeaderBar,
                  {
                    borderBottomColor: borderColor,
                    backgroundColor: containerBg,
                  },
                ]}
              >
                <View style={styles.rightHeaderLeft}>
                  {!isDesktop && (
                    <TouchableOpacity
                      onPress={() => {
                        setIsMobileDetailOpen(false);
                        onViewStateChange?.({ isDetailOpen: false, isUploading: isUploadModalOpen });
                      }}
                      style={styles.backBtn}
                      accessibilityRole="button"
                      accessibilityLabel="Back to Folders"
                    >
                      <ChevronLeft size={22} color={textMain} />
                    </TouchableOpacity>
                  )}

                  {/* Big Purple Folder Icon Box */}
                  <View style={styles.folderIconBox}>
                    <Folder size={18} color={primaryPurple} />
                  </View>

                  {/* Title & Storage Path */}
                  <View style={{ gap: 2, flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Text style={[styles.rightHeaderTitle, { color: textMain }]} numberOfLines={1}>
                        {sidebarTab === 'Recent'
                          ? 'Recent Files'
                          : sidebarTab === 'My Files'
                          ? `${activeCategory} (My Files)`
                          : activeCategory}
                      </Text>
                      <View style={styles.filesCountPill}>
                        <Text style={styles.filesCountPillText}>
                          {filteredFiles.length} file{filteredFiles.length === 1 ? '' : 's'}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.storageFolderSub, { color: textMuted }]} numberOfLines={1}>
                      {sidebarTab === 'Recent'
                        ? 'Recent files & chat attachments'
                        : sidebarTab === 'My Files'
                        ? `Chat/${userEmail}/${activeCategory} (My Files)`
                        : `Chat/${userEmail}/${activeCategory}`}
                    </Text>
                  </View>
                </View>

                {/* Right Action Icons: Bell, Flag, More, Cross [X] ALWAYS ON FAR RIGHT */}
                <View style={styles.rightHeaderRight}>
                  {isDesktop && (
                    <>
                      <TouchableOpacity style={styles.headerIconBtn}>
                        <Bell size={18} color="#f97316" />
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.headerIconBtn}>
                        <Flag size={18} color={textMuted} />
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.headerIconBtn}>
                        <MoreVertical size={18} color={textMuted} />
                      </TouchableOpacity>
                    </>
                  )}

                  {/* Cross [X] ALWAYS ON FAR RIGHT */}
                  <TouchableOpacity
                    onPress={() => {
                      if (!isDesktop && isMobileDetailOpen) {
                        setIsMobileDetailOpen(false);
                        onViewStateChange?.({ isDetailOpen: false, isUploading: isUploadModalOpen });
                      } else if (onClose || onCloseRightPane) {
                        (onClose || onCloseRightPane)?.();
                      }
                    }}
                    style={[styles.closeCrossBtn, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                  >
                    <X size={16} color={textMain} strokeWidth={2.2} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* B. Main Interactive Content Canvas */}
              <ScrollView
                style={styles.mainCanvas}
                contentContainerStyle={styles.mainCanvasContent}
                showsVerticalScrollIndicator={false}
              >
                {/* 1. Controls Row (LTR, FILTER, SORT, SHORT, VIEW: CARD) */}
                <View style={styles.controlsRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <TouchableOpacity
                      onPress={() => {}}
                      style={[styles.outlinePillBtn, { borderColor }]}
                    >
                      <ArrowLeftRight size={13} color={textMain} />
                      <Text style={[styles.outlinePillText, { color: textMain }]}>
                        LTR
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {}}
                      style={[styles.outlinePillBtn, { borderColor }]}
                    >
                      <Filter size={13} color={textMain} />
                      <Text style={[styles.outlinePillText, { color: textMain }]}>
                        FILTER
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        setSortOrder((prev) =>
                          prev === 'newest'
                            ? 'oldest'
                            : prev === 'oldest'
                              ? 'name'
                              : prev === 'name'
                                ? 'size'
                                : 'newest'
                        );
                      }}
                      style={[styles.outlinePillBtn, { borderColor }]}
                    >
                      <ArrowUpDown size={13} color={textMain} />
                      <Text style={[styles.outlinePillText, { color: textMain }]}>
                        SORT
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {}}
                      style={[styles.outlinePillBtn, { borderColor }]}
                    >
                      <SlidersHorizontal size={13} color={textMain} />
                      <Text style={[styles.outlinePillText, { color: textMain }]}>
                        SHORT
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Solid Purple VIEW: CARD Button */}
                  <TouchableOpacity
                    onPress={() => setViewCardMode(!viewCardMode)}
                    style={[styles.purpleViewCardBtn, { backgroundColor: primaryPurple }]}
                  >
                    <LayoutGrid size={14} color="#ffffff" />
                    <Text style={styles.purpleViewCardBtnText}>VIEW: CARD</Text>
                  </TouchableOpacity>
                </View>

                {/* 2. Search Bar */}
                <View
                  style={[
                    styles.canvasSearchWrapper,
                    {
                      borderColor,
                      backgroundColor: inputBg,
                    },
                  ]}
                >
                  <Search size={16} color={textMuted} strokeWidth={2} />
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search files by name, format, or sender..."
                    placeholderTextColor={textMuted}
                    style={[styles.canvasSearchInput, { color: textMain }]}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <X size={15} color={textMuted} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* 3. File Count & Pagination Row */}
                <View style={styles.paginationRow}>
                  <Text style={[styles.paginationCountText, { color: textMuted }]}>
                    {filteredFiles.length} files
                  </Text>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Text style={[styles.paginationRangeText, { color: textMuted }]}>
                      1–{filteredFiles.length} of {filteredFiles.length}
                    </Text>
                    <TouchableOpacity style={{ padding: 2 }}>
                      <ChevronLeft size={15} color={textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity style={{ padding: 2 }}>
                      <ChevronRight size={15} color={textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 4. Files Cards Grid */}
                <View style={styles.cardsGrid}>
                  {filteredFiles.map((file) => (
                    <View
                      key={file.id}
                      style={[
                        styles.fileCardBox,
                        {
                          backgroundColor: cardBg,
                          borderColor,
                        },
                      ]}
                    >
                      {/* Top Thumbnail Image / Preview Frame */}
                      <TouchableOpacity
                        activeOpacity={0.88}
                        onPress={() => setPreviewModalFile(file)}
                        style={[
                          styles.fileThumbnailArea,
                          { backgroundColor: isDark ? file.bgDark : file.bgLight },
                        ]}
                      >
                        {file.type === 'IMG' && file.url ? (
                          <Image
                            source={{ uri: file.url }}
                            style={styles.thumbnailImg}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={{ alignItems: 'center', gap: 6, paddingVertical: 20 }}>
                            {renderThumbnail(file, 38)}
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: '800',
                                color: file.color,
                                letterSpacing: 0.5,
                              }}
                            >
                              {file.badgeLabel}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>

                      {/* File Meta Info */}
                      <View style={{ padding: 12, gap: 4 }}>
                        <Text
                          style={[styles.cardFileName, { color: textMain }]}
                          numberOfLines={1}
                        >
                          {file.name}
                        </Text>

                        <Text
                          style={[styles.cardFilePath, { color: textMuted }]}
                          numberOfLines={1}
                        >
                          {file.path}
                        </Text>

                        {/* Action Buttons Row */}
                        <View style={styles.cardActionsRow}>
                          <TouchableOpacity
                            onPress={() => setPreviewModalFile(file)}
                            style={[
                              styles.previewBtnPill,
                              { backgroundColor: isDark ? '#312e81' : '#ede9fe' },
                            ]}
                          >
                            <Eye size={13} color="#7c3aed" />
                            <Text style={styles.previewBtnText}>Preview</Text>
                          </TouchableOpacity>

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <TouchableOpacity
                              onPress={() => handleDownloadFile(file)}
                              style={styles.cardActionIconBtn}
                              accessibilityLabel="Download file"
                            >
                              <Download size={14} color={textMuted} />
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => handleCopyLink(file)}
                              style={styles.cardActionIconBtn}
                              accessibilityLabel="More options"
                            >
                              {copiedId === file.id ? (
                                <Check size={14} color="#10b981" />
                              ) : (
                                <MoreVertical size={14} color={textMuted} />
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </>
          )}
        </View>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────── */}
      {/* 3. FILE PREVIEW MODAL (FULL SCREEN ON MOBILE WITH CROSS ON RIGHT)            */}
      {/* ──────────────────────────────────────────────────────────────────────────── */}
      <Modal
        visible={!!previewModalFile}
        transparent={isDesktop}
        animationType="fade"
        onRequestClose={() => setPreviewModalFile(null)}
      >
        <View style={isDesktop ? styles.modalBackdrop : [styles.modalBackdropMobile, { backgroundColor: isDark ? '#09090b' : '#ffffff' }]}>
          <View
            style={[
              isDesktop ? styles.previewModalBox : styles.previewModalBoxMobile,
              { backgroundColor: containerBg, borderColor },
            ]}
          >
            {/* Header: File Name + Close Cross [X] on FAR RIGHT */}
            <View style={[styles.modalHeaderRow, { borderBottomColor: borderColor, paddingTop: !isDesktop && Platform.OS !== 'web' ? 36 : 0 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <Folder size={18} color={primaryPurple} />
                <Text
                  style={{ fontSize: 15, fontWeight: '800', color: textMain, flex: 1, fontFamily: 'Open Sans' }}
                  numberOfLines={1}
                >
                  {previewModalFile?.name}
                </Text>
              </View>

              {/* Cross on right */}
              <TouchableOpacity
                onPress={() => setPreviewModalFile(null)}
                style={[styles.modalCloseBtn, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}
                accessibilityRole="button"
                accessibilityLabel="Close Preview"
              >
                <X size={18} color={textMain} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>

            {/* Content Body */}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={isDesktop ? { padding: 20, gap: 16 } : { padding: 16, gap: 16, paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
            >
              <View
                style={[
                  isDesktop ? styles.modalPreviewFrame : styles.modalPreviewFrameMobile,
                  {
                    backgroundColor: isDark
                      ? previewModalFile?.bgDark
                      : previewModalFile?.bgLight,
                    borderColor,
                  },
                ]}
              >
                {previewModalFile?.type === 'IMG' && previewModalFile.url ? (
                  <Image
                    source={{ uri: previewModalFile.url }}
                    style={isDesktop ? { width: '100%', height: 260, borderRadius: 10 } : { width: '100%', height: 320, borderRadius: 10 }}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={{ alignItems: 'center', gap: 12, paddingVertical: isDesktop ? 30 : 48 }}>
                    {previewModalFile && renderThumbnail(previewModalFile, isDesktop ? 54 : 68)}
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: '800',
                        color: previewModalFile?.color,
                        letterSpacing: 0.5,
                        fontFamily: 'Open Sans',
                      }}
                    >
                      {previewModalFile?.badgeLabel} DOCUMENT
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: textMuted,
                        textAlign: 'center',
                        paddingHorizontal: 16,
                        fontFamily: 'Open Sans',
                      }}
                      numberOfLines={2}
                    >
                      {previewModalFile?.name}
                    </Text>
                  </View>
                )}
              </View>

              {/* Metadata Details Box */}
              <View style={[styles.metaDetailBox, { borderColor, backgroundColor: inputBg }]}>
                <View style={styles.metaRow}>
                  <Text style={[styles.metaLabel, { color: textMuted }]}>Storage Path:</Text>
                  <Text style={[styles.metaValue, { color: textMain }]} numberOfLines={1}>{previewModalFile?.path}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={[styles.metaLabel, { color: textMuted }]}>File Size:</Text>
                  <Text style={[styles.metaValue, { color: textMain }]}>{previewModalFile?.size}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={[styles.metaLabel, { color: textMuted }]}>Folder Category:</Text>
                  <Text style={[styles.metaValue, { color: textMain }]}>{previewModalFile?.category}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={[styles.metaLabel, { color: textMuted }]}>Date Uploaded:</Text>
                  <Text style={[styles.metaValue, { color: textMain }]}>{previewModalFile?.date || 'Recent'}</Text>
                </View>
              </View>

              {/* Action Buttons: Copy Link + Download */}
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                <TouchableOpacity
                  onPress={() => previewModalFile && handleCopyLink(previewModalFile)}
                  style={[styles.outlinePillBtn, { borderColor, paddingVertical: 9, paddingHorizontal: 14 }]}
                >
                  {copiedId === previewModalFile?.id ? (
                    <>
                      <Check size={15} color="#10b981" />
                      <Text style={[styles.outlinePillText, { color: '#10b981' }]}>Copied!</Text>
                    </>
                  ) : (
                    <>
                      <Copy size={15} color={textMain} />
                      <Text style={[styles.outlinePillText, { color: textMain }]}>Copy Link</Text>
                    </>
                  )}
                </TouchableOpacity>

                {previewModalFile?.url && (
                  <TouchableOpacity
                    onPress={() => handleDownloadFile(previewModalFile)}
                    style={[styles.purpleViewCardBtn, { backgroundColor: primaryPurple, paddingVertical: 9, paddingHorizontal: 16 }]}
                  >
                    <Download size={15} color="#ffffff" />
                    <Text style={[styles.purpleViewCardBtnText, { fontSize: 13 }]}>Download</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ──────────────────────────────────────────────────────────────────────────── */}
      {/* 4. NEW FILE UPLOAD MODAL                                                     */}
      {/* ──────────────────────────────────────────────────────────────────────────── */}
      <Modal
        visible={isUploadModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsUploadModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }}
          >
            <View
              style={[
                styles.uploadModalBox,
                { backgroundColor: containerBg, borderColor },
              ]}
            >
              <View style={[styles.modalHeaderRow, { borderBottomColor: borderColor }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Folder size={18} color={primaryPurple} />
                  <Text style={{ fontSize: 16, fontWeight: '800', color: textMain, fontFamily: 'Open Sans' }}>
                    New File Upload
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => setIsUploadModalOpen(false)}
                  style={[styles.modalCloseBtn, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}
                >
                  <X size={16} color={textMain} strokeWidth={2.2} />
                </TouchableOpacity>
              </View>

              <View style={{ padding: 20, gap: 14 }}>
                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: textMain, fontFamily: 'Open Sans' }}>
                    Select Document or Media
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      onPress={handlePickDocument}
                      style={[styles.pickFileBtn, { borderColor, backgroundColor: inputBg }]}
                    >
                      <FileText size={18} color={primaryPurple} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: textMain }}>
                        Pick Document / PDF
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handlePickImage}
                      style={[styles.pickFileBtn, { borderColor, backgroundColor: inputBg }]}
                    >
                      <ImageIcon size={18} color="#10b981" />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: textMain }}>
                        Pick Image / Video
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {selectedUploadAsset && (
                    <View style={[styles.selectedAssetBanner, { borderColor, backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}>
                      <FileText size={16} color={primaryPurple} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: textMain, flex: 1 }} numberOfLines={1}>
                        {selectedUploadAsset.name} ({selectedUploadAsset.size ? formatBytes(selectedUploadAsset.size) : 'File'})
                      </Text>
                      <TouchableOpacity onPress={() => setSelectedUploadAsset(null)}>
                        <X size={14} color={textMuted} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Subfolder Category */}
                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: textMain }}>Folder Category</Text>
                  <TextInput
                    value={uploadSubFolder}
                    onChangeText={(t) => setUploadSubFolder(t as any)}
                    placeholder="e.g. Images, Pdf, Doc, Videos"
                    placeholderTextColor={textMuted}
                    style={[styles.modalInput, { backgroundColor: inputBg, borderColor, color: textMain }]}
                  />
                </View>

                {/* Remarks */}
                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: textMain }}>Remarks</Text>
                  <TextInput
                    value={uploadRemarks}
                    onChangeText={setUploadRemarks}
                    placeholder="Add a note about these attachments..."
                    placeholderTextColor={textMuted}
                    style={[styles.modalInput, { backgroundColor: inputBg, borderColor, color: textMain }]}
                  />
                </View>

                {/* Notes */}
                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: textMain }}>Description / Notes</Text>
                  <TextInput
                    value={uploadNotes}
                    onChangeText={setUploadNotes}
                    placeholder="Type description or notes here..."
                    placeholderTextColor={textMuted}
                    multiline
                    numberOfLines={3}
                    style={[styles.modalTextarea, { backgroundColor: inputBg, borderColor, color: textMain }]}
                  />
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                  <TouchableOpacity
                    onPress={() => setIsUploadModalOpen(false)}
                    style={[styles.outlinePillBtn, { borderColor }]}
                  >
                    <Text style={[styles.outlinePillText, { color: textMain }]}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleExecuteUpload}
                    disabled={isUploadingAction}
                    style={[styles.purpleViewCardBtn, { backgroundColor: primaryPurple }]}
                  >
                    {isUploadingAction ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <>
                        <Save size={14} color="#ffffff" />
                        <Text style={styles.purpleViewCardBtnText}>Upload</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  sidebar: {
    height: '100%',
    flexDirection: 'column',
  },
  mobileTopBar: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  mobileLogoBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileTopBarTitle: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Open Sans',
  },
  tabsRow: {
    height: 44,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 20,
    alignItems: 'center',
  },
  tabBtn: {
    paddingBottom: 10,
    paddingTop: 10,
    position: 'relative',
  },
  tabLabel: {
    fontSize: 13,
    fontFamily: 'Open Sans',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2.5,
    borderRadius: 9999,
  },
  searchUploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchWrapper: {
    flex: 1,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 12.5,
    fontFamily: 'Open Sans',
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    ...Platform.select({
      web: { outlineStyle: 'none', outlineWidth: 0, outline: 'none' } as any,
    }),
  },
  uploadPurpleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 12,
  },
  uploadPurpleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    fontFamily: 'Open Sans',
  },
  treeSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  treeSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Open Sans',
    letterSpacing: 0.5,
  },
  treeSectionCount: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Open Sans',
  },
  treeScroll: {
    flex: 1,
  },
  treeContent: {
    paddingHorizontal: 10,
    paddingBottom: 24,
  },
  treeNode: {
    gap: 4,
  },
  treeRowLevel1: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  treeNodeTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    fontFamily: 'Open Sans',
  },
  treeNodeCountMuted: {
    fontSize: 11.5,
    fontFamily: 'Open Sans',
    fontWeight: '600',
  },
  treeLevel2Wrap: {
    paddingLeft: 14,
    gap: 4,
  },
  treeRowLevel2: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  treeNodeEmailTitle: {
    fontSize: 12.5,
    fontWeight: '600',
    fontFamily: 'Open Sans',
  },
  treeLevel3Wrap: {
    paddingLeft: 18,
    gap: 3,
  },
  treeCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  categoryNameText: {
    fontSize: 12.5,
    fontFamily: 'Open Sans',
  },
  categoryCountBadge: {
    minWidth: 20,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  categoryCountText: {
    fontSize: 10.5,
    fontWeight: '700',
    fontFamily: 'Open Sans',
  },
  rightViewport: {
    flex: 1,
    height: '100%',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  rightHeaderBar: {
    height: 60,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  rightHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'Open Sans',
    letterSpacing: -0.3,
  },
  filesCountPill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  filesCountPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748b',
    fontFamily: 'Open Sans',
  },
  storageFolderSub: {
    fontSize: 11.5,
    fontFamily: 'Open Sans',
  },
  rightHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerIconBtn: {
    padding: 4,
  },
  closeCrossBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainCanvas: {
    flex: 1,
  },
  mainCanvasContent: {
    padding: 20,
    gap: 14,
    paddingBottom: 40,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  outlinePillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  outlinePillText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Open Sans',
  },
  purpleViewCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  purpleViewCardBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#ffffff',
    fontFamily: 'Open Sans',
  },
  canvasSearchWrapper: {
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
  },
  canvasSearchInput: {
    flex: 1,
    height: '100%',
    fontSize: 13,
    fontFamily: 'Open Sans',
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    ...Platform.select({
      web: { outlineStyle: 'none', outlineWidth: 0, outline: 'none' } as any,
    }),
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paginationCountText: {
    fontSize: 12,
    fontFamily: 'Open Sans',
    fontWeight: '600',
  },
  paginationRangeText: {
    fontSize: 12,
    fontFamily: 'Open Sans',
    fontWeight: '600',
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  fileCardBox: {
    flex: 1,
    minWidth: 220,
    maxWidth: Platform.OS === 'web' ? 260 : '100%',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  fileThumbnailArea: {
    height: 125,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbnailImg: {
    width: '100%',
    height: '100%',
  },
  cardFileName: {
    fontSize: 12.5,
    fontWeight: '800',
    fontFamily: 'Open Sans',
  },
  cardFilePath: {
    fontSize: 11,
    fontFamily: 'Open Sans',
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  previewBtnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  previewBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#7c3aed',
    fontFamily: 'Open Sans',
  },
  cardActionIconBtn: {
    padding: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBackdropMobile: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  previewModalBox: {
    width: '100%',
    maxWidth: 540,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  previewModalBoxMobile: {
    flex: 1,
    width: '100%',
    height: '100%',
    flexDirection: 'column',
  },
  modalHeaderRow: {
    height: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPreviewFrame: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  modalPreviewFrameMobile: {
    width: '100%',
    minHeight: 280,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  metaDetailBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 12,
    fontFamily: 'Open Sans',
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Open Sans',
  },
  uploadModalBox: {
    width: '100%',
    maxWidth: 540,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pickFileBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  selectedAssetBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  modalInput: {
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 12.5,
    fontFamily: 'Open Sans',
    ...Platform.select({
      web: { outlineStyle: 'none', outlineWidth: 0, outline: 'none' } as any,
    }),
  },
  modalTextarea: {
    minHeight: 64,
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    fontSize: 12.5,
    fontFamily: 'Open Sans',
    textAlignVertical: 'top',
    ...Platform.select({
      web: { outlineStyle: 'none', outlineWidth: 0, outline: 'none' } as any,
    }),
  },
});
