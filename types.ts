
export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system',
}

export type SearchResult = {
  uri: string;
  title: string;
};

export type Message = {
  id: string;
  role: MessageRole;
  text?: string;
  imageUrl?: string;
  searchResults?: SearchResult[];
};

export type User = {
  username: string;
};
