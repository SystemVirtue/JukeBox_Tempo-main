// =============================================================================
// ==                               player.js                                 ==
// ==          Handles the YouTube IFrame Player and Communication            ==
// =============================================================================

// Enable debug logging
const DEBUG = true;

// --- Global Variables & Constants ---
const COMMAND_STORAGE_KEY = 'jukeboxCommand';
const STATUS_STORAGE_KEY = 'jukeboxStatus';
const PLAYER_READY_TIMEOUT_MS = 30000; // Increased timeout to 30 seconds
const PLAYER_RETRY_DELAY_MS = 2000; // 2 seconds between retries
const MAX_RETRY_ATTEMPTS = 3;

let player;
let isPlayerReady = false;
let isInitialized = false;
let currentPlayerVideoId = null;
let fadeOverlay = null;
let loadingMessage = null;
let errorMessage = null;
let playerReadyTimeout = null;
let initializationAttempts = 0;

// --- Debug Helper ---
function debugLog(...args) {
    if (DEBUG) {
        console.log('[Jukebox Player]', ...args);
    }
}

// --- YouTube IFrame API Setup ---
// Store the original onYouTubeIframeAPIReady if it exists
const originalOnYouTubeIframeAPIReady = window.onYouTubeIframeAPIReady;

// Define our implementation
window.onYouTubeIframeAPIReady = function() {
    debugLog("YouTube API Ready");
    
    // Call the original handler if it exists
    if (typeof originalOnYouTubeIframeAPIReady === 'function') {
        try {
            originalOnYouTubeIframeAPIReady();
        } catch (e) {
            console.error("Error in original onYouTubeIframeAPIReady:", e);
        }
    }
    
    // Reset initialization attempts counter
    initializationAttempts = 0;
    
    const targetElement = document.getElementById('youtube-fullscreen-player');
    if (!targetElement) {
        const errorMsg = "YouTube player target element not found";
        showError(errorMsg);
        console.error("[Jukebox Player]", errorMsg);
        return;
    }

    try {
        debugLog("Creating YouTube player instance...");
        player = new YT.Player('youtube-fullscreen-player', {
            height: '100%',
            width: '100%',
            playerVars: {
                'playsinline': 1,
                'controls': 0,
                'rel': 0,
                'autoplay': 1,
                'mute': 1,
                'origin': window.location.origin,
                'origin': window.location.origin,
                'enablejsapi': 1,
                'fs': 0,
                'modestbranding': 1,
                'iv_load_policy': 3
            },
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange,
                'onError': onPlayerError,
                'onApiChange': onApiChange
            }
        });
    } catch (error) {
        const errorMsg = `Failed to initialize YouTube player: ${error.message}`;
        showError(errorMsg);
        console.error("[Jukebox Player]", errorMsg, error);
    }
};

// --- UI Helpers ---
function showError(message) {
    if (!errorMessage) errorMessage = document.getElementById('error-message');
    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        if (loadingMessage) loadingMessage.style.display = 'none';
    }
}

function hideError() {
    if (errorMessage) {
        errorMessage.style.display = 'none';
    }
    if (loadingMessage) {
        loadingMessage.style.display = 'block';
    }
}

function showPlayer() {
    const playerEl = document.getElementById('youtube-fullscreen-player');
    if (playerEl) {
        playerEl.style.opacity = '1';
    }
    if (fadeOverlay) {
        fadeOverlay.style.opacity = '0';
        setTimeout(() => {
            if (fadeOverlay) fadeOverlay.style.display = 'none';
        }, 300);
    }
}

// Player event handlers
function onPlayerReady(event) {
    debugLog("Player Ready");
    isPlayerReady = true;
    isInitialized = true;
    
    // Clear any timeout that might be waiting for player ready
    if (playerReadyTimeout) {
        clearTimeout(playerReadyTimeout);
        playerReadyTimeout = null;
    }
    
    // Initialize UI elements
    fadeOverlay = document.getElementById('fade-overlay');
    loadingMessage = document.getElementById('loading-message');
    errorMessage = document.getElementById('error-message');
    
    // Hide loading and show player
    if (loadingMessage) loadingMessage.textContent = 'Loading video...';
    hideError();
    
    // Notify parent window
    sendStatus('ready');
    
    // If we have a video ID, load it
    if (currentPlayerVideoId) {
        loadVideo(currentPlayerVideoId);
    }
    // Start playback
    if (player && typeof player.playVideo === 'function') {
        player.playVideo();
    }
}

