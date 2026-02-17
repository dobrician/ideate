"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, Upload, X, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "@/lib/use-locale";

interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

interface AttachmentUploadProps {
  proposalId: string;
  attachments: Attachment[];
  canEdit: boolean;
  onAttachmentsChange?: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) {
    return <ImageIcon className="h-4 w-4 shrink-0 text-blue-500" />;
  }
  return <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />;
}

export function AttachmentUpload({
  proposalId,
  attachments: initialAttachments,
  canEdit,
  onAttachmentsChange,
}: AttachmentUploadProps) {
  const { t } = useLocale();
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(t("attachments.tooLarge"));
        return;
      }

      if (attachments.length >= 3) {
        toast.error(t("attachments.tooMany"));
        return;
      }

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("proposalId", proposalId);

        const res = await fetch("/api/attachments", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          toast.error(data.error || t("attachments.uploadFailed"));
          return;
        }

        const uploaded = await res.json();
        setAttachments((prev) => [...prev, uploaded]);
        toast.success(t("attachments.uploaded"));
        onAttachmentsChange?.();
      } catch {
        toast.error(t("attachments.uploadFailed"));
      } finally {
        setUploading(false);
      }
    },
    [proposalId, attachments.length, t, onAttachmentsChange]
  );

  const deleteAttachment = async (id: string) => {
    try {
      const res = await fetch(`/api/attachments/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || t("attachments.deleteFailed"));
        return;
      }
      setAttachments((prev) => prev.filter((a) => a.id !== id));
      toast.success(t("attachments.deleted"));
      onAttachmentsChange?.();
    } catch {
      toast.error(t("attachments.deleteFailed"));
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) uploadFile(file);
    },
    [uploadFile]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  return (
    <div className="space-y-2">
      {attachments.length > 0 && (
        <div className="space-y-1">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm"
            >
              <FileIcon mimeType={att.mimeType} />
              <a
                href={`/api/attachments/${att.id}`}
                className="min-w-0 flex-1 truncate text-blue-600 hover:underline dark:text-blue-400"
                title={att.filename}
              >
                {att.filename}
              </a>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatFileSize(att.size)}
              </span>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-red-700 dark:hover:text-red-400"
                  onClick={() => deleteAttachment(att.id)}
                  title={t("attachments.delete")}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && attachments.length < 3 && (
        <div
          className={`rounded-md border-2 border-dashed p-3 text-center transition-colors ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                {t("attachments.uploading")}
              </>
            ) : (
              <>
                <Upload className="mr-1 h-3 w-3" />
                {t("attachments.dropzone")}
              </>
            )}
          </Button>
          <p className="mt-1 text-[10px] text-muted-foreground/60">
            {t("attachments.limit")}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Read-only attachment list for displaying on proposal cards
 */
export function AttachmentList({
  attachments,
}: {
  attachments: Attachment[];
}) {
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {attachments.map((att) => (
        <a
          key={att.id}
          href={`/api/attachments/${att.id}`}
          className="inline-flex items-center gap-1 rounded border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title={`${att.filename} (${formatFileSize(att.size)})`}
        >
          <Paperclip className="h-3 w-3" />
          <span className="max-w-[120px] truncate">{att.filename}</span>
        </a>
      ))}
    </div>
  );
}
