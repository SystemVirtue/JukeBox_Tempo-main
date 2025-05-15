import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface SettingsWindowProps {
  playlists: { id: string; name: string; enabled: boolean; videos?: any[] }[];
  defaultPlaylist: string;
  setDefaultPlaylist: (id: string) => void;
  randomPlay: boolean;
  setRandomPlay: (on: boolean) => void;
  onPlayPlaylist?: (videos: any[]) => void;
}

const SettingsWindow: React.FC<SettingsWindowProps> = ({ 
  playlists, 
  defaultPlaylist, 
  setDefaultPlaylist, 
  randomPlay, 
  setRandomPlay,
  onPlayPlaylist 
}) => {
  const enabledPlaylists = playlists.filter(p => p.enabled);
  return (
    <Card className="w-full max-w-4xl mx-auto bg-background border-2 border-border">
      <CardContent className="p-8">
        <h2 className="text-2xl font-bold mb-6">Settings</h2>
        <div className="mb-6">
          <Button size="lg" className="w-full text-lg font-semibold">Background Music Mode</Button>
        </div>
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-2">
            <span className="font-semibold">Default Playlist</span>
            <Select 
              value={defaultPlaylist} 
              onValueChange={(value) => {
                setDefaultPlaylist(value);
                if (value === 'none') {
                  // When switching to NO BGM - QUEUE ONLY, the parent component will handle it
                  return;
                }
                // For other playlists, play the selected playlist
                if (onPlayPlaylist) {
                  const selectedPlaylist = playlists.find(p => p.id === value);
                  if (selectedPlaylist?.videos?.length) {
                    onPlayPlaylist(selectedPlaylist.videos);
                  }
                }
              }}
            >
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">NO BGM - QUEUE ONLY</SelectItem>
                {enabledPlaylists.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {defaultPlaylist !== "none" && (
            <div className="flex items-center gap-4 mt-4">
              <span className="font-semibold">Random Play</span>
              <Switch checked={randomPlay} onCheckedChange={setRandomPlay} />
              <span>{randomPlay ? "ON" : "OFF"}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SettingsWindow;
