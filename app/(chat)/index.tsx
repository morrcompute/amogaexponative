import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  StatusBar,
  Share,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/providers/theme-provider';
import { useModeContext } from '@/providers/mode-provider';
import { useColorTheme } from '@/providers/color-theme-provider';
import { useAuth } from '@/providers/auth-provider';
import { useChat } from '@/hooks/useChat';
import {
  useToast,
  ChatSidebar,
  ChatCardItem,
  ChatInput,
  ChatHeader,
  ChatBubble,
  ChatMessageList,
  ChatEmptyState,
  ContactManager,
  GroupManager,
  ChatIconBar,
  ChatActionMenu,
  FileUploadProgress,
  TypingIndicator,
  ChatProfileModal,
  ContactInfoView,
  AppNavigationDrawer,
  ComingSoonView,
  ThemeSettingsDrawer,
  PreferencesDrawer,
  PreferencesView,
  AppSettingsView,
  FullPageMap,
  CalendarAppView,
  EmailAppView,
  DEFAULT_MAP_MARKERS,
  DEFAULT_DRAWER_ITEMS,
  app_menu_json,
  colorThemes,
  type ContactItem,
  type GroupItem,
} from 'amogamobileds-v1';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, LogOut, Sun, Moon, X, UserPlus, Menu, Command, MapPin } from 'lucide-react-native';

