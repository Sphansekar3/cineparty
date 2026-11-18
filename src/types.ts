export type StreamSourceType = 'embed' | 'direct' | 'youtube';

export interface Movie {
  id: string | number;
  title: string;
  tmdbId?: number;
  imdbId?: string;
  overview?: string;
  posterPath?: string;
  backdropPath?: string;
  releaseDate?: string;
  voteAverage?: number;
  streamType: StreamSourceType;
  streamUrl?: string; // Direct MP4/M3U8 link or YouTube URL
}

export type SyncActionType =
  | 'ROOM_STATE'
  | 'MOVIE_CHANGE'
  | 'COUNTDOWN_START'
  | 'PLAY'
  | 'PAUSE'
  | 'SEEK'
  | 'CHAT_MESSAGE'
  | 'HOST_LOCK_TOGGLE'
  | 'SERVER_CHANGE'
  | 'SYNC_PING'
  | 'SYNC_PULSE'
  | 'BUFFERING_START'
  | 'BUFFERING_END'
  | 'USER_LEFT'
  | 'USER_NAME_CHANGE';

export interface SyncMessage {
  type: SyncActionType;
  senderId: string;
  senderName: string;
  timestamp: number;
  payload: any;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface EmbedServer {
  id: string;
  name: string;
  buildMovieUrl: (tmdbId: string | number, imdbId?: string) => string;
}
