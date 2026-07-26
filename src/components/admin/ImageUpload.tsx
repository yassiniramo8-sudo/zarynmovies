import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";

interface ImageUploadProps { bucket: string; folder?: string; value?: string; onChange: (url: string) => void; label?: string; className?: string; }

export function ImageUpload({ bucket, folder = "", value, onChange, label, className }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();

  const upload = async (file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${folder ? folder + "/" : ""}${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) { toast.error("Upload failed: " + error.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
    onChange(urlData.publicUrl); setUploading(false); toast.success("Image uploaded");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { if (file.size > 10 * 1024 * 1024) { toast.error("File too large (max 10MB)"); return; } upload(file); }
  };

  return (
    <div className={className}>
      {label && <p className="text-sm font-medium text-foreground mb-1.5">{label}</p>}
      <input ref={inputRef} type="file" accept="image/*" onChange={handleChange} className="hidden" />
      {value ? (
        <div className="relative group rounded-lg overflow-hidden border border-border/50 bg-muted">
          <img src={value} alt="Upload" className="w-full h-40 object-cover" />
          <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("upload.replace")}</Button>
            <Button size="sm" variant="destructive" onClick={() => onChange("")}><X className="h-4 w-4" /></Button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="flex flex-col items-center justify-center w-full h-32 rounded-lg border-2 border-dashed border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors text-muted-foreground">
          {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <><Upload className="h-6 w-6 mb-1" /><span className="text-xs">{t("upload.clickToUpload")}</span></>}
        </button>
      )}
    </div>
  );
}

interface MultiImageUploadProps { bucket: string; folder?: string; value: string[]; onChange: (urls: string[]) => void; label?: string; max?: number; }

export function MultiImageUpload({ bucket, folder = "", value = [], onChange, label, max = 10 }: MultiImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList) => {
    setUploading(true);
    const newUrls: string[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) continue;
      const ext = file.name.split(".").pop();
      const path = `${folder ? folder + "/" : ""}${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { cacheControl: "3600" });
      if (!error) { const { data } = supabase.storage.from(bucket).getPublicUrl(path); newUrls.push(data.publicUrl); }
    }
    onChange([...value, ...newUrls].slice(0, max)); setUploading(false);
    if (newUrls.length) toast.success(`${newUrls.length} image(s) uploaded`);
  };

  const remove = (idx: number) => { onChange(value.filter((_, i) => i !== idx)); };

  return (
    <div>
      {label && <p className="text-sm font-medium text-foreground mb-1.5">{label}</p>}
      <input ref={inputRef} type="file" accept="image/*" multiple onChange={(e) => e.target.files && upload(e.target.files)} className="hidden" />
      <div className="grid grid-cols-3 gap-2">
        {value.map((url, i) => (
          <div key={i} className="relative group rounded-lg overflow-hidden border border-border/50">
            <img src={url} alt={`Gallery ${i}`} className="w-full h-20 object-cover" />
            <button onClick={() => remove(i)} className="absolute top-1 right-1 p-0.5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-3 w-3" /></button>
          </div>
        ))}
        {value.length < max && (
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="flex flex-col items-center justify-center h-20 rounded-lg border-2 border-dashed border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors text-muted-foreground">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ImageIcon className="h-4 w-4" /><span className="text-[10px]">Add</span></>}
          </button>
        )}
      </div>
    </div>
  );
}
