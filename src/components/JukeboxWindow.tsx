import React, { useState } from "react";
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface VideoItem {
  id: string;
  youtubeId: string;
  artist: string;
  title: string;
  thumbnail: string;
}

interface JukeboxWindowProps {
  videos?: VideoItem[];
  onVideoSelect?: (video: VideoItem) => void;
}

const JukeboxWindow: React.FC<JukeboxWindowProps> = ({
  videos = [
    {
      id: "1",
      youtubeId: "dQw4w9WgXcQ",
      artist: "Rick Astley",
      title: "Never Gonna Give You Up",
      thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    },
    {
      id: "2",
      youtubeId: "9bZkp7q19f0",
      artist: "PSY",
      title: "Gangnam Style",
      thumbnail: "https://i.ytimg.com/vi/9bZkp7q19f0/hqdefault.jpg",
    },
    {
      id: "3",
      youtubeId: "kJQP7kiw5Fk",
      artist: "Luis Fonsi",
      title: "Despacito ft. Daddy Yankee",
      thumbnail: "https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg",
    },
    {
      id: "4",
      youtubeId: "RgKAFK5djSk",
      artist: "Wiz Khalifa",
      title: "See You Again ft. Charlie Puth",
      thumbnail: "https://i.ytimg.com/vi/RgKAFK5djSk/hqdefault.jpg",
    },
    {
      id: "5",
      youtubeId: "JGwWNGJdvx8",
      artist: "Ed Sheeran",
      title: "Shape of You",
      thumbnail: "https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg",
    },
    {
      id: "6",
      youtubeId: "OPf0YbXqDm0",
      artist: "Mark Ronson",
      title: "Uptown Funk ft. Bruno Mars",
      thumbnail: "https://i.ytimg.com/vi/OPf0YbXqDm0/hqdefault.jpg",
    },
    {
      id: "7",
      youtubeId: "fRh_vgS2dFE",
      artist: "Justin Bieber",
      title: "Sorry",
      thumbnail: "https://i.ytimg.com/vi/fRh_vgS2dFE/hqdefault.jpg",
    },
    {
      id: "8",
      youtubeId: "YqeW9_5kURI",
      artist: "Maroon 5",
      title: "Sugar",
      thumbnail: "https://i.ytimg.com/vi/YqeW9_5kURI/hqdefault.jpg",
    },
  ],
  onVideoSelect = () => {},
  onAddToQueue = () => {},
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
  const [showAddToQueueDialog, setShowAddToQueueDialog] = useState(false);
  const [sortBy, setSortBy] = useState("artist");
  const [currentPage, setCurrentPage] = useState(1);
  const videosPerPage = 8;

  // Filter videos based on search term
  const filteredVideos = videos.filter((video) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      video.artist.toLowerCase().includes(searchLower) ||
      video.title.toLowerCase().includes(searchLower)
    );
  });

  // Sort videos based on selected sort option
  const sortedVideos = [...filteredVideos].sort((a, b) => {
    if (sortBy === "artist") {
      return a.artist.localeCompare(b.artist);
    } else {
      return a.title.localeCompare(b.title);
    }
  });

  // Calculate pagination
  const indexOfLastVideo = currentPage * videosPerPage;
  const indexOfFirstVideo = indexOfLastVideo - videosPerPage;
  const currentVideos = sortedVideos.slice(indexOfFirstVideo, indexOfLastVideo);
  const totalPages = Math.ceil(sortedVideos.length / videosPerPage);

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className="bg-background border rounded-lg p-4 w-full max-w-4xl h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Jukebox</h2>
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by artist or title"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 w-64"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="artist">Artist</SelectItem>
                <SelectItem value="title">Title</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Video Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-grow overflow-y-auto">
        {currentVideos.map((video) => (
          <Card
            key={video.id}
            className="overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all"
            onClick={() => onVideoSelect(video)}
          >
            <div className="relative pb-[56.25%]">
              <img
                src={video.thumbnail}
                alt={`${video.artist} - ${video.title}`}
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
            <CardContent className="p-2">
              <p className="font-medium truncate">{video.artist}</p>
              <p className="text-sm text-muted-foreground truncate">
                {video.title}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add to Queue Dialog */}
      <Dialog
        open={showAddToQueueDialog}
        onOpenChange={setShowAddToQueueDialog}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add to Queue?</DialogTitle>
            <DialogDescription>
              {selectedVideo && (
                <div className="flex items-center mt-2">
                  <img
                    src={selectedVideo.thumbnail}
                    alt={selectedVideo.title}
                    className="w-16 h-16 object-cover rounded mr-3"
                  />
                  <div>
                    <p className="font-medium">{selectedVideo.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedVideo.artist}
                    </p>
                  </div>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-center gap-4 sm:justify-center">
            <Button
              variant="outline"
              onClick={() => {
                console.log("Declined to add video to queue");
                setShowAddToQueueDialog(false);
              }}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" /> No
            </Button>
            <Button
              onClick={() => {
                if (selectedVideo && onAddToQueue) {
                  console.log(`Adding to queue: ${selectedVideo.title}`);
                  onAddToQueue(selectedVideo);
                }
                setShowAddToQueueDialog(false);
              }}
              className="flex items-center gap-2"
            >
              <Check className="h-4 w-4" /> Yes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  className={
                    currentPage === 1 ? "pointer-events-none opacity-50" : ""
                  }
                />
              </PaginationItem>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (page) => (
                  <PaginationItem key={page}>
                    <PaginationLink
                      isActive={page === currentPage}
                      onClick={() => handlePageChange(page)}
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ),
              )}

              <PaginationItem>
                <PaginationNext
                  onClick={() =>
                    handlePageChange(Math.min(totalPages, currentPage + 1))
                  }
                  className={
                    currentPage === totalPages
                      ? "pointer-events-none opacity-50"
                      : ""
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
};

export default JukeboxWindow;
