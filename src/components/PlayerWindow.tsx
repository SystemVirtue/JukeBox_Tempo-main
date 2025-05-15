import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  className?: string;
  volume?: number;
  onVolumeChange?: (volume: number) => void;
  isMuted?: boolean;
  onMuteChange?: (isMuted: boolean) => void;
}

const PlayerWindow: React.FC<PlayerWindowProps> = ({
  currentVideo,
  queuePosition = 0,
  queueTotal = 0,
  onNextVideo = () => {},
  onPreviousVideo = () => {},
  onVideoEnd = () => {},
  isPlaying = false,
  onPlayPause = () => {},
  isMinimized = false,
  className = "",
  volume = 80,
  onVolumeChange = () => {},
  isMuted = false,
  onMuteChange = () => {},
}) => {
  // Refs
  const playerWindowRef = useRef<Window | null>(null);
  const statusCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageHandlerRef = useRef<((event: MessageEvent) => void) | null>(null);
  const unloadHandlerRef = useRef<(() => void) | null>(null);
  
  // State for player status and retry logic
  const [playerStatus, setPlayerStatus] = useState<PlayerStatus>('idle');
  const [recoveryAttempts, setRecoveryAttempts] = useState(0);
  const [lastError, setLastError] = useState<Error | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [lastCommandTime, setLastCommandTime] = useState(0);
  const maxRetries = 3;
  
  // State for player controls
  const [volumeState, setVolumeState] = useState(volume);
  const [isMutedState, setIsMuted] = useState(isMuted);
  const [isPlayerMinimizedState, setIsPlayerMinimized] = useState(isMinimized);
  
  // Return minimized player if isMinimized is true
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 bg-background/80 backdrop-blur-sm rounded-lg shadow-lg border p-2 z-50">
        <div className="flex items-center gap-2">
          {currentVideo ? (
            <>
              <div className="w-10 h-10 bg-muted rounded overflow-hidden">
                <img 
                  src={currentVideo.thumbnail} 
                  alt="" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-sm truncate max-w-[200px]">
                <div className="font-medium truncate">{currentVideo.title}</div>
                <div className="text-muted-foreground text-xs truncate">{currentVideo.artist}</div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => {}}
                title="Open in separate window"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">No video playing</div>
          )}
        </div>
      </div>
    );
  }

  // Function to send command to player window
  const sendCommand = useCallback((command: PlayerCommand, data?: Record<string, any>) => {
    if (!playerWindowRef.current || playerWindowRef.current.closed) {
      console.error('Player window not available');
      return;
    }

    const message: PlayerMessage = {
      type: 'command',
      command,
      data,
      timestamp: Date.now(),
    };

    try {
      playerWindowRef.current.postMessage(message, '*');
      localStorage.setItem(COMMAND_STORAGE_KEY, JSON.stringify(message));
      setLastCommandTime(Date.now());
    } catch (error) {
      console.error('Error sending command to player window:', error);
      setLastError(error instanceof Error ? error : new Error(String(error)));
    }
  }, []);

  // Function to check player status
  const checkPlayerStatus = useCallback(() => {
    if (!playerWindowRef.current || playerWindowRef.current.closed) {
      setPlayerStatus('closed');
      return;
    }

    try {
      // Try to access the window to see if it's still available
      const windowExists = playerWindowRef.current.location.href;
      
      // If we get here, the window is still open
      // Check if we've received any status updates recently
      const lastStatus = localStorage.getItem(STATUS_STORAGE_KEY);
      if (lastStatus) {
        try {
          const parsedStatus = JSON.parse(lastStatus) as PlayerMessage;
          if (parsedStatus.status && parsedStatus.timestamp) {
            const timeSinceLastStatus = Date.now() - parsedStatus.timestamp;
            if (timeSinceLastStatus < PLAYER_TIMEOUT) {
              setPlayerStatus(parsedStatus.status);
              return;
            }
          }
        } catch (error) {
          console.error('Error parsing player status:', error);
        }
      }
      
      // If we haven't received a status update recently, try to recover
      if (playerStatus !== 'recovering') {
        setIsRecovering(true);
        setPlayerStatus('recovering');
        recoverPlayer();
      }
    } catch (error) {
      // If we can't access the window, it's likely been closed or is in an error state
      console.error('Error checking player status:', error);
      setPlayerStatus('error');
      setLastError(error instanceof Error ? error : new Error(String(error)));
      
      // Try to recover if we're not already recovering
      if (playerStatus !== 'recovering') {
        setIsRecovering(true);
        setPlayerStatus('recovering');
        recoverPlayer();
      }
    }
  }, [playerStatus]);

  // Function to recover player
  const recoverPlayer = useCallback(() => {
    if (recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
      console.error('Max recovery attempts reached');
      setPlayerStatus('error');
      setIsRecovering(false);
      return;
    }

    setRecoveryAttempts(prev => prev + 1);
    
    // Close any existing window
    if (playerWindowRef.current && !playerWindowRef.current.closed) {
      try {
        playerWindowRef.current.close();
      } catch (error) {
        console.error('Error closing player window during recovery:', error);
      }
    }
    
    // Reopen the window
    setTimeout(() => {
      openPlayerWindow();
      setIsRecovering(false);
    }, 1000);
  }, [recoveryAttempts]);

  // Function to open player window
  const openPlayerWindow = useCallback(() => {
    try {
      // Close any existing player window
      if (playerWindowRef.current && !playerWindowRef.current.closed) {
        try {
          playerWindowRef.current.close();
        } catch (error) {
          console.error('Error closing existing player window:', error);
        }
      }
      
      // Clear any existing timeouts
      if (statusCheckTimeoutRef.current) {
        clearTimeout(statusCheckTimeoutRef.current);
        statusCheckTimeoutRef.current = null;
      }
      
      // Reset state
      setPlayerStatus('opening');
      setRetryCount(0);
      
      // Open new window
      const playerUrl = new URL('/player', window.location.origin);
      if (currentVideo?.youtubeId) {
        playerUrl.searchParams.set('v', currentVideo.youtubeId);
        if (currentVideo.startSeconds !== undefined) {
          playerUrl.searchParams.set('t', currentVideo.startSeconds.toString());
        }
      }
      
      const newWindow = window.open(playerUrl.toString(), 'jukebox_player', PLAYER_WINDOW_FEATURES);
      if (!newWindow) {
        toast.error('Unable to open player window. Please check your popup blocker settings.');
        setPlayerStatus('error');
        setLastError(new Error('Unable to open player window'));
        return;
      }
      
      playerWindowRef.current = newWindow;
      
      // Add event listener for beforeunload to clean up resources
      const handleUnload = () => {
        if (newWindow && !newWindow.closed) {
          try {
            newWindow.close();
          } catch (error) {
            console.error('Error closing player window during unload:', error);
          }
        }
        setPlayerStatus('closed');
      };
      
      newWindow.addEventListener('beforeunload', handleUnload);
      unloadHandlerRef.current = handleUnload;
      
      // Set up message listener
      const messageHandler = (event: MessageEvent) => {
        // Validate origin for security
        if (event.origin !== window.location.origin) {
          return;
        }
        
        const message = event.data as PlayerMessage;
        if (message.type === 'status' && message.status) {
          setPlayerStatus(message.status);
          localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(message));
          
          // Handle specific status changes
          if (message.status === 'ended') {
            onVideoEnd();
          } else if (message.status === 'error') {
            setLastError(new Error(message.data?.error || 'Unknown player error'));
          }
        }
      };
      
      window.addEventListener('message', messageHandler);
      messageHandlerRef.current = messageHandler;
      
      // Start status check
      const checkStatus = () => {
        checkPlayerStatus();
        statusCheckTimeoutRef.current = setTimeout(checkStatus, 5000);
      };
      
      statusCheckTimeoutRef.current = setTimeout(checkStatus, 5000);
      
      // Initial command if video is available
      if (currentVideo?.youtubeId) {
        setTimeout(() => {
          sendCommand('load', { videoId: currentVideo.youtubeId, startSeconds: currentVideo.startSeconds });
          if (isPlaying) {
            setTimeout(() => sendCommand('play'), 1000);
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Error opening player window:', error);
      setPlayerStatus('error');
      setLastError(error instanceof Error ? error : new Error(String(error)));
      
      // Retry if under max retries
      if (retryCount < maxRetries) {
        setRetryCount(prev => prev + 1);
        setTimeout(openPlayerWindow, 1000);
      }
    }
  }, [currentVideo, isPlaying, retryCount, maxRetries, onVideoEnd, checkPlayerStatus, sendCommand]);

  // Clean up resources when component unmounts
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (playerWindowRef.current && !playerWindowRef.current.closed) {
        playerWindowRef.current.close();
      }
    };
    
    const messageHandler = (event: MessageEvent) => {
      // This is just a placeholder to keep the reference
      // The actual handler is set up in openPlayerWindow
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('message', messageHandler);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('message', messageHandler);
      
      if (statusCheckTimeoutRef.current) {
        clearTimeout(statusCheckTimeoutRef.current);
      }
      
      if (playerWindowRef.current && !playerWindowRef.current.closed) {
        try {
          playerWindowRef.current.close();
        } catch (error) {
          console.error('Error closing player window during cleanup:', error);
        }
      }
    };
  }, []);

  // Sync volume changes with player
  useEffect(() => {
    if (volumeState !== volume) {
      setVolumeState(volume);
    }
    
    if (playerStatus === 'ready' || playerStatus === 'playing' || playerStatus === 'paused') {
      sendCommand('setVolume', { volume: isMutedState ? 0 : volumeState });
    }
  }, [volume, volumeState, isMutedState, playerStatus, sendCommand]);

  // Sync mute state with player
  useEffect(() => {
    if (isMutedState !== isMuted) {
      setIsMuted(isMuted);
    }
    
    if (playerStatus === 'ready' || playerStatus === 'playing' || playerStatus === 'paused') {
      if (isMutedState) {
        sendCommand('mute');
      } else {
        sendCommand('unmute');
      }
    }
  }, [isMuted, isMutedState, playerStatus, sendCommand]);

  // Sync play/pause state with player
  useEffect(() => {
    if (playerStatus === 'ready' || playerStatus === 'playing' || playerStatus === 'paused') {
      if (isPlaying && playerStatus !== 'playing') {
        sendCommand('play');
      } else if (!isPlaying && playerStatus === 'playing') {
        sendCommand('pause');
      }
    }
  }, [isPlaying, playerStatus, sendCommand]);

  // Handle play/pause toggle
  const handlePlayPause = useCallback(() => {
    onPlayPause(!isPlaying);
  }, [isPlaying, onPlayPause]);

  // Handle volume change
  const handleVolumeChange = useCallback((value: number[]) => {
    const newVolume = value[0];
    setVolumeState(newVolume);
    onVolumeChange(newVolume);
    
    if (isMutedState && newVolume > 0) {
      setIsMuted(false);
      onMuteChange(false);
    }
  }, [isMutedState, onVolumeChange, onMuteChange]);

  // Handle mute toggle
  const toggleMute = useCallback(() => {
    const newMuteState = !isMutedState;
    setIsMuted(newMuteState);
    onMuteChange(newMuteState);
  }, [isMutedState, onMuteChange]);

  // Main player UI
  return (
    <div className={`w-full h-full flex flex-col ${className}`}>
      {/* Player Area */}
      <div className="flex-1 relative bg-black">
        {currentVideo ? (
          <>
            {playerStatus === 'idle' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="relative w-full max-w-md aspect-video bg-muted rounded-lg overflow-hidden">
                  <img 
                    src={currentVideo.thumbnail} 
                    alt={`${currentVideo.artist} - ${currentVideo.title}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Button 
                      variant="outline" 
                      size="lg" 
                      onClick={openPlayerWindow}
                      className="gap-2"
                    >
                      <Play className="h-5 w-5" />
                      Open Player
                    </Button>
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <h3 className="text-lg font-medium">{currentVideo.title}</h3>
                  <p className="text-muted-foreground">{currentVideo.artist}</p>
                </div>
              </div>
            )}
            
            {(playerStatus === 'error' || playerStatus === 'recovering') && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
                <div className="text-center p-6 max-w-md">
                  <div className="mb-4 text-destructive">
                    <X className="h-12 w-12 mx-auto" />
                  </div>
                  <h3 className="text-xl font-medium mb-2">Player Error</h3>
                  <p className="text-muted-foreground mb-4">
                    {lastError?.message || 'There was an error with the player.'}
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={openPlayerWindow}
                    className="gap-2"
                    disabled={isRecovering}
                  >
                    {isRecovering ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Recovering...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4" />
                        Retry
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
            
            {(playerStatus === 'loading' || playerStatus === 'opening') && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="text-center">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p>Opening player...</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-muted-foreground">No video selected</p>
          </div>
        )}
      </div>
      
      {/* Controls */}
      <div className="bg-background/80 backdrop-blur-sm border-t p-4">
        <div className="flex items-center justify-between gap-4">
          {/* Track info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {currentVideo ? (
              <>
                <div className="w-12 h-12 bg-muted rounded overflow-hidden">
                  <img 
                    src={currentVideo.thumbnail} 
                    alt="" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate">{currentVideo.title}</div>
                  <div className="text-muted-foreground text-sm truncate">{currentVideo.artist}</div>
                </div>
              </>
            ) : (
              <div className="text-muted-foreground">No video selected</div>
            )}
          </div>
          
          {/* Playback controls */}
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onPreviousVideo}
              disabled={!currentVideo || queuePosition <= 0}
              title="Previous"
            >
              <SkipBack className="h-5 w-5" />
            </Button>
            
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handlePlayPause}
              disabled={!currentVideo || playerStatus === 'idle' || playerStatus === 'error'}
              title={isPlaying ? 'Pause' : 'Play'}
              className="h-10 w-10"
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
              )}
            </Button>
            
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onNextVideo}
              disabled={!currentVideo || queuePosition >= queueTotal - 1}
              title="Next"
            >
              <SkipForward className="h-5 w-5" />
            </Button>
          </div>
          
          {/* Volume and window controls */}
          <div className="flex items-center gap-2 flex-1 justify-end">
            <div className="flex items-center gap-2 w-32">
              <Button 
                variant="ghost" 
                size="icon"
                className="h-8 w-8"
                onClick={toggleMute}
              >
                {isMutedState || volumeState === 0 ? (
                  <VolumeX className="h-4 w-4" />
                ) : volumeState < 50 ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>
              <Slider
                value={[isMutedState ? 0 : volumeState]}
                onValueChange={handleVolumeChange}
                min={0}
                max={100}
                step={1}
                className="w-full"
              />
            </div>
            
            <div className="h-6 w-px bg-border mx-1" />
            
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={playerStatus === 'idle' ? openPlayerWindow : () => {
                // TODO: Implement closePlayerWindow logic
                // For now, just close the window if open
                if (playerWindowRef.current && !playerWindowRef.current.closed) {
                  playerWindowRef.current.close();
                  playerWindowRef.current = null;
                }
                setPlayerStatus('closed');
              }}
              title={playerStatus === 'idle' ? 'Open in separate window' : 'Close player window'}
            >
              {playerStatus === 'idle' ? (
                <ExternalLink className="h-4 w-4" />
              ) : (
                <X className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Queue position */}
      {queueTotal > 0 && (
        <div className="bg-background/50 text-xs text-muted-foreground px-4 py-1 border-t text-right">
          {queuePosition + 1} of {queueTotal} in queue
        </div>
      )}
    </div>
  );
};

// Memoize the component for performance
export default React.memo(PlayerWindow);