function onPlayerStateChange(event) {
    console.log("[Player] State changed:", event.data);
    
    if (event.data === YT.PlayerState.ENDED) {
        console.log("[Player] Video ended");
        sendStatus('ended', { id: currentPlayerVideoId });
        currentPlayerVideoId = null;
    } else if (event.data === YT.PlayerState.PLAYING) {
        console.log("[Player] Video playing");
        try {
            const videoData = event.target.getVideoData();
            if (videoData && videoData.video_id) {
                currentPlayerVideoId = videoData.video_id;
                sendStatus('playing', { id: currentPlayerVideoId });
            }
        } catch (e) {
            console.error("[Player] Error getting video data:", e);
        }
    } else if (event.data === YT.PlayerState.PAUSED) {
        console.log("[Player] Video paused");
        sendStatus('paused');
    } else if (event.data === YT.PlayerState.BUFFERING) {
        console.log("[Player] Buffering");
    }
}

function onPlayerError(event) {
    debugLog('Player error:', event.data);
    sendStatus('error', { message: `Player error: ${event.data}` });
}

function onApiChange(event) {
    debugLog('API change:', event);
    // You can add specific handling for API changes here if needed
}

// Communication with main window
function sendStatus(status, data = {}) {
    const message = { status, ...data };
    debugLog("Sending status:", status, data);
    
    try {
        // Try to send via postMessage first
        if (window.opener && !window.opener.closed) {
            try {
                window.opener.postMessage(message, window.location.origin);
            } catch (e) {
                debugLog("Error sending message to opener:", e);
            }
        }
        
        // Also store in localStorage as fallback
        try {
            localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify({
                ...message,
                timestamp: Date.now()
            }));
        } catch (e) {
            debugLog("Error saving to localStorage:", e);
        }
    } catch (error) {
        console.error("[Jukebox Player] Error sending status:", error);
    }
}

// Load a video with error handling
function loadVideo(videoId, startSeconds = 0) {
    if (!player || !isPlayerReady) {
        debugLog("Player not ready, queueing video load:", videoId);
        currentPlayerVideoId = videoId;
        return;
    }
    
    try {
        debugLog("Loading video:", videoId);
        if (startSeconds) {
            player.loadVideoById({
                videoId: videoId,
                startSeconds: startSeconds
            });
        } else {
            player.loadVideoById(videoId);
        }
    } catch (error) {
        const errorMsg = `Error loading video: ${error.message}`;
        console.error("[Jukebox Player]", errorMsg, error);
        showError("Error loading video");
        sendStatus('error', { message: errorMsg });
    }
}

// Handle commands from main window
window.addEventListener('message', (event) => {
    // Verify the origin of the message for security
    if (event.origin !== window.location.origin) {
        debugLog("Ignoring message from unauthorized origin:", event.origin);
        return;
    }
    
    debugLog("Received message:", event.data);
    
    if (event.data && event.data.command) {
        try {
            handleCommand(event.data.command, event.data.data);
        } catch (error) {
            const errorMsg = `Error handling command ${event.data.command}: ${error.message}`;
            console.error("[Jukebox Player]", errorMsg, error);
            sendStatus('error', { message: errorMsg });
        }
    }
});

// Handle commands from localStorage (fallback)
function checkForCommands() {
    try {
        const commandStr = localStorage.getItem(COMMAND_STORAGE_KEY);
        if (commandStr) {
            const command = JSON.parse(commandStr);
            if (command && command.command) {
                debugLog("Processing command from localStorage:", command);
                handleCommand(command.command, command.data);
                localStorage.removeItem(COMMAND_STORAGE_KEY);
            }
        }
    } catch (error) {
        const errorMsg = `Error processing command from localStorage: ${error.message}`;
        console.error("[Jukebox Player]", errorMsg, error);
        showError(errorMsg);
    }
}

