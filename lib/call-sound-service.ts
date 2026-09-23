import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

let createAudioPlayer: any = null;
let setAudioModeAsync: any = null;

try {
  const expoAudio = require('expo-audio');
  createAudioPlayer = expoAudio.createAudioPlayer;
  setAudioModeAsync = expoAudio.setAudioModeAsync;
} catch (e) {
  // expo-audio not available
}

// Local sound assets
const OUTGOING_ASSET = require('../assets/sounds/outgoing_ring.wav');
const INCOMING_ASSET = require('../assets/sounds/incoming_ring.wav');

// Fallback CDN URLs if needed
const OUTGOING_CDN = 'https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3';
const INCOMING_CDN = 'https://assets.mixkit.co/active_storage/sfx/2874/2874-preview.mp3';

class CallSoundService {
  private activePlayer: any = null;
  private isPlaying = false;
  private hapticInterval: any = null;

  public async playOutgoingTone(): Promise<void> {
    await this.stopAll();
    this.isPlaying = true;
    this.startHaptics();
    await this.playAudio(OUTGOING_ASSET, OUTGOING_CDN);
  }

  public async playIncomingTone(): Promise<void> {
    await this.stopAll();
    this.isPlaying = true;
    this.startHaptics();
    await this.playAudio(INCOMING_ASSET, INCOMING_CDN);
  }

  public async stopAll(): Promise<void> {
    this.isPlaying = false;
    this.stopHaptics();

    if (this.activePlayer) {
      try {
        if (typeof this.activePlayer.pause === 'function') {
          this.activePlayer.pause();
        }
        if (typeof this.activePlayer.remove === 'function') {
          this.activePlayer.remove();
        }
      } catch (err) {
        // Player cleanup
      }
      this.activePlayer = null;
    }
  }

  private async playAudio(asset: any, fallbackUrl: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof Audio !== 'undefined') {
          const audio = new Audio(fallbackUrl);
          audio.loop = true;
          audio.play().catch(() => {});
          this.activePlayer = audio;
        }
        return;
      }

      if (setAudioModeAsync) {
        setAudioModeAsync({
          playsInSilentMode: true,
        }).catch(() => {});
      }

      if (createAudioPlayer) {
        // First try local bundled asset
        let player = null;
        try {
          player = createAudioPlayer(asset);
        } catch (_) {
          // fallback to remote URL
          player = createAudioPlayer(fallbackUrl);
        }

        if (player) {
          if ('loop' in player) {
            player.loop = true;
          }
          if (typeof player.play === 'function') {
            player.play();
          }
          this.activePlayer = player;
        }
      }
    } catch (err) {
      console.warn('[CallSoundService] Could not play ring tone:', err);
    }
  }

  private startHaptics(): void {
    if (Platform.OS === 'web') return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      this.hapticInterval = setInterval(() => {
        if (!this.isPlaying) {
          this.stopHaptics();
          return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }, 1800);
    } catch (_) {}
  }

  private stopHaptics(): void {
    if (this.hapticInterval) {
      clearInterval(this.hapticInterval);
      this.hapticInterval = null;
    }
  }
}

export const callSoundService = new CallSoundService();
