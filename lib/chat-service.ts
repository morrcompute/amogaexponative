import { supabase } from './supabase';
import type {
  ChatMessage,
  Conversation,
  ConversationMember,
  Profile,
} from './database.types';
import { Platform } from 'react-native';

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

export interface EnrichedConversation extends Conversation {
  otherMember?: Profile | null;
  lastMessage?: ChatMessage | null;
  unreadCount: number;
  membersCount?: number;
  members?: Profile[];
}

/**
 * Fetch all conversations for the given user, joined with other member's profile and latest message.
 */
export async function fetchUserConversations(userId: string): Promise<EnrichedConversation[]> {
  try {
    // 1. Get all memberships for current user
    const { data: memberships, error: memErr } = await supabase
      .from('conversation_members')
      .select('conversation_id, unread_count')
      .eq('user_id', userId);

    if (memErr || !memberships || memberships.length === 0) {
      return [];
    }

    const conversationIds = memberships.map((m) => m.conversation_id);

    // 2. Fetch conversations
    const { data: convos, error: convErr } = await supabase
      .from('conversations')
      .select('*')
      .in('id', conversationIds);

    if (convErr || !convos) return [];

    // 3. For each conversation, find the other members (for direct chats) & last message
    const enriched: EnrichedConversation[] = await Promise.all(
      convos.map(async (convo) => {
        const mem = memberships.find((m) => m.conversation_id === convo.id);
        const unreadCount = mem?.unread_count || 0;

        // Fetch last message for this user
        const { data: lastMsgs } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('conversation_id', convo.id)
          .eq('owner_user_id', userId)
          .eq('deleted', false)
          .order('created_at', { ascending: false })
          .limit(1);

        const lastMessage = lastMsgs && lastMsgs.length > 0 ? lastMsgs[0] : null;

        let otherMember: Profile | null = null;
        let membersCount = 2;
        let groupMembers: Profile[] = [];

        if (convo.type === 'direct') {
          const { data: otherMems } = await supabase
            .from('conversation_members')
            .select('user_id')
            .eq('conversation_id', convo.id)
            .neq('user_id', userId)
            .limit(1);

          if (otherMems && otherMems.length > 0) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', otherMems[0].user_id)
              .maybeSingle();

            otherMember = profile;
          }
        } else if (convo.type === 'group' || convo.type === 'channel_group' || convo.type === 'message_group') {
          const { data: groupMemRows } = await supabase
            .from('conversation_members')
            .select('user_id')
            .eq('conversation_id', convo.id);

          if (groupMemRows && groupMemRows.length > 0) {
            membersCount = groupMemRows.length;
            const uids = groupMemRows.map((m) => m.user_id);
            const { data: memberProfiles } = await supabase
              .from('profiles')
              .select('*')
              .in('id', uids);

            groupMembers = memberProfiles || [];
          }
        }

        return {
          ...convo,
          otherMember,
          lastMessage,
          unreadCount,
          membersCount: convo.type === 'group' ? membersCount : undefined,
          members: groupMembers,
        };
      })
    );

    // Sort by last message created_at or conversation created_at
    return enriched.sort((a, b) => {
      const timeA = new Date(a.lastMessage?.created_at || a.created_at).getTime();
      const timeB = new Date(b.lastMessage?.created_at || b.created_at).getTime();
      return timeB - timeA;
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return [];
  }
}

/**
 * Fetch messages for a specific conversation for the given user's copy.
 */
export async function fetchConversationMessages(
  conversationId: string,
  userId: string,
  limit = 50
): Promise<ChatMessage[]> {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('owner_user_id', userId)
      .eq('deleted', false)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Error fetching messages:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching messages:', error);
    return [];
  }
}

/**
 * Send a chat message. According to the database schema, a copy is inserted for every conversation member.
 */