export default function MobileChatScreen() {
  const insets = useSafeAreaInsets();
  const { colors, resolvedMode, mode, setMode } = useTheme();
  const isDark = resolvedMode === 'dark';
  const { user, profile, signOut } = useAuth();
  const toast = useToast();
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [isAppSettingsOpen, setIsAppSettingsOpen] = useState(false);

  const {
    conversations,
    activeConversationId,
    activeConversation,
    setActiveConversationId,
    messages,
    loadingConversations,
    loadingMessages,
    inputText,
    setInputText,
    isSending,
    uploadingFileName,
    uploadingFileSize,
    replyMessage,
    setReplyMessage,
    handleSendMessage,
    handleSelectAttachmentType,
    handleCameraClick,
    handleDeleteMessage,
    handleForwardMessage,
    startDirectChat,
    startGroupChat,
    addMemberToGroup,
    removeMemberFromGroup,
    loadConversations,
    isOtherTyping,
    sendTypingStatus,
    sendVoiceMessage,
  } = useChat();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isThemeSettingsOpen, setIsThemeSettingsOpen] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const { colorTheme, setColorTheme, resetColorTheme } = useColorTheme();
  const [activeMenuId, setActiveMenuId] = useState<string>('chat');
  const [activeTab, setActiveTab] = useState('chats');
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [activeActionMsgId, setActiveActionMsgId] = useState<string | null>(null);
  const [actionMenuMsg, setActionMenuMsg] = useState<any | null>(null);
  const [forwardTargetMsg, setForwardTargetMsg] = useState<any | null>(null);
  const [forwardSearch, setForwardSearch] = useState('');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [externalReplyMap, setExternalReplyMap] = useState<Record<string, any>>({});
  const [isEmailDetailOrCompose, setIsEmailDetailOrCompose] = useState(false);

  useEffect(() => {
    setIsEmailDetailOrCompose(false);
  }, [activeMenuId]);

  useEffect(() => {
    setShowContactInfo(false);
  }, [activeConversationId]);

  const profileName =
    profile?.display_name ||
    profile?.name ||
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    user?.phone ||
    user?.email?.split('@')[0] ||
    'User';
  const userEmail = profile?.email || user?.email || user?.phone || '';
  const userInitials = useMemo(() => {
    if (profileName && profileName !== 'User') {
      return profileName
        .split(' ')
        .filter(Boolean)
        .map((n: string) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();
    }
    if (userEmail) {
      return userEmail.substring(0, 2).toUpperCase();
    }
    return 'U';
  }, [profileName, userEmail]);

  const activeDrawerItem = useMemo(() => {
    return (
      DEFAULT_DRAWER_ITEMS.find((item) => item.id.toLowerCase() === activeMenuId.toLowerCase()) ||
      DEFAULT_DRAWER_ITEMS[0]
    );
  }, [activeMenuId]);

  // Fast map of messages indexed by both id and sender_message_id
  const messageMap = useMemo(() => {
    const map: Record<string, any> = {};
    messages.forEach((m) => {
      if (m.id) map[m.id] = m;
      if (m.sender_message_id) map[m.sender_message_id] = m;
    });
    return map;
  }, [messages]);

  // Fetch any missing replied messages asynchronously so receiver gets rich previews
  useEffect(() => {
    const missingIds = messages
      .map((m) => m.replyto_message_id)
      .filter((id): id is string => !!id && !messageMap[id] && !externalReplyMap[id]);

    if (missingIds.length === 0) return;

    supabase
      .from('chat_messages')
      .select('id, sender_message_id, sender_user_id, owner_user_id, message, file_name, message_type, direction')
      .in('id', missingIds)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setExternalReplyMap((prev) => {
            const updated = { ...prev };
            data.forEach((d) => {
              if (d.id) updated[d.id] = d;
              if (d.sender_message_id) updated[d.sender_message_id] = d;
            });
            return updated;
          });
        }
      });
  }, [messages, messageMap, externalReplyMap]);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Safe area top padding calculation for Android & iOS notch
  const safeTopPadding = Math.max(
    insets.top,
    Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0
  );

  // Load contacts for current user from contacts table
  const loadContacts = useCallback(async () => {
    if (!user) return;
    setLoadingContacts(true);
    try {
      const { data: contactsData, error } = await supabase
        .from('contacts')
        .select('id, owner_id, contact_user_id, nickname, created_at')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching contacts:', error);
        setContacts([]);
        return;
      }

      if (!contactsData || contactsData.length === 0) {
        setContacts([]);
        return;
      }

      const contactUserIds = contactsData.map((c) => c.contact_user_id).filter(Boolean);
      let profilesMap: Record<string, any> = {};
      if (contactUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, email, avatar, mobile, online')
          .in('id', contactUserIds);

        if (profiles) {
          profiles.forEach((p) => {
            profilesMap[p.id] = p;
          });
        }
      }

      const mappedContacts: ContactItem[] = contactsData.map((c) => {
        const p = profilesMap[c.contact_user_id] || {};
        const displayName = c.nickname || p.name || p.email?.split('@')[0] || 'Contact';
        const email = p.email || '';
        return {
          id: c.id,
          name: displayName,
          email: email,
          avatarUrl: p.avatar || undefined,
          initials: (displayName || email || 'U').slice(0, 2).toUpperCase(),
          isEnabled: p.online || false,
          mobile: p.mobile || undefined,
          contactUserId: c.contact_user_id,
        };
      });

      setContacts(mappedContacts);
    } catch (err) {
      console.error('Failed to load contacts:', err);
    } finally {
      setLoadingContacts(false);
    }
  }, [user]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Add contact by Email (with optional mobile for display)
  const handleAddContact = async (newC: { name: string; mobile?: string; email?: string }) => {
    if (!user) return;
    const nameTrimmed = newC.name?.trim() || '';
    const emailLower = newC.email?.trim().toLowerCase() || '';
    const mobileTrimmed = newC.mobile?.trim() || '';

    if (!nameTrimmed) {
      toast.info('Please enter contact name');
      return;
    }

    if (!emailLower) {
      toast.info('Please enter an email address');
      return;
    }

    if (user.email && user.email.toLowerCase() === emailLower) {
      toast.info('You cannot add yourself as a contact');
      return;
    }

    // Check if already in contact list
    const isAlready = contacts.some((c) => c.email?.toLowerCase() === emailLower);
    if (isAlready) {
      toast.info('This contact is already in your list');
      return;
    }

    try {
      // 0. Ensure current user profile exists in profiles table
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (!myProfile) {
        const myName =
          profile?.name ||
          user.user_metadata?.name ||
          user.user_metadata?.full_name ||
          user.user_metadata?.display_name ||
          user.email?.split('@')[0] ||
          'User';

        await supabase.from('profiles').upsert({
          id: user.id,
          email: user.email || '',
          name: myName,
          online: true,
          offline: false,
          updated_at: new Date().toISOString(),
        } as any);
      }

      // 1. Search for existing profile by email
      const { data: existingProfiles } = await supabase
        .from('profiles')
        .select('id, name, email, mobile')
        .ilike('email', emailLower)
        .limit(1);

      let targetUserId: string;

      if (existingProfiles && existingProfiles.length > 0) {
        targetUserId = existingProfiles[0].id;
      } else {
        // User is not in DB yet - generate UUID and create stub profile
        const newUserId =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                const r = (Math.random() * 16) | 0;
                const v = c === 'x' ? r : (r & 0x3) | 0x8;
                return v.toString(16);
              });

        const displayName = nameTrimmed || emailLower.split('@')[0];
        try {
          const { data: newProfile } = await supabase
            .from('profiles')
            .insert({
              id: newUserId,
              email: emailLower,
              name: displayName,
              mobile: mobileTrimmed || null,
              online: false,
              offline: true,
              updated_at: new Date().toISOString(),
            } as any)
            .select()
            .maybeSingle();

          targetUserId = newProfile?.id || newUserId;
        } catch (profErr) {
          console.warn('Profile stub insert note:', profErr);
          targetUserId = newUserId;
        }
      }

      // Check if contact record already exists
      const { data: existingContacts } = await supabase
        .from('contacts')
        .select('id')
        .eq('owner_id', user.id)
        .eq('contact_user_id', targetUserId)
        .limit(1);

      if (existingContacts && existingContacts.length > 0) {
        toast.info('This contact is already in your list');
        await startDirectChat(targetUserId);
        setIsDetailViewOpen(true);
        setActiveTab('chats');
        return;
      }

      const { error: insertErr } = await supabase.from('contacts').insert({
        owner_id: user.id,
        contact_user_id: targetUserId,
        nickname: nameTrimmed,
        email: emailLower,
        mobile: mobileTrimmed || null,
        user_uuid: user.id,
      } as any);

      if (insertErr) {
        console.error('Failed to create contact:', insertErr);
        toast.error('Failed to save contact: ' + (insertErr.message || 'Error'));
        return;
      }

      toast.success('Contact added successfully');
      await loadContacts();
      await startDirectChat(targetUserId);
      setIsDetailViewOpen(true);
      setActiveTab('chats');
    } catch (err) {
      console.error('Error adding contact:', err);
      toast.error('Failed to add contact');
    }
  };

  const handleDeleteContact = async (c: ContactItem) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', c.id)
        .eq('owner_id', user.id);

      if (error) {
        toast.error('Failed to delete contact');
      } else {
        toast.success('Contact removed');
        await loadContacts();
      }
    } catch (err) {
      toast.error('Failed to delete contact');
    }
  };

  const handleContactChatClick = async (c: ContactItem) => {
    if (c.contactUserId) {
      await startDirectChat(c.contactUserId);
      setIsDetailViewOpen(true);
      setActiveTab('chats');
    }
  };

  const handleAddGroup = async (newGroup: {
    name: string;
    description?: string;
    memberIds?: string[];
  }) => {
    if (!user || !newGroup.name.trim()) return;
    const memberIds = newGroup.memberIds || [];
    await startGroupChat(newGroup.name.trim(), memberIds);
    toast.success(`Group "${newGroup.name}" created`);
    setIsDetailViewOpen(true);
    setActiveTab('chats');
  };

  // Derived groups from conversations
  const groupsList: GroupItem[] = useMemo(() => {
    return conversations
      .filter((c) => c.type === 'group' || c.type === 'channel_group')
      .map((c) => ({
        id: c.id,
        name: c.name || 'Group Chat',
        ownerEmail: user?.email || '',
        membersCount: 3,
        isEnabled: true,
        description: 'Team discussion',
      }));
  }, [conversations, user]);

  // Filtered conversations
  const filteredConversations = useMemo(() => {
    if (!sidebarSearch.trim()) return conversations;
    const q = sidebarSearch.toLowerCase();
    return conversations.filter((c) => {
      const title =
        c.type === 'group'
          ? c.name || 'Group Chat'
          : c.otherMember?.name || c.otherMember?.email || 'Direct Chat';
      return title.toLowerCase().includes(q);
    });
  }, [conversations, sidebarSearch]);

  // Active chat metadata
  const chatTitle = useMemo(() => {
    if (!activeConversation) return 'Select a conversation';
    if (activeConversation.type === 'group') return activeConversation.name || 'Group Chat';
    return activeConversation.otherMember?.name || activeConversation.otherMember?.email || 'Direct Chat';
  }, [activeConversation]);

  const chatSubtitle = useMemo(() => {
    if (!activeConversation) return '';
    if (activeConversation.type === 'group') {
      const count = activeConversation.membersCount || activeConversation.members?.length || 2;
      return `${count} members`;
    }
    if (activeConversation.otherMember?.online) return 'Online';
    if (activeConversation.otherMember?.lastSeen) {
      try {
        const d = new Date(activeConversation.otherMember.lastSeen);
        const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const isToday = new Date().toDateString() === d.toDateString();
        return isToday ? `Last seen today at ${timeStr}` : `Last seen ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
      } catch (e) {
        return 'Last seen recently';
      }
    }
    return 'Offline';
  }, [activeConversation]);

  const otherMember = activeConversation?.otherMember;
  const isDirect = activeConversation?.type === 'direct';
  const isOtherInContacts = useMemo(() => {
    if (!isDirect || !otherMember) return true;
    return contacts.some(
      (c) =>
        (c.contactUserId && c.contactUserId === otherMember.id) ||
        (c.email && otherMember.email && c.email.toLowerCase() === otherMember.email.toLowerCase())
    );
  }, [contacts, otherMember, isDirect]);

  const handleSelectChat = (id: string) => {
    setActiveConversationId(id);
    setIsDetailViewOpen(true);
  };

  return (
    <View style={[styles.rootContainer, { backgroundColor: colors.background, paddingTop: safeTopPadding }]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? safeTopPadding : 10}
      >
        {activeMenuId === 'chat' ? (
          /* ──────────────── Main List View (Chats, Contact, Groups, Folder) ──────────────── */
          !isDetailViewOpen ? (
            <View style={{ flex: 1, paddingBottom: insets.bottom }}>
              {/* Top Bar with Logo Drawer Button and Clean Title */}
              <View style={[styles.userTopBar, { borderBottomColor: isDark ? colors.border : '#f1f5f9' }]}>
                <View style={styles.userBarLeft}>
                  {/* Purple Amoga Logo Button to open navigation drawer */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setIsDrawerOpen(true)}
                    style={[styles.mobileLogoBadge, { backgroundColor: colors.primary }]}
                    accessibilityRole="button"
                    accessibilityLabel="Open Navigation Menu"
                  >
                    <Command size={18} color="#ffffff" strokeWidth={2.4} />
                  </TouchableOpacity>

                  <Text style={[styles.topBarTitle, { color: colors.foreground, fontSize: 16, fontWeight: '700' }]}>
                    Chats
                  </Text>
                </View>
              </View>

            {/* Reusable ChatSidebar Component with Subtabs */}
            <ChatSidebar
              tabs={[
                { id: 'chats', label: 'Chats' },
                { id: 'contact', label: 'Contact' },
                { id: 'groups', label: 'Groups' },
                { id: 'folder', label: 'Folder' },
              ]}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              searchValue={sidebarSearch}
              onSearchChange={setSidebarSearch}
              searchPlaceholder="Search..."
              showSearch={activeTab === 'chats'}
              showSectionHeader={activeTab === 'chats'}
              sectionLabel="CHATS"
              sectionCount={filteredConversations.length}
            >
              {/* TAB 1: CHATS */}
              {activeTab === 'chats' && (
                loadingConversations ? (
                  <View style={styles.centered}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                ) : filteredConversations.length === 0 ? (
                  <View style={styles.centered}>
                    <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                      No conversations yet
                    </Text>
                  </View>
                ) : (
                  filteredConversations.map((item) => {
                    const title =
                      item.type === 'group'
                        ? item.name || 'Group Chat'
                        : item.otherMember?.name || item.otherMember?.email || 'Direct Chat';
                    const lastMsg =
                      item.lastMessage?.file_name ||
                      item.lastMessage?.message ||
                      (item.lastMessage?.file_url ? 'Attachment' : 'No messages yet');

                    return (
                      <ChatCardItem
                        key={item.id}
                        id={item.id}
                        title={title}
                        badgeLabel="Chat"
                        lastMessage={lastMsg}
                        time={item.lastMessage?.created_at ? new Date(item.lastMessage.created_at) : undefined}
                        membersCount={item.membersCount || (item.type === 'group' ? (item.members?.length || 2) : 2)}
                        onlineCount={item.otherMember?.online ? 1 : 0}
                        unreadCount={item.unreadCount}
                        isActive={item.id === activeConversationId}
                        isGroup={item.type === 'group'}
                        onClick={() => handleSelectChat(item.id)}
                        onPress={() => handleSelectChat(item.id)}
                      />
                    );
                  })
                )
              )}

              {/* TAB 2: CONTACTS */}
              {activeTab === 'contact' && (
                <ContactManager
                  contacts={contacts}
                  style={{ marginHorizontal: 0, marginTop: 4, borderWidth: 0 }}
                  onChatClick={handleContactChatClick}
                  onAddContact={handleAddContact}
                  onDeleteClick={handleDeleteContact}
                />
              )}

              {/* TAB 3: GROUPS */}
              {activeTab === 'groups' && (
                <GroupManager
                  groups={groupsList}
                  contacts={contacts}
                  style={{ marginHorizontal: 0, marginTop: 4, borderWidth: 0 }}
                  onChatClick={(g) => {
                    setActiveConversationId(g.id);
                    setIsDetailViewOpen(true);
                  }}
                  onAddGroup={handleAddGroup}
                />
              )}

              {/* TAB 4: FOLDER */}
              {activeTab === 'folder' && (
                <View style={{ padding: 16 }}>
                  <Text style={{ color: colors.foreground, fontWeight: '600', marginBottom: 8 }}>
                    Shared Documents & Files
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                    All parsed PDFs and attachments are organized here.
                  </Text>
                </View>
              )}
            </ChatSidebar>
          </View>
        ) : (
          /* ──────────────── Conversation Detail View ──────────────── */
          <View style={{ flex: 1, backgroundColor: colors.background, paddingBottom: isKeyboardVisible ? 0 : insets.bottom }}>
            {showContactInfo ? (
              <ContactInfoView
                conversation={activeConversation}
                messages={messages}
                onClose={() => setShowContactInfo(false)}
              />
            ) : (
              <>
                {/* Header with Back Button */}
                <View style={[styles.detailHeaderWrap, { borderBottomColor: isDark ? colors.border : '#f1f5f9' }]}>
                  <TouchableOpacity
                    onPress={() => setIsDetailViewOpen(false)}
                    style={styles.backBtn}
                  >
                    <ChevronLeft size={24} color={colors.foreground} />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <ChatHeader
                      title={chatTitle}
                      subtitle={chatSubtitle}
                      status={activeConversation?.otherMember?.online ? 'online' : 'offline'}
                      isGroup={activeConversation?.type === 'group'}
                      memberCount={activeConversation?.type === 'group' ? (activeConversation.membersCount || activeConversation.members?.length || 2) : undefined}
                      showDefaultActions={true}
                      onAvatarClick={() => setShowContactInfo(true)}
                    />
                  </View>
                </View>

            {/* Receiver Contact Banner: Shown if receiver does not have sender in contacts */}
            {isDirect && otherMember && !isOtherInContacts && (
              <View
                style={[
                  styles.notInContactBanner,
                  {
                    backgroundColor: isDark ? '#1e1b4b' : '#eef2ff',
                    borderBottomColor: isDark ? '#3730a3' : '#c7d2fe',
                  },
                ]}
              >
                <View style={styles.notInContactBannerLeft}>
                  <UserPlus size={16} color={isDark ? '#a5b4fc' : '#4f46e5'} />
                  <Text
                    style={[
                      styles.notInContactBannerText,
                      { color: isDark ? '#e0e7ff' : '#312e81' },
                    ]}
                    numberOfLines={1}
                  >
                    This user is not on your contact list.
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.notInContactBannerBtn,
                    { backgroundColor: isDark ? '#4f46e5' : '#4338ca' },
                  ]}
                  onPress={() =>
                    handleAddContact({
                      name: otherMember.name || otherMember.email?.split('@')[0] || 'Contact',
                      email: otherMember.email || '',
                    })
                  }
                >
                  <Text style={styles.notInContactBannerBtnText}>Click here to add</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Message List */}
            <ChatMessageList>
              {loadingMessages ? (
                <View style={styles.centered}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : messages.length === 0 ? (
                <ChatEmptyState
                  title="Say Hello 👋"
                  description={`Start chatting with ${chatTitle}`}
                  onAction={() => setInputText('Hello! 👋')}
                  actionLabel="Send Greeting"
                />
              ) : (
                messages.map((msg) => {
                  const isOwn = msg.owner_user_id === user?.id && msg.direction === 'Sent';
                  const senderName = isOwn
                    ? profile?.name || 'Mohammed Aman'
                    : activeConversation?.otherMember?.name || 'Aman';

                  let locationData: { latitude: number; longitude: number; address?: string; title?: string } | undefined = undefined;
                  if (msg.message_type === 'location' && msg.file_url) {
                    try {
                      locationData = JSON.parse(msg.file_url);
                    } catch (e) {
                      // plain text fallback
                    }
                  }

                  const isLocation = msg.message_type === 'location';
                  const fileNameOrMsg = msg.file_name || msg.message || '';
                  const isImage = msg.message_type === 'image' || /\.(jpg|jpeg|png|webp|gif|bmp|heic|svg)$/i.test(fileNameOrMsg) || msg.mime_type?.startsWith('image/');
                  const isVideo = msg.message_type === 'video' || /\.(mp4|mov|mkv|webm|avi)$/i.test(fileNameOrMsg) || msg.mime_type?.startsWith('video/');
                  const isAudio = msg.message_type === 'audio' || /\.(m4a|mp3|wav|aac|ogg|flac|opus)$/i.test(fileNameOrMsg) || msg.mime_type?.startsWith('audio/');
                  const isDoc = msg.message_type === 'file' || msg.message_type === 'document' || /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|rtf|zip|rar)$/i.test(fileNameOrMsg);
                  const isMediaOrDoc = !!msg.file_url || isImage || isVideo || isAudio || isDoc;

                  const hasFileAttachment = !isLocation && isMediaOrDoc;
                  const attachmentUrl = msg.file_url || (msg.message && (msg.message.startsWith('http') || msg.message.startsWith('file:') || msg.message.startsWith('content:') || msg.message.startsWith('data:')) ? msg.message : undefined);
                  const resolvedType = isImage ? 'image' : isVideo ? 'video' : isAudio ? 'audio' : (/\.pdf$/i.test(fileNameOrMsg) ? 'pdf' : 'file');

                  const isSelected = activeActionMsgId === msg.id;

                  // Resolve actual replied message for quote preview
                  const targetReplyId = msg.replyto_message_id;
                  const repliedMsg = targetReplyId
                    ? (messageMap[targetReplyId] || externalReplyMap[targetReplyId] || null)
                    : null;

                  const isRepliedOwn = repliedMsg
                    ? (repliedMsg.sender_user_id === user?.id || (('owner_user_id' in repliedMsg) && (repliedMsg as any).owner_user_id === user?.id && (repliedMsg as any).direction === 'Sent'))
                    : false;

                  const replyPreviewData = repliedMsg
                    ? {
                        id: targetReplyId || undefined,
                        senderName: isRepliedOwn ? 'You' : (activeConversation?.otherMember?.name || activeConversation?.otherMember?.email?.split('@')[0] || 'Contact'),
                        content:
                          repliedMsg.message ||
                          repliedMsg.file_name ||
                          (repliedMsg.message_type === 'image'
                            ? '📷 Photo'
                            : repliedMsg.message_type === 'video'
                            ? '🎥 Video'
                            : repliedMsg.message_type === 'audio'
                            ? '🎤 Voice note'
                            : '📎 Attachment'),
                      }
                    : undefined;

                  const handleTriggerReply = () => {
                    setReplyMessage({
                      id: msg.id,
                      senderName: isOwn ? 'You' : senderName,
                      content:
                        msg.message ||
                        msg.file_name ||
                        (isImage ? '📷 Photo' : isVideo ? '🎥 Video' : isAudio ? '🎤 Voice note' : '📎 Attachment'),
                    });
                    toast.info(`Replying to ${isOwn ? 'yourself' : senderName}`);
                  };

                  return (
                    <View key={msg.id} style={styles.messageRowWrapper}>
                      <ChatBubble
                        id={msg.id}
                        isOwn={isOwn}
                        senderName={senderName}
                        content={isLocation ? undefined : (msg.message || undefined)}
                        time={new Date(msg.created_at)}
                        status={isOwn ? (msg.received ? 'read' : msg.sent ? 'sent' : 'sending') : undefined}
                        location={locationData}
                        isSelected={isSelected}
                        onPress={() => setActiveActionMsgId(isSelected ? null : msg.id)}
                        onReply={handleTriggerReply}
                        attachments={
                          hasFileAttachment
                            ? [
                                {
                                  id: msg.id,
                                  name: msg.file_name || (msg.message && /\.[a-z0-9]{3,4}$/i.test(msg.message) ? msg.message : isImage ? 'Photo.jpg' : isAudio ? 'Voice Note.m4a' : 'Attachment'),
                                  size: msg.file_size || 507904,
                                  type: resolvedType,
                                  statusText: 'Parsed',
                                  url: attachmentUrl,
                                },
                              ]
                            : undefined
                        }
                        replyTo={replyPreviewData}
                      />

                      {/* Floating / Inline ChatIconBar for selected message */}
                      {isSelected && (
                        <View style={styles.iconBarWrapper}>
                          <ChatIconBar
                            onThumbUp={() => {
                              toast.success('Liked');
                              setActiveActionMsgId(null);
                            }}
                            onThumbDown={() => {
                              toast.info('Disliked');
                              setActiveActionMsgId(null);
                            }}
                            onCopy={() => {
                              toast.success('Copied to clipboard');
                              setActiveActionMsgId(null);
                            }}
                            onShare={() => {
                              setForwardTargetMsg(msg);
                              setActiveActionMsgId(null);
                            }}
                            onMore={() => {
                              setActionMenuMsg({
                                ...msg,
                                isOwn,
                                senderName,
                              });
                              setActiveActionMsgId(null);
                            }}
                          />
                        </View>
                      )}
                    </View>
                  );
                })
              )}

              {/* Realtime Typing Indicator */}
              {isOtherTyping && (
                <TypingIndicator
                  label={`${activeConversation?.otherMember?.name || 'Someone'} is typing...`}
                />
              )}
            </ChatMessageList>

            {/* File Upload Progress — shown while uploading any attachment */}
            {isSending && uploadingFileName ? (
              <View style={styles.uploadProgressWrap}>
                <FileUploadProgress
                  fileName={uploadingFileName}
                  fileSize={
                    uploadingFileSize
                      ? uploadingFileSize < 1024 * 1024
                        ? `${Math.round(uploadingFileSize / 1024)} KB`
                        : `${(uploadingFileSize / (1024 * 1024)).toFixed(1)} MB`
                      : undefined
                  }
                  fileType={uploadingFileName.split('.').pop()?.toUpperCase() || 'FILE'}
                  initialProgress={20}
                  status="uploading"
                />
              </View>
            ) : null}

            {/* Input Composer */}
            <ChatInput
              value={inputText}
              onChange={setInputText}
              onSend={handleSendMessage}
              isLoading={isSending}
              placeholder="Message"
              onSelectAttachmentType={handleSelectAttachmentType}
              onCameraClick={handleCameraClick}
              onTyping={sendTypingStatus}
              onVoiceRecordComplete={(uri, dur) => sendVoiceMessage(uri, dur)}
              replyMessage={
                replyMessage
                  ? {
                      senderName: replyMessage.senderName,
                      content: replyMessage.content,
                      onClear: () => setReplyMessage(null),
                    }
                  : undefined
              }
            />

            {/* Full Action Menu Modal (Triggered by 3-dot More in ChatIconBar) */}
            <Modal
              visible={!!actionMenuMsg}
              transparent
              animationType="fade"
              onRequestClose={() => setActionMenuMsg(null)}
            >
              <Pressable
                style={styles.actionMenuBackdrop}
                onPress={() => setActionMenuMsg(null)}
              >
                <View style={styles.actionMenuCardWrap}>
                  <ChatActionMenu
                    isOpen={true}
                    isOwnMessage={actionMenuMsg?.isOwn}
                    onClose={() => setActionMenuMsg(null)}
                    onSelect={(actionId) => {
                      if (!actionMenuMsg) return;
                      const cur = actionMenuMsg;
                      if (actionId === 'reply') {
                        setReplyMessage({
                          id: cur.id,
                          senderName: cur.isOwn ? 'You' : cur.senderName,
                          content: cur.message || cur.file_name || 'Attachment',
                        });
                        toast.info('Replying to message');
                      } else if (actionId === 'forward') {
                        setForwardTargetMsg(cur);
                      } else if (actionId === 'delete-for-me') {
                        handleDeleteMessage(cur.id, 'me');
                      } else if (actionId === 'delete-for-everyone') {
                        handleDeleteMessage(cur.id, 'everyone');
                      } else if (actionId === 'delete') {
                        handleDeleteMessage(cur.id, cur.isOwn ? 'everyone' : 'me');
                      } else if (actionId === 'pin') {
                        toast.success('Message pinned');
                      } else if (actionId === 'star') {
                        toast.success('Message starred');
                      } else if (actionId === 'favorite') {
                        toast.success('Added to favorites');
                      } else if (actionId === 'archive') {
                        toast.success('Conversation archived');
                      }
                      setActionMenuMsg(null);
                    }}
                  />
                </View>
              </Pressable>
            </Modal>

            {/* Contact / Group Info View Modal */}
            <Modal
              visible={showContactInfo}
              animationType="slide"
              onRequestClose={() => setShowContactInfo(false)}
            >
              <ContactInfoView
                conversation={activeConversation}
                messages={messages}
                currentUserId={user?.id}
                contacts={contacts}
                onAddMember={(uid) => {
                  if (activeConversationId) return addMemberToGroup(activeConversationId, uid);
                }}
                onRemoveMember={(uid) => {
                  if (activeConversationId) return removeMemberFromGroup(activeConversationId, uid);
                }}
                onClose={() => setShowContactInfo(false)}
              />
            </Modal>

            {/* In-App Forward Message Picker Modal (Forward to ANY Chat) */}
            <Modal
              visible={!!forwardTargetMsg}
              transparent
              animationType="slide"
              onRequestClose={() => setForwardTargetMsg(null)}
            >
              <View style={styles.forwardModalOverlay}>
                <View
                  style={[
                    styles.forwardModalContent,
                    {
                      backgroundColor: isDark ? '#141418' : '#ffffff',
                      borderColor: colors.border,
                    },
                  ]}
                >
                  {/* Forward Modal Header */}
                  <View style={[styles.forwardHeader, { borderBottomColor: isDark ? '#27272a' : '#e2e8f0' }]}>
                    <Text style={[styles.forwardTitle, { color: colors.foreground }]}>
                      Forward to...
                    </Text>
                    <TouchableOpacity
                      onPress={() => setForwardTargetMsg(null)}
                      style={styles.forwardCloseBtn}
                    >
                      <X size={18} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>

                  {/* Search Input */}
                  <View style={styles.forwardSearchWrap}>
                    <TextInput
                      value={forwardSearch}
                      onChangeText={setForwardSearch}
                      placeholder="Search conversations..."
                      placeholderTextColor={colors.mutedForeground}
                      style={[
                        styles.forwardSearchInput,
                        {
                          backgroundColor: isDark ? '#1e1e24' : '#f1f5f9',
                          color: colors.foreground,
                          borderColor: isDark ? '#27272a' : '#e2e8f0',
                        },
                      ]}
                    />
                  </View>

                  {/* Conversation List */}
                  <ScrollView style={styles.forwardList} keyboardShouldPersistTaps="handled">
                    {conversations
                      .filter((c) => {
                        const name =
                          c.type === 'group'
                            ? c.name || 'Group Chat'
                            : c.otherMember?.name || c.otherMember?.email || 'Direct Chat';
                        return name.toLowerCase().includes(forwardSearch.toLowerCase());
                      })
                      .map((c) => {
                        const name =
                          c.type === 'group'
                            ? c.name || 'Group Chat'
                            : c.otherMember?.name || c.otherMember?.email || 'Direct Chat';
                        return (
                          <TouchableOpacity
                            key={c.id}
                            onPress={async () => {
                              if (!forwardTargetMsg) return;
                              await handleForwardMessage(c.id, forwardTargetMsg);
                              setForwardTargetMsg(null);
                            }}
                            style={[
                              styles.forwardItem,
                              { borderBottomColor: isDark ? '#1e1e24' : '#f8fafc' },
                            ]}
                          >
                            <View
                              style={[
                                styles.forwardAvatar,
                                { backgroundColor: isDark ? '#312e81' : '#dbeafe' },
                              ]}
                            >
                              <Text style={[styles.forwardAvatarText, { color: isDark ? '#a5b4fc' : '#2563eb' }]}>
                                {name.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.forwardItemName, { color: colors.foreground }]} numberOfLines={1}>
                                {name}
                              </Text>
                              <Text style={[styles.forwardItemSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                                {c.type === 'group' ? 'Group' : c.otherMember?.online ? 'Online' : 'Chat'}
                              </Text>
                            </View>
                            <View style={[styles.forwardSendBadge, { backgroundColor: '#0284c7' }]}>
                              <Text style={styles.forwardSendText}>Send</Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                  </ScrollView>

                  {/* Share Externally Button */}
                  <TouchableOpacity
                    onPress={async () => {
                      if (!forwardTargetMsg) return;
                      try {
                        await Share.share({
                          message: forwardTargetMsg.message || forwardTargetMsg.file_url || 'Shared message',
                          title: 'Forward Message',
                        });
                      } catch (e) {}
                      setForwardTargetMsg(null);
                    }}
                    style={[styles.shareExternalBtn, { backgroundColor: isDark ? '#27272a' : '#f1f5f9' }]}
                  >
                    <Text style={[styles.shareExternalText, { color: colors.foreground }]}>
                      Share to other apps...
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>

            {/* Telegram-Style Shared Media & Profile Modal */}
            <ChatProfileModal
              visible={isProfileModalOpen}
              onClose={() => setIsProfileModalOpen(false)}
              conversation={activeConversation}
              messages={messages}
            />
            </>
          )}
        </View>
        )
      ) : activeMenuId === 'calendar' ? (
        /* ──────────────── Calendar & Tasks View ──────────────── */
        <View style={{ flex: 1, backgroundColor: colors.background, paddingBottom: insets.bottom }}>
          {/* Top Bar with Logo Drawer Button and Clean Title */}
          <View style={[styles.userTopBar, { borderBottomColor: isDark ? colors.border : '#f1f5f9' }]}>
            <View style={styles.userBarLeft}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setIsDrawerOpen(true)}
                style={[styles.mobileLogoBadge, { backgroundColor: colors.primary }]}
                accessibilityRole="button"
                accessibilityLabel="Open Navigation Menu"
              >
                <Command size={18} color="#ffffff" strokeWidth={2.4} />
              </TouchableOpacity>

              <Text style={[styles.topBarTitle, { color: colors.foreground, fontSize: 16, fontWeight: '700' }]}>
                Calendar & Tasks
              </Text>
            </View>
          </View>

          <CalendarAppView initialTab="today" onOpenDrawer={() => setIsDrawerOpen(true)} />
        </View>
      ) : activeMenuId === 'email' || activeMenuId === 'mail' ? (
        /* ──────────────── Email & Messages View ──────────────── */
        <View
          style={{
            flex: 1,
            backgroundColor: colors.background,
            paddingBottom: insets.bottom,
            width: '100%',
          }}
        >
          {/* Top Bar with Logo Drawer Button and Clean Title (hidden in detail or compose view) */}
          {!isEmailDetailOrCompose && (
            <View style={[styles.userTopBar, { borderBottomColor: isDark ? colors.border : '#f1f5f9' }]}>
              <View style={styles.userBarLeft}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setIsDrawerOpen(true)}
                  style={[styles.mobileLogoBadge, { backgroundColor: colors.primary }]}
                  accessibilityRole="button"
                  accessibilityLabel="Open Navigation Menu"
                >
                  <Command size={18} color="#ffffff" strokeWidth={2.4} />
                </TouchableOpacity>

                <Text style={[styles.topBarTitle, { color: colors.foreground, fontSize: 16, fontWeight: '600', fontFamily: 'Open Sans' }]}>
                  Email
                </Text>
              </View>
            </View>
          )}

          <EmailAppView
            initialTab="Inbox"
            onOpenDrawer={() => setIsDrawerOpen(true)}
            onViewStateChange={({ isDetailOpen, isComposing }) => {
              setIsEmailDetailOrCompose(isDetailOpen || isComposing);
            }}
          />
        </View>
      ) : (
        /* ──────────────── Non-Chat Menu Items (Screenshot 1) ──────────────── */
        <View style={{ flex: 1, backgroundColor: colors.background, paddingBottom: insets.bottom }}>
          {/* Top Bar with Logo Drawer Button and Title matching Screenshot 1 */}
          <View style={[styles.userTopBar, { borderBottomColor: isDark ? colors.border : '#f1f5f9' }]}>
            <View style={styles.userBarLeft}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setIsDrawerOpen(true)}
                style={[styles.mobileLogoBadge, { backgroundColor: colors.primary }]}
                accessibilityRole="button"
                accessibilityLabel="Open Navigation Menu"
              >
                <Command size={18} color="#ffffff" strokeWidth={2.4} />
              </TouchableOpacity>

              <Text style={[styles.topBarTitle, { color: colors.foreground, fontSize: 16, fontWeight: '700' }]}>
                {activeDrawerItem.label}
              </Text>
            </View>
          </View>

          <ComingSoonView
            title={activeDrawerItem.label}
            icon={activeDrawerItem.icon}
            onGoToChat={() => {
              setActiveMenuId('chat');
              setIsDetailViewOpen(false);
            }}
          />
        </View>
      )}
      </KeyboardAvoidingView>

      {/* Slide-out Mobile Navigation Drawer (Screenshot 2) */}
      <AppNavigationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        activeId={activeMenuId}
        onSelect={(id) => {
          setActiveMenuId(id);
          setIsDetailViewOpen(false);
        }}
        workspaceName="Amoga App"
        workspaceSubtitle="Workspace"
        userName={profileName}
        userSubtitle="My Account"
        userInitials={userInitials}
        onProfilePress={() => setIsProfileModalOpen(true)}
        onMapPress={() => {
          setIsDrawerOpen(false);
          setIsMapModalOpen(true);
        }}
        onThemePress={() => setIsThemeSettingsOpen(true)}
        onPreferencesPress={() => setIsPreferencesOpen(true)}
        onPreferencePress={() => setIsPreferencesOpen(true)}
        onAppSettingsPress={() => {
          setIsDrawerOpen(false);
          setIsAppSettingsOpen(true);
        }}
        onAppSettingPress={() => {
          setIsDrawerOpen(false);
          setIsAppSettingsOpen(true);
        }}
        onSettingsPress={() => {
          setIsDrawerOpen(false);
          setIsAppSettingsOpen(true);
        }}
        onSettingPress={() => {
          setIsDrawerOpen(false);
          setIsAppSettingsOpen(true);
        }}
        onSignOut={signOut}
        primaryColor={colors.primary}
      />

      {/* Full View Map Modal for Mobile APK */}
      <Modal
        visible={isMapModalOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setIsMapModalOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
          {/* Top Header Bar with Title and Close Cross button on right */}
          <View
            style={{
              height: 52,
              paddingHorizontal: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: colors.card || colors.background,
              zIndex: 10,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: isDark ? '#1e3a8a' : '#dbeafe',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MapPin size={17} color="#2563eb" strokeWidth={2.2} />
              </View>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: colors.foreground,
                  fontFamily: 'Open Sans',
                }}
              >
                My Map
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setIsMapModalOpen(false)}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: isDark ? '#27272a' : '#f1f5f9',
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              accessibilityRole="button"
              accessibilityLabel="Close My Map"
            >
              <X size={16} color={colors.mutedForeground} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* Full-Length Map */}
          <View style={{ flex: 1, width: '100%', height: '100%', overflow: 'hidden' }}>
            <FullPageMap
              markers={DEFAULT_MAP_MARKERS}
              defaultCenter={[23.2599, 77.4126]}
              defaultZoom={4}
              height="100%"
            />
          </View>
        </View>
      </Modal>

      {/* App Settings Modal (Environment & Integrations) */}
      <Modal
        visible={isAppSettingsOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setIsAppSettingsOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
          <AppSettingsView
            onClose={() => setIsAppSettingsOpen(false)}
            title="App Settings"
          />
        </View>
      </Modal>

      {/* Tweakcn Theme Settings Drawer */}
      <ThemeSettingsDrawer
        isOpen={isThemeSettingsOpen}
        onClose={() => setIsThemeSettingsOpen(false)}
        appearanceMode={mode}
        onModeChange={(m) => setMode(m)}
        currentColorTheme={colorTheme}
        onColorThemeChange={setColorTheme}
        onResetTheme={resetColorTheme}
        availableThemes={colorThemes}
      />

      {/* Application Preferences Settings Modal */}
      <Modal
        visible={isPreferencesOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsPreferencesOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: safeTopPadding }}>
          <PreferencesView
            onClose={() => setIsPreferencesOpen(false)}
            primaryColor={colors.primary}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  userTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  userBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  mobileLogoBadge: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Open Sans',
  },
  avatarCircleSmall: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTextSmall: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  userActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  topIconBtn: {
    padding: 6,
    borderRadius: 6,
  },
  detailHeaderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  messageRowWrapper: {
    position: 'relative',
    width: '100%',
  },
  iconBarWrapper: {
    marginVertical: 4,
    alignSelf: 'flex-start',
    paddingLeft: 48,
    zIndex: 10,
  },
  actionMenuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  actionMenuCardWrap: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  forwardModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  forwardModalContent: {
    maxHeight: '80%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 16,
    paddingBottom: 24,
  },
  forwardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  forwardTitle: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'Open Sans',
  },
  forwardCloseBtn: {
    padding: 4,
  },
  forwardSearchWrap: {
    marginTop: 12,
    marginBottom: 8,
  },
  forwardSearchInput: {
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: 'Open Sans',
  },
  forwardList: {
    maxHeight: 280,
  },
  forwardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 12,
  },
  forwardAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forwardAvatarText: {
    fontSize: 16,
    fontWeight: '700',
  },
  forwardItemName: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Open Sans',
  },
  forwardItemSub: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: 'Open Sans',
  },
  forwardSendBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  forwardSendText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  shareExternalBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareExternalText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Open Sans',
  },
  uploadProgressWrap: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  notInContactBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: 1,
    gap: 8,
  },
  notInContactBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  notInContactBannerText: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Open Sans',
    flex: 1,
  },
  notInContactBannerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  notInContactBannerBtnText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: '600',
    fontFamily: 'Open Sans',
  },
});
