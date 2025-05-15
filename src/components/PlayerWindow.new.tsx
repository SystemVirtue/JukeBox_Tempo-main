import React, { useState, useEffect, useRef, useCallback, FC } from "react";
import { Button } from "@/components/ui/button";
import { SkipBack, SkipForward, Play, Pause, Volume2, VolumeX, ExternalLink, X, RefreshCw } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

// Constants
const COMMAND_STORAGE_KEY = 'jukeboxCommand';
const STATUS_STORAGE_KEY = 'jukeboxStatus';
const MAX_RECOVERY_ATTEMPTS = 3;
const PLAYER_TIMEOUT = 10000; // 10 seconds

// Types
type PlayerStatus = 'idle' | 'loading' | 'opening' | 'ready' | 'error' | 'playing' | 'paused' | 'ended' | 'recovering' | 'closed';
type PlayerCommand = 'play' | 'pause' | 'load' | 'setVolume' | 'mute' | 'unmute' | 'ended' | 'error';

interface PlayerMessage {
  type: 'status' | 'command' | 'error' | 'info';
  status?: PlayerStatus;
  command?: PlayerCommand;
  data?: Record<string, any>;
  timestamp?: number;
}

interface VideoInfo {
  id: string;
  youtubeId?: string;
  artist: string;
  title: string;
  thumbnail: string;
  startSeconds?: number;
}

const PLAYER_WINDOW_FEATURES = [
  'width=1280',
  'height=720',
  'menubar=no',
  'toolbar=no',
  'location=no',
  'status=no',
  'resizable=yes',
  'scrollbars=no',
].join(',');

interface PlayerWindowProps {
  currentVideo?: VideoInfo | null;
  queuePosition?: number;
  queueTotal?: number;
  onNextVideo?: () => void;
  onPreviousVideo?: () => void;
  onVideoEnd?: () => void;
  isPlaying?: boolean;
  onPlayPause?: (isPlaying: boolean) => void;
  isMinimized?: boolean;
  toggleMinimize?: () => void;
  className?: string;
  volume?: number;
  onVolumeChange?: (volume: number) => void;
  isMuted?: boolean;
  onMuteChange?: (isMuted: boolean) => void;
}

