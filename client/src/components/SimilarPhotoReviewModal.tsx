import { useState, useEffect, useCallback, useRef } from "react";
import { Check, ChevronLeft, ChevronRight, ZoomIn, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SimilarGroupItem {
  id: string;
  photoUrl: string;
  originalFilename: string;
  distance: number;
  isSelected: boolean;
}

interface SimilarGroup {
  id: string;
  items: SimilarGroupItem[];
}

interface SimilarPhotoReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string;
  groups: SimilarGroup[];
  onComplete: (result: { keptCount: number; discardedCount: number; folderId?: string | null }) => void;
  strictness: string;
  onStrictnessChange?: (strictness: string) => void;
}

export default function SimilarPhotoReviewModal({
  open,
  onOpenChange,
  batchId,
  groups: initialGroups,
  onComplete,
  strictness,
  onStrictnessChange,
}: SimilarPhotoReviewModalProps) {
  const { toast } = useToast();
  const [groups, setGroups] = useState<SimilarGroup[]>(initialGroups);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [selections, setSelections] = useState<Record<string, Set<string>>>({});
  const [keepMultiple, setKeepMultiple] = useState<Record<string, boolean>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedetecting, setIsRedetecting] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setGroups(initialGroups);
    const initial: Record<string, Set<string>> = {};
    for (const group of initialGroups) {
      initial[group.id] = new Set([group.items[0]?.id].filter(Boolean));
    }
    setSelections(initial);
    setCurrentGroupIndex(0);
  }, [initialGroups]);

  const currentGroup = groups[currentGroupIndex];
  const totalGroups = groups.length;

  const toggleSelection = useCallback((groupId: string, itemId: string) => {
    setSelections(prev => {
      const current = new Set(prev[groupId] || []);
      const isMultiple = keepMultiple[groupId];

      if (isMultiple) {
        if (current.has(itemId)) {
          current.delete(itemId);
        } else {
          current.add(itemId);
        }
      } else {
        current.clear();
        current.add(itemId);
      }

      return { ...prev, [groupId]: current };
    });
  }, [keepMultiple]);

  const toggleKeepMultiple = useCallback((groupId: string) => {
    setKeepMultiple(prev => {
      const newVal = !prev[groupId];
      if (!newVal) {
        setSelections(prevSel => {
          const current = prevSel[groupId];
          if (current && current.size > 1) {
            const first = current.values().next().value;
            return { ...prevSel, [groupId]: new Set(first ? [first] : []) };
          }
          return prevSel;
        });
      }
      return { ...prev, [groupId]: newVal };
    });
  }, []);

  const goToNextGroup = useCallback(() => {
    if (currentGroupIndex < totalGroups - 1) {
      setCurrentGroupIndex(prev => prev + 1);
    }
  }, [currentGroupIndex, totalGroups]);

  const goToPrevGroup = useCallback(() => {
    if (currentGroupIndex > 0) {
      setCurrentGroupIndex(prev => prev - 1);
    }
  }, [currentGroupIndex]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (previewUrl) {
        if (e.key === "Escape") {
          setPreviewUrl(null);
          e.preventDefault();
        }
        return;
      }

      if (!currentGroup) return;

      const groupSelSet = selections[currentGroup.id] || new Set();
      const selectedIndex = currentGroup.items.findIndex(item => groupSelSet.has(item.id));

      switch (e.key) {
        case "ArrowLeft": {
          const newIdx = Math.max(0, selectedIndex - 1);
          toggleSelection(currentGroup.id, currentGroup.items[newIdx].id);
          e.preventDefault();
          break;
        }
        case "ArrowRight": {
          const newIdx = Math.min(currentGroup.items.length - 1, selectedIndex + 1);
          toggleSelection(currentGroup.id, currentGroup.items[newIdx].id);
          e.preventDefault();
          break;
        }
        case "j":
        case "J":
          goToNextGroup();
          e.preventDefault();
          break;
        case "k":
        case "K":
          goToPrevGroup();
          e.preventDefault();
          break;
        case "Enter":
          if (currentGroupIndex < totalGroups - 1) {
            goToNextGroup();
          }
          e.preventDefault();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, currentGroup, currentGroupIndex, totalGroups, selections, previewUrl, toggleSelection, goToNextGroup, goToPrevGroup]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const selectionData = groups.map(group => ({
        groupId: group.id,
        selectedItemIds: Array.from(selections[group.id] || []),
      }));

      const response = await apiRequest("POST", `/api/photo-batches/${batchId}/resolve`, {
        selections: selectionData,
      });
      const result = await response.json();

      toast({
        title: "Photos processed",
        description: `${result.keptCount} photo(s) kept, ${result.discardedCount} discarded.`,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/tagged-photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/photo-folders"] });
      onComplete(result);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process selections. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeepAll = async () => {
    setIsSubmitting(true);
    try {
      const selectionData = groups.map(group => ({
        groupId: group.id,
        selectedItemIds: group.items.map(item => item.id),
      }));

      const response = await apiRequest("POST", `/api/photo-batches/${batchId}/resolve`, {
        selections: selectionData,
      });
      const result = await response.json();

      toast({
        title: "All photos kept",
        description: `${result.keptCount} photo(s) added to your library.`,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/tagged-photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/photo-folders"] });
      onComplete(result);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStrictnessChange = async (newStrictness: string) => {
    if (!onStrictnessChange) return;
    setIsRedetecting(true);
    try {
      const response = await apiRequest("POST", `/api/photo-batches/${batchId}/redetect`, {
        strictness: newStrictness,
      });
      const data = await response.json();
      onStrictnessChange(newStrictness);

      if (data.groups && data.groups.length > 0) {
        setGroups(data.groups);
        const initial: Record<string, Set<string>> = {};
        for (const group of data.groups) {
          initial[group.id] = new Set([group.items[0]?.id].filter(Boolean));
        }
        setSelections(initial);
        setCurrentGroupIndex(0);
        setKeepMultiple({});
      } else {
        toast({
          title: "No similar photos found",
          description: `All ${data.keptCount || 0} photo(s) have been added to your library.`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/tagged-photos"] });
        queryClient.invalidateQueries({ queryKey: ["/api/photo-folders"] });
        onComplete({ keptCount: data.keptCount || 0, discardedCount: 0 });
        onOpenChange(false);
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to re-analyze photos.",
        variant: "destructive",
      });
    } finally {
      setIsRedetecting(false);
    }
  };

  const getPhotoSrc = (url: string) => {
    if (url.startsWith("http")) return url;
    return url;
  };

  if (!currentGroup) return null;

  const selectedCount = Object.values(selections).reduce((sum, set) => sum + set.size, 0);
  const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0);
  const discardCount = totalItems - selectedCount;

  return (
    <>
      <Dialog open={open && !previewUrl} onOpenChange={(v) => { if (!isSubmitting) onOpenChange(v); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle data-testid="text-similar-modal-title">
              Choose the best from similar photos
            </DialogTitle>
            <DialogDescription>
              We found {totalGroups} group{totalGroups !== 1 ? "s" : ""} of similar photos.
              Select the best photo from each group. Use arrow keys to navigate, J/K to switch groups.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Badge variant="outline" data-testid="text-group-progress">
                Group {currentGroupIndex + 1} of {totalGroups}
              </Badge>
              <Badge variant="secondary">
                {selectedCount} kept / {discardCount} discarded
              </Badge>
            </div>

          </div>

          {isRedetecting ? (
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="text-center space-y-2">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                <p className="text-sm text-muted-foreground">Re-analyzing photos...</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-hidden">
              <div className="space-y-4">
                {groups.map((group, groupIdx) => {
                  const isActive = groupIdx === currentGroupIndex;
                  const groupSel = selections[group.id] || new Set();
                  const isMulti = keepMultiple[group.id];

                  return (
                    <div
                      key={group.id}
                      className={cn(
                        "rounded-lg border p-3 transition-all cursor-pointer",
                        isActive ? "border-primary ring-1 ring-primary/30" : "border-border opacity-60"
                      )}
                      onClick={() => setCurrentGroupIndex(groupIdx)}
                      data-testid={`group-row-${groupIdx}`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                        <span className="text-sm font-medium">
                          Group {groupIdx + 1}
                          <span className="text-muted-foreground ml-1">
                            ({group.items.length} photos)
                          </span>
                        </span>
                        {isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleKeepMultiple(group.id);
                            }}
                            data-testid={`button-toggle-multi-${groupIdx}`}
                          >
                            {isMulti ? "Single select" : "Keep multiple"}
                          </Button>
                        )}
                      </div>

                      <div
                        ref={isActive ? scrollContainerRef : undefined}
                        className="flex gap-2 overflow-x-auto pb-2"
                        style={{ scrollBehavior: "smooth" }}
                      >
                        {group.items.map((item) => {
                          const isItemSelected = groupSel.has(item.id);
                          return (
                            <div
                              key={item.id}
                              className={cn(
                                "relative flex-shrink-0 rounded-md overflow-visible cursor-pointer transition-all border-2",
                                isItemSelected
                                  ? "border-primary ring-2 ring-primary/30"
                                  : "border-transparent hover:border-muted-foreground/30"
                              )}
                              style={{ width: 120, height: 120 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSelection(group.id, item.id);
                              }}
                              data-testid={`photo-thumb-${item.id}`}
                            >
                              <img
                                src={getPhotoSrc(item.photoUrl)}
                                alt={item.originalFilename}
                                className="w-full h-full object-cover rounded-sm"
                                loading="lazy"
                              />
                              {isItemSelected && (
                                <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                                  <Check className="h-3 w-3" />
                                </div>
                              )}
                              <button
                                className="absolute bottom-1 right-1 bg-background/80 text-foreground rounded-full p-1 opacity-0 hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewUrl(getPhotoSrc(item.photoUrl));
                                }}
                                data-testid={`button-preview-${item.id}`}
                              >
                                <ZoomIn className="h-3 w-3" />
                              </button>
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-1 py-0.5 rounded-b-sm">
                                <p className="text-[10px] text-white truncate">
                                  {item.originalFilename}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-2 border-t flex-wrap">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={goToPrevGroup}
                disabled={currentGroupIndex === 0 || isSubmitting}
                data-testid="button-prev-group"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={goToNextGroup}
                disabled={currentGroupIndex >= totalGroups - 1 || isSubmitting}
                data-testid="button-next-group"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleKeepAll}
                disabled={isSubmitting}
                data-testid="button-keep-all"
              >
                Keep All
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || selectedCount === 0}
                data-testid="button-confirm-selection"
              >
                {isSubmitting ? "Processing..." : `Keep ${selectedCount} & Discard ${discardCount}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {previewUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center cursor-pointer"
          onClick={() => setPreviewUrl(null)}
          data-testid="photo-preview-overlay"
        >
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-4 right-4 text-white hover:bg-white/10"
            onClick={() => setPreviewUrl(null)}
            data-testid="button-close-preview"
          >
            <X className="h-6 w-6" />
          </Button>
          <img
            src={previewUrl}
            alt="Full preview"
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
