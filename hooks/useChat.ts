import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../providers/auth-provider';
import {
  fetchUserConversations,
  fetchConversationMessages,
  sendMessage as sendChatMessage,
  uploadChatAttachment,
  deleteChatMessage,
  deleteChatMessageForMe,
  deleteChatMessageForEveryone,
  EnrichedConversation,
  getOrCreateDirectConversation,
  createGroupConversation,
  addConversationMember,
  removeConversationMember,
  getConversationMembers,
} from '../lib/chat-service';
import type { ChatMessage, Profile } from '../lib/database.types';
import {
  LocalChatService,
  type LocalConversationRecord,
  type LocalChatMessageRecord,
} from '../lib/local-db';
import type { AttachmentOptionType } from 'amogamobileds-v1';
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useToast } from 'amogamobileds-v1';

const getLocationModule = () => {
  try {
    return require('expo-location');
  } catch {
    return null;
  }
};

const getFileSystemModule = () => {
  try {
    return require('expo-file-system/legacy');
  } catch {
    try {
      return require('expo-file-system');
    } catch {
      return null;
    }
  }
};

const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // fallback
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export function useChat() {
  const { user, profile } = useAuth();
  const toast = useToast();

  const [conversations, setConversations] = useState<EnrichedConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);
  const [uploadingFileSize, setUploadingFileSize] = useState<number | null>(null);
  const [replyMessage, setReplyMessage] = useState<{
    id: string;
    senderName?: string;
    content?: string;
  } | null>(null);

  const activeConvoIdRef = useRef<string | null>(null);
  activeConvoIdRef.current = activeConversationId;

  // Active conversation object
  const activeConversation = conversations.find((c) => c.id === activeConversationId) || null;

  // 1. Load user conversations (offline local first, then sync with Supabase)
  const loadConversations = useCallback(async () => {
    if (!user) {
      setConversations([]);
      setMessages([]);
      setActiveConversationId(null);
      setLoadingConversations(false);
      return;
    }
    setLoadingConversations(true);

    // Step A: Load instantly from local storage (0ms offline latency)
    try {
      const localList = await LocalChatService.getConversations(user.id);
      if (localList && localList.length > 0) {
        const mapped: EnrichedConversation[] = localList.map((c) => {
          let otherMember: Profile | null = null;
          let members: Profile[] = [];
          if (c.other_member_json) {
            try {
              const parsed = JSON.parse(c.other_member_json);
              if (c.type === 'group' || Array.isArray(parsed)) {
                members = Array.isArray(parsed) ? parsed : [];
              } else {
                otherMember = parsed;
              }
            } catch (e) {
              // ignore json parse error
            }
          }
          return {
            id: c.id,
            type: c.type,
            name: c.name || null,
            image: c.image || null,
            created_by: c.created_by || null,
            created_at: c.created_at || new Date().toISOString(),
            unreadCount: c.unread_count || 0,
            otherMember,
            members,
            lastMessage: c.last_message_text
              ? ({
                  id: `local-last-${c.id}`,
                  conversation_id: c.id,
                  owner_user_id: user.id,
                  sender_user_id: user.id,
                  message: c.last_message_text,
                  created_at: c.last_message_time || c.updated_at || new Date().toISOString(),
                  direction: 'Sent',
                  sent: true,
                  received: false,
                  message_type: 'text',
                } as any)
              : null,
            membersCount: c.members_count || (members.length > 0 ? members.length : 2),
          };
        });
        setConversations(mapped);
        setLoadingConversations(false);
      }
    } catch (err) {
      console.warn('Could not read local conversations:', err);
    }

    // Step B: Remote fetch from Supabase (if online) & update local storage
    try {
      const convos = await fetchUserConversations(user.id);
      if (convos && convos.length > 0) {
        setConversations(convos);
        const toCache: LocalConversationRecord[] = convos.map((c) => ({
          id: c.id,
          type: c.type,
          name: c.name,
          image: c.image,
          created_by: c.created_by,
          created_at: c.created_at,
          updated_at: c.lastMessage?.created_at || c.created_at,
          unread_count: c.unreadCount || 0,
          last_message_text: c.lastMessage?.message || null,
          last_message_time: c.lastMessage?.created_at || c.created_at,
          other_member_json:
            c.type === 'group' && c.members && c.members.length > 0
              ? JSON.stringify(c.members)
              : c.otherMember
              ? JSON.stringify(c.otherMember)
              : null,
          members_count: c.membersCount || (c.members?.length ?? 2),
        }));
        await LocalChatService.saveConversations(toCache, user.id);
      }
    } catch (err) {
      console.warn('Offline / Network error fetching remote conversations, using local cache:', err);
    } finally {
      setLoadingConversations(false);
    }
  }, [user]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // 2. Load messages when active conversation changes (offline local first, then sync)
  const loadMessages = useCallback(
    async (convoId: string | null) => {
      if (!convoId || !user) {
        setMessages([]);
        setLoadingMessages(false);
        return;
      }
      setLoadingMessages(true);
      // Immediately clear messages so previous conversation's messages don't bleed through
      setMessages([]);

      // Step A: Load instantly from local storage (0ms offline latency)
      try {
        const localMsgs = await LocalChatService.getMessages(convoId, user.id);
        if (localMsgs && localMsgs.length > 0) {
          setMessages(localMsgs as any);
        }
      } catch (err) {
        console.warn('Could not read local messages:', err);
      }

      // Step B: Remote fetch from Supabase (if online) & cache locally
      try {
        const msgs = await fetchConversationMessages(convoId, user.id);
        if (msgs && msgs.length > 0) {
          setMessages(msgs);
          const toCache: LocalChatMessageRecord[] = msgs.map((m) => ({
            id: m.id,
            conversation_id: m.conversation_id,
            owner_user_id: m.owner_user_id,
            sender_user_id: m.sender_user_id || m.owner_user_id,
            message: m.message,
            message_type: m.message_type,
            direction: m.direction,
            sent: m.sent ? 1 : 0,
            received: m.received ? 1 : 0,
            created_at: m.created_at,
            file_url: m.file_url,
            file_name: m.file_name,
            file_size: m.file_size,
            mime_type: m.mime_type,
            duration: m.duration,
            thumbnail: m.thumbnail,
            is_read: m.sent ? 1 : 0,
            is_starred: m.star ? 1 : 0,
            is_pinned: m.pin ? 1 : 0,
            is_deleted: m.deleted ? 1 : 0,
            sync_status: 'synced',
            replyto_message_id: m.replyto_message_id,
            replyto_user_id: m.replyto_user_id,
            sender_message_id: m.sender_message_id,
          }));
          await LocalChatService.saveMessages(toCache);
        } else if (msgs && msgs.length === 0) {
          // If remote returned empty array, preserve any actively sending/pending optimistic messages
          setMessages((prev) => prev.filter((m) => (m as any).sync_status === 'pending'));
        }
      } catch (err) {
        console.warn('Offline / Network error fetching remote messages, using local cache:', err);
      } finally {
        setLoadingMessages(false);
      }
    },
    [user]
  );

  useEffect(() => {
    loadMessages(activeConversationId);
  }, [activeConversationId, loadMessages]);

  // 3. Realtime subscription for incoming messages to current user
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`chat_messages_user:${user.id}`)
      .on<ChatMessage>(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `owner_user_id=eq.${user.id}`,
        },
        async (payload) => {
          const newMsg = payload.new;
          await LocalChatService.saveMessage({
            id: newMsg.id,
            conversation_id: newMsg.conversation_id,
            owner_user_id: newMsg.owner_user_id,
            sender_user_id: newMsg.sender_user_id || newMsg.owner_user_id,
            message: newMsg.message,
            message_type: newMsg.message_type,
            direction: newMsg.direction,
            sent: newMsg.sent ? 1 : 0,
            received: newMsg.received ? 1 : 0,
            created_at: newMsg.created_at,
            file_url: newMsg.file_url,
            file_name: newMsg.file_name,
            file_size: newMsg.file_size,
            mime_type: newMsg.mime_type,
            sync_status: 'synced',
          }).catch(() => {});

          if (newMsg.conversation_id === activeConvoIdRef.current) {
            setMessages((prev) => {
              // 1. If already exists by server ID, don't duplicate
              if (prev.some((m) => m.id === newMsg.id)) return prev;

              // 2. If matching sender_message_id with an optimistic local record, replace it
              if (
                newMsg.sender_message_id &&
                prev.some(
                  (m) =>
                    m.id === newMsg.sender_message_id ||
                    (m as any).sender_message_id === newMsg.sender_message_id
                )
              ) {
                return prev.map((m) =>
                  m.id === newMsg.sender_message_id ||
                  (m as any).sender_message_id === newMsg.sender_message_id
                    ? newMsg
                    : m
                );
              }

              // 3. Fallback: If sender is self and a pending optimistic local message matches, replace it
              const pendingIdx = prev.findIndex(
                (m) =>
                  (m as any).sync_status === 'pending' &&
                  m.sender_user_id === newMsg.sender_user_id &&
                  m.message === newMsg.message
              );
              if (pendingIdx !== -1) {
                const next = [...prev];
                next[pendingIdx] = newMsg;
                return next;
              }

              return [...prev, newMsg];
            });
          }
          loadConversations();
        }
      )
      .on<ChatMessage>(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `owner_user_id=eq.${user.id}`,
        },
        async (payload) => {
          const updatedMsg = payload.new;
          await LocalChatService.saveMessage({
            id: updatedMsg.id,
            conversation_id: updatedMsg.conversation_id,
            owner_user_id: updatedMsg.owner_user_id,
            sender_user_id: updatedMsg.sender_user_id || updatedMsg.owner_user_id,
            message: updatedMsg.message,
            message_type: updatedMsg.message_type,
            direction: updatedMsg.direction,
            sent: updatedMsg.sent ? 1 : 0,
            received: updatedMsg.received ? 1 : 0,
            created_at: updatedMsg.created_at,
            is_deleted: updatedMsg.deleted ? 1 : 0,
            sync_status: 'synced',
          }).catch(() => {});

          if (updatedMsg.conversation_id === activeConvoIdRef.current) {
            setMessages((prev) =>
              prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadConversations]);

  // 3a. Typing indicator state & Realtime channel
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingChannelRef = useRef<any>(null);

  useEffect(() => {
    if (!activeConversationId || !user) {
      setIsOtherTyping(false);
      return;
    }

    const channel = supabase.channel(`conversation_typing:${activeConversationId}`);
    typingChannelRef.current = channel;

    channel
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { senderId, isTyping } = payload.payload || {};
        if (senderId && senderId !== user.id) {
          if (isTyping) {
            setIsOtherTyping(true);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
              setIsOtherTyping(false);
            }, 3000);
          } else {
            setIsOtherTyping(false);
          }
        }
      })
      .subscribe();

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      supabase.removeChannel(channel);
      typingChannelRef.current = null;
      setIsOtherTyping(false);
    };
  }, [activeConversationId, user]);

  const sendTypingStatus = (typing: boolean) => {
    if (!typingChannelRef.current || !user || !activeConversationId) return;
    typingChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { senderId: user.id, isTyping: typing },
    });
  };

  // 3b. User presence (online & last_seen) heartbeat
  useEffect(() => {
    if (!user) return;

    const setPresence = async (online: boolean) => {
      try {
        await supabase
          .from('profiles')
          .update({
            online,
            last_seen: new Date().toISOString(),
          })
          .eq('id', user.id);
      } catch (err) {
        console.warn('Presence update error:', err);
      }
    };

    setPresence(true);
    const interval = setInterval(() => {
      setPresence(true);
    }, 45000); // 45s heartbeat

    return () => {
      clearInterval(interval);
      setPresence(false);
    };
  }, [user]);

  // 3c. Realtime listener on profiles table to update contact online status live
  useEffect(() => {
    if (!user) return;

    const profileChannel = supabase
      .channel('public_profiles_presence')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
        },
        (payload) => {
          const updated = payload.new as Profile;
          if (updated) {
            setConversations((prev) =>
              prev.map((c) => {
                if (c.otherMember?.id === updated.id) {
                  return {
                    ...c,
                    otherMember: {
                      ...c.otherMember,
                      online: updated.online ?? false,
                      last_seen: updated.last_seen || c.otherMember.last_seen,
                    },

                  };
                }
                return c;
              })
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
    };
  }, [user]);

  // 4. Send text message (optimistic local save first, then Supabase sync)
  const handleSendMessage = async () => {
    if (!user || !activeConversationId || !inputText.trim() || isSending) return;

    const text = inputText.trim();
    setInputText('');
    const reply = replyMessage;
    setReplyMessage(null);
    setIsSending(true);

    const now = new Date().toISOString();
    const tempId = generateUUID();

    const optimisticRecord: LocalChatMessageRecord = {
      id: tempId,
      conversation_id: activeConversationId,
      owner_user_id: user.id,
      sender_user_id: user.id,
      sender_message_id: tempId,
      message: text,
      message_type: 'text',
      direction: 'Sent',
      sent: 1,
      received: 0,
      created_at: now,
      sync_status: 'pending',
      replyto_message_id: reply?.id || null,
      replyto_content: reply?.content || null,
      replyto_user_id: null,
    };

    // 1. Immediately save to local SQLite / Web storage
    await LocalChatService.saveMessage(optimisticRecord).catch(() => {});

    // 2. Immediately update state so user sees message instantly
    setMessages((prev) => [...prev, optimisticRecord as any]);
    loadConversations();

    try {
      const sent = await sendChatMessage({
        conversationId: activeConversationId,
        senderId: user.id,
        messageText: text,
        messageType: 'text',
        replyToMessageId: reply?.id,
        senderMessageId: tempId,
      });

      if (sent) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? sent : m)));
        await LocalChatService.updateMessageStatus(tempId, { id: sent.id, sync_status: 'synced' });
      }
    } catch (err) {
      console.warn('Message saved locally (offline / network error syncing to Supabase):', err);
    } finally {
      setIsSending(false);
    }
  };

  // 5. Handle all attachment options (images, videos, documents, location, converters, scanner)
  const handleSelectAttachmentType = async (type: AttachmentOptionType) => {
    if (!user || !activeConversationId) {
      toast.info('Select a conversation first');
      return;
    }

    try {
      if (type === 'images' || type === 'image-converter') {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.7,
          base64: true,
          allowsEditing: false,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          const fileName = asset.fileName || `photo_${Date.now()}.jpg`;
          const mimeType = asset.mimeType || 'image/jpeg';

          setUploadingFileName(fileName);
          setUploadingFileSize(asset.fileSize || null);
          setIsSending(true);
          const publicUrl = await uploadChatAttachment(asset.uri, fileName, mimeType, asset.base64 || undefined);
          const finalUrl = publicUrl || (asset.base64 ? `data:${mimeType};base64,${asset.base64}` : asset.uri);

          await sendChatMessage({
            conversationId: activeConversationId,
            senderId: user.id,
            messageText: fileName,
            messageType: 'image',
            fileUrl: finalUrl,
            fileName,
            fileSize: asset.fileSize,
            mimeType,
          });
          setIsSending(false);
          setUploadingFileName(null);
          setUploadingFileSize(null);
        }
      } else if (type === 'videos') {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['videos'],
          quality: 0.8,
          allowsEditing: false,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          const fileName = asset.fileName || `video_${Date.now()}.mp4`;
          const mimeType = asset.mimeType || 'video/mp4';

          setUploadingFileName(fileName);
          setUploadingFileSize(asset.fileSize || null);
          setIsSending(true);
          const publicUrl = await uploadChatAttachment(asset.uri, fileName, mimeType);
          const finalUrl = publicUrl || asset.uri;

          await sendChatMessage({
            conversationId: activeConversationId,
            senderId: user.id,
            messageText: fileName,
            messageType: 'video',
            fileUrl: finalUrl,
            fileName,
            fileSize: asset.fileSize,
            mimeType,
          });
          setIsSending(false);
          setUploadingFileName(null);
          setUploadingFileSize(null);
        }
      } else if (
        type === 'documents' ||
        type === 'doc-scanner' ||
        type === 'scan-document' ||
        type === 'extract-text' ||
        type === 'doc-converter'
      ) {
        const result = await DocumentPicker.getDocumentAsync({
          type: '*/*',
          copyToCacheDirectory: true,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          const fileName = asset.name || 'Document.pdf';
          const mimeType = asset.mimeType || 'application/pdf';

          setUploadingFileName(fileName);
          setUploadingFileSize(asset.size || null);
          setIsSending(true);
          let base64Data: string | undefined = undefined;
          let readableUri = asset.uri;

          if (Platform.OS !== 'web' && asset.uri) {
            const FileSystem = getFileSystemModule();
            if (FileSystem) {
              try {
                // On Android, DocumentPicker cache path may not be readable directly.
                // Copy the file to the app's own cache directory first.
                const ext = fileName.split('.').pop() || 'dat';
                const destPath = `${FileSystem.cacheDirectory || ''}docpick_${Date.now()}.${ext}`;
                if (FileSystem.copyAsync) {
                  await FileSystem.copyAsync({ from: asset.uri, to: destPath });
                  readableUri = destPath;
                }
              } catch (copyErr) {
                console.warn('File copy notice (will try original URI):', copyErr);
                readableUri = asset.uri;
              }

              try {
                if (FileSystem.readAsStringAsync && FileSystem.EncodingType) {
                  base64Data = await FileSystem.readAsStringAsync(readableUri, {
                    encoding: FileSystem.EncodingType.Base64,
                  });
                }
              } catch (readErr) {
                console.warn('Document base64 read notice:', readErr);
              }
            }
          }

          const publicUrl = await uploadChatAttachment(readableUri, fileName, mimeType, base64Data);

          // publicUrl could be:
          // 1. A Supabase HTTPS URL (best case - viewable in WebView)
          // 2. A data: URI (fallback when Supabase fails but we have base64)
          // 3. null (total failure)
          if (!publicUrl) {
            toast.error('Could not upload file. Check your Supabase storage bucket and policies.');
            setIsSending(false);
            setUploadingFileName(null);
            setUploadingFileSize(null);
            return;
          }
          const finalUrl = publicUrl;

          await sendChatMessage({
            conversationId: activeConversationId,
            senderId: user.id,
            messageText: fileName,
            messageType: type === 'extract-text' ? 'document' : 'file',
            fileUrl: finalUrl,
            fileName,
            fileSize: asset.size,
            mimeType,
          });
          setIsSending(false);
          setUploadingFileName(null);
          setUploadingFileSize(null);
        }
      } else if (type === 'location') {
        setIsSending(true);
        const Location = getLocationModule();
        if (!Location || !Location.requestForegroundPermissionsAsync) {
          toast.info('Location service is not available on this platform');
          setIsSending(false);
          return;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          toast.info('Location permission is required to share location');
          setIsSending(false);
          return;
        }

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy?.Balanced || 3,
        });

        const latitude = loc.coords.latitude;
        const longitude = loc.coords.longitude;

        let address = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        try {
          if (Location.reverseGeocodeAsync) {
            const reverse = await Location.reverseGeocodeAsync({ latitude, longitude });
            if (reverse && reverse.length > 0) {
              const r = reverse[0];
              const parts = [r.name, r.street, r.city, r.region, r.country].filter(Boolean);
              if (parts.length > 0) {
                address = parts.join(', ');
              }
            }
          }
        } catch (geoErr) {
          console.log('Reverse geocode error:', geoErr);
        }

        const locationPayload = JSON.stringify({
          latitude,
          longitude,
          address,
          title: 'Shared Location',
        });

        await sendChatMessage({
          conversationId: activeConversationId,
          senderId: user.id,
          messageText: `📍 Location: ${address}`,
          messageType: 'location',
          fileUrl: locationPayload,
          fileName: 'location.json',
        });

        setIsSending(false);
      }
    } catch (err) {
      console.error('Attachment upload failed:', err);
      toast.error('Failed to process attachment');
      setIsSending(false);
      setUploadingFileName(null);
      setUploadingFileSize(null);
    }
  };

  const handleCameraClick = async () => {
    if (!user || !activeConversationId) return;

    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        toast.info('Camera permission is required');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const fileName = `camera_${Date.now()}.jpg`;
        setUploadingFileName(fileName);
        setIsSending(true);
        const publicUrl = await uploadChatAttachment(asset.uri, fileName, 'image/jpeg', asset.base64 || undefined);
        const finalUrl = publicUrl || (asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri);
        await sendChatMessage({
          conversationId: activeConversationId,
          senderId: user.id,
          messageText: fileName,
          messageType: 'image',
          fileUrl: finalUrl,
          fileName,
          mimeType: 'image/jpeg',
        });
        setIsSending(false);
        setUploadingFileName(null);
      }
    } catch (e) {
      console.error('Camera error:', e);
      setIsSending(false);
      setUploadingFileName(null);
      setUploadingFileSize(null);
    }
  };

  // Delete message: "Delete for me" vs "Delete for everyone"
  const handleDeleteMessage = async (
    messageId: string,
    mode: 'me' | 'everyone' = 'everyone'
  ) => {
    if (!user) return;
    // Optimistic removal from current user's screen
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    let ok = false;
    if (mode === 'me') {
      ok = await deleteChatMessageForMe(messageId, user.id);
    } else {
      ok = await deleteChatMessageForEveryone(messageId, user.id);
    }
    if (ok) {
      toast.success(mode === 'me' ? 'Deleted for you' : 'Deleted for everyone');
      loadConversations();
    } else {
      toast.error('Failed to delete message');
      if (activeConversationId) loadMessages(activeConversationId);
    }
  };

  // Send voice note/recording
  const sendVoiceMessage = async (uri: string, durationSeconds?: number) => {
    if (!user || !activeConversationId) return;
    setIsSending(true);
    const fileName = `voice_${Date.now()}.m4a`;
    setUploadingFileName(fileName);
    try {
      let base64Data: string | undefined = undefined;
      let readableUri = uri;
      if (Platform.OS !== 'web' && uri) {
        try {
          const FileSystem = getFileSystemModule();
          if (FileSystem) {
            if (!uri.startsWith('file://') && !uri.startsWith('content://') && !uri.startsWith('data:')) {
              readableUri = `file://${uri}`;
            }
            base64Data = await FileSystem.readAsStringAsync(readableUri, {
              encoding: FileSystem.EncodingType?.Base64 || 'base64',
            });
          }
        } catch (readErr) {
          console.warn('Voice base64 read notice:', readErr);
        }
      }

      const publicUrl = await uploadChatAttachment(readableUri, fileName, 'audio/m4a', base64Data);
      const finalUrl = publicUrl || (base64Data ? `data:audio/m4a;base64,${base64Data}` : readableUri);

      await sendChatMessage({
        conversationId: activeConversationId,
        senderId: user.id,
        messageText: durationSeconds ? `Voice note (${Math.round(durationSeconds)}s)` : 'Voice note',
        messageType: 'audio',
        fileUrl: finalUrl,
        fileName,
        mimeType: 'audio/m4a',
        duration: durationSeconds,
      });
      toast.success('Voice message sent');
    } catch (e) {
      console.error('Voice send error:', e);
      toast.error('Failed to send voice message');
    } finally {
      setIsSending(false);
      setUploadingFileName(null);
      setUploadingFileSize(null);
    }
  };

  // Forward message to any conversation
  const handleForwardMessage = async (
    targetConversationId: string,
    messageToForward: ChatMessage
  ) => {
    if (!user) return;
    setIsSending(true);
    try {
      await sendChatMessage({
        conversationId: targetConversationId,
        senderId: user.id,
        messageText: messageToForward.message || undefined,
        messageType: messageToForward.message_type as any,
        fileUrl: messageToForward.file_url || undefined,
        fileName: messageToForward.file_name || undefined,
        fileSize: messageToForward.file_size || undefined,
        mimeType: messageToForward.mime_type || undefined,
      });
      toast.success('Message forwarded');
      loadConversations();
    } catch (err) {
      console.error('Forward failed:', err);
      toast.error('Failed to forward message');
    } finally {
      setIsSending(false);
    }
  };

  // Start new direct conversation with a profile
  const startDirectChat = async (targetUserId: string) => {
    if (!user) return;
    const convoId = await getOrCreateDirectConversation(user.id, targetUserId);
    if (convoId) {
      await loadConversations();
      setActiveConversationId(convoId);
    }
  };

  // Start new group conversation
  const startGroupChat = async (groupName: string, memberUserIds: string[]) => {
    if (!user) return;
    const convoId = await createGroupConversation(user.id, groupName, memberUserIds);
    if (convoId) {
      await loadConversations();
      setActiveConversationId(convoId);
    }
  };

  // Add member to group
  const addMemberToGroup = async (convoId: string, targetUserId: string) => {
    const success = await addConversationMember(convoId, targetUserId);
    if (success) {
      await loadConversations();
    }
    return success;
  };

  // Remove member from group
  const removeMemberFromGroup = async (convoId: string, targetUserId: string) => {
    const success = await removeConversationMember(convoId, targetUserId);
    if (success) {
      await loadConversations();
    }
    return success;
  };

  return {
    user,
    profile,
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
  };
}
