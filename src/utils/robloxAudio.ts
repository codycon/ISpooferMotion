import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { AppConfig } from '../contexts/ConfigContext';
import { logIsm } from './robloxProfiles';

let currentAudio: HTMLAudioElement | null = null;

export const playRobloxAudio = async (assetId: string, config: AppConfig) => {


  if (!assetId.trim()) {
    logIsm('warn', 'No Roblox audio asset id was provided.');
    return false;
  }

  // Stop currently playing audio
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  try {
    const audioPath = await invoke<string>('play_roblox_audio', {
      assetId,
      cookie: config.spoofing.cookie || null,
      enableCache: config.debug.enableCache,
    });

    const audioUrl = convertFileSrc(audioPath);

    // Try all common audio MIME types so the browser always finds one it supports
    const ext = audioPath.split('.').pop()?.toLowerCase() ?? '';
    const mimeTypes: Record<string, string[]> = {
      ogg: ['audio/ogg; codecs=vorbis', 'audio/ogg'],
      mp3: ['audio/mpeg', 'audio/mp3'],
      mp4: ['audio/mp4', 'audio/aac', 'audio/x-m4a'],
      m4a: ['audio/mp4', 'audio/aac', 'audio/x-m4a'],
      wav: ['audio/wav', 'audio/x-wav'],
      flac: ['audio/flac'],
    };
    const types = mimeTypes[ext] ?? ['audio/ogg', 'audio/mpeg', 'audio/mp4'];

    currentAudio = new Audio();
    for (const mime of types) {
      const src = document.createElement('source');
      src.src = audioUrl;
      src.type = mime;
      currentAudio.appendChild(src);
    }

    currentAudio.addEventListener('error', () => {
      window.dispatchEvent(
        new CustomEvent('ism-warning-toast', {
          detail: {
            message: `Playback failed for audio ${assetId}: Format unsupported. Try re-scanning.`,
          },
        }),
      );
      logIsm('error', `Playback failed for audio ${assetId}`);
      // Delete the cached file so the next attempt re-downloads
      invoke('play_roblox_audio', { assetId, cookie: config.spoofing.cookie || null, enableCache: false }).catch(() => {});
    });

    await currentAudio.play();
    logIsm('success', `Playing Roblox audio ${assetId}.`);
    return true;
  } catch (err) {
    // Invoke failed
    window.dispatchEvent(
      new CustomEvent('ism-warning-toast', {
        detail: { message: `Audio playback failed: ${String(err)}` },
      }),
    );
    logIsm('error', `Could not play Roblox audio ${assetId}: ${String(err)}`);
    return false;
  }
};
