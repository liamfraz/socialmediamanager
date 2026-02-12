import { useState, useRef, useCallback } from "react";
import { Upload, X, Check, AlertCircle, Loader2, Image as ImageIcon, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import SimilarPhotoReviewModal from "./SimilarPhotoReviewModal";

interface FilePreview {
  file: File;
  id: string;
  valid: boolean;
  error?: string;
}

interface PhotoUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete: () => void;
  defaultFolderName?: string;
  folderId?: string;
}

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

type UploadPhase = "select" | "uploading" | "review" | "done";

export default function PhotoUploadModal({
  open,
  onOpenChange,
  onUploadComplete,
  defaultFolderName = "",
  folderId,
}: PhotoUploadModalProps) {
  const { toast } = useToast();
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [phase, setPhase] = useState<UploadPhase>("select");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");
  const [folderName, setFolderName] = useState(defaultFolderName);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [reviewBatchId, setReviewBatchId] = useState<string | null>(null);
  const [reviewGroups, setReviewGroups] = useState<any[]>([]);
  const [reviewStrictness, setReviewStrictness] = useState("medium");
  const [showReviewModal, setShowReviewModal] = useState(false);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `Invalid file type. Allowed: JPG, PNG, WebP`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`;
    }
    return null;
  };

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const previews: FilePreview[] = fileArray.map((file) => {
      const error = validateFile(file);
      return {
        file,
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        valid: !error,
        error: error || undefined,
      };
    });
    setFiles((prev) => [...prev, ...previews]);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files);
      }
      e.target.value = "";
    },
    [addFiles]
  );

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const uploadFiles = async () => {
    const validFiles = files.filter((f) => f.valid);
    if (validFiles.length === 0) return;

    setPhase("uploading");
    setUploadProgress(10);
    setUploadStatus("Preparing upload...");

    try {
      const formData = new FormData();
      for (const f of validFiles) {
        formData.append("photos", f.file);
      }

      if (folderId) {
        formData.append("folderId", folderId);
      } else if (folderName.trim()) {
        formData.append("folderName", folderName.trim());
      }

      formData.append("strictness", "medium");

      setUploadProgress(30);
      setUploadStatus(`Uploading ${validFiles.length} photo(s)...`);

      const response = await fetch("/api/photo-batches/upload", {
        method: "POST",
        body: formData,
      });

      setUploadProgress(70);
      setUploadStatus("Analyzing for duplicates...");

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Upload failed: ${response.status}`);
      }

      const data = await response.json();

      setUploadProgress(100);

      if (data.status === "needs_review" && data.groups && data.groups.length > 0) {
        setReviewBatchId(data.batchId);
        setReviewGroups(data.groups);
        setReviewStrictness("medium");
        setPhase("review");
        setShowReviewModal(true);
      } else {
        setPhase("done");
        setUploadStatus(`${data.totalPhotos} photo(s) added to your library.`);
        queryClient.invalidateQueries({ queryKey: ["/api/tagged-photos"] });
        queryClient.invalidateQueries({ queryKey: ["/api/photo-folders"] });
        onUploadComplete();
        toast({
          title: "Upload complete",
          description: `${data.totalPhotos} photo(s) added successfully.`,
        });
      }
    } catch (error) {
      setPhase("select");
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const handleReviewComplete = (result: { keptCount: number; discardedCount: number }) => {
    setShowReviewModal(false);
    setPhase("done");
    setUploadStatus(`${result.keptCount} photo(s) kept, ${result.discardedCount} discarded.`);
    onUploadComplete();
  };

  const handleClose = () => {
    if (phase === "uploading") return;
    setFiles([]);
    setFolderName(defaultFolderName);
    setPhase("select");
    setUploadProgress(0);
    setUploadStatus("");
    setReviewBatchId(null);
    setReviewGroups([]);
    setShowReviewModal(false);
    onOpenChange(false);
  };

  const validCount = files.filter((f) => f.valid).length;
  const errorCount = files.filter((f) => !f.valid).length;
  const isUploading = phase === "uploading";

  return (
    <>
      <Dialog open={open && !showReviewModal} onOpenChange={(v) => { if (!isUploading) { if (!v) handleClose(); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Photos</DialogTitle>
            <DialogDescription>
              {phase === "done"
                ? "Upload complete"
                : "Drag and drop photos or click to browse. Similar photos will be detected automatically."}
            </DialogDescription>
          </DialogHeader>

          {phase === "done" ? (
            <div className="py-8 text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm text-muted-foreground">{uploadStatus}</p>
            </div>
          ) : phase === "uploading" ? (
            <div className="py-8 space-y-4">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm font-medium">{uploadStatus}</p>
              </div>
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                This may take a moment for AI tagging and similarity analysis
              </p>
            </div>
          ) : (
            <>
              {!folderId && (
                <div className="space-y-2">
                  <Label htmlFor="folder-name" className="flex items-center gap-2">
                    <Folder className="h-4 w-4" />
                    Folder Name (optional)
                  </Label>
                  <Input
                    id="folder-name"
                    placeholder="e.g., Wedding Reception, Beach Portraits"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    data-testid="input-folder-name"
                  />
                  <p className="text-xs text-muted-foreground">
                    Group these photos into a folder for easier organization
                  </p>
                </div>
              )}

              <div
                className={cn(
                  "relative border-2 border-dashed rounded-lg p-8 transition-colors",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-muted-foreground/50"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  multiple
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={handleFileSelect}
                />
                <div className="flex flex-col items-center gap-2 text-center">
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Drop photos here or click to browse</p>
                    <p className="text-sm text-muted-foreground">
                      JPG, PNG, WebP up to 10MB each
                    </p>
                  </div>
                </div>
              </div>

              {files.length > 0 && (
                <div className="max-h-52 overflow-y-auto space-y-1">
                  {files.map((fp) => (
                    <div
                      key={fp.id}
                      className="flex items-center gap-3 p-2 rounded-lg border bg-card"
                    >
                      <div className="h-8 w-8 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                        <img
                          src={URL.createObjectURL(fp.file)}
                          alt=""
                          className="h-full w-full object-cover"
                          onLoad={(e) => {
                            URL.revokeObjectURL((e.target as HTMLImageElement).src);
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{fp.file.name}</p>
                        {fp.error && (
                          <div className="flex items-center gap-1">
                            <AlertCircle className="h-3 w-3 text-red-500" />
                            <span className="text-xs text-red-500">{fp.error}</span>
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(fp.id)}
                        data-testid={`button-remove-file-${fp.id}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {files.length > 0 && (
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{validCount} valid file(s)</span>
                  {errorCount > 0 && (
                    <span className="text-red-500">{errorCount} invalid</span>
                  )}
                </div>
              )}
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={isUploading}>
              {phase === "done" ? "Close" : "Cancel"}
            </Button>
            {phase === "select" && (
              <Button
                onClick={uploadFiles}
                disabled={validCount === 0}
                data-testid="button-upload-photos"
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload {validCount > 0 ? `(${validCount})` : ""}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showReviewModal && reviewBatchId && (
        <SimilarPhotoReviewModal
          open={showReviewModal}
          onOpenChange={(v) => {
            setShowReviewModal(v);
            if (!v) {
              handleClose();
            }
          }}
          batchId={reviewBatchId}
          groups={reviewGroups}
          onComplete={handleReviewComplete}
          strictness={reviewStrictness}
          onStrictnessChange={setReviewStrictness}
        />
      )}
    </>
  );
}
