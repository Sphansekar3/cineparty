import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check, QrCode, Smartphone, Sparkles } from 'lucide-react';
import { copyToClipboard } from '../utils/helpers';

interface RoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
}

export const RoomModal: React.FC<RoomModalProps> = ({
  isOpen,
  onClose,
  roomId,
}) => {
  const [copied, setCopied] = useState(false);
  const roomUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;

  const handleCopy = async () => {
    const success = await copyToClipboard(roomUrl);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-cinema-800 border border-cinema-700 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-gray-400 hover:text-white hover:bg-cinema-700 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-2xl bg-cinema-accent/20 border border-cinema-accent/40 flex items-center justify-center text-cinema-accent mx-auto mb-2">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-extrabold text-white">Invite Watch Buddy</h3>
          <p className="text-xs text-gray-400 mt-1">
            Share this link or scan the QR code to watch together in real-time.
          </p>
        </div>

        {/* Copy Link Input */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-gray-300 mb-1.5">
            Room Invite Link
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={roomUrl}
              className="flex-1 px-3 py-2 bg-cinema-900 border border-cinema-700 rounded-xl text-xs text-gray-300 font-mono select-all focus:outline-none"
            />
            <button
              onClick={handleCopy}
              className="px-3 py-2 bg-cinema-accent hover:bg-cinema-accentHover text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shrink-0"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* QR Code Container for Phone joining */}
        <div className="bg-cinema-900 border border-cinema-700 rounded-xl p-4 flex flex-col items-center justify-center text-center">
          <div className="p-3 bg-white rounded-xl shadow-md mb-2">
            <QRCodeSVG value={roomUrl} size={150} level="M" />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-300 font-medium mt-1">
            <Smartphone className="w-4 h-4 text-cinema-blue" />
            <span>Scan with phone camera to join instantly</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-0.5 font-mono">
            Room Code: <span className="text-gray-300 font-bold">{roomId}</span>
          </p>
        </div>

        {/* Quick Tips */}
        <div className="mt-4 pt-3 border-t border-cinema-700/60 text-[11px] text-gray-400 space-y-1">
          <p className="font-semibold text-gray-300 flex items-center gap-1">
            <QrCode className="w-3.5 h-3.5 text-cinema-accent" />
            Zero-Money Guarantee:
          </p>
          <p>
            Connects directly between your devices via WebRTC peer-to-peer. No registration or subscription required!
          </p>
        </div>
      </div>
    </div>
  );
};
