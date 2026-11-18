import React from 'react';
import { Film, Users, Share2, Shield, ShieldAlert, Server, User } from 'lucide-react';
import type { ConnectionState } from '../services/peerService';
import { EMBED_SERVERS } from '../services/embedService';

interface NavbarProps {
  roomId: string;
  userName: string;
  onUpdateUserName: (name: string) => void;
  connectionState: ConnectionState;
  peerCount: number;
  activeServerId: string;
  isHost: boolean;
  isHostLocked: boolean;
  onToggleHostLock: () => void;
  onSelectServer: (serverId: string) => void;
  onOpenRoomModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  roomId,
  userName,
  onUpdateUserName,
  connectionState,
  peerCount,
  activeServerId,
  isHost,
  isHostLocked,
  onToggleHostLock,
  onSelectServer,
  onOpenRoomModal,
}) => {
  return (
    <header className="bg-cinema-800 border-b border-cinema-700/60 px-3 py-2.5 sm:px-6 sm:py-3 flex items-center justify-between sticky top-0 z-30">
      {/* Brand */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-cinema-accent flex items-center justify-center text-white shadow-lg shadow-cinema-accent/30">
          <Film className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-base sm:text-lg tracking-tight text-white">
              Cine<span className="text-cinema-accent">Party</span>
            </span>
            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-cinema-700 text-gray-300 border border-cinema-600">
              $0 Free
            </span>
          </div>
          <p className="text-[11px] text-gray-400 hidden sm:block">Room: <span className="font-mono text-gray-300">{roomId}</span></p>
        </div>
      </div>

      {/* Room and Status info */}
      <div className="flex items-center gap-1.5 sm:gap-3">
        {/* User profile / Name change button */}
        <button
          onClick={() => {
            const next = window.prompt('Enter your display name:', userName);
            if (next && next.trim()) {
              onUpdateUserName(next.trim().substring(0, 24));
            }
          }}
          title="Click to edit your display name"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cinema-900 hover:bg-cinema-700/80 border border-cinema-700 text-xs text-gray-200 transition group"
        >
          <User className="w-3 h-3 text-cinema-accent" />
          <span className="max-w-[75px] sm:max-w-[120px] truncate font-medium">{userName}</span>
        </button>

        {/* Connection status indicator */}
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-cinema-900 border border-cinema-700 text-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              connectionState === 'connected'
                ? 'bg-emerald-400 animate-pulse'
                : connectionState === 'connecting'
                ? 'bg-amber-400 animate-ping'
                : 'bg-rose-500'
            }`}
          />
          <span className="text-[11px] text-gray-300 hidden md:inline">
            {connectionState === 'connected'
              ? peerCount > 0
                ? `${peerCount + 1} Watching`
                : 'Room Ready'
              : connectionState === 'connecting'
              ? 'Connecting...'
              : 'Disconnected'}
          </span>
          <span className="text-[11px] text-gray-300 md:hidden flex items-center gap-0.5">
            <Users className="w-3 h-3 inline text-gray-400" />
            {peerCount + 1}
          </span>
        </div>

        {/* Server Switcher Dropdown */}
        <div className="relative hidden lg:flex items-center">
          <Server className="w-3.5 h-3.5 absolute left-2 text-gray-400 pointer-events-none" />
          <select
            value={activeServerId}
            onChange={(e) => onSelectServer(e.target.value)}
            className="pl-7 pr-2 py-1 text-xs bg-cinema-700 hover:bg-cinema-600 text-gray-200 border border-cinema-600 rounded-lg cursor-pointer focus:outline-none focus:ring-1 focus:ring-cinema-accent"
            title="Switch streaming provider server if video is slow"
          >
            {EMBED_SERVERS.map((server) => (
              <option key={server.id} value={server.id}>
                {server.name}
              </option>
            ))}
          </select>
        </div>

        {/* Host lock button */}
        {isHost && (
          <button
            onClick={onToggleHostLock}
            title={isHostLocked ? 'Host control locked (only host can change movies)' : 'Collaborative mode (everyone can control)'}
            className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition ${
              isHostLocked
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-cinema-700 hover:bg-cinema-600 text-gray-300 border border-cinema-600'
            }`}
          >
            {isHostLocked ? <ShieldAlert className="w-3.5 h-3.5 text-amber-400" /> : <Shield className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isHostLocked ? 'Host Only' : 'Shared Control'}</span>
          </button>
        )}

        {/* Invite / Room button */}
        <button
          onClick={onOpenRoomModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cinema-accent hover:bg-cinema-accentHover text-white text-xs font-semibold shadow transition active:scale-95"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>Invite</span>
        </button>
      </div>
    </header>
  );
};
