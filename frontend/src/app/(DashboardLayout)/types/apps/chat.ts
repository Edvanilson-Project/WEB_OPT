type attachType = {
  icon?: string;
  file?: string;
  fileSize?: string;
};

export type MessageType = {
  createdAt?: Date | string | number;
  msg: string;
  senderId: number | string;
  type: string;
  attachment: attachType[];
  id: string;
};

export interface ChatsType {
  id: number | string;
  name: string;
  status: string;
  thumb: string;
  recent: boolean;
  excerpt: string;
  messages: MessageType[];
}
