import { useMemo, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import PostRow from "@/components/PostRow";
import EmptyState from "@/components/EmptyState";
import { useLocation } from "wouter";
import type { PostStatus } from "@/components/StatusBadge";
import type { Post, TaggedPhoto } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, X, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

const PHOTOS_PER_PAGE = 20;

export default function PostedPosts() {
  const [, setLocation] = useLocation();
  const [showPostedPhotos, setShowPostedPhotos] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<TaggedPhoto | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    apiRequest("POST", "/api/seed").catch(() => {});
  }, []);

  const { data: posts = [], isLoading } = useQuery<Post[]>({
    queryKey: ["/api/posts"],
  });

  const { data: postedPhotos = [], isLoading: photosLoading } = useQuery<TaggedPhoto[]>({
    queryKey: ["/api/tagged-photos/posted"],
    enabled: showPostedPhotos,
  });

  const postedPosts = useMemo(() => {
    return posts
      .filter((post) => post.status === "posted")
      .sort((a, b) => a.order - b.order);
  }, [posts]);

  const totalPages = Math.ceil(postedPhotos.length / PHOTOS_PER_PAGE);
  const paginatedPhotos = useMemo(() => {
    const startIndex = (currentPage - 1) * PHOTOS_PER_PAGE;
    return postedPhotos.slice(startIndex, startIndex + PHOTOS_PER_PAGE);
  }, [postedPhotos, currentPage]);

  const handlePostClick = (postId: string) => {
    setLocation(`/post/${postId}`);
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-muted-foreground" data-testid="loading-indicator">Loading posts...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-3 flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Posts that have been published.
          <span className="ml-2 font-medium text-foreground">{postedPosts.length} posted</span>
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowPostedPhotos(true)}
          data-testid="button-posted-photos"
        >
          <ImageIcon className="w-4 h-4 mr-2" />
          Posted Photos
        </Button>
      </div>
      
      <main className="flex-1 p-6">
        <div className="mx-auto max-w-4xl">
          {postedPosts.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-3">
              {postedPosts.map((post, index) => (
                <PostRow
                  key={post.id}
                  post={{
                    id: post.id,
                    content: post.content,
                    status: post.status as PostStatus,
                    scheduledDate: new Date(post.scheduledDate),
                    images: post.images ?? undefined,
                    order: post.order,
                  }}
                  index={index}
                  totalPosts={postedPosts.length}
                  onClick={() => handlePostClick(post.id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <Dialog open={showPostedPhotos} onOpenChange={setShowPostedPhotos}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Posted Photos
              <Badge variant="secondary" className="ml-2">{postedPhotos.length} photos</Badge>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto">
            {photosLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-muted-foreground">Loading photos...</div>
              </div>
            ) : postedPhotos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ImageIcon className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No photos have been posted yet.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Photos from tagged photos that are used in published posts will appear here.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-3 p-1">
                  {paginatedPhotos.map((photo) => (
                    <div
                      key={photo.id}
                      className="relative aspect-square rounded-md overflow-hidden cursor-pointer hover-elevate group"
                      onClick={() => setPreviewPhoto(photo)}
                      data-testid={`posted-photo-${photo.id}`}
                    >
                      <img
                        src={photo.photoUrl}
                        alt={photo.description || "Posted photo"}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "https://via.placeholder.com/200?text=Error";
                        }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                      {photo.postedAt && (
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                          <p className="text-white text-xs truncate">
                            {format(new Date(photo.postedAt), "MMM d, yyyy")}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewPhoto} onOpenChange={() => setPreviewPhoto(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Photo Preview</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPreviewPhoto(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          {previewPhoto && (
            <div className="space-y-4">
              <div className="relative aspect-video rounded-md overflow-hidden bg-muted">
                <img
                  src={previewPhoto.photoUrl}
                  alt={previewPhoto.description || "Photo preview"}
                  className="w-full h-full object-contain"
                />
              </div>
              {previewPhoto.description && (
                <p className="text-sm text-muted-foreground">{previewPhoto.description}</p>
              )}
              {previewPhoto.tags && previewPhoto.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {previewPhoto.tags.map((tag, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
              {previewPhoto.postedAt && (
                <p className="text-xs text-muted-foreground">
                  Posted: {format(new Date(previewPhoto.postedAt), "MMMM d, yyyy 'at' h:mm a")}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
