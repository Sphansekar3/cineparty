# CineParty - Watch Movies Online Together ($0 Free)

**CineParty** is a free, real-time online watch party web application (like Rave) that allows you and your friends to discover and watch movies together in sync—with **zero downloads**, **zero screen sharing**, and **$0 running costs**.

---

## Features

- 🎬 **Zero Downloads & Zero Screen Sharing**: Stream directly from free online movie streaming providers (VidSrc, 2Embed, SuperEmbed, Smashy) using TMDB movie IDs.
- 📱 **Mobile-First Cinema Experience**:
  - Pinned 16:9 movie screen at the top with `playsinline` (preventing iOS/Android fullscreen takeover).
  - Clean bottom tabs for **Live Chat**, **Movie Search**, and **Room Details**.
  - **No webcam clutter on mobile**: Keeps your phone screen distraction-free, prevents stutter, and saves battery/cellular data.
- 💻 **Desktop Video Chat (Optional)**:
  - On laptops, desktops, and tablets, enjoy optional picture-in-picture webcam and microphone video chat right alongside the movie and chat.
- ⏱️ **Dual-Control Real-Time Synchronization**:
  - **Shared 3-2-1 Countdown ("Sync Start")**: High-visibility synchronized countdown overlay with audio chime ensures both friends start the movie on the exact same second.
  - **Direct Stream Auto-Sync**: Frame-by-frame automated sync (< 150ms) for direct video links (`.mp4`, `.m3u8`/HLS) and YouTube embeds.
  - **Remote Control Bar**: Synchronized Play, Pause, Rewind 10s, and Fast-Forward 10s.
- 🌐 **Peer-to-Peer Architecture ($0 Hosting)**:
  - Powered by WebRTC DataChannels (PeerJS) and Google's free public STUN servers.
  - No middleman backend server, no database fees, no bandwidth costs.
- 📱 **Scan to Join (QR Code)**:
  - Tap "Invite" to display a room link and an instant QR code. A friend can point their phone camera at your screen and join the party in 1 second!
- 🔒 **Host-Lock Mode**:
  - By default, controls are collaborative (anyone can pause, play, seek, or change movie). The room creator can toggle "Host Only" at any time.

---

## Running Locally

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm run dev
   ```

3. Open `http://localhost:5173` in your browser.
   - Click "Invite" to copy your room link or open a second window (Incognito) with `?room=<roomId>` to test two clients syncing together!

---

## 100% Free Deployment ($0 Forever)

You can host CineParty for free on **Vercel**, **Cloudflare Pages**, or **Netlify**.

### Option A: Deploy to Vercel (Recommended)
1. Push this folder to a GitHub repository.
2. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
3. Import your GitHub repository.
4. Framework Preset: **Vite** (auto-detected).
5. Click **Deploy**. Your app will be live at `https://your-project.vercel.app`!

### Option B: Deploy to Cloudflare Pages
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) -> **Workers & Pages** -> **Create application**.
2. Connect your Git repository.
3. Build command: `npm run build`
4. Build output directory: `dist`
5. Click **Save and Deploy**.

---

## Free Movie Sources & TMDB Setup

- **Built-in Curated Movies**: Popular blockbusters (Inception, Interstellar, Dune, The Dark Knight, Avengers, Spider-Man, Oppenheimer) are included out-of-the-box with zero configuration needed.
- **Unlimited TMDB Search**: To search through thousands of movies, you can optionally paste your free [TMDB API Key](https://www.themoviedb.org/settings/api) in the catalog modal.
- **Direct Video Links**: Supports any direct `.mp4`, `.webm`, or `.m3u8` (HLS) stream link, as well as any YouTube video link.
