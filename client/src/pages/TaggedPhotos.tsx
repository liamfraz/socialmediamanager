import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, Trash2, Edit2, X, Check, Image as ImageIcon, Search, ChevronLeft, ChevronRight, FileEdit, RefreshCw, FileText, Upload, ArrowUpDown, Folder, FolderOpen, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { TaggedPhoto, PhotoFolder } from "@shared/schema";
import Breadcrumb from "@/components/Breadcrumb";
import PhotoUploadModal from "@/components/PhotoUploadModal";

const ITEMS_PER_PAGE = 50;

export default function TaggedPhotos() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<TaggedPhoto | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; description: string; tags: string[] } | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [deleteFolderConfirm, setDeleteFolderConfirm] = useState<{ id: string; name: string } | null>(null);
  
  const [formData, setFormData] = useState({
    photoId: "",
    photoUrl: "",
    description: "",
    tags: "",
  });

  // Fetch all photos (for unfiled view)
  const { data: photos = [], isLoading, error, isError } = useQuery<TaggedPhoto[]>({
    queryKey: ["/api/tagged-photos"],
    refetchInterval: 5000,
  });

  // Fetch folders
  const { data: folders = [] } = useQuery<PhotoFolder[]>({
    queryKey: ["/api/photo-folders"],
    refetchInterval: 5000,
  });

  // Fetch photos in current folder (when viewing a folder)
  // Using a URL that the default queryFn will fetch from
  const { data: folderPhotos = [] } = useQuery<TaggedPhoto[]>({
    queryKey: [`/api/photo-folders/${currentFolderId}/photos`],
    enabled: !!currentFolderId,
    refetchInterval: 5000,
  });

  // Get current folder info
  const currentFolder = useMemo(() => {
    if (!currentFolderId) return null;
    return folders.find(f => f.id === currentFolderId) || null;
  }, [currentFolderId, folders]);

  // Get photos currently in prepared posts (draft/pending/approved)
  const { data: photosInPosts = [] } = useQuery<string[]>({
    queryKey: ["/api/tagged-photos/in-posts"],
    refetchInterval: 5000,
  });

  // Create a set of photo URLs that are in posts for quick lookup
  const photosInPostsSet = useMemo(() => new Set(photosInPosts), [photosInPosts]);

  // Log any errors
  if (isError) {
    console.error("Error fetching photos:", error);
  }


  // Get photos without folders (unfiled)
  const unfiledPhotos = useMemo(() => {
    return photos.filter(p => !p.folderId);
  }, [photos]);

  // Determine which photos to show based on current view
  const activePhotos = useMemo(() => {
    if (currentFolderId) {
      return folderPhotos;
    }
    return unfiledPhotos;
  }, [currentFolderId, folderPhotos, unfiledPhotos]);

  // Filter and sort photos
  const filteredPhotos = useMemo(() => {
    let result = activePhotos;
    
    // Filter by search term
    if (searchTerm.trim()) {
      const searchWords = searchTerm.toLowerCase().trim().split(/\s+/);
      result = result.filter((photo) => {
        if (!photo.tags || photo.tags.length === 0) return false;
        const photoTags = photo.tags.map((tag) => tag.toLowerCase());
        return searchWords.every((word) =>
          photoTags.some((tag) => tag.includes(word))
        );
      });
    }
    
    // Sort by date added
    result = [...result].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });
    
    return result;
  }, [activePhotos, searchTerm, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredPhotos.length / ITEMS_PER_PAGE);
  const paginatedPhotos = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredPhotos.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredPhotos, currentPage]);

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const createMutation = useMutation({
    mutationFn: (data: { photoId: string; photoUrl: string; description: string; tags: string[] }) =>
      apiRequest("POST", "/api/tagged-photos", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tagged-photos"] });
      setAddDialogOpen(false);
      resetForm();
      toast({ title: "Photo added", description: "The photo has been added to your library." });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ photoId: string; photoUrl: string; description: string; tags: string[] }> }) =>
      apiRequest("PUT", `/api/tagged-photos/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tagged-photos"] });
      setEditingPhoto(null);
      resetForm();
      toast({ title: "Photo updated", description: "The photo has been updated." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/tagged-photos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tagged-photos"] });
      setDeleteConfirmId(null);
      setSelectedPhotos((prev) => {
        const next = new Set(prev);
        next.clear();
        return next;
      });
      toast({ title: "Photo deleted", description: "The photo has been removed from your library." });
    },
  });

  const createPostMutation = useMutation({
    mutationFn: async (images: string[]) => {
      const response = await apiRequest("POST", "/api/posts", {
        content: "",
        status: "draft",
        scheduledDate: new Date().toISOString(),
        images,
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      setSelectedPhotos(new Set());
      toast({ title: "Post created", description: "Write your caption to complete the post." });
      setLocation(`/post/${data.id}`);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create post.", variant: "destructive" });
    },
  });

  const renameFolderMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiRequest("PUT", `/api/photo-folders/${id}`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/photo-folders"] });
      setRenamingFolderId(null);
      setNewFolderName("");
      toast({ title: "Folder renamed", description: "The folder has been renamed." });
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/photo-folders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/photo-folders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tagged-photos"] });
      if (currentFolderId) {
        setCurrentFolderId(null);
      }
      setDeleteFolderConfirm(null);
      toast({ title: "Folder deleted", description: "The folder and all photos have been deleted." });
    },
  });

  const resetForm = () => {
    setFormData({ photoId: "", photoUrl: "", description: "", tags: "" });
  };

  const handleAdd = () => {
    setUploadModalOpen(true);
  };

  const handleUploadComplete = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/tagged-photos"] });
    queryClient.invalidateQueries({ queryKey: ["/api/photo-folders"] });
    if (currentFolderId) {
      queryClient.invalidateQueries({ queryKey: [`/api/photo-folders/${currentFolderId}/photos`] });
    }
    toast({ title: "Photos uploaded", description: "Your photos have been uploaded and tagged." });
  };

  const handleOpenFolder = (folderId: string) => {
    setCurrentFolderId(folderId);
    setCurrentPage(1);
    setSearchTerm("");
    setSelectedPhotos(new Set());
  };

  const handleBackToFolders = () => {
    setCurrentFolderId(null);
    setCurrentPage(1);
    setSearchTerm("");
    setSelectedPhotos(new Set());
  };

  const handleRenameFolder = (folder: PhotoFolder) => {
    setRenamingFolderId(folder.id);
    setNewFolderName(folder.name);
  };

  const submitRenameFolder = () => {
    if (renamingFolderId && newFolderName.trim()) {
      renameFolderMutation.mutate({ id: renamingFolderId, name: newFolderName.trim() });
    }
  };

  const handleEdit = (photo: TaggedPhoto) => {
    setEditingPhoto(photo);
    setFormData({
      photoId: photo.photoId,
      photoUrl: photo.photoUrl,
      description: photo.description || "",
      tags: photo.tags?.join(", ") || "",
    });
  };

  const handleSubmit = () => {
    const tagsArray = formData.tags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const data = {
      photoId: formData.photoId,
      photoUrl: formData.photoUrl,
      description: formData.description || undefined,
      tags: tagsArray.length > 0 ? tagsArray : undefined,
    };

    if (editingPhoto) {
      updateMutation.mutate({ id: editingPhoto.id, data });
    } else {
      createMutation.mutate(data as any);
    }
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleBulkDelete = async () => {
    const idsToDelete = Array.from(selectedPhotos);
    setSelectedPhotos(new Set()); // Clear selection immediately
    let deletedCount = 0;
    for (const id of idsToDelete) {
      try {
        await apiRequest("DELETE", `/api/tagged-photos/${id}`);
        deletedCount++;
      } catch {
        // Photo may have already been deleted, continue with others
      }
    }
    queryClient.invalidateQueries({ queryKey: ["/api/tagged-photos"] });
    toast({ 
      title: "Photos deleted", 
      description: `${deletedCount} photo(s) have been removed from your library.` 
    });
  };

  const togglePhotoSelection = (id: string) => {
    setSelectedPhotos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedPhotos.size === paginatedPhotos.length) {
      setSelectedPhotos(new Set());
    } else {
      setSelectedPhotos(new Set(paginatedPhotos.map((p) => p.id)));
    }
  };

  const handleCreatePost = () => {
    const selectedPhotoObjects = photos.filter((p) => selectedPhotos.has(p.id));
    const imageUrls = selectedPhotoObjects.map((p) => getDirectImageUrl(p.photoUrl));
    createPostMutation.mutate(imageUrls);
  };

  const buildGoogleDriveUrl = (photoId: string) => {
    return `https://lh3.googleusercontent.com/d/${photoId}=w800-h800`;
  };

  // Convert any Google Drive URL to direct image URL
  const getDirectImageUrl = (url: string) => {
    // Already in lh3 format
    if (url.includes("lh3.googleusercontent.com")) {
      return url;
    }
    // Convert drive.google.com/file/d/{ID}/view format
    const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    if (driveMatch) {
      return `https://lh3.googleusercontent.com/d/${driveMatch[1]}=w800-h800`;
    }
    // Return original if unknown format
    return url;
  };

  // Check if a photo is currently in a prepared post
  const isPhotoInPost = (photo: TaggedPhoto) => {
    const directUrl = getDirectImageUrl(photo.photoUrl);
    return photosInPostsSet.has(photo.photoUrl) || photosInPostsSet.has(directUrl);
  };

  const handlePhotoIdChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      photoId: value,
      photoUrl: value ? buildGoogleDriveUrl(value) : "",
    }));
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b px-6 py-3">
        <Breadcrumb items={currentFolder 
          ? [
              { label: "Photo Library", onClick: handleBackToFolders },
              { label: currentFolder.name }
            ]
          : [{ label: "Photo Library" }]
        } />
      </div>

      <div className="flex-1 p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold" data-testid="text-page-title">
              {currentFolder ? currentFolder.name : "Photo Library"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {currentFolder 
                ? `${filteredPhotos.length} photo${filteredPhotos.length !== 1 ? "s" : ""} in folder`
                : `${folders.length} folder${folders.length !== 1 ? "s" : ""}, ${unfiledPhotos.length} unfiled photo${unfiledPhotos.length !== 1 ? "s" : ""}`
              }
            </p>
          </div>
          <div className="flex items-center gap-3">
            {currentFolder && (
              <Button variant="outline" onClick={handleBackToFolders} data-testid="button-back-to-folders">
                <ChevronLeft className="mr-2 h-4 w-4" />
                All Folders
              </Button>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by tag..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-64 pl-9"
                data-testid="input-search-tags"
              />
            </div>
            <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as "newest" | "oldest")}>
              <SelectTrigger className="w-40" data-testid="select-sort-order">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
              </SelectContent>
            </Select>
            {selectedPhotos.size > 0 && (
              <>
                <Button 
                  onClick={handleCreatePost}
                  disabled={createPostMutation.isPending}
                  data-testid="button-create-post"
                >
                  <FileEdit className="mr-2 h-4 w-4" />
                  Create Post ({selectedPhotos.size})
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleBulkDelete}
                  data-testid="button-bulk-delete"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete ({selectedPhotos.size})
                </Button>
              </>
            )}
            <Button 
              variant="outline"
              size="icon"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/tagged-photos"] });
                queryClient.invalidateQueries({ queryKey: ["/api/photo-folders"] });
              }}
              data-testid="button-refresh-photos"
              title="Refresh photos"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={handleAdd} data-testid="button-add-photo">
              <Upload className="mr-2 h-4 w-4" />
              Add Photo
            </Button>
          </div>
        </div>

        {/* Folder Grid - show when not inside a folder */}
        {!currentFolderId && folders.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Folders</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {folders.map((folder) => (
                <Card
                  key={folder.id}
                  className="group cursor-pointer hover-elevate p-4"
                  onClick={() => handleOpenFolder(folder.id)}
                  data-testid={`folder-${folder.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FolderOpen className="h-8 w-8 text-primary flex-shrink-0" />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          data-testid={`folder-menu-${folder.id}`}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => handleRenameFolder(folder)}>
                          <Edit2 className="mr-2 h-4 w-4" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteFolderConfirm({ id: folder.id, name: folder.name })}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <p className="mt-2 text-sm font-medium truncate" title={folder.name}>
                    {folder.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {photos.filter(p => p.folderId === folder.id).length} photos
                  </p>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Section header for unfiled photos when not in a folder */}
        {!currentFolderId && folders.length > 0 && unfiledPhotos.length > 0 && (
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Unfiled Photos</h3>
        )}

        {/* Error display */}
        {isError && (
          <div className="mb-4 rounded-lg border border-red-500/50 bg-red-50 dark:bg-red-950/30 p-3 text-sm">
            <p className="font-medium text-red-800 dark:text-red-200">
              Error loading photos: {error instanceof Error ? error.message : String(error)}
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="text-center text-muted-foreground py-12">Loading photos...</div>
        ) : isError ? (
          <div className="text-center py-12">
            <ImageIcon className="mx-auto h-12 w-12 text-red-500/50" />
            <h3 className="mt-4 text-lg font-medium text-red-600">Failed to load photos</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Unknown error occurred"}
            </p>
          </div>
        ) : photos.length === 0 ? (
          <div className="text-center py-12">
            <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No photos yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Upload photos to get started. They'll be automatically tagged using AI.
            </p>
            <Button className="mt-4" onClick={handleAdd}>
              <Upload className="mr-2 h-4 w-4" />
              Add Your First Photo
            </Button>
          </div>
        ) : filteredPhotos.length === 0 ? (
          <div className="text-center py-12">
            <Search className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No matching photos</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              No photos found with tags matching "{searchTerm}"
            </p>
            <Button className="mt-4" variant="outline" onClick={() => setSearchTerm("")}>
              Clear Search
            </Button>
          </div>
        ) : (
          <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={paginatedPhotos.length > 0 && selectedPhotos.size === paginatedPhotos.length}
                      onCheckedChange={toggleSelectAll}
                      data-testid="checkbox-select-all"
                    />
                  </TableHead>
                  <TableHead className="w-24">Preview</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedPhotos.map((photo) => (
                  <TableRow key={photo.id} data-testid={`row-photo-${photo.id}`}>
                    <TableCell>
                      <Checkbox
                        checked={selectedPhotos.has(photo.id)}
                        onCheckedChange={() => togglePhotoSelection(photo.id)}
                        data-testid={`checkbox-photo-${photo.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => setPreviewPhoto({ 
                          url: getDirectImageUrl(photo.photoUrl), 
                          description: photo.description || "Photo",
                          tags: photo.tags || []
                        })}
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                        data-testid={`button-preview-${photo.id}`}
                      >
                        <img
                          src={getDirectImageUrl(photo.photoUrl)}
                          alt={photo.description || "Photo"}
                          className="h-16 w-16 rounded-md object-cover bg-muted"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'%3E%3C/rect%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'%3E%3C/circle%3E%3Cpolyline points='21 15 16 10 5 21'%3E%3C/polyline%3E%3C/svg%3E";
                          }}
                        />
                      </button>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="flex flex-col gap-1">
                        <span className="truncate">{photo.description || "-"}</span>
                        {isPhotoInPost(photo) && (
                          <Badge variant="default" className="w-fit text-xs gap-1">
                            <FileText className="h-3 w-3" />
                            In Post
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {photo.tags?.slice(0, 5).map((tag, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {tag.charAt(0).toUpperCase() + tag.slice(1)}
                          </Badge>
                        ))}
                        {(photo.tags?.length || 0) > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{(photo.tags?.length || 0) - 5}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(photo)}
                          data-testid={`button-edit-${photo.id}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        {deleteConfirmId === photo.id ? (
                          <>
                            <Button
                              size="icon"
                              variant="destructive"
                              onClick={() => handleDelete(photo.id)}
                              data-testid={`button-confirm-delete-${photo.id}`}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setDeleteConfirmId(null)}
                              data-testid={`button-cancel-delete-${photo.id}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleteConfirmId(photo.id)}
                            data-testid={`button-delete-${photo.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredPhotos.length)} of {filteredPhotos.length} photos
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  data-testid="button-next-page"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
          </>
        )}
      </div>

      <Dialog open={addDialogOpen || !!editingPhoto} onOpenChange={(open) => {
        if (!open) {
          setAddDialogOpen(false);
          setEditingPhoto(null);
          resetForm();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPhoto ? "Edit Photo" : "Add Photo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {formData.photoUrl && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Preview</label>
                <img
                  src={getDirectImageUrl(formData.photoUrl)}
                  alt="Preview"
                  className="h-32 w-32 rounded-md object-cover bg-muted"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Input
                placeholder="Photo description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                data-testid="input-description"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Tags</label>
              <Input
                placeholder="tag1, tag2, tag3"
                value={formData.tags}
                onChange={(e) => setFormData((prev) => ({ ...prev, tags: e.target.value }))}
                data-testid="input-tags"
              />
              <p className="text-xs text-muted-foreground">Separate tags with commas</p>
            </div>

            {editingPhoto && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Photo ID</label>
                <Input
                  value={editingPhoto.id}
                  readOnly
                  className="bg-muted cursor-not-allowed"
                  data-testid="input-photo-uuid"
                />
                <p className="text-xs text-muted-foreground">
                  Internal identifier (read-only)
                </p>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Google Drive Photo ID</label>
              <Input
                placeholder="e.g., 1NkANuUpNLNVov_24Jl-ZEKlM1itVwNgc"
                value={formData.photoId}
                onChange={(e) => handlePhotoIdChange(e.target.value)}
                readOnly={!!editingPhoto}
                className={editingPhoto ? "bg-muted cursor-not-allowed" : ""}
                data-testid="input-photo-id"
              />
              <p className="text-xs text-muted-foreground">
                {editingPhoto ? "Cannot be changed after creation" : "The ID from your Google Drive share link"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddDialogOpen(false);
                setEditingPhoto(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.photoId || createMutation.isPending || updateMutation.isPending}
              data-testid="button-submit"
            >
              {editingPhoto ? "Save Changes" : "Add Photo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewPhoto} onOpenChange={(open) => !open && setPreviewPhoto(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          {previewPhoto && (
            <div className="flex flex-col">
              <img
                src={previewPhoto.url}
                alt={previewPhoto.description}
                className="w-full h-auto max-h-[60vh] object-contain bg-black/5 dark:bg-white/5"
              />
              <div className="p-4 space-y-3">
                <h3 className="font-medium text-lg">{previewPhoto.description}</h3>
                {previewPhoto.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {previewPhoto.tags.map((tag, idx) => (
                      <Badge key={idx} variant="secondary">
                        {tag.charAt(0).toUpperCase() + tag.slice(1)}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <PhotoUploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        onUploadComplete={handleUploadComplete}
        folderId={currentFolderId || undefined}
        defaultFolderName={currentFolder?.name}
      />

      {/* Folder Rename Dialog */}
      <Dialog open={!!renamingFolderId} onOpenChange={(open) => !open && setRenamingFolderId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Enter new folder name"
              data-testid="input-rename-folder"
              onKeyDown={(e) => e.key === "Enter" && submitRenameFolder()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenamingFolderId(null)}>
              Cancel
            </Button>
            <Button 
              onClick={submitRenameFolder}
              disabled={!newFolderName.trim() || renameFolderMutation.isPending}
              data-testid="button-confirm-rename"
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteFolderConfirm} onOpenChange={(open) => !open && setDeleteFolderConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? All photos in the folder "{deleteFolderConfirm?.name}" will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-folder">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteFolderConfirm && deleteFolderMutation.mutate(deleteFolderConfirm.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-folder"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