export async function sendMessage(params: {
  conversationId: string;
  senderId: string;
  messageText?: string;
  messageType?: 'text' | 'image' | 'file' | 'document' | 'audio' | 'video' | 'location';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  duration?: number;
  replyToMessageId?: string;
  replyToUserId?: string;
  senderMessageId?: string;
}): Promise<ChatMessage | null> {
  try {
    const {
      conversationId,
      senderId,
      messageText = '',
      messageType = 'text',
      fileUrl,
      fileName,
      fileSize,
      mimeType,
      duration,
      replyToMessageId,
      replyToUserId,
      senderMessageId,
    } = params;

    // 1. Get all members in the conversation
    const { data: members, error: memErr } = await supabase
      .from('conversation_members')
      .select('user_id')
      .eq('conversation_id', conversationId);

    if (memErr || !members || members.length === 0) {
      throw new Error('Could not retrieve conversation members');
    }

    const now = new Date().toISOString();

    // 2. Insert sender's copy first
    const senderCopyPayload = {
      conversation_id: conversationId,
      owner_user_id: senderId,
      sender_user_id: senderId,
      sender_message_id: senderMessageId || null,
      message: messageText,
      message_type: messageType,
      direction: 'Sent' as const,
      sent: true,
      received: false,
      created_at: now,
      file_url: fileUrl || null,
      file_name: fileName || null,
      file_size: fileSize || null,
      mime_type: mimeType || null,
      duration: duration || null,
      reply: !!replyToMessageId,
      replyto_message_id: replyToMessageId || null,
      replyto_user_id: replyToUserId || null,
    };

    const { data: senderMessage, error: sendErr } = await supabase
      .from('chat_messages')
      .insert(senderCopyPayload)
      .select()
      .single();

    if (sendErr || !senderMessage) {
      console.error('Error inserting sender message copy:', sendErr);
      throw sendErr;
    }

    // 3. Insert copies for each recipient
    const recipientMembers = members.filter((m) => m.user_id !== senderId);
    if (recipientMembers.length > 0) {
      const recipientCopies = recipientMembers.map((m) => ({
        conversation_id: conversationId,
        owner_user_id: m.user_id,
        sender_user_id: senderId,
        sender_message_id: senderMessageId || null,
        message: messageText,
        message_type: messageType,
        direction: 'Received' as const,
        sent: true,
        received: false,
        created_at: now,
        file_url: fileUrl || null,
        file_name: fileName || null,
        file_size: fileSize || null,
        mime_type: mimeType || null,
        duration: duration || null,
        reply: !!replyToMessageId,
        replyto_message_id: replyToMessageId || null,
        replyto_user_id: replyToUserId || null,
      }));

      await supabase.from('chat_messages').insert(recipientCopies);
    }

    return senderMessage;
  } catch (error) {
    console.error('Error sending message:', error);
    return null;
  }
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const cleanBase64 = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = cleanBase64.length;
  const bufferLength = Math.floor((len * 3) / 4) - (cleanBase64.endsWith('==') ? 2 : cleanBase64.endsWith('=') ? 1 : 0);
  const bytes = new Uint8Array(Math.max(0, bufferLength));

  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const enc1 = chars.indexOf(cleanBase64.charAt(i));
    const enc2 = chars.indexOf(cleanBase64.charAt(i + 1));
    const enc3 = chars.indexOf(cleanBase64.charAt(i + 2));
    const enc4 = chars.indexOf(cleanBase64.charAt(i + 3));

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;

    if (p < bufferLength) bytes[p++] = chr1;
    if (enc3 !== 64 && p < bufferLength) bytes[p++] = chr2;
    if (enc4 !== 64 && p < bufferLength) bytes[p++] = chr3;
  }
  return bytes.buffer;
}

/**
 * Upload attachment to Supabase Storage 'amogachatfiles' bucket (with 'chat-files' fallback).
 * Organized into sub-folders: Videos, Voice, Images, Files, Links.
 */
