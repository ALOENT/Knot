export const SOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  JOIN_CHAT: 'join_chat',
  USER_JOINED_CHAT: 'user_joined_chat',
  SEND_MESSAGE: 'send_message',
  NEW_MESSAGE: 'new_message',
  MESSAGE_CONFIRMED: 'message_confirmed',
  MESSAGE_DELIVERED: 'message_delivered',
  MESSAGE_READ: 'message_read',
  MESSAGE_DELETED: 'message_deleted',
  START_TYPING: 'start_typing',
  STOP_TYPING: 'stop_typing',
  USER_TYPING: 'user_typing',
  PRESENCE_UPDATE: 'presence_update',
  ERROR: 'error'
} as const;
