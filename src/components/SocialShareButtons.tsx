import { Facebook, Twitter, Link2, Share2, Mail, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SocialShareButtonsProps {
  url?: string;
  title: string;
  description?: string;
}

export function SocialShareButtons({ url, title, description }: SocialShareButtonsProps) {
  const shareUrl = url || window.location.href;
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(title);
  const encodedDesc = encodeURIComponent(description || "");

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied!");
  };

  const shareNative = () => {
    if (navigator.share) {
      navigator.share({ title, text: description, url: shareUrl });
    } else {
      copyLink();
    }
  };

  const platforms = [
    {
      name: "Facebook",
      icon: Facebook,
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      name: "Twitter",
      icon: Twitter,
      url: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    },
    {
      name: "WhatsApp",
      icon: MessageCircle,
      url: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
    },
    {
      name: "Telegram",
      icon: Send,
      url: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
    },
    {
      name: "LinkedIn",
      icon: Link2,
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    },
    {
      name: "Email",
      icon: Mail,
      url: `mailto:?subject=${encodedTitle}&body=${encodedDesc}%0A%0A${encodedUrl}`,
      noWindow: true,
    },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 hover:bg-accent hover:text-accent-foreground">
          <Share2 className="h-4 w-4" />
          <span className="hidden sm:inline">Share</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {platforms.map((p) => (
          <DropdownMenuItem
            key={p.name}
            onClick={() => {
              if (p.noWindow) {
                window.location.href = p.url;
              } else {
                window.open(p.url, "_blank", "width=600,height=400");
              }
            }}
            className="gap-2 cursor-pointer"
          >
            <p.icon className="h-4 w-4" />
            {p.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem onClick={copyLink} className="gap-2 cursor-pointer">
          <Link2 className="h-4 w-4" />
          Copy Link
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareNative} className="gap-2 cursor-pointer">
          <Share2 className="h-4 w-4" />
          More...
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
