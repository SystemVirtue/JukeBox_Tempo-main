import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Library,
  X,
  Save,
  Plus,
  Trash2,
  Edit,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface VideoItem {
  id: string;
  youtubeId: string;
  artist: string;
  title: string;
  thumbnail: string;
}

interface LibraryPlaylist {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  videoCount: number;
  videos?: VideoItem[];
}

interface LibraryWindowProps {
  playlists?: LibraryPlaylist[];
  onPlaylistToggle?: (id: string) => void;
  onPlaylistDelete?: (id: string) => void;
  onPlaylistEdit?: (id: string, name: string) => void;
  onPlaylistAdd?: (url: string) => void;
}

const LibraryWindow: React.FC<LibraryWindowProps> = ({
  playlists = [],
  onPlaylistToggle = () => {},
  onPlaylistDelete = () => {},
  onPlaylistEdit = () => {},
  onPlaylistAdd = () => {},
}) => {
  const [editPlaylistId, setEditPlaylistId] = useState<string | null>(null);
  const [editPlaylistName, setEditPlaylistName] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newPlaylistUrl, setNewPlaylistUrl] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
    null,
  );

  const handleSaveEdit = () => {
    if (editPlaylistId && editPlaylistName.trim()) {
      onPlaylistEdit(editPlaylistId, editPlaylistName.trim());
      setEditPlaylistId(null);
      setEditPlaylistName("");
    }
  };

  const handleAddPlaylist = () => {
    if (newPlaylistUrl.trim()) {
      onPlaylistAdd(newPlaylistUrl.trim());
      setNewPlaylistUrl("");
      setShowAddDialog(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-background">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Your Playlists</h2>
        <Button
          onClick={() => setShowAddDialog(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Add Playlist
        </Button>
      </div>

      <div className="grid gap-4">
        {playlists.map((playlist) => (
          <Card key={playlist.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{playlist.name}</h3>
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
                    onClick={() => onPlaylistToggle(playlist.id)}
                    className="flex items-center gap-2"
                  >
                    {playlist.enabled ? (
                      <>
                        <ToggleRight className="h-4 w-4" /> Enabled
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="h-4 w-4" /> Disabled
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditPlaylistId(playlist.id);
                      setEditPlaylistName(playlist.name);
                    }}
                    className="flex items-center gap-2"
                  >
                    <Edit className="h-4 w-4" /> Edit
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setShowDeleteConfirm(playlist.id)}
                    className="flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {playlists.length === 0 && (
          <div className="bg-card rounded-md p-8 text-center">
            <Library className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Playlists Added</h3>
            <p className="text-muted-foreground mb-4">
              Add YouTube playlists to start building your music video library
            </p>
            <Button
              onClick={() => setShowAddDialog(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" /> Add Your First Playlist
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
              onClick={handleSaveEdit}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Playlist Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add YouTube Playlist</DialogTitle>
            <DialogDescription>
              Enter the URL of a YouTube playlist to add it to your library.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Input
                id="playlist-url"
                value={newPlaylistUrl}
                onChange={(e) => setNewPlaylistUrl(e.target.value)}
                className="col-span-4"
                placeholder="https://www.youtube.com/playlist?list=..."
              />
            </div>
          </div>
          <DialogFooter className="flex justify-between sm:justify-between">
            <Button
              variant="outline"
              onClick={() => setShowAddDialog(false)}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" /> Cancel
            </Button>
            <Button
              onClick={handleAddPlaylist}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" /> Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteConfirm !== null}
        onOpenChange={(open) => !open && setShowDeleteConfirm(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Playlist</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this playlist? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-between sm:justify-between">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(null)}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" /> Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (showDeleteConfirm) {
                  onPlaylistDelete(showDeleteConfirm);
                  setShowDeleteConfirm(null);
                }
              }}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LibraryWindow;
