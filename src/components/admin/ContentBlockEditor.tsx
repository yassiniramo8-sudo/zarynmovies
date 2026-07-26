import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Type,
  ImageIcon,
  Video,
  Link2,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  GripVertical,
} from "lucide-react";

export type ContentBlock = {
  id: string;
  type: "text" | "image" | "video" | "link";
  content: string; // HTML for text, URL for image/video, href for link
  caption?: string;
  alt?: string;
  linkText?: string;
};

interface ContentBlockEditorProps {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
  isRtl?: boolean;
}

const createId = () => Math.random().toString(36).slice(2, 10);

const BLOCK_TYPES = [
  { value: "text", label: "Text", icon: Type },
  { value: "image", label: "Image", icon: ImageIcon },
  { value: "video", label: "Video", icon: Video },
  { value: "link", label: "Link", icon: Link2 },
] as const;

export function ContentBlockEditor({
  blocks,
  onChange,
  isRtl = false,
}: ContentBlockEditorProps) {
  const [addType, setAddType] = useState<ContentBlock["type"]>("text");

  const addBlock = (insertAfterIdx?: number) => {
    const newBlock: ContentBlock = {
      id: createId(),
      type: addType,
      content: "",
      caption: "",
      alt: "",
      linkText: "",
    };
    const updated = [...blocks];
    const idx =
      insertAfterIdx !== undefined ? insertAfterIdx + 1 : updated.length;
    updated.splice(idx, 0, newBlock);
    onChange(updated);
  };

  const removeBlock = (idx: number) => {
    onChange(blocks.filter((_, i) => i !== idx));
  };

  const moveBlock = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= blocks.length) return;
    const updated = [...blocks];
    [updated[idx], updated[target]] = [updated[target], updated[idx]];
    onChange(updated);
  };

  const updateBlock = (idx: number, patch: Partial<ContentBlock>) => {
    onChange(blocks.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  };

  const dir = isRtl ? "rtl" : "ltr";

  return (
    <div className="space-y-3">
      {blocks.map((block, idx) => (
        <Card
          key={block.id}
          className="border-border/50 bg-muted/10 p-3 space-y-2"
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <GripVertical className="h-4 w-4 shrink-0" />
            <span className="uppercase font-medium">
              {BLOCK_TYPES.find((t) => t.value === block.type)?.label}
            </span>
            <span className="text-muted-foreground/50">#{idx + 1}</span>
            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => moveBlock(idx, -1)}
                disabled={idx === 0}
              >
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => moveBlock(idx, 1)}
                disabled={idx === blocks.length - 1}
              >
                <ArrowDown className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={() => removeBlock(idx)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {block.type === "text" && (
            <Textarea
              value={block.content}
              onChange={(e) => updateBlock(idx, { content: e.target.value })}
              placeholder="Enter HTML content..."
              className="border-border/50 bg-background/50 font-mono text-xs min-h-[100px]"
              dir={dir}
            />
          )}

          {block.type === "image" && (
            <div className="space-y-2">
              <Input
                value={block.content}
                onChange={(e) => updateBlock(idx, { content: e.target.value })}
                placeholder="Image URL (https://...)"
                className="border-border/50 bg-background/50 text-xs"
              />
              {block.content && (
                <img
                  src={block.content}
                  alt={block.alt || ""}
                  className="max-h-40 rounded-lg object-cover"
                />
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">
                    Alt Text
                  </Label>
                  <Input
                    value={block.alt || ""}
                    onChange={(e) => updateBlock(idx, { alt: e.target.value })}
                    placeholder="Describe the image..."
                    className="border-border/50 bg-background/50 text-xs h-7"
                    dir={dir}
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">
                    Caption
                  </Label>
                  <Input
                    value={block.caption || ""}
                    onChange={(e) =>
                      updateBlock(idx, { caption: e.target.value })
                    }
                    placeholder="Image caption..."
                    className="border-border/50 bg-background/50 text-xs h-7"
                    dir={dir}
                  />
                </div>
              </div>
            </div>
          )}

          {block.type === "video" && (
            <div className="space-y-2">
              <Input
                value={block.content}
                onChange={(e) => updateBlock(idx, { content: e.target.value })}
                placeholder="Video URL (YouTube, Vimeo, etc.)"
                className="border-border/50 bg-background/50 text-xs"
              />
              <Input
                value={block.caption || ""}
                onChange={(e) => updateBlock(idx, { caption: e.target.value })}
                placeholder="Video caption..."
                className="border-border/50 bg-background/50 text-xs"
                dir={dir}
              />
              {block.content && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Video className="h-3 w-3" /> {block.content}
                </div>
              )}
            </div>
          )}

          {block.type === "link" && (
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={block.content}
                onChange={(e) => updateBlock(idx, { content: e.target.value })}
                placeholder="URL (https://...)"
                className="border-border/50 bg-background/50 text-xs"
              />
              <Input
                value={block.linkText || ""}
                onChange={(e) =>
                  updateBlock(idx, { linkText: e.target.value })
                }
                placeholder="Link display text..."
                className="border-border/50 bg-background/50 text-xs"
                dir={dir}
              />
            </div>
          )}

          {/* Insert block after */}
          <div className="flex justify-center pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-[10px] h-5 text-muted-foreground hover:text-primary"
              onClick={() => addBlock(idx)}
            >
              <Plus className="h-3 w-3 mr-1" /> Insert below
            </Button>
          </div>
        </Card>
      ))}

      {/* Add block controls */}
      <div className="flex items-center gap-2 pt-2">
        <Select
          value={addType}
          onValueChange={(v) => setAddType(v as ContentBlock["type"])}
        >
          <SelectTrigger className="w-[140px] border-border/50 bg-background/50 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BLOCK_TYPES.map((bt) => (
              <SelectItem key={bt.value} value={bt.value}>
                <span className="flex items-center gap-2">
                  <bt.icon className="h-3 w-3" />
                  {bt.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => addBlock()}
          className="border-border/50 h-8 text-xs"
        >
          <Plus className="h-3 w-3 mr-1" /> Add Block
        </Button>
      </div>
    </div>
  );
}

