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

interface FileUploadStatus {
  file: File;
  id: string;
  status: "pending" | "uploading" | "tagging" | "done" | "error";
  progress: number;
  error?: string;
  photo?: any;
}

interface PhotoUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete: () => void;
  defaultFolderName?: string;
  folderId?: string;
}

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_CONCURRENT_UPLOADS = 3;

export default function PhotoUploadModal({
  open,
  onOpenChange,
  onUploadComplete,
  defaultFolderName = "",
  folderId,
}: PhotoUploadModalProps) {
  const [files, setFiles] = useState<FileUploadStatus[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [folderName, setFolderName] = useState(defaultFolderName);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const validatedFiles: FileUploadStatus[] = fileArray.map((file) => {
      const error = validateFile(file);
      return {
        file,
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        status: error ? "error" : "pending",
        progress: 0,
        error: error || undefined,
      };
    });

    setFiles((prev) => [...prev, ...validatedFiles]);
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
      // Reset input so the same file can be selected again
      e.target.value = "";
    },
    [addFiles]
  );

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const uploadFiles = async () => {
    const pendingFiles = files.filter((f) => f.status === "pending");
    if (pendingFiles.length === 0) return;

    setIsUploading(true);

    // If we have multiple files and a folder name, create folder once and use for all
    let targetFolderId = folderId;

    // Process files with concurrency limit
    const queue = [...pendingFiles];
    const inProgress: Promise<void>[] = [];

    const processFile = async (fileStatus: FileUploadStatus, isFirst: boolean) => {
      const { file, id } = fileStatus;

      // Update status to uploading
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, status: "uploading", progress: 10 } : f
        )
      );

      try {
        const formData = new FormData();
        formData.append("photos", file);
        
        // Add folder info - only create folder on first file upload
        if (targetFolderId) {
          formData.append("folderId", targetFolderId);
        } else if (isFirst && folderName.trim()) {
          formData.append("folderName", folderName.trim());
        } else if (targetFolderId) {
          formData.append("folderId", targetFolderId);
        }

        // Update progress during upload
        setFiles((prev) =>
          prev.map((f) => (f.id === id ? { ...f, progress: 30 } : f))
        );

        const response = await fetch("/api/photos/upload-and-tag", {
          method: "POST",
          body: formData,
        });

        // Update to tagging status
        setFiles((prev) =>
          prev.map((f) =>
            f.id === id ? { ...f, status: "tagging", progress: 60 } : f
          )
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Upload failed: ${response.status}`);
        }

        const data = await response.json();
        const result = data.results?.[0];

        if (result?.success) {
          // Capture folderId from first upload for subsequent uploads
          if (data.folderId && !targetFolderId) {
            targetFolderId = data.folderId;
          }
          setFiles((prev) =>
            prev.map((f) =>
              f.id === id
                ? { ...f, status: "done", progress: 100, photo: result.photo }
                : f
            )
          );
        } else {
          throw new Error(result?.error || "Upload failed");
        }
      } catch (error) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === id
              ? {
                  ...f,
                  status: "error",
                  progress: 0,
                  error: error instanceof Error ? error.message : "Upload failed",
                }
              : f
          )
        );
      }
    };

    // Process files sequentially to properly handle folder creation
    let isFirst = true;
    for (const fileStatus of pendingFiles) {
      await processFile(fileStatus, isFirst);
      isFirst = false;
    }

    setIsUploading(false);
    onUploadComplete();
  };

  const handleClose = () => {
    if (!isUploading) {
      setFiles([]);
      setFolderName(defaultFolderName);
      onOpenChange(false);
    }
  };

  const pendingCount = files.filter((f) => f.status === "pending").length;
  const doneCount = files.filter((f) => f.status === "done").length;
  const errorCount = files.filter((f) => f.status === "error").length;

  const getStatusIcon = (status: FileUploadStatus["status"]) => {
    switch (status) {
      case "pending":
        return <ImageIcon className="h-4 w-4 text-muted-foreground" />;
      case "uploading":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "tagging":
        return <Loader2 className="h-4 w-4 text-purple-500 animate-spin" />;
      case "done":
        return <Check className="h-4 w-4 text-green-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusText = (status: FileUploadStatus["status"]) => {
    switch (status) {
      case "pending":
        return "Ready";
      case "uploading":
        return "Uploading...";
      case "tagging":
        return "AI tagging...";
      case "done":
        return "Done";
      case "error":
        return "Failed";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Photos</DialogTitle>
          <DialogDescription>
            Drag and drop photos or click to browse. Photos will be automatically tagged using AI.
          </DialogDescription>
        </DialogHeader>

        {/* Folder name input */}
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
              disabled={isUploading}
              data-testid="input-folder-name"
            />
            <p className="text-xs text-muted-foreground">
              Group these photos into a folder for easier organization
            </p>
          </div>
        )}

        {/* Drop zone */}
        <div
          className={cn(
            "relative border-2 border-dashed rounded-lg p-8 transition-colors",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50",
            isUploading && "pointer-events-none opacity-50"
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
            disabled={isUploading}
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

        {/* File list */}
        {files.length > 0 && (
          <div className="max-h-64 overflow-y-auto space-y-2">
            {files.map((fileStatus) => (
              <div
                key={fileStatus.id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card"
              >
                {/* Thumbnail */}
                <div className="h-10 w-10 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                  <img
                    src={URL.createObjectURL(fileStatus.file)}
                    alt=""
                    className="h-full w-full object-cover"
                    onLoad={(e) => {
                      // Revoke object URL after load to free memory
                      URL.revokeObjectURL((e.target as HTMLImageElement).src);
                    }}
                  />
                </div>

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {fileStatus.file.name}
                  </p>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(fileStatus.status)}
                    <span
                      className={cn(
                        "text-xs",
                        fileStatus.status === "error"
                          ? "text-red-500"
                          : "text-muted-foreground"
                      )}
                    >
                      {fileStatus.error || getStatusText(fileStatus.status)}
                    </span>
                  </div>
                  {(fileStatus.status === "uploading" ||
                    fileStatus.status === "tagging") && (
                    <Progress value={fileStatus.progress} className="h-1 mt-1" />
                  )}
                </div>

                {/* Remove button */}
                {!isUploading && fileStatus.status !== "done" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    onClick={() => removeFile(fileStatus.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        {files.length > 0 && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{files.length} file(s) selected</span>
            {doneCount > 0 && (
              <span className="text-green-600">{doneCount} uploaded</span>
            )}
            {errorCount > 0 && (
              <span className="text-red-500">{errorCount} failed</span>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            {doneCount > 0 && pendingCount === 0 ? "Close" : "Cancel"}
          </Button>
          <Button
            onClick={uploadFiles}
            disabled={isUploading || pendingCount === 0}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload {pendingCount > 0 ? `(${pendingCount})` : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
