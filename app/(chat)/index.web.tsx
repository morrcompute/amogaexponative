import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  Modal,
  Pressable,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
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
  TypingIndicator,
  ChatIconBar,
  ChatActionMenu,
  ChatProfileModal,
  ContactInfoView,
  AppNavigationSidebar,
  AppNavigationDrawer,
  ComingSoonView,
  ThemeSettingsDrawer,
  PreferencesDrawer,
  AppSettingsView,
  FullPageMap,
  CalendarAppView,
  EmailAppView,
  DEFAULT_MAP_MARKERS,
  DEFAULT_NAV_ITEMS,
  app_menu_json,
  type ContactItem,
  type GroupItem,
} from 'amogamobileds-v1';
// Local component copies to avoid production bundle resolution issues on Vercel
import { ThemeSettingsView } from '@/components/theme-settings-view';
import { PreferencesView } from '@/components/preferences-view';
import { supabase } from '@/lib/supabase';
import { UserPlus, Palette, LogOut, Sparkles, Command, ChevronLeft, Menu, X, MapPin } from 'lucide-react-native';

export default function ChatWebScreen() {
  const { colors, resolvedMode, toggleMode } = useTheme();
  const isDark = resolvedMode === 'dark';
  const { user, profile, signOut } = useAuth();
  const toast = useToast();

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
    replyMessage,
    setReplyMessage,
    handleSendMessage,
    handleSelectAttachmentType,
    handleCameraClick,
    handleDeleteMessage,
    startDirectChat,
    startGroupChat,
    loadConversations,
    isOtherTyping,
    sendTypingStatus,
    sendVoiceMessage,
  } = useChat();

  const { width } = useWindowDimensions();
  const isMobileOrTablet = width < 768;
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isThemeSettingsOpen, setIsThemeSettingsOpen] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isMyProfileOpen, setIsMyProfileOpen] = useState(false);
  const [isMyMapOpen, setIsMyMapOpen] = useState(false);
  const [isAppSettingsOpen, setIsAppSettingsOpen] = useState(false);
  const modeContext = useModeContext();
  const { colorTheme, setColorTheme, resetColorTheme, colorThemes } = useColorTheme();

  // Strictly keep mobile drawer closed when on desktop view
  useEffect(() => {
    if (!isMobileOrTablet) {
      setIsDrawerOpen(false);
    }
  }, [isMobileOrTablet]);
  const [mainNavId, setMainNavId] = useState<string>('chat');
  const [activeTab, setActiveTab] = useState('chats');
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [activeActionMsgId, setActiveActionMsgId] = useState<string | null>(null);
  const [actionMenuMsg, setActionMenuMsg] = useState<any | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [externalReplyMap, setExternalReplyMap] = useState<Record<string, any>>({});
  const [isEmailDetailOrCompose, setIsEmailDetailOrCompose] = useState(false);

  useEffect(() => {
    setIsEmailDetailOrCompose(false);
  }, [mainNavId]);

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

  const myProfileConversation = useMemo(() => {
    const name = profileName;
    const email = userEmail;
    return {
      id: 'my-profile',
      title: name,
      name: name,
      type: 'direct' as const,
      image: null,
      created_by: user?.id || null,
      otherMember: {
        id: user?.id || 'me',
        name: name,
        email: email,
        online: true,
      },
      is_group: false,
      created_at: '',
      updated_at: '',
    };
  }, [profileName, userEmail, user]);

  const activeNavItem = useMemo(() => {
    return (
      DEFAULT_NAV_ITEMS.find((item) => item.id.toLowerCase() === mainNavId.toLowerCase()) ||
      DEFAULT_NAV_ITEMS[0]
    );
  }, [mainNavId]);

  // Fast map of messages indexed by both id and sender_message_id
  const messageMap = useMemo(() => {
    const map: Record<string, any> = {};
    messages.forEach((m) => {
      if (m.id) map[m.id] = m;
      if (m.sender_message_id) map[m.sender_message_id] = m;
    });
    return map;
  }, [messages]);

  // Fetch any missing replied messages asynchronously
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

      if (error || !contactsData || contactsData.length === 0) {
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

  // Add contact (user can add ANY email whether in DB or not)
  const handleAddContact = async (newC: { name: string; email: string }) => {
    if (!user) return;
    const emailLower = newC.email.trim().toLowerCase();
    if (!emailLower) {
      toast.info('Please enter an email address');
      return;
    }

    if (user.email && user.email.toLowerCase() === emailLower) {
      toast.info('You cannot add yourself as a contact');
      return;
    }

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

      const { data: existingProfiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .ilike('email', emailLower)
        .limit(1);

      let targetUserId: string;

      if (existingProfiles && existingProfiles.length > 0) {
        targetUserId = existingProfiles[0].id;
      } else {
        const newUserId =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                const r = (Math.random() * 16) | 0;
                const v = c === 'x' ? r : (r & 0x3) | 0x8;
                return v.toString(16);
              });

        const displayName = newC.name?.trim() || emailLower.split('@')[0];
        try {
          const { data: newProfile } = await supabase
            .from('profiles')
            .insert({
              id: newUserId,
              email: emailLower,
              name: displayName,
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

      const { data: existingContacts } = await supabase
        .from('contacts')
        .select('id')
        .eq('owner_id', user.id)
        .eq('contact_user_id', targetUserId)
        .limit(1);

      if (existingContacts && existingContacts.length > 0) {
        toast.info('This contact is already in your list');
        return;
      }

      const { error: insertErr } = await supabase.from('contacts').insert({
        owner_id: user.id,
        contact_user_id: targetUserId,
        nickname: newC.name?.trim() || emailLower.split('@')[0],
        email: emailLower,
        user_uuid: user.id,
      } as any);

      if (insertErr) {
        console.error('Failed to create contact:', insertErr);
        toast.error('Failed to save contact: ' + (insertErr.message || 'Error'));
        return;
      }

      toast.success('Contact added successfully');
      await loadContacts();
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
    setIsMyProfileOpen(false);
    setIsThemeSettingsOpen(false);
    setIsPreferencesOpen(false);
    if (c.contactUserId) {
      await startDirectChat(c.contactUserId);
      setActiveTab('chats');
    }
  };

  const handleAddGroup = async (newGroup: {
    name: string;
    description?: string;
    memberIds?: string[];
  }) => {
    if (!user || !newGroup.name.trim()) return;
    setIsMyProfileOpen(false);
    setIsThemeSettingsOpen(false);
    setIsPreferencesOpen(false);
    const memberIds = newGroup.memberIds || [];
    await startGroupChat(newGroup.name.trim(), memberIds);
    toast.success(`Group "${newGroup.name}" created`);
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

  // Auto-select first chat on desktop
  useEffect(() => {
    if (!isMobileOrTablet && !activeConversationId && conversations.length > 0) {
      setActiveConversationId(conversations[0].id);
    }
  }, [conversations, activeConversationId, setActiveConversationId, isMobileOrTablet]);

  const showSidebar = !isMobileOrTablet || (!activeConversationId && !isPreferencesOpen && !isThemeSettingsOpen && !isMyProfileOpen && !isMyMapOpen && !isAppSettingsOpen);
  const showDetailPane = !isMobileOrTablet || !!activeConversationId || isPreferencesOpen || isThemeSettingsOpen || isMyProfileOpen || isMyMapOpen || isAppSettingsOpen;

  return (
    <View style={[styles.rootContainer, { backgroundColor: colors.background }]}>
      {/* ──────────────── Left Navigation Sidebar (Desktop View) ──────────────── */}
      {!isMobileOrTablet && (
        <AppNavigationSidebar
          activeId={mainNavId}
          onSelect={setMainNavId}
          userInitials={userInitials}
          userName={profileName}
          userSubtitle="Account"
          onProfilePress={() => {
            setIsPreferencesOpen(false);
            setIsThemeSettingsOpen(false);
            setIsMyMapOpen(false);
            setIsAppSettingsOpen(false);
            setIsMyProfileOpen(true);
          }}
          onMapPress={() => {
            setIsPreferencesOpen(false);
            setIsThemeSettingsOpen(false);
            setIsMyProfileOpen(false);
            setIsAppSettingsOpen(false);
            setIsMyMapOpen(true);
          }}
          onThemePress={() => {
            setIsMyProfileOpen(false);
            setIsPreferencesOpen(false);
            setIsMyMapOpen(false);
            setIsAppSettingsOpen(false);
            setIsThemeSettingsOpen(true);
          }}
          onPreferencesPress={() => {
            setIsMyProfileOpen(false);
            setIsThemeSettingsOpen(false);
            setIsMyMapOpen(false);
            setIsAppSettingsOpen(false);
            setIsPreferencesOpen(true);
          }}
          onPreferencePress={() => {
            setIsMyProfileOpen(false);
            setIsThemeSettingsOpen(false);
            setIsMyMapOpen(false);
            setIsAppSettingsOpen(false);
            setIsPreferencesOpen(true);
          }}
          onSettingsPress={() => {
            setIsMyProfileOpen(false);
            setIsThemeSettingsOpen(false);
            setIsMyMapOpen(false);
            setIsPreferencesOpen(false);
            setIsAppSettingsOpen(true);
          }}
          onAppSettingsPress={() => {
            setIsMyProfileOpen(false);
            setIsThemeSettingsOpen(false);
            setIsMyMapOpen(false);
            setIsPreferencesOpen(false);
            setIsAppSettingsOpen(true);
          }}
          onSignOut={signOut}
          onLogoPress={() => setMainNavId('chat')}
          primaryColor={colors.primary}
        />
      )}

      {/* ──────────────── Slide-out Navigation Drawer (Mobile Web & Mobile View Only) ──────────────── */}
      {isMobileOrTablet && (
        <AppNavigationDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          activeId={mainNavId}
          onSelect={(id) => {
            setMainNavId(id);
            setIsDrawerOpen(false);
          }}
          workspaceName="Amoga App"
          workspaceSubtitle="Workspace"
          userName={profileName}
          userSubtitle="My Account"
          userInitials={userInitials}
          onProfilePress={() => {
            setIsPreferencesOpen(false);
            setIsThemeSettingsOpen(false);
            setIsMyMapOpen(false);
            setIsAppSettingsOpen(false);
            setIsMyProfileOpen(true);
            setIsDrawerOpen(false);
          }}
          onMapPress={() => {
            setIsPreferencesOpen(false);
            setIsThemeSettingsOpen(false);
            setIsMyProfileOpen(false);
            setIsAppSettingsOpen(false);
            setIsMyMapOpen(true);
            setIsDrawerOpen(false);
          }}
          onThemePress={() => {
            setIsMyProfileOpen(false);
            setIsPreferencesOpen(false);
            setIsMyMapOpen(false);
            setIsAppSettingsOpen(false);
            setIsThemeSettingsOpen(true);
            setIsDrawerOpen(false);
          }}
          onPreferencesPress={() => {
            setIsMyProfileOpen(false);
            setIsThemeSettingsOpen(false);
            setIsMyMapOpen(false);
            setIsAppSettingsOpen(false);
            setIsPreferencesOpen(true);
            setIsDrawerOpen(false);
          }}
          onPreferencePress={() => {
            setIsMyProfileOpen(false);
            setIsThemeSettingsOpen(false);
            setIsMyMapOpen(false);
            setIsAppSettingsOpen(false);
            setIsPreferencesOpen(true);
            setIsDrawerOpen(false);
          }}
          onSettingsPress={() => {
            setIsMyProfileOpen(false);
            setIsThemeSettingsOpen(false);
            setIsMyMapOpen(false);
            setIsPreferencesOpen(false);
            setIsAppSettingsOpen(true);
            setIsDrawerOpen(false);
          }}
          onAppSettingsPress={() => {
            setIsMyProfileOpen(false);
            setIsThemeSettingsOpen(false);
            setIsMyMapOpen(false);
            setIsPreferencesOpen(false);
            setIsAppSettingsOpen(true);
            setIsDrawerOpen(false);
          }}
          onSignOut={signOut}
          primaryColor={colors.primary}
        />
      )}

      {mainNavId === 'chat' ? (
        <>
          {/* ──────────────── Left Sidebar with Tabs ──────────────── */}
          {showSidebar && (
            <View
              style={[
                styles.sidebarWrap,
                isMobileOrTablet && styles.sidebarWrapMobile,
                {
                  borderRightWidth: !isMobileOrTablet ? 1 : 0,
                  borderRightColor: colors.border,
                  backgroundColor: colors.background,
                },
              ]}
            >
              {/* On mobile/tablet only: show clean top bar with drawer button */}
              {isMobileOrTablet && (
                <View
                  style={[
                    styles.userTopBar,
                    { borderBottomColor: colors.border },
                  ]}
                >
                  <View style={styles.userRow}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => setIsDrawerOpen(true)}
                      style={[
                        styles.mobileLogoBadge,
                        { backgroundColor: colors.primary, shadowColor: colors.primary },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Open Navigation Menu"
                    >
                      <Command size={18} color="#ffffff" strokeWidth={2.4} />
                    </TouchableOpacity>

                    <Text
                      style={[styles.topBarTitle, { color: colors.foreground, fontSize: 16, fontWeight: '700' }]}
                    >
                      Chats
                    </Text>
                  </View>
                </View>
              )}

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
                sectionLabel={activeTab.toUpperCase()}
                sectionCount={
                  activeTab === 'chats'
                    ? filteredConversations.length
                    : activeTab === 'contact'
                      ? contacts.length
                      : groupsList.length
                }
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
                          onClick={() => {
                            setIsMyProfileOpen(false);
                            setIsThemeSettingsOpen(false);
                            setIsPreferencesOpen(false);
                            setShowContactInfo(false);
                            setActiveConversationId(item.id);
                          }}
                        />
                      );
                    })
                  )
                )}

                {/* TAB 2: CONTACTS */}
                {activeTab === 'contact' && (
                  <ContactManager
                    contacts={contacts}
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
                    onChatClick={(g) => {
                      setIsMyProfileOpen(false);
                      setIsThemeSettingsOpen(false);
                      setIsPreferencesOpen(false);
                      setActiveConversationId(g.id);
                      setActiveTab('chats');
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
                      All parsed PDFs and media files will appear here.
                    </Text>
                  </View>
                )}
              </ChatSidebar>
            </View>
          )}

          {/* ──────────────── Right Detail Pane: Active Chat / Preferences / Theme Settings / Profile ──────────────── */}
          {showDetailPane && (
            <View style={[styles.rightViewport, { backgroundColor: colors.background, borderLeftColor: colors.border }]}>
              {isPreferencesOpen ? (
                <PreferencesView
                  onClose={() => setIsPreferencesOpen(false)}
                  primaryColor={colors.primary}
                />
              ) : isThemeSettingsOpen ? (
                <ThemeSettingsView
                  onClose={() => setIsThemeSettingsOpen(false)}
                  appearanceMode={modeContext?.mode || 'system'}
                  onModeChange={(m) => modeContext?.setMode(m)}
                  currentColorTheme={colorTheme}
                  onColorThemeChange={setColorTheme}
                  onResetTheme={() => {
                    modeContext?.setMode('light');
                    resetColorTheme();
                  }}
                  availableThemes={colorThemes}
                />
              ) : isMyMapOpen ? (
                <View style={{ flex: 1, width: '100%', height: '100%', backgroundColor: colors.background, display: 'flex', flexDirection: 'column' }}>
                  {/* Top Header with title and cross on right */}
                  <View
                    style={{
                      height: 56,
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
                      onPress={() => setIsMyMapOpen(false)}
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
              ) : isAppSettingsOpen ? (
                <AppSettingsView
                  onClose={() => setIsAppSettingsOpen(false)}
                  title="App Settings"
                />
              ) : isMyProfileOpen ? (
                <ContactInfoView
                  conversation={myProfileConversation}
                  messages={messages}
                  onClose={() => setIsMyProfileOpen(false)}
                />
              ) : activeConversationId ? (
                showContactInfo ? (
                  <ContactInfoView
                    conversation={activeConversation}
                    messages={messages}
                    onClose={() => setShowContactInfo(false)}
                  />
                ) : (
                  <>
                    <ChatHeader
                      title={chatTitle}
                      subtitle={chatSubtitle}
                      status={activeConversation?.otherMember?.online ? 'online' : 'offline'}
                      isGroup={activeConversation?.type === 'group'}
                      memberCount={activeConversation?.type === 'group' ? (activeConversation.membersCount || activeConversation.members?.length || 2) : undefined}
                      showDefaultActions={true}
                      onAvatarClick={() => setShowContactInfo(true)}
                      onDelete={signOut}
                      onClose={isMobileOrTablet ? () => setActiveConversationId(null) : undefined}
                    />

                  {/* Receiver Contact Banner: Shown if receiver does not have sender in contacts */}
                  {isDirect && otherMember && !isOtherInContacts && (
                    <View
                      style={[
                        styles.notInContactBanner,
                        {
                          backgroundColor: `${colors.primary}15`,
                          borderBottomColor: colors.border,
                        },
                      ]}
                    >
                      <View style={styles.notInContactBannerLeft}>
                        <UserPlus size={16} color={colors.primary} />
                        <Text
                          style={[
                            styles.notInContactBannerText,
                            { color: colors.foreground },
                          ]}
                          numberOfLines={1}
                        >
                          This user is not on your contact list.
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.notInContactBannerBtn,
                          { backgroundColor: colors.primary },
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

                        const isSelected = activeActionMsgId === msg.id;

                        const isLocation = msg.message_type === 'location';
                        const isMediaOrDoc =
                          msg.file_url ||
                          msg.message_type === 'image' ||
                          msg.message_type === 'video' ||
                          msg.message_type === 'document' ||
                          msg.message_type === 'file' ||
                          /\.(jpg|jpeg|png|webp|gif|mp4|mov|pdf|doc|docx)$/i.test(msg.file_name || msg.message || '');

                        const hasFileAttachment = !isLocation && isMediaOrDoc;
                        const attachmentUrl = msg.file_url || (msg.message && (msg.message.startsWith('http') || msg.message.startsWith('file:') || msg.message.startsWith('content:') || msg.message.startsWith('data:')) ? msg.message : undefined);

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
                            content: msg.message || msg.file_name || 'Attachment',
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
                                        name: msg.file_name || (msg.message && /\.[a-z0-9]{3,4}$/i.test(msg.message) ? msg.message : 'Attachment'),
                                        size: msg.file_size || 507904,
                                        type: msg.message_type || (/\.(mp4|mov)$/i.test(msg.file_name || msg.message || '') ? 'video' : /\.(jpg|jpeg|png|webp)$/i.test(msg.file_name || msg.message || '') ? 'image' : 'pdf'),
                                        statusText: 'Parsed',
                                        url: attachmentUrl,
                                      },
                                    ]
                                  : undefined
                              }
                              replyTo={replyPreviewData}
                            />

                            {/* Inline ChatIconBar */}
                            {isSelected && (
                              <View style={styles.iconBarWrapper}>
                                <ChatIconBar
                                  onThumbUp={() => {
                                    setActiveActionMsgId(null);
                                  }}
                                  onThumbDown={() => {
                                    setActiveActionMsgId(null);
                                  }}
                                  onCopy={() => {
                                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                                      navigator.clipboard.writeText(msg.message || msg.file_url || '');
                                    }
                                    toast.success('Copied to clipboard');
                                    setActiveActionMsgId(null);
                                  }}
                                  onShare={() => {
                                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                                      navigator.clipboard.writeText(msg.message || msg.file_url || '');
                                    }
                                    toast.success('Message link copied to forward');
                                    setActiveActionMsgId(null);
                                  }}
                                  onDelete={() => {
                                    handleDeleteMessage(msg.id);
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

                  <View style={styles.chatInputWrapper}>
                    <ChatInput
                      value={inputText}
                      onChange={setInputText}
                      onSend={handleSendMessage}
                      isLoading={isSending}
                      placeholder="Message"
                      onSelectAttachmentType={handleSelectAttachmentType}
                      onCameraClick={handleCameraClick}
                      onTyping={sendTypingStatus}
                      onVoiceRecordComplete={(uri: string, dur: number) => sendVoiceMessage(uri, dur)}
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
                  </View>

                  {/* Action Menu Modal */}
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
                          onSelect={(actionId: string) => {
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
                              if (typeof navigator !== 'undefined' && navigator.clipboard) {
                                navigator.clipboard.writeText(cur.message || cur.file_url || '');
                              }
                              toast.success('Message copied for forwarding');
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
                </>
                )
              ) : (
                <View style={styles.centered}>
                  <ChatEmptyState
                    title="Welcome to Amoga Chat"
                    description="Select a conversation from the sidebar or start a new chat."
                    onAction={() => setActiveTab('contact')}
                    actionLabel="View Contacts"
                  />
                </View>
              )}
            </View>
          )}
        </>
      ) : mainNavId === 'calendar' ? (
        /* ──────────────── Calendar & Tasks App View ──────────────── */
        <View style={{ flex: 1, height: '100%', width: '100%', display: 'flex' as any, flexDirection: 'column' }}>
          {isMobileOrTablet && (
            <View
              style={[
                styles.userTopBar,
                { borderBottomColor: colors.border },
              ]}
            >
              <View style={styles.userRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setIsDrawerOpen(true)}
                  style={[
                    styles.mobileLogoBadge,
                    { backgroundColor: colors.primary, shadowColor: colors.primary },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Open Navigation Menu"
                >
                  <Command size={18} color="#ffffff" strokeWidth={2.4} />
                </TouchableOpacity>
                <Text
                  style={[styles.topBarTitle, { color: colors.foreground, fontSize: 16, fontWeight: '700' }]}
                >
                  Calendar & Tasks
                </Text>
              </View>
            </View>
          )}

          <CalendarAppView
            initialTab="today"
            onOpenDrawer={() => setIsDrawerOpen(true)}
            rightOverlayView={
              isPreferencesOpen ? (
                <PreferencesView
                  onClose={() => setIsPreferencesOpen(false)}
                  primaryColor={colors.primary}
                />
              ) : isThemeSettingsOpen ? (
                <ThemeSettingsView
                  onClose={() => setIsThemeSettingsOpen(false)}
                  appearanceMode={modeContext?.mode || 'system'}
                  onModeChange={(m) => modeContext?.setMode(m)}
                  currentColorTheme={colorTheme}
                  onColorThemeChange={setColorTheme}
                  onResetTheme={() => {
                    modeContext?.setMode('light');
                    resetColorTheme();
                  }}
                  availableThemes={colorThemes}
                />
              ) : isMyMapOpen ? (
                <View style={{ flex: 1, width: '100%', height: '100%', backgroundColor: colors.background, display: 'flex', flexDirection: 'column' }}>
                  {/* Top Header with title and cross on right */}
                  <View
                    style={{
                      height: 56,
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
                      onPress={() => setIsMyMapOpen(false)}
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
              ) : isMyProfileOpen ? (
                <ContactInfoView
                  conversation={myProfileConversation}
                  messages={messages}
                  onClose={() => setIsMyProfileOpen(false)}
                />
              ) : undefined
            }
          />
        </View>
      ) : mainNavId === 'email' || mainNavId === 'mail' ? (
        /* ──────────────── Email & Messages App View ──────────────── */
        <View style={{ flex: 1, height: '100%', width: '100%', display: 'flex' as any, flexDirection: 'column' }}>
          {isMobileOrTablet && !isEmailDetailOrCompose && (
            <View
              style={[
                styles.userTopBar,
                { borderBottomColor: colors.border },
              ]}
            >
              <View style={styles.userRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setIsDrawerOpen(true)}
                  style={[
                    styles.mobileLogoBadge,
                    { backgroundColor: colors.primary, shadowColor: colors.primary },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Open Navigation Menu"
                >
                  <Command size={18} color="#ffffff" strokeWidth={2.4} />
                </TouchableOpacity>
                <Text
                  style={[styles.topBarTitle, { color: colors.foreground, fontSize: 16, fontWeight: '600', fontFamily: 'Open Sans' }]}
                >
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
            rightOverlayView={
              isAppSettingsOpen ? (
                <AppSettingsView
                  onClose={() => setIsAppSettingsOpen(false)}
                  title="App Settings"
                />
              ) : isPreferencesOpen ? (
                <PreferencesView
                  onClose={() => setIsPreferencesOpen(false)}
                  primaryColor={colors.primary}
                />
              ) : isThemeSettingsOpen ? (
                <ThemeSettingsView
                  onClose={() => setIsThemeSettingsOpen(false)}
                  appearanceMode={modeContext?.mode || 'system'}
                  onModeChange={(m) => modeContext?.setMode(m)}
                  currentColorTheme={colorTheme}
                  onColorThemeChange={setColorTheme}
                  onResetTheme={() => {
                    modeContext?.setMode('light');
                    resetColorTheme();
                  }}
                  availableThemes={colorThemes}
                />
              ) : isMyMapOpen ? (
                <View style={{ flex: 1, width: '100%', height: '100%', backgroundColor: colors.background, display: 'flex', flexDirection: 'column' }}>
                  {/* Top Header with title and cross on right */}
                  <View
                    style={{
                      height: 56,
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
                          fontWeight: '600',
                          color: colors.foreground,
                          fontFamily: 'Open Sans',
                        }}
                      >
                        My Map
                      </Text>
                    </View>

                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setIsMyMapOpen(false)}
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
              ) : isMyProfileOpen ? (
                <ContactInfoView
                  conversation={myProfileConversation}
                  messages={messages}
                  onClose={() => setIsMyProfileOpen(false)}
                />
              ) : undefined
            }
          />
        </View>
      ) : (
        /* ──────────────── Coming Soon View for Other Menu Items ──────────────── */
        <View style={[styles.comingSoonWrap, { backgroundColor: colors.background }]}>
          {isMobileOrTablet && (
            <View
              style={[
                styles.userTopBar,
                { borderBottomColor: colors.border },
              ]}
            >
              <View style={styles.userRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setIsDrawerOpen(true)}
                  style={[
                    styles.mobileLogoBadge,
                    { backgroundColor: colors.primary, shadowColor: colors.primary },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Open Navigation Menu"
                >
                  <Command size={18} color="#ffffff" strokeWidth={2.4} />
                </TouchableOpacity>
                <Text
                  style={[styles.topBarTitle, { color: colors.foreground }]}
                >
                  {activeNavItem.label}
                </Text>
              </View>
            </View>
          )}
          <ComingSoonView
            title={activeNavItem.label}
            icon={activeNavItem.icon}
            onGoToChat={() => setMainNavId('chat')}
          />
        </View>
      )}

      {/* Global Profile Modal */}
      <ChatProfileModal
        visible={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        conversation={activeConversation}
        messages={messages}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    flexDirection: 'row',
    height: '100vh' as any,
  },
  sidebarWrap: {
    width: 320,
    height: '100%',
  },
  sidebarWrapMobile: {
    width: '100%',
    flex: 1,
  },
  mobileLogoBadge: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  mobileBackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  mobileBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 4,
  },
  mobileBackText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Open Sans',
  },
  userTopBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  avatarCircleSmall: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTextSmall: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Open Sans',
  },
  topBarTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    fontFamily: 'Open Sans',
    flex: 1,
  },
  userActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  topIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightViewport: {
    flex: 1,
    height: '100%',
    maxHeight: '100%',
    display: 'flex' as any,
    flexDirection: 'column',
    borderLeftWidth: 1,
    overflow: 'hidden',
  },
  comingSoonWrap: {
    flex: 1,
    height: '100%',
    width: '100%',
    display: 'flex' as any,
    flexDirection: 'column',
  },
  chatInputWrapper: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 14,
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  notInContactBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
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
    fontSize: 12.5,
    fontWeight: '500',
    fontFamily: 'Open Sans',
    flex: 1,
  },
  notInContactBannerBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  notInContactBannerBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Open Sans',
  },
});