/** Convert ContentBlock array to HTML string */
export function blocksToHtml(blocks: ContentBlock[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case "text":
          return b.content;
        case "image": {
          const alt = b.alt ? ` alt="${b.alt}"` : "";
          const img = `<img src="${b.content}"${alt} style="max-width:100%;border-radius:8px;" loading="lazy" />`;
          const caption = b.caption
            ? `<figcaption style="text-align:center;font-size:0.85em;color:#888;margin-top:4px;">${b.caption}</figcaption>`
            : "";
          return `<figure style="margin:1.5em 0;">${img}${caption}</figure>`;
        }
        case "video": {
          const ytMatch = b.content.match(
            /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/
          );
          if (ytMatch) {
            const embed = `<iframe width="100%" height="400" src="https://www.youtube.com/embed/${ytMatch[1]}" frameborder="0" allowfullscreen style="border-radius:8px;"></iframe>`;
            const caption = b.caption
              ? `<p style="text-align:center;font-size:0.85em;color:#888;">${b.caption}</p>`
              : "";
            return `<div style="margin:1.5em 0;">${embed}${caption}</div>`;
          }
          return `<p><a href="${b.content}" target="_blank" rel="noopener">${b.caption || b.content}</a></p>`;
        }
        case "link":
          return `<p><a href="${b.content}" target="_blank" rel="noopener">${b.linkText || b.content}</a></p>`;
        default:
          return "";
      }
    })
    .join("\n");
}

/** Convert HTML string to ContentBlock array (basic) */
export function htmlToBlocks(html: string): ContentBlock[] {
  if (!html.trim()) return [];
  // Simple approach: treat entire HTML as one text block
  return [{ id: createId(), type: "text", content: html }];
}
