declare module 'expo-document-picker' {
  export interface DocumentPickerOptions {
    type?: string | string[];
    copyToCacheDirectory?: boolean;
    multiple?: boolean;
  }
  export interface DocumentPickerAsset {
    uri: string;
    name: string;
    mimeType?: string;
    size?: number;
    file?: File;
    lastModified?: number;
  }
  export interface DocumentPickerResult {
    canceled: boolean;
    assets: DocumentPickerAsset[] | null;
  }
  export function getDocumentAsync(options?: DocumentPickerOptions): Promise<DocumentPickerResult>;
}

declare module 'expo-audio' {
  export type AudioSource = string | number | { uri: string } | null;
  export interface AudioPlayer {
    playing: boolean;
    isLoaded: boolean;
    duration: number;
    currentTime: number;
    play: () => void;
    pause: () => void;
    seekTo: (seconds: number) => void;
    remove: () => void;
  }
  export interface AudioRecorder {
    isRecording: boolean;
    uri?: string | null;
    record: () => Promise<void>;
    stop: () => Promise<void>;
    getStatus?: () => Promise<any> | any;
    prepareToRecordAsync: (options?: any) => Promise<any>;
    getURI?: () => string | null;
  }
  export const AudioModule: any;
  export type RecordingOptions = any;
  export const RecordingOptions: any;
  export const RecordingPresets: any;
  export function useAudioPlayer(source?: AudioSource): AudioPlayer;
  export function useAudioRecorder(options?: any): AudioRecorder;
}

declare module 'expo-video' {
  import { Component, RefObject } from 'react';
  import { ViewStyle } from 'react-native';
  export type VideoSource = string | number | { uri: string } | null;
  export interface VideoPlayer {
    playing: boolean;
    volume: number;
    muted: boolean;
    currentTime: number;
    duration: number;
    loop: boolean;
    play: () => void;
    pause: () => void;
    replay: () => void;
    seekBy: (seconds: number) => void;
    addListener: (event: string, listener: (...args: any[]) => void) => any;
    removeListener: (event: string, listener: (...args: any[]) => void) => any;
    removeAllListeners: (event?: string) => any;
    emit: (event: string, ...args: any[]) => boolean;
    listenerCount: (event: string) => number;
  }
  export interface VideoProps {
    player?: VideoPlayer;
    style?: ViewStyle | any;
    source?: VideoSource;
    allowsFullscreen?: boolean;
    allowsPictureInPicture?: boolean;
    showsTimecodes?: boolean;
    nativeControls?: boolean;
    showControls?: boolean;
    fullscreenOptions?: any;
    contentFit?: 'contain' | 'cover' | 'fill';
    ref?: RefObject<any> | any;
    onFullscreenEnter?: () => void;
    onFullscreenExit?: () => void;
  }
  export class VideoView extends Component<VideoProps> {}
  export function useVideoPlayer(source: any, setup?: (player: VideoPlayer) => void): VideoPlayer;
  export function useEvent(player: any, eventName: string, initialValue?: any): any;
}

declare module 'expo-camera' {
  import { Component } from 'react';
  import { ViewStyle } from 'react-native';
  export type CameraType = 'back' | 'front';
  export type FlashMode = 'off' | 'on' | 'auto';
  export type CameraMode = 'picture' | 'video';
  export type CameraRatio = '4:3' | '16:9' | '1:1';
  export interface CameraProps {
    facing?: CameraType;
    flash?: FlashMode;
    zoom?: number;
    mode?: CameraMode;
    ratio?: CameraRatio;
    mirror?: boolean;
    enableTorch?: boolean;
    animateShutter?: boolean;
    animatedProps?: any;
    style?: ViewStyle | any;
    ref?: any;
    children?: any;
  }
  export class CameraView extends Component<CameraProps> {
    takePictureAsync(options?: any): Promise<{ uri: string }>;
    recordAsync(options?: any): Promise<{ uri: string }>;
    stopRecording(): void;
  }
  export function useCameraPermissions(): [any, () => Promise<any>];
  export function useMicrophonePermissions(): [any, () => Promise<any>];
}

declare module 'expo-location' {
  export enum Accuracy {
    Lowest = 1,
    Low = 2,
    Balanced = 3,
    High = 4,
    Highest = 5,
    BestForNavigation = 6,
  }
  export interface LocationObject {
    coords: {
      latitude: number;
      longitude: number;
      altitude: number | null;
      accuracy: number | null;
      altitudeAccuracy: number | null;
      heading: number | null;
      speed: number | null;
    };
    timestamp: number;
  }
  export interface LocationPermissionResponse {
    status: 'granted' | 'undetermined' | 'denied';
    granted: boolean;
    canAskAgain: boolean;
    expires: 'never' | number;
  }
  export function requestForegroundPermissionsAsync(): Promise<LocationPermissionResponse>;
  export function getCurrentPositionAsync(options?: { accuracy?: Accuracy }): Promise<LocationObject>;
  export function reverseGeocodeAsync(location: { latitude: number; longitude: number }): Promise<Array<{
    city?: string | null;
    district?: string | null;
    streetNumber?: string | null;
    street?: string | null;
    region?: string | null;
    subregion?: string | null;
    country?: string | null;
    postalCode?: string | null;
    name?: string | null;
    isoCountryCode?: string | null;
    timezone?: string | null;
    formattedAddress?: string | null;
  }>>;
}

declare module '@cometchat/calls-sdk-react-native' {
  export const CometChatCalls: any;
  export default CometChatCalls;
}

