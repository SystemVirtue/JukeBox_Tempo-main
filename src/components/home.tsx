import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import SettingsWindow from "./SettingsWindow";
import { Button } from "@/components/ui/button";
import { Search, Music, Library, Settings, X, Save, Check } from "lucide-react";

import JukeboxWindow from "./JukeboxWindow";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface LibraryPlaylist {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  videoCount: number;
  videos?: any[]; // Array of video objects, if present
}

import { useEffect } from "react";

const YOUTUBE_PLAYLIST_REGEX = /(?:list=)?([a-zA-Z0-9_-]{16,})/;
const YOUTUBE_API_KEY = 'AIzaSyC12QKbzGaKZw9VD3-ulxU_mrd0htZBiI4'; // YouTube Data API v3 key

const TEST_PLAYLIST_URL = "https://www.youtube.com/playlist?list=PLt4yoh9S_Ar6h_mArbGXMJ-QoCkNf_X0z";

const Home = () => {
  // Playlists and playlist dialog/add state
  const TEST_PLAYLIST_URL = "https://www.youtube.com/playlist?list=Jukebox_Test_Playlist";
const TEST_PLAYLIST_ID = "Jukebox_Test_Playlist";

const [playlists, setPlaylists] = useState<LibraryPlaylist[]>([
  {
    id: TEST_PLAYLIST_ID,
    name: "Jukebox Test Playlist",
    url: TEST_PLAYLIST_URL,
    enabled: true,
    videoCount: 2,
    videos: [
      {
        id: "test1",
        youtubeId: "dQw4w9WgXcQ",
        title: "Never Gonna Give You Up",
        artist: "Rick Astley",
        thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      },
      {
        id: "test2",
        youtubeId: "9bZkp7q19f0",
        title: "Gangnam Style",
        artist: "PSY",
        thumbnail: "https://i.ytimg.com/vi/9bZkp7q19f0/hqdefault.jpg",
      }
    ]
  }
]);
  const [addPlaylistDialog, setAddPlaylistDialog] = useState(false);
  const [addPlaylistInput, setAddPlaylistInput] = useState("");
  const [addPlaylistError, setAddPlaylistError] = useState("");
  const [isAddingPlaylist, setIsAddingPlaylist] = useState(false);
  const [addPlaylistProgress, setAddPlaylistProgress] = useState({
    current: 0,
    total: 0,
    status: 'idle' // 'idle' | 'fetching' | 'processing' | 'done'
  });

  


  // Add Playlist Handler
  async function handleValidateAndAddPlaylist(inputOverride?: string) {
    setAddPlaylistError("");
    setIsAddingPlaylist(true);
    setAddPlaylistProgress({ current: 0, total: 0, status: 'fetching' });
    const input = (inputOverride !== undefined ? inputOverride : addPlaylistInput.trim());
    
    // Try to extract playlist ID from URL
    const urlMatch = input.match(/[&?]list=([^&]+)/i) || input.match(/^([a-zA-Z0-9_-]+)$/i);
    
    if (!urlMatch || !urlMatch[1]) {
      setAddPlaylistError("Not a valid YouTube Playlist!");
      setIsAddingPlaylist(false);
      return;
    }
    
    const extractedPlaylistId = urlMatch[1];
    
    // Check if playlist already exists in the library
    const playlistExists = playlists.some(playlist => {
      // Extract ID from stored playlist URL
      const storedUrlMatch = playlist.url.match(/[&?]list=([^&]+)/i) || [];
      return storedUrlMatch[1] === extractedPlaylistId;
    });
    
    if (playlistExists) {
      setAddPlaylistError("This playlist is already in your library!");
      setIsAddingPlaylist(false);
      return;
    }
    
    try {
      setAddPlaylistProgress({ current: 0, total: 0, status: 'fetching' });
      
      // First, get the playlist details to get the title
      const playlistResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${extractedPlaylistId}&key=${YOUTUBE_API_KEY}`
      );
      
      if (!playlistResponse.ok) {
        throw new Error('Failed to fetch playlist details');
      }
      
      const playlistData = await playlistResponse.json();
      
      if (!playlistData.items || playlistData.items.length === 0) {
        throw new Error('Playlist not found');
      }
      
      const playlistTitle = playlistData.items[0].snippet.title;
      const playlistUrl = `https://www.youtube.com/playlist?list=${extractedPlaylistId}`;
      
      // Now get the playlist items
      let nextPageToken = '';
      let allVideos: any[] = [];
      let fetchedVideos = 0;
      
      // First, get the total number of videos
      const countResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=1&playlistId=${extractedPlaylistId}&key=${YOUTUBE_API_KEY}`
      );
      
      if (!countResponse.ok) {
        throw new Error('Failed to fetch playlist item count');
      }
      
      const countData = await countResponse.json();
      const totalVideos = countData.pageInfo?.totalResults || 0;
      
      setAddPlaylistProgress({ current: 0, total: totalVideos, status: 'processing' });
      
      // Fetch all pages of videos
      do {
        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails,snippet&maxResults=50&playlistId=${extractedPlaylistId}&key=${YOUTUBE_API_KEY}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`
        );
        
        if (!response.ok) {
          throw new Error('Failed to fetch playlist items');
        }
        
        const data = await response.json();
        allVideos = [...allVideos, ...data.items];
        fetchedVideos += data.items.length;
        nextPageToken = data.nextPageToken || '';
        
        // Update progress
        setAddPlaylistProgress({ 
          current: fetchedVideos, 
          total: totalVideos, 
          status: 'processing' 
        });
        
        // Small delay to avoid hitting rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
      } while (nextPageToken);
      
      console.log(`Fetched ${allVideos.length} videos from playlist`);
      
      // Process the videos
      const processedVideos = allVideos
        .filter((item: any) => item.snippet && item.snippet.resourceId)
        .map((item: any) => ({
          id: item.snippet.resourceId.videoId,
          youtubeId: item.snippet.resourceId.videoId,
          title: item.snippet.title,
          artist: item.snippet.videoOwnerChannelTitle || 'Unknown',
          thumbnail: `https://img.youtube.com/vi/${item.snippet.resourceId.videoId}/hqdefault.jpg`,
        }));
        
      console.log(`Successfully processed ${processedVideos.length} videos`);
      
      // Add playlist to the list
      const newPlaylist = {
        id: extractedPlaylistId,
        name: playlistTitle,
        url: playlistUrl,
        enabled: true,
        videoCount: processedVideos.length,
        videos: processedVideos,
      };
      
      // Update playlists state
      setPlaylists(prev => [...prev, newPlaylist]);
      setAddPlaylistDialog(false);
      setAddPlaylistInput("");
      
    } catch (error: any) {
      console.error("Error fetching playlist:", error);
      setAddPlaylistError(error.message || "Failed to fetch playlist. Please check the playlist URL and try again.");
    } finally {
      setIsAddingPlaylist(false);
      setAddPlaylistProgress({ current: 0, total: 0, status: 'idle' });
    }
  }

  const [activeTab, setActiveTab] = useState("player");
  const [queue, setQueue] = useState<any[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFirstVisit, setIsFirstVisit] = useState(() => {
    return localStorage.getItem("music_jukebox_visited") === null;
  });
  
  
  // Settings state
  const [defaultPlaylist, setDefaultPlaylist] = useState<string>('none');
  const [randomPlay, setRandomPlay] = useState<boolean>(false);
  
  // State for delete confirmation dialog
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string | null>(null);
  
  // State for add-to-queue dialog and warning
  const [addToQueueDialog, setAddToQueueDialog] = useState<{open: boolean, video: any | null}>({open: false, video: null});
  const [queueWarning, setQueueWarning] = useState<string | null>(null);
  
  // Video playback state
  const [videoEnded, setVideoEnded] = useState(false);

  const handlePlaylistToggle = (id: string) => {
    setPlaylists(
      playlists.map((playlist) =>
        playlist.id === id
          ? { ...playlist, enabled: !playlist.enabled }
          : playlist,
      ),
    );
  };

  const handlePlaylistDelete = (id: string) => {
    setPlaylists(playlists.filter((playlist) => playlist.id !== id));
  };

  const [editPlaylistName, setEditPlaylistName] = useState("");
  const [editPlaylistId, setEditPlaylistId] = useState<string | null>(null);

  const handleSavePlaylistEdit = () => {
    if (editPlaylistId && editPlaylistName.trim()) {
      setPlaylists(
        playlists.map((playlist) =>
          playlist.id === editPlaylistId
            ? { ...playlist, name: editPlaylistName.trim() }
            : playlist,
        ),
      );
      setEditPlaylistId(null);
      setEditPlaylistName("");
    }
  };

  const handleAddPlaylist = () => {
    setAddPlaylistInput("PLN9QqCogPsXJCgeL_iEgYnW6Rl_8nIUUH");
    setAddPlaylistDialog(true);
  };

  // Mark that the user has visited the app
  React.useEffect(() => {
    if (isFirstVisit) {
      localStorage.setItem("music_jukebox_visited", "true");
      setIsFirstVisit(false);

      // If it's the first visit, show a welcome message
      alert(
        "Welcome to Music Video Jukebox! We've added the Obie Bar Essentials playlist with 927 videos to get you started.",
      );

      // You could also set the active tab to library to show the user their playlists
      setActiveTab("library");
    }

    // Add console log to show the app is working
    console.log("Music Video Jukebox initialized with:");
    console.log(`- ${playlists.length} playlists`);
    console.log(
      `- ${playlists.reduce((total, playlist) => total + playlist.videoCount, 0)} total videos`,
    );
    console.log(
      `- Obie Bar Essentials playlist has ${playlists.find((p) => p.id === "4")?.videoCount || 0} videos`,
    );
  }, [isFirstVisit, playlists]);

  // Handle video end and auto-play next video
  useEffect(() => {
    if (!isPlaying) return;
    
    if (videoEnded && queue.length > 0) {
      const nextIndex = (currentVideoIndex + 1) % queue.length;
      
      // If we're at the end of the queue and random play is enabled
      if (nextIndex === 0 && randomPlay && defaultPlaylist !== 'none') {
        const defaultPlaylistVideos = playlists.find(p => p.id === defaultPlaylist)?.videos || [];
        if (defaultPlaylistVideos.length > 0) {
          const randomVideo = defaultPlaylistVideos[Math.floor(Math.random() * defaultPlaylistVideos.length)];
          setQueue(prevQueue => [...prevQueue, randomVideo]);
        }
      }
      
      // Move to next video
      setCurrentVideoIndex(prev => (prev + 1) % queue.length);
      setVideoEnded(false);
    }
  }, [videoEnded, currentVideoIndex, queue.length, isPlaying, randomPlay, defaultPlaylist, playlists]);

  // Handle empty queue by adding a video from default playlist if available
  useEffect(() => {
    if (queue.length === 0 && defaultPlaylist !== 'none' && isPlaying) {
      const defaultPlaylistVideos = playlists.find(p => p.id === defaultPlaylist)?.videos || [];
      if (defaultPlaylistVideos.length > 0) {
        const videoToAdd = randomPlay 
          ? defaultPlaylistVideos[Math.floor(Math.random() * defaultPlaylistVideos.length)]
          : defaultPlaylistVideos[0];
        
        if (videoToAdd) {
          setQueue([videoToAdd]);
          setCurrentVideoIndex(0);
        }
      }
    }
  }, [queue.length, defaultPlaylist, playlists, randomPlay, isPlaying]);
  
  // Handle video end event
  const handleVideoEnd = () => {
    setVideoEnded(true);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 relative">
      {/* Player Button - Always visible in top right */}
      <div className="fixed top-4 right-4 z-50">
        <Button 
          variant="outline" 
          className="flex items-center gap-2 bg-background/80 backdrop-blur-sm border-2 border-primary"
          onClick={() => {
            // Save current video and queue info to localStorage for the player window
            try {
              // Send a command to the player window using the jukeboxCommand key
              const commandData = {
                action: 'play',
                video: queue[currentVideoIndex] || null,
                queuePosition: currentVideoIndex + 1,
                queueTotal: queue.length,
                isPlaying: isPlaying,
                timestamp: Date.now()
              };
              
              // Store the command in localStorage for the player window to pick up
              localStorage.setItem('jukeboxCommand', JSON.stringify(commandData));
              
              // Open the player in a new window with improved parameters
              const playerWindow = window.open('/player.html', 'jukebox_player', 
                'width=800,height=600,resizable=yes,scrollbars=no,status=no');
              
              // Focus the player window
              if (playerWindow) {
                playerWindow.focus();
                console.log('Player window opened successfully');
              } else {
                console.error('Failed to open player window - popup may be blocked');
                alert('Player window could not be opened. Please check your popup blocker settings.');
              }
            } catch (error) {
              console.error('Error opening player window:', error);
            }
          }}
        >
          <Music className="h-4 w-4" />
          Open Player
        </Button>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Music className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">Music Video Jukebox</h1>
          </div>
        </header>

        <Tabs 
          value={activeTab} 
          onValueChange={setActiveTab}
          className="w-full"
        >
          <div className="flex justify-center mb-6">
            <TabsList className="grid grid-cols-3 w-full max-w-md">
              <TabsTrigger value="jukebox">Jukebox</TabsTrigger>
              <TabsTrigger value="library">Library</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
          </div>

        <TabsContent value="jukebox" className="mt-0">
          <div className="flex flex-col items-center">

            <div className="mt-6 w-full max-w-3xl">
              <h2 className="text-xl font-semibold mb-3">Current Queue</h2>
              {queue.length > 0 ? (
                <div className="bg-card rounded-md p-4 max-h-60 overflow-y-auto">
                  {queue.map((item, index) => (
                    <div
                      key={index}
                      className={`flex items-center p-2 rounded-md mb-1 ${index === currentVideoIndex ? "bg-accent" : "hover:bg-accent/50"}`}
                      onClick={() => setCurrentVideoIndex(index)}
                    >
                      <div className="w-10 h-10 bg-muted rounded mr-3"></div>
                      <div>
                        <div className="font-medium">
                          {item?.title || "Unknown Title"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {item?.artist || "Unknown Artist"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-card rounded-md p-6 text-center">
                  <div className="text-muted-foreground">
                    Your queue is empty. Add videos from the Jukebox tab.
                  </div>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setActiveTab("jukebox")}
                  >
                    Browse Videos
                  </Button>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="jukebox" className="mt-0">
          <JukeboxWindow
             videos={playlists
               .filter(p => p.enabled && Array.isArray(p.videos) && p.videos.length > 0)
               .flatMap(p => p.videos || [])}
             onVideoSelect={(video) => {
               // Prevent adding if currently playing or already in queue
               const isPlaying = queue[currentVideoIndex]?.id === video.id;
               const isInQueue = queue.some(q => q.id === video.id);
               if (isPlaying || isInQueue) {
                 setQueueWarning("Can't add: Video is already in queue or currently playing.");
                 setTimeout(() => setQueueWarning(null), 2000);
                 return;
               }
               setAddToQueueDialog({open: true, video});
             }}
          />
          {/* Add to Queue Dialog */}
          <Dialog open={addToQueueDialog.open} onOpenChange={open => setAddToQueueDialog({open, video: open ? addToQueueDialog.video : null})}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add {addToQueueDialog.video?.title} to Queue?</DialogTitle>
                <DialogDescription>
                  {addToQueueDialog.video && (
                    <div className="flex items-center mt-2">
                      <img
                        src={addToQueueDialog.video.thumbnail}
                        alt={addToQueueDialog.video.title}
                        className="w-16 h-16 object-cover rounded mr-3"
                      />
                      <div>
                        <div className="font-medium">{addToQueueDialog.video.title}</div>
                        <div className="text-sm text-muted-foreground">{addToQueueDialog.video.artist}</div>
                      </div>
                    </div>
                  )}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex justify-center gap-4 sm:justify-center">
                <Button
                  variant="outline"
                  onClick={() => setAddToQueueDialog({open: false, video: null})}
                  className="flex items-center gap-2"
                >
                  <X className="h-4 w-4 text-red-500" /> No
                </Button>
                <Button
                  onClick={() => {
                     if (addToQueueDialog.video) {
                       setQueue(prevQueue => {
                         // Prevent duplicates at this stage as well (in case of race conditions)
                         if (prevQueue.some(q => q.id === addToQueueDialog.video.id)) {
                           setQueueWarning("Can't add: Video is already in queue or currently playing.");
                           setTimeout(() => setQueueWarning(null), 2000);
                           return prevQueue;
                         }
                         const newQueue = [...prevQueue, addToQueueDialog.video];
                         if (prevQueue.length === 0) {
                           setCurrentVideoIndex(0);
                           setIsPlaying(true);
                         }
                         return newQueue;
                       });
                     }
                     setAddToQueueDialog({open: false, video: null});
                   }}
                  className="flex items-center gap-2"
                >
                  <Check className="h-4 w-4 text-green-500" /> Yes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {/* Queue warning popup */}
          {queueWarning && (
            <div className="fixed top-8 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded shadow-lg z-50">
              {queueWarning}
            </div>
          )}
        </TabsContent>

        <TabsContent value="library" className="mt-0">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Your Playlists</h2>
              <Button onClick={() => setAddPlaylistDialog(true)}>Add Playlist</Button>
              {/* Add Playlist Dialog */}
              <Dialog open={addPlaylistDialog} onOpenChange={setAddPlaylistDialog}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add YouTube Playlist</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <Input
                      id="playlist-url"
                      value={addPlaylistInput}
                      onChange={e => setAddPlaylistInput(e.target.value)}
                      className="col-span-4"
                      placeholder="Paste YouTube Playlist URL or ID"
                      disabled={isAddingPlaylist}
                    />
                    
                    {/* Progress Indicator */}
                    {isAddingPlaylist && (
                      <div className="space-y-2 pt-2">
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div 
                            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                            style={{ 
                              width: addPlaylistProgress.total > 0 
                                ? `${Math.min(100, Math.round((addPlaylistProgress.current / addPlaylistProgress.total) * 100))}%`
                                : '50%' 
                            }}
                          />
                        </div>
                        <div className="text-sm text-muted-foreground text-center">
                          {addPlaylistProgress.status === 'fetching' 
                            ? 'Fetching playlist info...' 
                            : `Processing videos (${addPlaylistProgress.current} of ${addPlaylistProgress.total})...`
                          }
                        </div>
                      </div>
                    )}
                  </div>
                  <DialogFooter className="flex justify-between sm:justify-between">
                    <Button 
                      variant="outline" 
                      onClick={() => setAddPlaylistDialog(false)} 
                      className="flex items-center gap-2"
                      disabled={isAddingPlaylist}
                    >
                      <X className="h-4 w-4" /> Cancel
                    </Button>
                    <Button
                      onClick={async () => {
                        await handleValidateAndAddPlaylist();
                      }}
                      className="flex items-center gap-2"
                      disabled={!addPlaylistInput.trim() || isAddingPlaylist}
                    >
                      {isAddingPlaylist ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Adding...
                        </>
                      ) : (
                        'Add'
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              {/* Add Playlist Error Dialog */}
              <Dialog open={!!addPlaylistError} onOpenChange={() => setAddPlaylistError("")}> 
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Error</DialogTitle>
                  </DialogHeader>
                  <div>{addPlaylistError}</div>
                  <DialogFooter>
                    <Button onClick={() => setAddPlaylistError("")}>OK</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4">
              {playlists.map((playlist) => (
                <Card key={playlist.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">
                          {playlist.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {playlist.videoCount} videos
                        </p>
                        <p className="text-xs text-muted-foreground truncate max-w-md mt-1">
                          {playlist.url}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant={playlist.enabled ? "default" : "outline"}
                          onClick={() => handlePlaylistToggle(playlist.id)}
                        >
                          {playlist.enabled ? "Enabled" : "Disabled"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEditPlaylistId(playlist.id);
                            setEditPlaylistName(playlist.name);
                          }}
                        >
                          Edit
                        </Button>
                        {playlists.length > 1 && (
                          <Button
                            variant="destructive"
                            onClick={() => {
                              setDeleteConfirmId(playlist.id);
                              setDeleteConfirmName(playlist.name);
                            }}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {playlists.length === 0 && (
                <div className="bg-card rounded-md p-8 text-center">
                  <Library className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">
                    No Playlists Added
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Add YouTube playlists to start building your music video
                    library
                  </p>
                  <Button onClick={handleAddPlaylist}>
                    Add Your First Playlist
                  </Button>
                </div>
              )}
            </div>

            {/* Edit Playlist Dialog */}
            <Dialog
              open={editPlaylistId !== null}
              onOpenChange={(open) => !open && setEditPlaylistId(null)}
            >
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Edit Playlist</DialogTitle>
                  <DialogDescription>
                    Change the name of your playlist.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Input
                      id="playlist-name"
                      value={editPlaylistName}
                      onChange={(e) => setEditPlaylistName(e.target.value)}
                      className="col-span-4"
                      placeholder="Playlist name"
                    />
                  </div>
                </div>
                <DialogFooter className="flex justify-between sm:justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setEditPlaylistId(null)}
                    className="flex items-center gap-2"
                  >
                    <X className="h-4 w-4" /> Cancel
                  </Button>
                  <Button
                    onClick={handleSavePlaylistEdit}
                    className="flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" /> Save
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            {/* Delete Playlist Confirmation Dialog */}
            <Dialog open={deleteConfirmId !== null} onOpenChange={open => !open && setDeleteConfirmId(null)}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Are you sure you want to delete {deleteConfirmName}?</DialogTitle>
                </DialogHeader>
                <DialogFooter className="flex justify-between sm:justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setDeleteConfirmId(null)}
                    className="flex items-center gap-2"
                  >
                    <X className="h-4 w-4" /> Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (deleteConfirmId) {
                        setPlaylists(playlists.filter((playlist) => playlist.id !== deleteConfirmId));
                        setDeleteConfirmId(null);
                      }
                    }}
                    className="flex items-center gap-2"
                  >
                    Confirm
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-0">
          <SettingsWindow 
            playlists={playlists}
            defaultPlaylist={defaultPlaylist}
            setDefaultPlaylist={(value) => {
              setDefaultPlaylist(value);
              // If switching to NO BGM - QUEUE ONLY and queue is empty, stop playback
              if (value === 'none' && queue.length === 0) {
                setCurrentVideoIndex(0);
                setQueue([]);
              }
            }}
            randomPlay={randomPlay}
            setRandomPlay={setRandomPlay}
            onPlayPlaylist={(videos) => {
              if (videos?.length > 0) {
                setQueue(videos);
                setCurrentVideoIndex(0);
                setIsPlaying(true);
                // Don't change tab, just update the queue
              }
            }}
          />
        </TabsContent>
        </Tabs>


      </div>
    </div>
  );
};

export default Home;