const PlayerWindow: FC<PlayerWindowProps> = ({
  currentVideo,
  queuePosition = 0,
  queueTotal = 0,
  onNextVideo = () => {},
  onPreviousVideo = () => {},
  onVideoEnd = () => {},
  isPlaying = false,
  onPlayPause = () => {},
  isMinimized = false,
  toggleMinimize = () => {},
  className = '',
  volume = 50,
  onVolumeChange = () => {},
  isMuted = false,
  onMuteChange = () => {},
}) => {
  // Refs
  const playerWindowRef = useRef<Window | null>(null);
  const statusCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageHandlerRef = useRef<((event: MessageEvent) => void) | null>(null);
  const unloadHandlerRef = useRef<(() => void) | null>(null);
  const playerUrl = useRef(`/player.html?t=${Date.now()}`);

  // State
  const [playerStatus, setPlayerStatus] = useState<PlayerStatus>('idle');
  const [recoveryAttempts, setRecoveryAttempts] = useState(0);
  const [lastError, setLastError] = useState<Error | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [localVolume, setLocalVolume] = useState(volume);
  const [localIsMuted, setLocalIsMuted] = useState(isMuted);

  // Derived state
  const isPlayerActive = playerStatus === 'ready' || playerStatus === 'playing' || playerStatus === 'paused';

  // Cleanup function for resources
  const cleanupResources = useCallback(() => {
    // Remove message handler
    if (messageHandlerRef.current) {
      window.removeEventListener('message', messageHandlerRef.current);
      messageHandlerRef.current = null;
    }

    // Remove unload handler
    if (unloadHandlerRef.current && playerWindowRef.current) {
      try {
        playerWindowRef.current.removeEventListener('beforeunload', unloadHandlerRef.current);
      } catch (e) {
        console.warn('Error removing unload handler:', e);
      }
      unloadHandlerRef.current = null;
    }

    // Clear any pending timeouts
    if (statusCheckTimeoutRef.current) {
      clearTimeout(statusCheckTimeoutRef.current);
      statusCheckTimeoutRef.current = null;
    }
  }, []);

  // Cleanup resources when component unmounts
  useEffect(() => {
    return () => {
      cleanupResources();
    };
  }, [cleanupResources]);

  // Handle volume and mute changes
  useEffect(() => {
    if (isPlayerActive) {
      if (localIsMuted) {
        sendCommandToPlayer('mute');
      } else {
        sendCommandToPlayer('unmute');
        sendCommandToPlayer('setVolume', { volume: localVolume / 100 });
      }
    }
  }, [localVolume, localIsMuted, isPlayerActive]);

  // Handle play/pause changes
  useEffect(() => {
    if (isPlayerActive) {
      if (isPlaying) {
        sendCommandToPlayer('play');
      } else {
        sendCommandToPlayer('pause');
      }
    }
  }, [isPlaying, isPlayerActive]);

  // Handle current video changes
  useEffect(() => {
    if (currentVideo && isPlayerActive) {
      sendCommandToPlayer('load', {
        videoId: currentVideo.id,
        startSeconds: currentVideo.startSeconds || 0,
        autoplay: isPlaying,
        volume: localIsMuted ? 0 : localVolume / 100,
      });
    }
  }, [currentVideo, isPlaying, localVolume, localIsMuted, isPlayerActive]);

  // Send command to player
  const sendCommandToPlayer = useCallback((command: PlayerCommand, data?: any) => {
    if (!playerWindowRef.current || playerWindowRef.current.closed) {
      console.warn('Player window is not open');
      return;
    }

    try {
      const message = { type: 'command', command, data, timestamp: Date.now() };
      playerWindowRef.current.postMessage(message, window.location.origin);
    } catch (error) {
      console.error('Error sending command to player:', error);
      setLastError(error instanceof Error ? error : new Error(String(error)));
    }
  }, []);

  // Start status check
  const startStatusCheck = useCallback(() => {
    if (statusCheckTimeoutRef.current) {
      clearTimeout(statusCheckTimeoutRef.current);
    }

    statusCheckTimeoutRef.current = setTimeout(() => {
      if (playerStatus === 'loading' || playerStatus === 'opening') {
        console.error('Player window failed to load in time');
        setPlayerStatus('error');
        toast.error('Player failed to load. Attempting to recover...');
        recoverPlayer();
      }
    }, PLAYER_TIMEOUT);
  }, [playerStatus]);

  // Recover player
  const recoverPlayer = useCallback(async () => {
    if (recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
      console.error('Max recovery attempts reached');
      setPlayerStatus('error');
      setIsRecovering(false);
      return;
    }

    setIsRecovering(true);
    setRecoveryAttempts(prev => prev + 1);

    try {
      // Close existing player window if it exists
      if (playerWindowRef.current && !playerWindowRef.current.closed) {
        playerWindowRef.current.close();
      }

      // Clear any pending timeouts
      if (statusCheckTimeoutRef.current) {
        clearTimeout(statusCheckTimeoutRef.current);
        statusCheckTimeoutRef.current = null;
      }

      // Reset player status
      setPlayerStatus('recovering');
      setRetryCount(0);

      // Reopen player window after a short delay
      setTimeout(() => {
        openPlayerWindow();
      }, 1000);
    } catch (error) {
      console.error('Error during player recovery:', error);
      setLastError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsRecovering(false);
    }
  }, [recoveryAttempts]);

  // Open player window
  const openPlayerWindow = useCallback(() => {
    // Only open if we don't have a window reference or the window is closed
    if (!playerWindowRef.current || playerWindowRef.current.closed) {
      try {
        // Close existing player window if it exists
        if (playerWindowRef.current && !playerWindowRef.current.closed) {
          playerWindowRef.current.close();
        }

        // Clear any existing timeouts
        if (statusCheckTimeoutRef.current) {
          clearTimeout(statusCheckTimeoutRef.current);
          statusCheckTimeoutRef.current = null;
        }

        // Open new window
        const newWindow = window.open(playerUrl.current, 'JukeboxPlayer', PLAYER_WINDOW_FEATURES);
        
        if (!newWindow) {
          throw new Error('Failed to open player window. Please allow popups for this site.');
        }
        
        playerWindowRef.current = newWindow;
        setPlayerStatus('opening');
        
        // Add event listener for beforeunload to clean up resources
        const handleUnload = () => {
          cleanupResources();
          setPlayerStatus('closed');
        };
        
        newWindow.addEventListener('beforeunload', handleUnload);
        unloadHandlerRef.current = handleUnload;
        
        // Set up message listener
        const messageHandler = (event: MessageEvent) => {
          // Only process messages from our player window
          if (event.origin !== window.location.origin) return;
          
          try {
            const message = event.data as PlayerMessage;
            handlePlayerMessage(message);
          } catch (error) {
            console.error('Error processing message:', error, event.data);
          }
        };
        
        window.addEventListener('message', messageHandler);
        messageHandlerRef.current = messageHandler;
        
        // Start status check
        startStatusCheck();
        
      } catch (error) {
        console.error('Error opening player window:', error);
        setPlayerStatus('error');
        setLastError(error instanceof Error ? error : new Error(String(error)));
        
        // Auto-retry on error
        if (retryCount < MAX_RECOVERY_ATTEMPTS) {
          const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000);
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
            openPlayerWindow();
          }, retryDelay);
        }
      }
    } else {
      // If window exists, focus it
      playerWindowRef.current.focus();
    }
  }, [retryCount, cleanupResources, startStatusCheck]);

  // Close player window
  const closePlayerWindow = useCallback(() => {
    if (playerWindowRef.current && !playerWindowRef.current.closed) {
      playerWindowRef.current.close();
      playerWindowRef.current = null;
      setPlayerStatus('idle');
    }
  }, []);

  // Toggle player window
  const togglePlayerWindow = useCallback(() => {
    if (playerStatus === 'idle' || playerStatus === 'error') {
      openPlayerWindow();
    } else {
      closePlayerWindow();
    }
  }, [playerStatus, openPlayerWindow, closePlayerWindow]);

  // Handle player messages
  const handlePlayerMessage = useCallback((message: PlayerMessage) => {
    try {
      console.log('Received message from player:', message);
      
      if (message.status) {
        setPlayerStatus(message.status);
        
        // Reset recovery attempts on successful status update
        if (message.status === 'ready' || message.status === 'playing' || message.status === 'paused') {
          setRecoveryAttempts(0);
          setLastError(null);
        }
        
        // If player is ready, send initial state
        if (message.status === 'ready' && currentVideo) {
          // Small delay to ensure player is fully ready
          setTimeout(() => {
            sendCommandToPlayer('load', {
              videoId: currentVideo.id,
              startSeconds: 0,
              autoplay: isPlaying,
              volume: localIsMuted ? 0 : localVolume / 100,
            });
          }, 500);
        }
      }
      
      // Handle specific commands from player
      if (message.command === 'ended') {
        onVideoEnd();
      } else if (message.command === 'play') {
        onPlayPause(true);
      } else if (message.command === 'pause') {
        onPlayPause(false);
      } else if (message.command === 'error') {
        const errorMsg = message.data?.message || 'Unknown player error';
        console.error('Player error:', errorMsg, message.data);
        setLastError(new Error(errorMsg));
        
        // Don't show toast for network-related errors as they're common
        if (!errorMsg.includes('network') && !errorMsg.includes('Error 5')) {
          toast.error(`Player error: ${errorMsg}`);
        }
        
        // Attempt recovery for certain errors
        if (errorMsg.includes('Error 5') || errorMsg.includes('network') || errorMsg.includes('timeout')) {
          recoverPlayer();
        }
      }
    } catch (error) {
      console.error('Error in handlePlayerMessage:', error);
      setLastError(error instanceof Error ? error : new Error(String(error)));
    }
  }, [currentVideo, isPlaying, localVolume, localIsMuted, onPlayPause, onVideoEnd, recoverPlayer, sendCommandToPlayer]);

  // Toggle play/pause
  const handlePlayPause = useCallback(() => {
    onPlayPause(!isPlaying);
  }, [isPlaying, onPlayPause]);

  // Handle volume change
  const handleVolumeChange = useCallback((value: number[]) => {
    const newVolume = value[0];
    setLocalVolume(newVolume);
    onVolumeChange(newVolume);
    
    // If muting/unmuting based on volume level
    if (newVolume === 0 && !localIsMuted) {
      setLocalIsMuted(true);
      onMuteChange(true);
    } else if (newVolume > 0 && localIsMuted) {
      setLocalIsMuted(false);
      onMuteChange(false);
    }
  }, [localIsMuted, onMuteChange, onVolumeChange]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    const newMuted = !localIsMuted;
    setLocalIsMuted(newMuted);
    onMuteChange(newMuted);
  }, [localIsMuted, onMuteChange]);

  // Render loading/error states
  if (isRecovering) {
    return (
      <div className="flex items-center justify-center h-full bg-black/50 text-white">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p>Recovering player...</p>
          <p className="text-sm text-gray-400">Attempt {recoveryAttempts + 1} of {MAX_RECOVERY_ATTEMPTS}</p>
        </div>
      </div>
    );
  }

  if (playerStatus === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-black/50 text-white p-4 text-center">
        <X className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-xl font-bold mb-2">Player Error</h3>
        <p className="text-gray-300 mb-4">
          {lastError?.message || 'An unknown error occurred'}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={recoverPlayer}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
          <Button variant="outline" onClick={closePlayerWindow}>
            Close Player
          </Button>
        </div>
      </div>
    );
  }

  // Render player UI
  return (
    <div className={`w-full h-full flex flex-col ${className}`}>
      {/* Player Area */}
      <div className="flex-1 relative bg-black">
        {currentVideo ? (
          <>
            {/* Video Thumbnail */}
            <div className="absolute inset-0 flex items-center justify-center">
              <img
                src={currentVideo.thumbnail}
                alt={`${currentVideo.artist} - ${currentVideo.title}`}
                className="w-full h-full object-cover opacity-50"
              />
            </div>

            {/* Play Button Overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <Button
                variant="ghost"
                size="icon"
                className="w-16 h-16 rounded-full bg-white/20 hover:bg-white/30 text-white"
                onClick={handlePlayPause}
              >
                {isPlaying ? (
                  <Pause className="w-8 h-8" />
                ) : (
                  <Play className="w-8 h-8 ml-1" />
                )}
              </Button>
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400">
            No video selected
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-background/80 backdrop-blur-sm border-t p-4">
        <div className="flex items-center justify-between gap-4">
          {/* Track info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {currentVideo && (
              <>
                <div className="w-12 h-12 flex-shrink-0 rounded overflow-hidden">
                  <img
                    src={currentVideo.thumbnail}
                    alt={`${currentVideo.artist} - ${currentVideo.title}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="font-medium truncate">{currentVideo.title}</h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {currentVideo.artist}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Playback controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onPreviousVideo}
              disabled={!currentVideo || queuePosition <= 1}
            >
              <SkipBack className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePlayPause}
              disabled={!currentVideo}
              className="w-12 h-12 rounded-full"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6 ml-1" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onNextVideo}
              disabled={!currentVideo || queuePosition >= (queueTotal || 0)}
            >
              <SkipForward className="w-5 h-5" />
            </Button>
          </div>

          {/* Volume and window controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              className="w-8 h-8"
            >
              {localIsMuted || localVolume === 0 ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </Button>
            <div className="w-24">
              <Slider
                value={[localIsMuted ? 0 : localVolume]}
                onValueChange={handleVolumeChange}
                min={0}
                max={100}
                step={1}
                className="w-full"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePlayerWindow}
              className="w-8 h-8"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(PlayerWindow);