// Process commands
function handleCommand(command, data = {}) {
    debugLog(`Handling command: ${command}`, data);
    
    // If player isn't ready yet, queue the command
    if (!isPlayerReady) {
        if (command === 'load' && data.videoId) {
            // Special case: store video ID to load when player is ready
            currentPlayerVideoId = data.videoId;
            if (loadingMessage) loadingMessage.textContent = 'Loading video...';
        }
        
        // Queue the command to be processed when player is ready
        const maxAttempts = 30; // 3 seconds max wait (100ms * 30)
        let attempts = 0;
        
        const tryCommand = () => {
            attempts++;
            if (isPlayerReady) {
                handleCommand(command, data);
            } else if (attempts < maxAttempts) {
                setTimeout(tryCommand, 100);
            } else {
                const errorMsg = `Player not ready after ${maxAttempts} attempts`;
                console.error("[Jukebox Player]", errorMsg);
                showError("Player initialization timed out. Please try again.");
                sendStatus('error', { message: errorMsg });
            }
        };
        
        setTimeout(tryCommand, 100);
        return;
    }

    try {
        switch (command) {
            case 'play':
                debugLog("Playing video");
                player.playVideo();
                showPlayer();
                break;
                
            case 'pause':
                debugLog("Pausing video");
                player.pauseVideo();
                break;
                
            case 'load':
                if (data.videoId) {
                    debugLog("Loading video:", data.videoId);
                    currentPlayerVideoId = data.videoId;
                    if (loadingMessage) {
                        loadingMessage.textContent = 'Loading video...';
                        fadeOverlay.style.display = 'flex';
                        fadeOverlay.style.opacity = '1';
                        hideError();
                    }
                    
                    // Load the video
                    if (data.startSeconds) {
                        player.loadVideoById({
                            videoId: data.videoId,
                            startSeconds: data.startSeconds
                        });
                    } else {
                        player.loadVideoById(data.videoId);
                    }
                    
                    // Show loading state
                    const playerEl = document.getElementById('youtube-fullscreen-player');
                    if (playerEl) playerEl.style.opacity = '0';
                }
                break;
                
            case 'setVolume':
                if (typeof data.volume === 'number') {
                    debugLog("Setting volume to:", data.volume);
                    player.setVolume(data.volume);
                    if (data.volume > 0) {
                        player.unMute();
                    }
                }
                break;
                
            case 'mute':
                debugLog("Muting player");
                player.mute();
                break;
                
            case 'unmute':
                debugLog("Unmuting player");
                player.unMute();
                break;
                
            default:
                debugLog("Unknown command:", command);
        }
    } catch (error) {
        const errorMsg = `Error executing ${command}: ${error.message}`;
        console.error("[Jukebox Player]", errorMsg, error);
        showError(`Player error: ${command} failed`);
        sendStatus('error', { message: errorMsg });
    }
}

// Initialize the player with retry logic
function init() {
    console.log("[Player] Initializing...");
    
    // Clear any existing timeouts
    if (playerReadyTimeout) {
        clearTimeout(playerReadyTimeout);
    }
    
    // Set up command polling
    setInterval(checkForCommands, 100);
    
    // Set up player initialization timeout
    playerReadyTimeout = setTimeout(() => {
        if (!isPlayerReady) {
            console.error("[Player] Player initialization timed out");
            showError("Player initialization timed out. Please try again.");
            sendStatus('error', { message: 'Player initialization timed out' });
            
            // Retry initialization if we haven't exceeded max attempts
            if (initializationAttempts < MAX_RETRY_ATTEMPTS) {
                initializationAttempts++;
                console.log(`[Player] Retrying initialization (attempt ${initializationAttempts}/${MAX_RETRY_ATTEMPTS})`);
                setTimeout(init, PLAYER_RETRY_DELAY_MS);
            }
        }
    }, PLAYER_READY_TIMEOUT_MS);
    
    // Set up DOM elements
    fadeOverlay = document.getElementById('fade-overlay');
    loadingMessage = document.getElementById('loading-message');
    errorMessage = document.getElementById('error-message');
    
    // Notify parent that we're loading
    sendStatus('loading');
    
    // The actual player initialization happens in onYouTubeIframeAPIReady
}

// Start the player
init();
