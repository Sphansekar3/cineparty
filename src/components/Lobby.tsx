import React, { useState } from 'react';
import { Film, Users, PlusCircle, ArrowRight, ShieldCheck, Smartphone, Zap, Sparkles, User } from 'lucide-react';

interface LobbyProps {
  userName: string;
  onUpdateUserName: (name: string) => void;
  onStartCreate: () => void;
  onJoinRoom: (roomId: string) => void;
  invitedRoomId?: string;
}

export const Lobby: React.FC<LobbyProps> = ({
  userName,
  onUpdateUserName,
  onStartCreate,
  onJoinRoom,
  invitedRoomId,
}) => {
  const [joinInput, setJoinInput] = useState(invitedRoomId || '');
  const [joinError, setJoinError] = useState('');

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');

    const trimmed = joinInput.trim();
    if (!trimmed) {
      setJoinError('Please enter a room code or invite URL.');
      return;
    }

    // Smart join: extract ?room= if a full URL was pasted
    let finalRoomId = trimmed;
    try {
      if (trimmed.includes('?room=')) {
        const url = new URL(trimmed);
        const parsed = url.searchParams.get('room');
        if (parsed) finalRoomId = parsed;
      } else if (trimmed.includes('/')) {
        // e.g. path like .../room-name
        const parts = trimmed.split('/');
        finalRoomId = parts[parts.length - 1];
      }
    } catch {
      // not a full URL, use raw string
    }

    // Clean up alphanumeric + hyphen
    finalRoomId = finalRoomId.replace(/[^a-zA-Z0-9_-]/g, '');

    if (!finalRoomId) {
      setJoinError('Invalid room code format. Example: chill-441');
      return;
    }

    onJoinRoom(finalRoomId);
  };

  return (
    <div className="min-h-screen bg-cinema-900 text-white flex flex-col justify-between p-4 sm:p-8 relative overflow-hidden select-none">
      {/* Background glow effects */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-cinema-accent/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-cinema-blue/15 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cinema-accent flex items-center justify-center text-white shadow-lg shadow-cinema-accent/40">
            <Film className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-xl tracking-tight">
                Cine<span className="text-cinema-accent">Party</span>
              </span>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-cinema-700 text-gray-300 border border-cinema-600">
                $0 Free
              </span>
            </div>
            <p className="text-xs text-gray-400">Watch Movies Online Together</p>
          </div>
        </div>
      </header>

      {/* Hero Content */}
      <main className="max-w-4xl w-full mx-auto my-auto py-10 z-10 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cinema-800 border border-cinema-700 text-xs text-gray-300 mb-6 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-cinema-accent" />
          <span>Peer-to-Peer Real-Time Video Sync</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight max-w-2xl mx-auto mb-4">
          Watch Movies Together, <span className="text-cinema-accent">In Perfect Sync.</span>
        </h1>
        <p className="text-sm sm:text-base text-gray-400 max-w-xl mx-auto mb-6 leading-relaxed">
          Stream movies from YouTube, Google Drive, Dropbox, or free catalogs with your friend in real-time. Zero downloads, zero screen sharing.
        </p>

        {/* Prominent Onboarding: Display Name Input */}
        <div className="max-w-xl mx-auto mb-10">
          <div className="bg-cinema-800/95 border-2 border-cinema-700/80 hover:border-cinema-accent/60 focus-within:border-cinema-accent rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-md transition-all text-left">
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="user-display-name" className="text-xs uppercase tracking-wider text-gray-300 font-bold flex items-center gap-2">
                <User className="w-4 h-4 text-cinema-accent" />
                <span>Your Name in Watch Party</span>
              </label>
              <span className="text-[11px] text-gray-400">Visible to friends</span>
            </div>
            <div className="relative">
              <input
                id="user-display-name"
                type="text"
                value={userName}
                onChange={(e) => {
                  const val = e.target.value.substring(0, 24);
                  onUpdateUserName(val);
                }}
                placeholder="Enter your name (e.g. Shreyas)..."
                maxLength={24}
                className="w-full px-4 py-3 bg-cinema-900 border border-cinema-700/80 rounded-xl text-base sm:text-lg font-bold text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cinema-accent/50 transition shadow-inner"
              />
            </div>
          </div>
        </div>

        {/* Action Cards: Create Room vs Join Room */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl mx-auto text-left">
          {/* Card 1: Create a Room */}
          <div className="bg-cinema-800/90 border border-cinema-700 hover:border-cinema-accent/80 rounded-2xl p-6 flex flex-col justify-between shadow-xl transition hover:-translate-y-1">
            <div>
              <div className="w-12 h-12 rounded-xl bg-cinema-accent/20 border border-cinema-accent/40 flex items-center justify-center text-cinema-accent mb-4">
                <PlusCircle className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-white mb-1.5">Host a Watch Party</h2>
              <p className="text-xs text-gray-400 leading-relaxed">
                Pick a movie from the catalog or paste a video link (YouTube, Dropbox, Drive). We'll set up your room and give you an invite link.
              </p>
            </div>
            <button
              onClick={onStartCreate}
              className="mt-6 w-full py-3 bg-cinema-accent hover:bg-cinema-accentHover text-white rounded-xl text-sm font-bold shadow-lg shadow-cinema-accent/30 transition active:scale-95 flex items-center justify-center gap-2"
            >
              <span>Create a Room</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Card 2: Join a Room */}
          <div className="bg-cinema-800/90 border border-cinema-700 hover:border-cinema-blue/80 rounded-2xl p-6 flex flex-col justify-between shadow-xl transition hover:-translate-y-1">
            <div>
              <div className="w-12 h-12 rounded-xl bg-cinema-blue/20 border border-cinema-blue/40 flex items-center justify-center text-cinema-blue mb-4">
                <Users className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-white mb-1.5">Join Existing Party</h2>
              <p className="text-xs text-gray-400 leading-relaxed mb-4">
                Got a code or invite link from a friend? Enter it below to jump directly into their party.
              </p>
            </div>

            <form onSubmit={handleJoinSubmit} className="space-y-2 mt-auto">
              <input
                type="text"
                placeholder="Enter room code or paste link..."
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value)}
                className="w-full px-3 py-2 bg-cinema-900 border border-cinema-700 rounded-xl text-xs sm:text-sm text-white placeholder-gray-500 font-mono focus:outline-none focus:ring-1 focus:ring-cinema-blue"
              />
              {joinError && <p className="text-xs text-rose-400 font-medium">{joinError}</p>}
              <button
                type="submit"
                className="w-full py-2.5 bg-cinema-700 hover:bg-cinema-600 text-white rounded-xl text-xs sm:text-sm font-bold transition active:scale-95 flex items-center justify-center gap-2"
              >
                <span>Enter Party</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto mt-12 pt-8 border-t border-cinema-800 text-left">
          <div className="flex items-start gap-2.5 p-2">
            <Zap className="w-4 h-4 text-cinema-accent shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs font-bold text-white">Zero Drift Sync</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Automated frame-locked playback via WebRTC</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 p-2">
            <Smartphone className="w-4 h-4 text-cinema-blue shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs font-bold text-white">Mobile Friendly</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Optimized cinema screen for iOS & Android</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 p-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs font-bold text-white">Smart Ad-Shield</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Blocks invasive pop-ups and redirects</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 p-2">
            <Film className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs font-bold text-white">YouTube & Drive</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Stream from personal cloud storage</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl w-full mx-auto text-center text-xs text-gray-500 py-3 z-10 border-t border-cinema-800/60">
        CineParty • 100% Free & Open-Source P2P Watch Party
      </footer>
    </div>
  );
};