export async function uploadChatAttachment(
  fileUri: string,
  fileName: string,
  mimeType: string,
  base64Data?: string,
  targetFolder?: 'Videos' | 'Voice' | 'Images' | 'Files' | 'Links' | string
): Promise<string | null> {
  try {
    const ext = fileName.split('.').pop() || 'dat';
    const cleanName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
    
    // Auto-detect folder if not explicitly specified
    let folder = targetFolder;
    if (!folder) {
      if (mimeType.startsWith('image/')) folder = 'Images';
      else if (mimeType.startsWith('video/')) folder = 'Videos';
      else if (mimeType.startsWith('audio/')) folder = 'Voice';
      else folder = 'Files';
    }

    const filePath = `${folder}/${cleanName}`;
    const bucketsToTry = ['amogachatfiles', 'chat-files'];

    for (const bucket of bucketsToTry) {
      // ── Tier 0: Native FileSystem streaming (Android & iOS) ──────────────────
      if (Platform.OS !== 'web' && fileUri && (fileUri.startsWith('file:') || fileUri.startsWith('content:'))) {
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
        const FileSystem = getFileSystemModule();

        if (FileSystem && supabaseUrl && supabaseKey) {
          try {
            const uploadEndpoint = `${supabaseUrl}/storage/v1/object/${bucket}/${filePath}`;
            const uploadRes = await FileSystem.uploadAsync(uploadEndpoint, fileUri, {
              headers: {
                Authorization: `Bearer ${supabaseKey}`,
                apikey: supabaseKey,
                'Content-Type': mimeType || 'application/octet-stream',
              },
              httpMethod: 'POST',
              uploadType: FileSystem.FileSystemUploadType?.BINARY_CONTENT || 0,
            });

            if (uploadRes && uploadRes.status >= 200 && uploadRes.status < 300) {
              const { data: urlData } = supabase.storage
                .from(bucket)
                .getPublicUrl(filePath);
              if (urlData?.publicUrl) {
                console.log(`[upload] Native FileSystem success (${bucket}):`, urlData.publicUrl);
                return urlData.publicUrl;
              }
            }
          } catch (nativeErr) {
            console.warn(`[upload] Native FileSystem error on ${bucket}:`, nativeErr);
          }
        }

        if (!base64Data && FileSystem) {
          try {
            base64Data = await FileSystem.readAsStringAsync(fileUri, {
              encoding: FileSystem.EncodingType?.Base64 || 'base64',
            });
          } catch (fsReadErr) {
            console.warn('[upload] FileSystem.readAsStringAsync error:', fsReadErr);
          }
        }
      }

      // ── Tier 1: base64 → ArrayBuffer upload ──────────────────────────────────
      if (base64Data) {
        try {
          const uploadBody = base64ToArrayBuffer(base64Data);
          const { error } = await supabase.storage
            .from(bucket)
            .upload(filePath, uploadBody, {
              contentType: mimeType || 'application/octet-stream',
              upsert: true,
            });

          if (!error) {
            const { data: urlData } = supabase.storage
              .from(bucket)
              .getPublicUrl(filePath);
            if (urlData?.publicUrl) {
              console.log(`[upload] Tier-1 success (${bucket}):`, urlData.publicUrl);
              return urlData.publicUrl;
            }
          }
        } catch (tier1Err) {
          console.warn(`[upload] Tier-1 exception on ${bucket}:`, tier1Err);
        }
      }

      // ── Tier 2: fetch(fileUri) → Blob upload ─────────────────────────────────
      if (fileUri) {
        try {
          const response = await fetch(fileUri);
          if (response.ok) {
            const blob = await response.blob();
            if (blob.size > 0) {
              const { error } = await supabase.storage
                .from(bucket)
                .upload(filePath, blob, {
                  contentType: mimeType || blob.type || 'application/octet-stream',
                  upsert: true,
                });

              if (!error) {
                const { data: urlData } = supabase.storage
                  .from(bucket)
                  .getPublicUrl(filePath);
                if (urlData?.publicUrl) {
                  console.log(`[upload] Tier-2 success (${bucket}):`, urlData.publicUrl);
                  return urlData.publicUrl;
                }
              }
            }
          }
        } catch (tier2Err) {
          console.warn(`[upload] Tier-2 exception on ${bucket}:`, tier2Err);
        }
      }
    }

    // ── Tier 3: data: URI fallback ────────────────────────────────────────────
    if (base64Data) {
      console.warn('[upload] Using data: URI fallback');
      return `data:${mimeType || 'application/octet-stream'};base64,${base64Data}`;
    }

    if (fileUri) {
      return fileUri;
    }

    return null;
  } catch (err) {
    console.warn('[upload] uploadChatAttachment error:', err);
    return base64Data ? `data:${mimeType || 'application/octet-stream'};base64,${base64Data}` : fileUri || null;
  }
}

/**
 * Delete a message only for the current user (Delete for me)
 */
export async function deleteChatMessageForMe(
  messageId: string,
  userId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('chat_messages')
      .update({ deleted: true })
      .eq('id', messageId)
      .eq('owner_user_id', userId);

    if (error) {
      console.error('Error deleting message for me:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error deleting message for me:', err);
    return false;
  }
}

/**
 * Delete a message for all participants in the conversation (Delete for everyone)
 */
