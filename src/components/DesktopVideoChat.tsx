import React, { useState, useRef, useEffect } from 'react';
import { Video, VideoOff, Users } from 'lucide-react';
import { peerService } from '../services/peerService';

interface DesktopVideoChatProps {
  remoteStream: MediaStream | null;
}

export const DesktopVideoChat: React.FC<DesktopVideoChatProps> = ({
  remoteStream,
}) => {
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Bind local stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Bind remote stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const toggleMedia = async () => {
    if (isVideoOn) {
      // Turn off
      peerService.stopLocalMedia();
      setLocalStream(null);
      setIsVideoOn(false);
    } else {
      // Turn on
      const stream = await peerService.startLocalMedia(true, true);
      if (stream) {
        setLocalStream(stream);
        setIsVideoOn(true);
      }
    }
  };

  return (
    <div className="bg-cinema-800/90 border border-cinema-700 rounded-xl p-3 shadow-md">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
          <Users className="w-3.5 h-3.5 text-cinema-blue" />
          <span>Video Chat</span>
          <span className="text-[10px] text-gray-400 font-normal">(Desktop/Tablet)</span>
        </div>

        <button
          onClick={toggleMedia}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
            isVideoOn
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              : 'bg-cinema-700 hover:bg-cinema-600 text-gray-200 border border-cinema-600'
          }`}
        >
          {isVideoOn ? <VideoOff className="w-3 h-3 text-rose-400" /> : <Video className="w-3 h-3" />}
          <span>{isVideoOn ? 'Stop Camera' : 'Start Camera'}</span>
        </button>
      </div>

      {/* Video feeds grid */}
      {(localStream || remoteStream) ? (
        <div className="grid grid-cols-2 gap-2 mt-2">
          {/* Local Feed */}
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-cinema-700">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
            <span className="absolute bottom-1 left-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[9px] text-gray-300">
              You
            </span>
          </div>

          {/* Remote Feed */}
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-cinema-700 flex items-center justify-center">
            {remoteStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[10px] text-gray-500 text-center px-1">
                Friend's camera is off
              </span>
            )}
            <span className="absolute bottom-1 left-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[9px] text-gray-300">
              Friend
            </span>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-gray-400 mt-1">
          Camera is off. Click "Start Camera" to chat with your friend face-to-face on desktop.
        </p>
      )}
    </div>
  );
};
