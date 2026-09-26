import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  Bell,
  Send,
  FileText,
  Trash2,
  Paperclip,
  Reply,
  Forward,
  ReplyAll,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Flag,
  Link2,
  Image as ImageIcon,
  List,
  ListOrdered,
  Download,
  Eye,
  ChevronDown,
  Save,
} from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';
import { useAuth } from '@/providers/auth-provider';
import { supabase } from '@/lib/supabase';
import { LocalNotificationService, type AppNotificationRecord } from '@/lib/local-db';

export type NotificationTabType = 'Inbox' | 'Sent' | 'Folder' | 'Contact';

export interface NotificationAttachment {
  id: string;
  name: string;
  type: string;
  size: string;
  uri?: string;
}

export interface NotificationsAppViewProps {
  initialTab?: NotificationTabType;
  onOpenDrawer?: () => void;
  onClose?: () => void;
  showMobileHeader?: boolean;
  rightOverlayView?: React.ReactNode;
  onCloseRightPane?: () => void;
  onViewStateChange?: (state: { isDetailOpen: boolean; isComposing: boolean }) => void;
}

const TABS: NotificationTabType[] = ['Inbox', 'Sent', 'Folder', 'Contact'];

export function NotificationsAppView({
  initialTab = 'Inbox',
  onOpenDrawer,
  onClose,
  showMobileHeader = true,
  rightOverlayView,
  onCloseRightPane,
  onViewStateChange,
}: NotificationsAppViewProps) {
  const { colors, resolvedMode } = useTheme();
  const { user, profile } = useAuth();
  const isDark = resolvedMode === 'dark';
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [activeTab, setActiveTab] = useState<NotificationTabType>(initialTab);
  const [notifications, setNotifications] = useState<AppNotificationRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [starredMap, setStarredMap] = useState<Record<string, boolean>>({});

  // Mobile navigation state: false = list view, true = detail/compose view
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);

  // Compose form state
  const [composeTo, setComposeTo] = useState('');
  const [composeFrom, setComposeFrom] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeAttachments, setComposeAttachments] = useState<NotificationAttachment[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('Blank');
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [composeCc, setComposeCc] = useState('');
  const [composeBcc, setComposeBcc] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  // Sync dynamic From address when auth user or profile is available
  useEffect(() => {
    const senderName =
      profile?.full_name ||
      profile?.display_name ||
      user?.user_metadata?.full_name ||
      user?.email?.split('@')[0] ||
      '';
    const senderEmail = user?.email || '';
    if (senderName && senderEmail) {
      setComposeFrom(`${senderName} <${senderEmail}>`);
    } else if (senderEmail) {
      setComposeFrom(senderEmail);
    } else if (senderName) {
      setComposeFrom(senderName);
    } else {
      setComposeFrom('');
    }
  }, [user, profile]);

  // Notify parent of view state changes
  useEffect(() => {
    onViewStateChange?.({
      isDetailOpen: isMobileDetailOpen,
      isComposing: isComposing,
    });
  }, [isMobileDetailOpen, isComposing, onViewStateChange]);

  // Reset pagination on tab or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery]);

  // Colors & Theme Tokens (Exact match to Email design)
  const containerBg = isDark ? '#0b0f19' : '#ffffff';
  const borderColor = colors.border || (isDark ? '#1e293b' : '#e2e8f0');
  const textMain = colors.foreground || (isDark ? '#f8fafc' : '#0f172a');
  const textMuted = colors.mutedForeground || (isDark ? '#94a3b8' : '#64748b');
  const itemSelectedBg = isDark ? 'rgba(99, 102, 241, 0.16)' : '#fff8ed';
  const itemSelectedBorder = isDark ? '#f97316' : colors.primary || '#f97316';
  const badgeBg = isDark ? '#1e293b' : '#f1f5f9';
  const badgeText = isDark ? '#94a3b8' : '#475569';
  const inputBg = isDark ? '#1e293b' : '#f8fafc';

  // Load notifications from local SQLite database and sync with Supabase
  const loadNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      const items = await LocalNotificationService.fetchAndSyncUserNotifications(
        user?.email,
        user?.id
      );
      if (items) {
        setNotifications(items);
        const starMap: Record<string, boolean> = {};
        items.forEach((item) => {
          const id = item.app_notification_uuid || String(item.app_notification_id);
          starMap[id] = Boolean(item.is_starred || item.is_important);
        });
        setStarredMap(starMap);
        if (items.length > 0 && !selectedId) {
          setSelectedId(items[0].app_notification_uuid || String(items[0].app_notification_id));
        }
      }
    } catch (err) {
      console.warn('Error loading notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.email, user?.id, selectedId]);

  useEffect(() => {
    loadNotifications();

    // Live real-time Supabase subscription
    const channel = supabase
      .channel('app_notification_live_stream')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_notification' },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    const interval = setInterval(() => {
      loadNotifications();
    }, 5000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [loadNotifications]);

  // Pick Document
  const handlePickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const picked: NotificationAttachment[] = result.assets.map((asset, index) => {
          const ext = asset.name?.split('.').pop()?.toUpperCase() || 'FILE';
          const sizeBytes = asset.size || 0;
          const sizeStr =
            sizeBytes > 1024 * 1024
              ? `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
              : sizeBytes > 0
                ? `${(sizeBytes / 1024).toFixed(0)} KB`
                : '1.2 MB';

          return {
            id: `att-doc-${Date.now()}-${index}`,
            name: asset.name || `document-${index + 1}.${ext.toLowerCase()}`,
            type: ext,
            size: sizeStr,
            uri: asset.uri,
          };
        });

        if (isComposing) {
          setComposeAttachments((prev) => [...prev, ...picked]);
        }
      }
    } catch (error) {
      console.warn('Error picking document:', error);
    }
  }, [isComposing]);

  // Pick Image
  const handlePickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.9,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const picked: NotificationAttachment[] = result.assets.map((asset, index) => {
          const ext = (asset.fileName || asset.uri).split('.').pop()?.toUpperCase() || 'IMAGE';
          const sizeBytes = (asset as any).fileSize || 0;
          const sizeStr =
            sizeBytes > 1024 * 1024
              ? `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
              : sizeBytes > 0
                ? `${(sizeBytes / 1024).toFixed(0)} KB`
                : '850 KB';

          return {
            id: `att-img-${Date.now()}-${index}`,
            name: asset.fileName || `image-${Date.now()}.${ext.toLowerCase()}`,
            type: ext,
            size: sizeStr,
            uri: asset.uri,
          };
        });

        if (isComposing) {
          setComposeAttachments((prev) => [...prev, ...picked]);
        }
      }
    } catch (error) {
      console.warn('Error picking image:', error);
    }
  }, [isComposing]);

  const handleRemoveAttachment = useCallback((attId: string) => {
    setComposeAttachments((prev) => prev.filter((a) => a.id !== attId));
  }, []);

  // Filter notifications by active tab and search
  const filteredNotifications = useMemo(() => {
    const userEmailLower = user?.email?.trim().toLowerCase() || '';
    const userId = user?.id || '';
    const userPhone = (profile?.mobile || user?.phone || '').trim();

    return notifications.filter((item) => {
      const currentTabLower = activeTab.toLowerCase();
      const folderLower = (item.folder_name || item.status || '').toLowerCase();
      const isDraft = Boolean(item.is_draft) || folderLower === 'drafts' || item.status === 'draft';

      // Check if logged-in user is recipient (To, Cc, or Bcc)
      const toEmail = (item.to_email || item.to_user_email || '').toLowerCase();
      const toPhone = (item.to_mobile || item.to_user_mobile || item.recipient_mobiles || '').trim();
      const toUuid = item.to_user_uuid || '';
      const ccEmails = (item.cc_emails || item.ccusers_json || '').toLowerCase();
      const bccEmails = (item.bcc_emails || item.bccusers_json || '').toLowerCase();

      const isRecipient =
        (!!userEmailLower && (toEmail.includes(userEmailLower) || ccEmails.includes(userEmailLower) || bccEmails.includes(userEmailLower))) ||
        (!!userPhone && toPhone.includes(userPhone)) ||
        (!!userId && toUuid === userId);

      // Check if logged-in user is sender (From)
      const fromEmail = (item.from_email || item.sender_email || item.from_user_email || item.created_user || '').toLowerCase();
      const isSender =
        (!!userEmailLower && fromEmail.includes(userEmailLower)) ||
        (!!userId && (item.from_user_uuid === userId || item.created_user_id === userId || item.created_user_uuid === userId));

      let matchTab = true;
      if (currentTabLower === 'inbox') {
        if (isDraft) return false;
        if (userEmailLower || userId) {
          matchTab = isRecipient || (folderLower === 'inbox' && !isSender);
        } else {
          matchTab = folderLower === 'inbox' || (!item.folder_name && !isDraft);
        }
      } else if (currentTabLower === 'sent') {
        if (isDraft) return false;
        matchTab = folderLower === 'sent' || isSender;
      } else if (currentTabLower === 'folder') {
        matchTab = isDraft || folderLower === 'drafts' || folderLower === 'folder' || Boolean(item.folder_name);
      } else if (currentTabLower === 'contact') {
        matchTab = Boolean(item.sender_mobile || item.recipient_mobiles || item.full_name);
      }

      if (!searchQuery.trim()) return matchTab;

      const q = searchQuery.toLowerCase();
      const matchSearch =
        (item.subject || '').toLowerCase().includes(q) ||
        (item.body || '').toLowerCase().includes(q) ||
        (item.sender_name || '').toLowerCase().includes(q) ||
        (item.sender_email || '').toLowerCase().includes(q) ||
        (item.to_email || '').toLowerCase().includes(q) ||
        (item.to_user_name || '').toLowerCase().includes(q) ||
        (item.cc_emails || '').toLowerCase().includes(q) ||
        (item.bcc_emails || '').toLowerCase().includes(q) ||
        (item.full_name || '').toLowerCase().includes(q);

      return matchTab && matchSearch;
    });
  }, [notifications, activeTab, searchQuery, user?.email, user?.id, user?.phone, profile?.mobile]);

  const totalCount = filteredNotifications.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalCount);
  const paginatedNotifications = useMemo(() => {
    return filteredNotifications.slice(startIndex, endIndex);
  }, [filteredNotifications, startIndex, endIndex]);

  const rangeText = useMemo(() => {
    if (totalCount === 0) return '0–0 of 0';
    return `${startIndex + 1}–${endIndex} of ${totalCount}`;
  }, [totalCount, startIndex, endIndex]);

  const selectedNotification = useMemo(() => {
    return (
      notifications.find(
        (e) => (e.app_notification_uuid || String(e.app_notification_id)) === selectedId
      ) ||
      paginatedNotifications[0] ||
      null
    );
  }, [notifications, selectedId, paginatedNotifications]);

  const handleSelectNotification = useCallback(
    (id: string) => {
      setSelectedId(id);
      setIsComposing(false);
      setNotifications((prev) =>
        prev.map((item) => {
          const itemId = item.app_notification_uuid || String(item.app_notification_id);
          return itemId === id ? { ...item, is_read: true } : item;
        })
      );
      LocalNotificationService.markAsRead(id, true);
      if (!isDesktop) {
        setIsMobileDetailOpen(true);
      }
    },
    [isDesktop]
  );

  const handleDeleteNotification = useCallback(
    async (id: string) => {
      await LocalNotificationService.deleteNotification(id);
      setNotifications((prev) => {
        const remaining = prev.filter(
          (item) => (item.app_notification_uuid || String(item.app_notification_id)) !== id
        );
        if (selectedId === id && remaining.length > 0) {
          setSelectedId(remaining[0].app_notification_uuid || String(remaining[0].app_notification_id));
        } else if (remaining.length === 0) {
          setSelectedId('');
        }
        return remaining;
      });
      if (!isDesktop) {
        setIsMobileDetailOpen(false);
      }
    },
    [selectedId, isDesktop]
  );

  const handleToggleFlag = useCallback((id: string) => {
    setStarredMap((prev) => {
      const nextVal = !prev[id];
      LocalNotificationService.toggleStar(id, nextVal);
      return { ...prev, [id]: nextVal };
    });
  }, []);

  const buildNotificationPayload = useCallback(
    (isDraft = false): Partial<AppNotificationRecord> => {
      const nowIso = new Date().toISOString();
      const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
      const senderName =
        profile?.full_name ||
        profile?.display_name ||
        user?.user_metadata?.full_name ||
        user?.email?.split('@')[0] ||
        '';
      const senderEmail = user?.email || '';
      const senderMobile = profile?.mobile || user?.phone || null;

      const recipientText = composeTo.trim();
      const isRecipientEmail = recipientText.includes('@');
      const toEmail = isRecipientEmail ? recipientText : null;
      const toMobile = !isRecipientEmail && recipientText ? recipientText : null;

      const ccList = composeCc
        ? composeCc.split(',').map((e) => ({ email: e.trim() })).filter((x) => x.email)
        : [];
      const bccList = composeBcc
        ? composeBcc.split(',').map((e) => ({ email: e.trim() })).filter((x) => x.email)
        : [];

      return {
        status: isDraft ? 'draft' : 'sent',
        user_email_account_id: user?.id || null,
        subject: composeSubject.trim() || (isDraft ? '(Draft Notification)' : '(No Subject)'),
        sender_email: senderEmail || null,
        sender_name: senderName || null,
        full_name: senderName || null,
        sender_mobile: senderMobile,
        recipient_mobiles: toMobile || recipientText || null,
        cc_emails: composeCc.trim() || null,
        bcc_emails: composeBcc.trim() || null,
        body: composeBody.trim() || '',
        is_read: 1,
        is_starred: 0,
        is_important: 0,
        is_draft: isDraft ? 1 : 0,
        is_deleted: 0,
        has_attachments: composeAttachments.length > 0 ? 1 : 0,
        created_user: senderEmail || senderName || null,
        created_user_id: user?.id || null,
        received_datetime: nowIso,
        created_datetime: nowIso,
        updated_datetime: nowIso,
        ccusers_json: JSON.stringify(ccList),
        bccusers_json: JSON.stringify(bccList),
        from_email: senderEmail || null,
        to_email: toEmail,
        from_user_name: senderName || null,
        to_user_name: recipientText || null,
        from_mobile: senderMobile,
        to_mobile: toMobile,
        from_user_uuid: user?.id || null,
        to_user_uuid: null,
        from_fullname: senderName || null,
        to_fullname: recipientText || null,
        email_files_json: JSON.stringify(composeAttachments),
        attachments: JSON.stringify(composeAttachments),
        is_archive: 0,
        is_like: 0,
        is_dislike: 0,
        is_flag: 0,
        is_favourite: 0,
        user_uuid: user?.id || null,
        created_user_uuid: user?.id || null,
        updated_user_uuid: user?.id || null,
        user_name: senderName || null,
        user_email: senderEmail || null,
        user_mobile: senderMobile,
        from_user_email: senderEmail || null,
        from_user_mobile: senderMobile,
        to_user_email: toEmail,
        to_user_mobile: toMobile,
        month_name: currentMonth,
        folder_name: isDraft ? 'Drafts' : 'Sent',
      };
    },
    [
      profile,
      user,
      composeTo,
      composeCc,
      composeBcc,
      composeSubject,
      composeBody,
      composeAttachments,
    ]
  );

  const handleSendCompose = useCallback(async () => {
    if (!composeSubject.trim()) {
      alert('Please enter a subject for the notification.');
      return;
    }
    setIsSending(true);
    try {
      const payload = buildNotificationPayload(false);
      const newRecord = await LocalNotificationService.createNotification(payload);

      if (newRecord) {
        setNotifications((prev) => [newRecord, ...prev]);
        setSelectedId(newRecord.app_notification_uuid || String(newRecord.app_notification_id));
      }

      setIsComposing(false);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
      setComposeCc('');
      setComposeBcc('');
      setShowCc(false);
      setShowBcc(false);
      setComposeAttachments([]);
      setActiveTab('Sent');
      if (!isDesktop) {
        setIsMobileDetailOpen(false);
      }
    } catch (err) {
      console.error('Error creating notification:', err);
    } finally {
      setIsSending(false);
    }
  }, [composeSubject, buildNotificationPayload, isDesktop]);

  const handleSaveDraft = useCallback(async () => {
    setIsSending(true);
    try {
      const payload = buildNotificationPayload(true);
      const newRecord = await LocalNotificationService.createNotification(payload);

      if (newRecord) {
        setNotifications((prev) => [newRecord, ...prev]);
        setSelectedId(newRecord.app_notification_uuid || String(newRecord.app_notification_id));
      }

      setIsComposing(false);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
      setComposeCc('');
      setComposeBcc('');
      setShowCc(false);
      setShowBcc(false);
      setComposeAttachments([]);
      setActiveTab('Folder');
      if (!isDesktop) {
        setIsMobileDetailOpen(false);
      }
    } catch (err) {
      console.error('Error saving draft notification:', err);
    } finally {
      setIsSending(false);
    }
  }, [buildNotificationPayload, isDesktop]);

  // Responsive display controls
  const showSidebar = isDesktop || !isMobileDetailOpen;
  const showDetailPane = isDesktop || isMobileDetailOpen;

  // Formatted date and time helpers for selected item (dynamic only)
  const selectedDateStr = useMemo(() => {
    const raw = selectedNotification?.created_at || selectedNotification?.created_datetime || selectedNotification?.received_datetime;
    if (!raw) return '';
    try {
      const d = new Date(raw);
      return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  }, [selectedNotification]);

  const selectedTimeStr = useMemo(() => {
    const raw = selectedNotification?.created_at || selectedNotification?.created_datetime || selectedNotification?.received_datetime;
    if (!raw) return '';
    try {
      const d = new Date(raw);
      return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }, [selectedNotification]);

  const parsedAttachments = useMemo<NotificationAttachment[]>(() => {
    const atts = selectedNotification?.email_files_json || selectedNotification?.attachments;
    if (!atts) return [];
    try {
      if (typeof atts === 'string') {
        return JSON.parse(atts);
      }
      if (Array.isArray(atts)) {
        return atts;
      }
    } catch {
      return [];
    }
    return [];
  }, [selectedNotification]);

  const selectedItemInitials = useMemo(() => {
    const name =
      selectedNotification?.sender_name ||
      selectedNotification?.full_name ||
      selectedNotification?.from_user_name ||
      selectedNotification?.sender_email ||
      'N';
    return (
      name
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase() || 'N'
    );
  }, [selectedNotification]);

  return (
    <View style={[styles.rootContainer, { backgroundColor: containerBg }]}>
      <View style={styles.dualPaneWrapper}>
        {/* ============================================================ */}
        {/* 1. LEFT NOTIFICATION LIST PANE (width: 320px on desktop)     */}
        {/* ============================================================ */}
        {showSidebar && (
          <View
            style={[
              styles.leftListPane,
              {
                width: isDesktop ? 320 : '100%',
                flex: isDesktop ? undefined : 1,
                borderRightColor: borderColor,
                borderRightWidth: isDesktop ? 1 : 0,
                backgroundColor: containerBg,
              },
            ]}
          >
            {/* Top Navigation Tabs & Mini Pagination */}
            <View style={[styles.tabsRow, { borderBottomColor: borderColor }]}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tabsScrollContent}
              >
                {TABS.map((tab) => {
                  const isActive = activeTab === tab;
                  return (
                    <TouchableOpacity
                      key={tab}
                      onPress={() => setActiveTab(tab)}
                      style={[
                        styles.tabItemBtn,
                        isActive && [
                          styles.tabItemBtnActive,
                          { borderBottomColor: colors.primary || '#f97316' },
                        ],
                      ]}
                    >
                      <Text
                        style={[
                          styles.tabItemText,
                          {
                            color: isActive ? colors.primary || '#f97316' : textMuted,
                            fontWeight: isActive ? '600' : '400',
                          },
                        ]}
                      >
                        {tab}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.miniPagination}>
                <Text style={[styles.paginationText, { color: textMuted }]}>
                  {rangeText}
                </Text>
                <TouchableOpacity
                  disabled={currentPage <= 1}
                  onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  style={[styles.pageChevronBtn, { opacity: currentPage <= 1 ? 0.35 : 1 }]}
                >
                  <ChevronLeft size={13} color={textMuted} />
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={currentPage >= totalPages}
                  onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  style={[styles.pageChevronBtn, { opacity: currentPage >= totalPages ? 0.35 : 1 }]}
                >
                  <ChevronRight size={13} color={textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Search Bar & New Notification Button Row */}
            <View style={[styles.searchAndNewRow, { borderBottomColor: borderColor }]}>
              <View
                style={[
                  styles.searchInputBox,
                  { backgroundColor: inputBg, borderColor },
                ]}
              >
                <Search size={14} color={textMuted} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search..."
                  placeholderTextColor={textMuted}
                  style={[
                    styles.searchTextInput,
                    {
                      color: textMain,
                      ...Platform.select({
                        web: { outlineStyle: 'none' } as any,
                      }),
                    },
                  ]}
                />
              </View>

              <TouchableOpacity
                onPress={() => {
                  setIsComposing(true);
                  if (!isDesktop) {
                    setIsMobileDetailOpen(true);
                  }
                }}
                style={[styles.newNotificationPillBtn, { backgroundColor: colors.primary || '#f97316' }]}
              >
                <Text style={styles.newNotificationPillText}>New +</Text>
              </TouchableOpacity>
            </View>

            {/* Notification Cards List */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.notificationListScroll}
              contentContainerStyle={{ padding: 10, gap: 8, width: '100%' }}
            >
              {isLoading && notifications.length === 0 ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary || '#f97316'} />
                  <Text style={[styles.emptyListText, { color: textMuted, marginTop: 8 }]}>
                    Loading notifications...
                  </Text>
                </View>
              ) : paginatedNotifications.length === 0 ? (
                <View style={styles.emptyListState}>
                  <Bell size={28} color={textMuted} strokeWidth={1.5} />
                  <Text style={[styles.emptyListText, { color: textMuted }]}>
                    No notifications in {activeTab}
                  </Text>
                </View>
              ) : (
                paginatedNotifications.map((item) => {
                  const itemId = item.app_notification_uuid || String(item.app_notification_id);
                  const isSelected = itemId === selectedId && !isComposing;
                  const rawTime = item.created_at || item.created_datetime || item.received_datetime;
                  const itemTime = rawTime
                    ? new Date(rawTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '';

                  return (
                    <TouchableOpacity
                      key={itemId}
                      activeOpacity={0.7}
                      onPress={() => handleSelectNotification(itemId)}
                      style={[
                        styles.notificationCardItem,
                        {
                          backgroundColor: isSelected ? itemSelectedBg : 'transparent',
                          borderColor: isSelected ? itemSelectedBorder : borderColor,
                        },
                      ]}
                    >
                      {/* Card Header Row */}
                      <View style={styles.cardHeaderRow}>
                        <View style={styles.senderNameBox}>
                          <Text
                            style={[
                              styles.senderNameLabel,
                              {
                                color: textMain,
                                fontWeight: isSelected ? '600' : '500',
                              },
                            ]}
                          >
                            {activeTab === 'Sent'
                              ? `To: ${item.to_user_name || item.to_email || item.to_fullname || 'Recipient'}`
                              : item.sender_name || item.full_name || item.sender_email || 'Notification'}
                          </Text>
                          <View style={[styles.statusDot, { backgroundColor: colors.primary || '#f97316' }]} />
                        </View>
                        {itemTime ? (
                          <Text style={[styles.relativeTimeText, { color: textMuted }]}>
                            {itemTime}
                          </Text>
                        ) : null}
                      </View>

                      {/* Badges Row */}
                      <View style={styles.badgesRow}>
                        <View style={[styles.badgePill, { backgroundColor: badgeBg }]}>
                          <Text style={[styles.badgePillText, { color: badgeText }]}>
                            {item.folder_name ||
                              (activeTab === 'Sent'
                                ? 'Sent'
                                : (user?.email && item.cc_emails?.toLowerCase().includes(user.email.toLowerCase()))
                                  ? 'Cc'
                                  : (user?.email && item.bcc_emails?.toLowerCase().includes(user.email.toLowerCase()))
                                    ? 'Bcc'
                                    : 'Inbox')}
                          </Text>
                        </View>
                      </View>

                      {/* Subject */}
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.cardSubjectText,
                          {
                            color: textMain,
                            fontWeight: item.is_read ? '500' : '600',
                          },
                        ]}
                      >
                        {item.subject || 'Notification'}
                      </Text>

                      {/* Snippet */}
                      <Text
                        numberOfLines={1}
                        style={[styles.cardSnippetText, { color: textMuted }]}
                      >
                        {item.body || item.description || ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            {/* Bottom Pagination Row */}
            <View style={[styles.bottomPaginationRow, { borderTopColor: borderColor }]}>
              <Text style={[styles.paginationText, { color: textMuted }]}>
                {rangeText}
              </Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity
                  disabled={currentPage <= 1}
                  onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  style={[styles.pageChevronBtn, { opacity: currentPage <= 1 ? 0.35 : 1 }]}
                >
                  <ChevronLeft size={13} color={textMuted} />
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={currentPage >= totalPages}
                  onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  style={[styles.pageChevronBtn, { opacity: currentPage >= totalPages ? 0.35 : 1 }]}
                >
                  <ChevronRight size={13} color={textMuted} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ============================================================ */}
        {/* 2. RIGHT NOTIFICATION VIEWPORT (Exact Email Detail Structure) */}
        {/* ============================================================ */}
        {showDetailPane && (
          <View
            style={[
              styles.rightDetailPane,
              { backgroundColor: isDark ? '#0f172a' : '#ffffff' },
            ]}
          >
            {rightOverlayView ? (
              rightOverlayView
            ) : isComposing ? (
              /* ── COMPOSE NEW NOTIFICATION VIEW ── */
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={[styles.composeContainerStyle, { flexGrow: 1 }]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Compose Header */}
                <View style={[styles.composeHeaderRow, { borderBottomColor: borderColor }]}>
                  <Text style={[styles.detailHeading, { color: textMain }]}>
                    New Notification
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setIsComposing(false);
                      if (!isDesktop) {
                        setIsMobileDetailOpen(false);
                      }
                    }}
                    style={styles.closeComposeBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Close Compose"
                  >
                    <X size={18} color={textMain} />
                  </TouchableOpacity>
                </View>

                {/* 1. Select Template */}
                <View style={styles.fieldSection}>
                  <Text style={[styles.fieldLabel, { color: textMain }]}>Select Template</Text>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={[
                      styles.templateDropdownBtn,
                      { backgroundColor: inputBg, borderColor },
                    ]}
                  >
                    <Text style={[styles.templateDropdownText, { color: textMain }]}>{selectedTemplate}</Text>
                    <ChevronDown size={14} color={textMuted} />
                  </TouchableOpacity>
                </View>

                {/* 2. Subject */}
                <View style={styles.fieldSection}>
                  <Text style={[styles.fieldLabel, { color: textMain }]}>Subject</Text>
                  <TextInput
                    placeholder="Enter subject"
                    placeholderTextColor={textMuted}
                    value={composeSubject}
                    onChangeText={setComposeSubject}
                    style={[
                      styles.inputBox,
                      { backgroundColor: inputBg, borderColor, color: textMain },
                    ]}
                  />
                </View>

                {/* 3. From */}
                <View style={styles.fieldSection}>
                  <Text style={[styles.fieldLabel, { color: textMain }]}>From</Text>
                  <TextInput
                    placeholder="Sender address"
                    placeholderTextColor={textMuted}
                    value={composeFrom}
                    onChangeText={setComposeFrom}
                    style={[
                      styles.inputBox,
                      { backgroundColor: inputBg, borderColor, color: textMain },
                    ]}
                  />
                </View>

                {/* 4. To */}
                <View style={styles.fieldSection}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={[styles.fieldLabel, { color: textMain }]}>To</Text>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TouchableOpacity onPress={() => setShowCc((s) => !s)}>
                        <Text style={{ fontSize: 11.5, color: colors.primary || '#f97316', fontFamily: 'Open Sans', fontWeight: '600' }}>
                          Cc
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setShowBcc((s) => !s)}>
                        <Text style={{ fontSize: 11.5, color: colors.primary || '#f97316', fontFamily: 'Open Sans', fontWeight: '600' }}>
                          Bcc
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <TextInput
                    placeholder="Recipient address or phone number"
                    placeholderTextColor={textMuted}
                    value={composeTo}
                    onChangeText={setComposeTo}
                    style={[
                      styles.inputBox,
                      { backgroundColor: inputBg, borderColor, color: textMain },
                    ]}
                  />
                </View>

                {showCc && (
                  <View style={styles.fieldSection}>
                    <Text style={[styles.fieldLabel, { color: textMain }]}>Cc</Text>
                    <TextInput
                      placeholder="Cc recipient"
                      placeholderTextColor={textMuted}
                      value={composeCc}
                      onChangeText={setComposeCc}
                      style={[
                        styles.inputBox,
                        { backgroundColor: inputBg, borderColor, color: textMain },
                      ]}
                    />
                  </View>
                )}

                {showBcc && (
                  <View style={styles.fieldSection}>
                    <Text style={[styles.fieldLabel, { color: textMain }]}>Bcc</Text>
                    <TextInput
                      placeholder="Bcc recipient"
                      placeholderTextColor={textMuted}
                      value={composeBcc}
                      onChangeText={setComposeBcc}
                      style={[
                        styles.inputBox,
                        { backgroundColor: inputBg, borderColor, color: textMain },
                      ]}
                    />
                  </View>
                )}

                {/* 5. Message with Rich Toolbar */}
                <View style={[styles.fieldSection, { flex: 1, minHeight: 220 }]}>
                  <Text style={[styles.fieldLabel, { color: textMain }]}>Message</Text>
                  <View
                    style={[
                      styles.emailContentBox,
                      { backgroundColor: isDark ? '#141824' : '#ffffff', borderColor, flex: 1 },
                    ]}
                  >
                    <View style={[styles.richToolbar, { borderBottomColor: borderColor, backgroundColor: isDark ? '#141e33' : '#f8fafc' }]}>
                      <TouchableOpacity style={styles.toolbarBtn}>
                        <Text style={[styles.toolbarTextBtn, { color: textMain }]}>B</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.toolbarBtn}>
                        <Text style={[styles.toolbarTextBtn, { fontStyle: 'italic', color: textMain }]}>I</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.toolbarBtn}>
                        <Text style={[styles.toolbarTextBtn, { textDecorationLine: 'underline', color: textMain }]}>U</Text>
                      </TouchableOpacity>

                      <View style={[styles.toolbarDivider, { backgroundColor: borderColor }]} />

                      <TouchableOpacity style={styles.toolbarBtn}>
                        <List size={14} color={textMain} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.toolbarBtn}>
                        <ListOrdered size={14} color={textMain} />
                      </TouchableOpacity>

                      <View style={[styles.toolbarDivider, { backgroundColor: borderColor }]} />

                      <TouchableOpacity style={styles.toolbarBtn}>
                        <Link2 size={14} color={textMain} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handlePickImage} style={styles.toolbarBtn}>
                        <ImageIcon size={14} color={textMain} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handlePickDocument}
                        style={styles.toolbarBtn}
                        accessibilityLabel="Attach Document"
                      >
                        <Paperclip size={14} color={textMain} />
                      </TouchableOpacity>
                    </View>

                    <TextInput
                      placeholder="Write your notification message..."
                      placeholderTextColor={textMuted}
                      value={composeBody}
                      onChangeText={setComposeBody}
                      multiline
                      textAlignVertical="top"
                      style={[
                        styles.composeTextArea,
                        {
                          color: textMain,
                          flex: 1,
                        },
                      ]}
                    />
                  </View>
                </View>

                {/* 6. Attachments Section */}
                <View style={styles.attachmentsSection}>
                  <Text style={[styles.attachmentsHeading, { color: textMain }]}>
                    Attachments ({composeAttachments.length})
                  </Text>

                  {composeAttachments.map((att) => (
                    <View
                      key={att.id}
                      style={[
                        styles.attachmentCard,
                        { backgroundColor: inputBg, borderColor },
                      ]}
                    >
                      <View style={styles.attachmentLeft}>
                        <View
                          style={[
                            styles.pdfTypeBox,
                            { backgroundColor: isDark ? '#334155' : '#ede9fe' },
                          ]}
                        >
                          <FileText size={16} color={colors.primary || '#f97316'} />
                        </View>
                        <View>
                          <Text style={[styles.attachmentName, { color: textMain }]}>
                            {att.name}
                          </Text>
                          <Text style={[styles.attachmentSize, { color: textMuted }]}>
                            {att.size}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.attachmentActions}>
                        <TouchableOpacity
                          onPress={() => alert(`Downloading ${att.name}...`)}
                          style={styles.attActionBtn}
                          accessibilityLabel="Download Attachment"
                        >
                          <Download size={15} color={textMuted} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => alert(`Previewing ${att.name}...`)}
                          style={styles.attActionBtn}
                          accessibilityLabel="Preview Attachment"
                        >
                          <Eye size={15} color={textMuted} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleRemoveAttachment(att.id)}
                          style={styles.attActionBtn}
                          accessibilityLabel="Remove Attachment"
                        >
                          <X size={15} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}

                  <TouchableOpacity
                    onPress={handlePickDocument}
                    style={[
                      styles.attachFilesOutlineBtn,
                      { borderColor, width: '100%', marginTop: 6, height: 38, justifyContent: 'center' },
                    ]}
                  >
                    <Paperclip size={14} color={textMain} />
                    <Text style={[styles.attachFilesOutlineText, { color: textMain }]}>
                      Attach Files
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* 7. Footer Actions */}
                <View style={styles.composeFooterRow}>
                  <TouchableOpacity
                    onPress={() => {
                      setIsComposing(false);
                      if (!isDesktop) {
                        setIsMobileDetailOpen(false);
                      }
                    }}
                    style={[styles.outlineActionBtn, { borderColor }]}
                  >
                    <Text style={[styles.outlineActionBtnText, { color: textMain }]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <TouchableOpacity
                      onPress={handleSaveDraft}
                      disabled={isSending}
                      style={[styles.outlineActionBtn, { borderColor, flexDirection: 'row', alignItems: 'center', gap: 6 }]}
                    >
                      <Save size={14} color={textMain} />
                      <Text style={[styles.outlineActionBtnText, { color: textMain }]}>
                        Save as Draft
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handleSendCompose}
                      disabled={isSending}
                      activeOpacity={0.85}
                      style={[
                        styles.sendPrimaryBtn,
                        { backgroundColor: colors.primary || '#f97316', opacity: isSending ? 0.7 : 1 },
                      ]}
                    >
                      {isSending ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Send size={14} color="#ffffff" />
                      )}
                      <Text style={styles.sendPrimaryBtnText}>
                        {isSending ? 'Sending...' : 'Send'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            ) : selectedNotification ? (
              /* ── NOTIFICATION READING & REPLY VIEW ── */
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={[styles.detailScrollContent, { flexGrow: 1 }]}
                showsVerticalScrollIndicator={false}
              >
                {/* Detail Top Header Bar */}
                <View style={[styles.detailHeaderBar, { borderBottomColor: borderColor }]}>
                  <View style={styles.senderProfileRow}>
                    <View
                      style={[
                        styles.avatarCircle,
                        { backgroundColor: '#e0f2fe' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.avatarText,
                          { color: '#0284c7' },
                        ]}
                      >
                        {selectedItemInitials}
                      </Text>
                    </View>

                    <View style={styles.senderDetailsCol}>
                      <View style={styles.senderNameAndEmail}>
                        <Text style={[styles.fromNameText, { color: textMain }]}>
                          From: {selectedNotification.sender_name || selectedNotification.full_name || selectedNotification.from_user_name || 'Notification'}
                        </Text>
                        {selectedNotification.sender_email ? (
                          <Text style={[styles.fromEmailText, { color: textMuted }]} numberOfLines={1}>
                            {selectedNotification.sender_email}
                          </Text>
                        ) : null}
                      </View>
                      <Text style={[styles.toMeDateText, { color: textMuted }]}>
                        to me {selectedDateStr} {selectedTimeStr ? `• ${selectedTimeStr}` : ''}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailTopActions}>
                    <TouchableOpacity
                      onPress={() => alert('Notifications toggled')}
                      style={styles.topActionBtn}
                      accessibilityLabel="Notifications"
                    >
                      <Bell size={16} color="#f97316" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        const id = selectedNotification.app_notification_uuid || String(selectedNotification.app_notification_id);
                        handleToggleFlag(id);
                      }}
                      style={styles.topActionBtn}
                      accessibilityLabel="Flag"
                    >
                      <Flag
                        size={16}
                        color={
                          starredMap[selectedNotification.app_notification_uuid || String(selectedNotification.app_notification_id)]
                            ? '#ef4444'
                            : textMuted
                        }
                        fill={
                          starredMap[selectedNotification.app_notification_uuid || String(selectedNotification.app_notification_id)]
                            ? '#ef4444'
                            : 'none'
                        }
                      />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.topActionBtn} accessibilityLabel="More options">
                      <MoreVertical size={16} color={textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setIsMobileDetailOpen(false);
                        if (onCloseRightPane) onCloseRightPane();
                        if (onClose) onClose();
                      }}
                      style={styles.topActionBtn}
                      accessibilityRole="button"
                      accessibilityLabel="Close"
                    >
                      <X size={18} color={textMain} strokeWidth={2} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Subject Box */}
                <View style={styles.subjectContainer}>
                  <Text style={[styles.sectionFieldLabel, { color: textMuted }]}>
                    Subject
                  </Text>
                  <View
                    style={[
                      styles.subjectDisplayBox,
                      { backgroundColor: inputBg, borderColor },
                    ]}
                  >
                    <Text style={[styles.subjectDisplayText, { color: textMain }]}>
                      {selectedNotification.subject || 'Notification'}
                    </Text>
                  </View>
                </View>

                {/* Email / Notification Content Box with Rich Toolbar */}
                <View style={[styles.emailContentSection, { flex: 1, minHeight: 200 }]}>
                  <Text style={[styles.sectionFieldLabel, { color: textMuted }]}>
                    Email Content
                  </Text>

                  <View
                    style={[
                      styles.emailContentBox,
                      { backgroundColor: isDark ? '#141824' : '#ffffff', borderColor, flex: 1 },
                    ]}
                  >
                    {/* Rich Formatting Toolbar */}
                    <View style={[styles.richToolbar, { borderBottomColor: borderColor, backgroundColor: isDark ? '#141e33' : '#f8fafc' }]}>
                      <TouchableOpacity style={styles.toolbarBtn}>
                        <Text style={[styles.toolbarTextBtn, { color: textMain }]}>B</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.toolbarBtn}>
                        <Text style={[styles.toolbarTextBtn, { fontStyle: 'italic', color: textMain }]}>I</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.toolbarBtn}>
                        <Text style={[styles.toolbarTextBtn, { textDecorationLine: 'underline', color: textMain }]}>U</Text>
                      </TouchableOpacity>

                      <View style={[styles.toolbarDivider, { backgroundColor: borderColor }]} />

                      <TouchableOpacity style={styles.toolbarBtn}>
                        <List size={14} color={textMain} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.toolbarBtn}>
                        <ListOrdered size={14} color={textMain} />
                      </TouchableOpacity>

                      <View style={[styles.toolbarDivider, { backgroundColor: borderColor }]} />

                      <TouchableOpacity style={styles.toolbarBtn}>
                        <Link2 size={14} color={textMain} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handlePickDocument}
                        style={styles.toolbarBtn}
                        accessibilityLabel="Attach Document"
                      >
                        <Paperclip size={14} color={textMain} />
                      </TouchableOpacity>
                    </View>

                    {/* Email / Notification Body Inner Text */}
                    <View style={styles.emailBodyInner}>
                      <Text style={[styles.bodyNormalText, { color: textMain }]}>
                        {selectedNotification.body || selectedNotification.description || 'No content provided.'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Attachments Section */}
                <View style={styles.attachmentsSection}>
                  <Text style={[styles.attachmentsHeading, { color: textMain }]}>
                    Attachments ({parsedAttachments.length})
                  </Text>

                  {parsedAttachments.map((att) => (
                    <View
                      key={att.id}
                      style={[
                        styles.attachmentCard,
                        { backgroundColor: inputBg, borderColor },
                      ]}
                    >
                      <View style={styles.attachmentLeft}>
                        <View
                          style={[
                            styles.pdfTypeBox,
                            { backgroundColor: isDark ? '#334155' : '#e2e8f0' },
                          ]}
                        >
                          <Text style={[styles.pdfTypeText, { color: textMuted }]}>
                            {att.type}
                          </Text>
                        </View>
                        <View>
                          <Text style={[styles.attachmentName, { color: textMain }]}>
                            {att.name}
                          </Text>
                          <Text style={[styles.attachmentSize, { color: textMuted }]}>
                            {att.size}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.attachmentActions}>
                        <TouchableOpacity
                          onPress={() => alert(`Downloading ${att.name}...`)}
                          style={styles.attActionBtn}
                          accessibilityLabel="Download Attachment"
                        >
                          <Download size={15} color={textMuted} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => alert(`Previewing ${att.name}...`)}
                          style={styles.attActionBtn}
                          accessibilityLabel="Preview Attachment"
                        >
                          <Eye size={15} color={textMuted} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleRemoveAttachment(att.id)}
                          style={styles.attActionBtn}
                          accessibilityLabel="Remove Attachment"
                        >
                          <X size={15} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}

                  <TouchableOpacity
                    onPress={handlePickDocument}
                    style={[
                      styles.attachFilesOutlineBtn,
                      { borderColor, width: '100%', marginTop: 8, height: 38, justifyContent: 'center' },
                    ]}
                  >
                    <Paperclip size={14} color={textMain} />
                    <Text style={[styles.attachFilesOutlineText, { color: textMain }]}>
                      Attach Files
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Bottom Actions Bar (Reply / Reply All / Forward / Delete) */}
                <View style={[styles.bottomActionsBar, { borderTopColor: borderColor }]}>
                  <View style={styles.bottomLeftActionGroup}>
                    <TouchableOpacity
                      onPress={() => {
                        setIsComposing(true);
                        setComposeTo(selectedNotification.sender_email || selectedNotification.from_email || '');
                        setComposeSubject(
                          selectedNotification.subject?.startsWith('Re:')
                            ? selectedNotification.subject
                            : `Re: ${selectedNotification.subject || ''}`
                        );
                        setComposeBody(
                          `\n\n--- Original Notification ---\nFrom: ${selectedNotification.sender_name || 'Sender'} <${selectedNotification.sender_email || selectedNotification.from_email || ''}>\n\n${selectedNotification.body || ''}`
                        );
                      }}
                      style={[styles.actionOutlineBtn, { borderColor }]}
                    >
                      <Reply size={13} color={textMain} />
                      <Text style={[styles.actionOutlineBtnText, { color: textMain }]}>
                        Reply
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        setIsComposing(true);
                        setComposeTo(selectedNotification.sender_email || selectedNotification.from_email || '');
                        setComposeSubject(
                          selectedNotification.subject?.startsWith('Re:')
                            ? selectedNotification.subject
                            : `Re: ${selectedNotification.subject || ''}`
                        );
                        setComposeBody(
                          `\n\n--- Original Notification ---\nFrom: ${selectedNotification.sender_name || 'Sender'} <${selectedNotification.sender_email || selectedNotification.from_email || ''}>\n\n${selectedNotification.body || ''}`
                        );
                      }}
                      style={[styles.actionOutlineBtn, { borderColor }]}
                    >
                      <ReplyAll size={13} color={textMain} />
                      <Text style={[styles.actionOutlineBtnText, { color: textMain }]}>
                        Reply All
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        setIsComposing(true);
                        setComposeTo('');
                        setComposeSubject(
                          selectedNotification.subject?.startsWith('Fwd:')
                            ? selectedNotification.subject
                            : `Fwd: ${selectedNotification.subject || ''}`
                        );
                        setComposeBody(
                          `\n\n--- Forwarded Notification ---\nFrom: ${selectedNotification.sender_name || 'Sender'} <${selectedNotification.sender_email || selectedNotification.from_email || ''}>\n\n${selectedNotification.body || ''}`
                        );
                      }}
                      style={[styles.actionOutlineBtn, { borderColor }]}
                    >
                      <Forward size={13} color={textMain} />
                      <Text style={[styles.actionOutlineBtnText, { color: textMain }]}>
                        Forward
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    onPress={() => {
                      const id = selectedNotification.app_notification_uuid || String(selectedNotification.app_notification_id);
                      handleDeleteNotification(id);
                    }}
                    style={[styles.deleteOutlineBtn, { borderColor: '#fee2e2' }]}
                  >
                    <Trash2 size={13} color="#ef4444" />
                    <Text style={styles.deleteOutlineBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : (
              <View style={styles.emptySelectionContainer}>
                <Bell size={36} color={textMuted} />
                <Text style={{ color: textMuted, marginTop: 10, fontSize: 13, fontFamily: 'Open Sans' }}>
                  Select a notification to view its content
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  dualPaneWrapper: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    height: '100%',
  },

  // ── Left Pane ─────────────────────────────────────────────────────────────
  leftListPane: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },

  // Subtabs & Pagination
  tabsRow: {
    width: '100%',
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    borderBottomWidth: 1,
  },
  tabsScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  tabItemBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  tabItemBtnActive: {
    borderBottomWidth: 2,
  },
  tabItemText: {
    fontSize: 12,
    fontFamily: 'Open Sans',
  },
  miniPagination: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  paginationText: {
    fontSize: 10.5,
    fontFamily: 'Open Sans',
  },
  pageChevronBtn: {
    padding: 2,
  },

  // Search & New Action Row
  searchAndNewRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  searchInputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
  },
  searchTextInput: {
    flex: 1,
    fontSize: 11.5,
    fontFamily: 'Open Sans',
    padding: 0,
  },
  newNotificationPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    justifyContent: 'center',
  },
  newNotificationPillText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Open Sans',
  },

  // Notification Card Items
  notificationListScroll: {
    flex: 1,
    width: '100%',
  },
  notificationCardItem: {
    width: '100%',
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    gap: 4,
    marginBottom: 8,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  senderNameBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  senderNameLabel: {
    fontSize: 12,
    fontFamily: 'Open Sans',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  relativeTimeText: {
    fontSize: 10,
    fontFamily: 'Open Sans',
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginVertical: 1,
  },
  badgePill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  badgePillText: {
    fontSize: 9.5,
    fontWeight: '600',
    fontFamily: 'Open Sans',
  },
  cardSubjectText: {
    fontSize: 11.5,
    fontFamily: 'Open Sans',
  },
  cardSnippetText: {
    fontSize: 10.5,
    fontFamily: 'Open Sans',
    lineHeight: 14,
  },
  bottomPaginationRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyListState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyListText: {
    fontSize: 12,
    fontFamily: 'Open Sans',
  },

  // ── Right Pane ────────────────────────────────────────────────────────────
  rightDetailPane: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  detailScrollContent: {
    padding: 16,
    gap: 12,
    flexGrow: 1,
  },
  detailHeaderBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  senderProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Open Sans',
  },
  senderDetailsCol: {
    flex: 1,
    gap: 1,
  },
  senderNameAndEmail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  fromNameText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Open Sans',
  },
  fromEmailText: {
    fontSize: 11.5,
    fontFamily: 'Open Sans',
  },
  toMeDateText: {
    fontSize: 10.5,
    fontFamily: 'Open Sans',
  },
  detailTopActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  topActionBtn: {
    padding: 6,
    borderRadius: 6,
  },

  // Subject Section
  subjectContainer: {
    gap: 4,
  },
  sectionFieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'Open Sans',
  },
  subjectDisplayBox: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  subjectDisplayText: {
    fontSize: 12.5,
    fontWeight: '600',
    fontFamily: 'Open Sans',
  },

  // Content Section
  emailContentSection: {
    gap: 4,
  },
  emailContentBox: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  richToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    flexWrap: 'wrap',
  },
  toolbarBtn: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarTextBtn: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Open Sans',
    minWidth: 12,
    textAlign: 'center',
  },
  toolbarDivider: {
    width: 1,
    height: 14,
    marginHorizontal: 2,
  },
  emailBodyInner: {
    padding: 14,
    gap: 10,
  },
  bodyNormalText: {
    fontSize: 12,
    fontFamily: 'Open Sans',
    lineHeight: 18,
  },

  // Attachments Section
  attachmentsSection: {
    gap: 8,
    paddingTop: 4,
  },
  attachmentsHeading: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Open Sans',
  },
  attachmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  attachmentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pdfTypeBox: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfTypeText: {
    fontSize: 9.5,
    fontWeight: '600',
    fontFamily: 'Open Sans',
  },
  attachmentName: {
    fontSize: 11.5,
    fontWeight: '600',
    fontFamily: 'Open Sans',
  },
  attachmentSize: {
    fontSize: 10,
    fontFamily: 'Open Sans',
  },
  attachmentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  attActionBtn: {
    padding: 4,
  },
  attachFilesOutlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  attachFilesOutlineText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'Open Sans',
  },

  // Bottom Action Buttons
  bottomActionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    marginTop: 'auto',
    borderTopWidth: 1,
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  bottomLeftActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionOutlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  actionOutlineBtnText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'Open Sans',
  },
  deleteOutlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: '#fff1f2',
  },
  deleteOutlineBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ef4444',
    fontFamily: 'Open Sans',
  },

  // Compose View
  composeContainerStyle: {
    padding: 16,
    gap: 12,
    flexGrow: 1,
  },
  composeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  detailHeading: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Open Sans',
  },
  closeComposeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldSection: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Open Sans',
  },
  templateDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: 130,
  },
  templateDropdownText: {
    fontSize: 12.5,
    fontWeight: '500',
    fontFamily: 'Open Sans',
  },
  inputBox: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12.5,
    fontFamily: 'Open Sans',
  },
  composeTextArea: {
    minHeight: 180,
    padding: 12,
    fontSize: 12.5,
    fontFamily: 'Open Sans',
    textAlignVertical: 'top',
  },
  composeFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    marginTop: 'auto',
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  sendPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
  },
  sendPrimaryBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '600',
    fontFamily: 'Open Sans',
  },
  outlineActionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  outlineActionBtnText: {
    fontSize: 12.5,
    fontWeight: '500',
    fontFamily: 'Open Sans',
  },

  emptySelectionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
});