export async function deleteChatMessageForEveryone(
  messageId: string,
  userId: string
): Promise<boolean> {
  try {
    // 1. Fetch message to check root id
    const { data: msg } = await supabase
      .from('chat_messages')
      .select('id, sender_user_id, sender_message_id, conversation_id')
      .eq('id', messageId)
      .maybeSingle();

    if (!msg) return false;

    // The root ID is either this message's ID or its sender_message_id
    const rootMessageId = msg.sender_message_id || msg.id;

    // Mark deleted across all member copies
    const { error } = await supabase
      .from('chat_messages')
      .update({
        deleted: true,
        message: 'This message was deleted',
      })
      .or(`id.eq.${rootMessageId},sender_message_id.eq.${rootMessageId}`);

    if (error) {
      console.error('Error deleting message for everyone:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error deleting message for everyone:', err);
    return false;
  }
}

/**
 * Legacy delete function (defaults to Delete for me)
 */
export async function deleteChatMessage(
  messageId: string,
  userId: string
): Promise<boolean> {
  return deleteChatMessageForMe(messageId, userId);
}

/**
 * Create or get direct conversation between two users.
 */
export async function getOrCreateDirectConversation(
  currentUserId: string,
  targetUserId: string
): Promise<string | null> {
  try {
    // Check if a direct conversation already exists between both users
    const { data: myMemberships } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', currentUserId);

    if (myMemberships && myMemberships.length > 0) {
      const convoIds = myMemberships.map((m) => m.conversation_id);
      const { data: targetMemberships } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', targetUserId)
        .in('conversation_id', convoIds);

      if (targetMemberships && targetMemberships.length > 0) {
        // Query all matching shared conversations to find if any is a direct conversation
        const sharedConvoIds = targetMemberships.map((t) => t.conversation_id);
        const { data: convos } = await supabase
          .from('conversations')
          .select('id, type')
          .in('id', sharedConvoIds)
          .eq('type', 'direct')
          .limit(1);

        if (convos && convos.length > 0) {
          return convos[0].id;
        }
      }
    }

    // Otherwise create a new direct conversation
    const { data: newConvo, error: createErr } = await supabase
      .from('conversations')
      .insert({
        type: 'direct',
        created_by: currentUserId,
      })
      .select()
      .single();

    if (createErr || !newConvo) throw createErr;

    // Add members
    await supabase.from('conversation_members').insert([
      { conversation_id: newConvo.id, user_id: currentUserId, role: 'member' },
      { conversation_id: newConvo.id, user_id: targetUserId, role: 'member' },
    ]);

    return newConvo.id;
  } catch (error) {
    console.error('Error getting or creating conversation:', error);
    return null;
  }
}

/**
 * Create a new group conversation.
 */
export async function createGroupConversation(
  creatorId: string,
  groupName: string,
  memberUserIds: string[],
  imageUrl?: string
): Promise<string | null> {
  try {
    const { data: newConvo, error } = await supabase
      .from('conversations')
      .insert({
        type: 'group',
        name: groupName,
        image: imageUrl || null,
        created_by: creatorId,
      })
      .select()
      .single();

    if (error || !newConvo) throw error;

    const allMemberIds = Array.from(new Set([creatorId, ...memberUserIds]));
    const memberRows = allMemberIds.map((uid) => ({
      conversation_id: newConvo.id,
      user_id: uid,
      role: uid === creatorId ? 'admin' : 'member',
    }));

    await supabase.from('conversation_members').insert(memberRows);

    return newConvo.id;
  } catch (error) {
    console.error('Error creating group conversation:', error);
    return null;
  }
}

/**
 * Search profiles by name, email, or mobile.
 */
export async function searchProfiles(
  query: string,
  currentUserId: string
): Promise<Profile[]> {
  try {
    const trimmed = query.trim();
    if (!trimmed) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', currentUserId)
        .limit(20);
      return data || [];
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', currentUserId)
      .or(`name.ilike.%${trimmed}%,email.ilike.%${trimmed}%,mobile.ilike.%${trimmed}%`)
      .limit(20);

    if (error) {
      console.error('Search profiles error:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error in searchProfiles:', err);
    return [];
  }
}

export interface ConversationMemberWithProfile {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'admin' | 'member' | string;
  joined_at?: string;
  profile?: {
    id: string;
    name?: string;
    email?: string;
    mobile?: string;
    avatar?: string;
    avatar_url?: string;
    online?: boolean;
    last_seen?: string;
  };
}

/**
 * Fetch all members of a conversation with their profiles.
 */
export async function getConversationMembers(
  conversationId: string
): Promise<ConversationMemberWithProfile[]> {
  try {
    const { data: members, error: memErr } = await supabase
      .from('conversation_members')
      .select('id, conversation_id, user_id, role, joined_at')
      .eq('conversation_id', conversationId);

    if (memErr || !members) {
      console.error('Error fetching conversation members:', memErr);
      return [];
    }

    const userIds = members.map((m) => m.user_id).filter(Boolean);
    if (userIds.length === 0) return [];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, email, mobile, avatar, avatar_url, online, last_seen')
      .in('id', userIds);

    const profileMap: Record<string, any> = {};
    if (profiles) {
      profiles.forEach((p) => {
        profileMap[p.id] = p;
      });
    }

    return members.map((m) => ({
      ...m,
      profile: profileMap[m.user_id] || { id: m.user_id, name: 'User' },
    }));
  } catch (err) {
    console.error('Error in getConversationMembers:', err);
    return [];
  }
}

/**
 * Add a member to a group conversation.
 */
export async function addConversationMember(
  conversationId: string,
  userId: string,
  role: string = 'member'
): Promise<boolean> {
  try {
    const { error } = await supabase.from('conversation_members').insert({
      conversation_id: conversationId,
      user_id: userId,
      role,
    });

    if (error) {
      console.error('Error adding conversation member:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error in addConversationMember:', err);
    return false;
  }
}

/**
 * Remove a member from a group conversation.
 */
export async function removeConversationMember(
  conversationId: string,
  userId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('conversation_members')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error removing conversation member:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error in removeConversationMember:', err);
    return false;
  }
}

/**
 * Log a call message (completed, missed, or rejected) into the chat conversation
 */
export async function logCallMessage(params: {
  callerId: string;
  calleeId: string;
  callType: 'audio' | 'video';
  status: 'completed' | 'missed' | 'rejected' | 'declined';
  durationSeconds?: number;
  isGroup?: boolean;
}): Promise<void> {
  try {
    const { callerId, calleeId, callType, status, durationSeconds = 0, isGroup = false } = params;
    const now = new Date().toISOString();
    const typeLabel = isGroup
      ? (callType === 'video' ? 'Group Video call' : 'Group Audio call')
      : (callType === 'video' ? 'Video call' : 'Audio call');

    const formatDur = (secs: number) => {
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      if (m > 0) return `${m}m ${s}s`;
      return `${s}s`;
    };

    if (isGroup) {
      const conversationId = calleeId;
      const durStr = formatDur(durationSeconds);
      const msgText = `${typeLabel} · ${durStr}`;

      const { data: members } = await supabase
        .from('conversation_members')
        .select('user_id')
        .eq('conversation_id', conversationId);

      if (members && members.length > 0) {
        const rows = members.map((m) => ({
          conversation_id: conversationId,
          owner_user_id: m.user_id,
          sender_user_id: callerId,
          message: msgText,
          message_type: 'call',
          direction: m.user_id === callerId ? 'Sent' : 'Received',
          sent: true,
          received: false,
          created_at: now,
          file_name: 'completed',
          duration: durationSeconds,
        }));

        await supabase.from('chat_messages').insert(rows as any);
      }
      return;
    }

    const conversationId = await getOrCreateDirectConversation(callerId, calleeId);
    if (!conversationId) return;

    let callerMsg = typeLabel;
    let calleeMsg = typeLabel;
    let fileName = status;

    if (status === 'completed') {
      const durStr = formatDur(durationSeconds);
      callerMsg = `${typeLabel} · ${durStr}`;
      calleeMsg = `${typeLabel} · ${durStr}`;
    } else if (status === 'missed' || status === 'rejected' || status === 'declined') {
      callerMsg = `${typeLabel} · Cancelled`;
      calleeMsg = `Missed ${typeLabel.toLowerCase()}`;
      fileName = 'missed';
    }

    // Insert copy for caller (direction: Sent)
    await supabase.from('chat_messages').insert({
      conversation_id: conversationId,
      owner_user_id: callerId,
      sender_user_id: callerId,
      message: callerMsg,
      message_type: 'call',
      direction: 'Sent',
      sent: true,
      received: false,
      created_at: now,
      file_name: fileName,
      duration: durationSeconds,
    });

    // Insert copy for callee (direction: Received)
    await supabase.from('chat_messages').insert({
      conversation_id: conversationId,
      owner_user_id: calleeId,
      sender_user_id: callerId,
      message: calleeMsg,
      message_type: 'call',
      direction: 'Received',
      sent: true,
      received: false,
      created_at: now,
      file_name: fileName,
      duration: durationSeconds,
    });
  } catch (err) {
    console.error('Error logging call message:', err);
  }
}


