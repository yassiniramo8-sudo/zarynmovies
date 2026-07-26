export interface ContentItem {
  id: string;
  title: string;
  poster: string;
  rating: number;
  year: number;
  genre: string[];
  description: string;
  type: "movie" | "anime" | "series";
  trending?: boolean;
  pinned?: boolean;
  trailer_url?: string | null;
  vip_only?: boolean;
}

export interface BackgroundItem {
  id: string;
  title: string;
  image: string;
  likes: number;
}

export interface ArticleItem {
  id: string;
  title: string;
  cover: string;
  excerpt: string;
  content: string;
  date: string;
  likes: number;
}

const posterBase = "https://images.unsplash.com/";

export const movies: ContentItem[] = [
  { id: "m1", title: "Shadow Protocol", poster: posterBase + "photo-1536440136628-849c177e76a1?w=400&h=600&fit=crop", rating: 8.5, year: 2024, genre: ["Action", "Thriller"], description: "A covert agent uncovers a global conspiracy threatening world order.", type: "movie", trending: true },
  { id: "m2", title: "Neon Requiem", poster: posterBase + "photo-1489599849927-2ee91cede3ba?w=400&h=600&fit=crop", rating: 7.8, year: 2024, genre: ["Sci-Fi", "Drama"], description: "In a dystopian future, a musician fights to save the last symphony.", type: "movie", trending: true },
  { id: "m3", title: "Desert Storm", poster: posterBase + "photo-1440404653325-ab127d49abc1?w=400&h=600&fit=crop", rating: 9.1, year: 2023, genre: ["War", "Drama"], description: "A squad of soldiers navigates treacherous desert terrain behind enemy lines.", type: "movie" },
  { id: "m4", title: "Midnight Echo", poster: posterBase + "photo-1478720568477-152d9b164e26?w=400&h=600&fit=crop", rating: 8.2, year: 2024, genre: ["Horror", "Mystery"], description: "Strange echoes haunt an abandoned mansion, revealing dark secrets.", type: "movie" },
  { id: "m5", title: "The Last Frontier", poster: posterBase + "photo-1518676590747-1e3dcf5a0680?w=400&h=600&fit=crop", rating: 7.5, year: 2023, genre: ["Adventure", "Sci-Fi"], description: "Humanity's last hope lies beyond the stars.", type: "movie", trending: true },
  { id: "m6", title: "Iron Resolve", poster: posterBase + "photo-1535016120720-40c646be5580?w=400&h=600&fit=crop", rating: 8.8, year: 2024, genre: ["Action", "Drama"], description: "A retired boxer returns to the ring for one final fight.", type: "movie" },
  { id: "m7", title: "Crimson Tide", poster: posterBase + "photo-1524712245354-2c4e5e7121c0?w=400&h=600&fit=crop", rating: 7.9, year: 2023, genre: ["Thriller", "Crime"], description: "A detective races against time to stop a serial killer.", type: "movie" },
  { id: "m8", title: "Starfall", poster: posterBase + "photo-1506466010722-395aa2bef877?w=400&h=600&fit=crop", rating: 9.0, year: 2024, genre: ["Sci-Fi", "Fantasy"], description: "When stars begin to fall, an unlikely hero rises.", type: "movie", trending: true },
];

export const anime: ContentItem[] = [
  { id: "a1", title: "Blade of Eternity", poster: posterBase + "photo-1578632767115-351597cf2477?w=400&h=600&fit=crop", rating: 9.2, year: 2024, genre: ["Action", "Fantasy"], description: "A young swordsman embarks on a quest to find the legendary Eternal Blade.", type: "anime", trending: true },
  { id: "a2", title: "Spirit Weaver", poster: posterBase + "photo-1541562232579-512a21360020?w=400&h=600&fit=crop", rating: 8.7, year: 2024, genre: ["Fantasy", "Adventure"], description: "A girl discovers she can communicate with ancient spirits.", type: "anime", trending: true },
  { id: "a3", title: "Cyber Ronin", poster: posterBase + "photo-1558618666-fcd25c85f82e?w=400&h=600&fit=crop", rating: 8.4, year: 2023, genre: ["Sci-Fi", "Action"], description: "A cybernetically enhanced warrior fights for justice in Neo Tokyo.", type: "anime" },
  { id: "a4", title: "Eclipse Academy", poster: posterBase + "photo-1534972195531-d756b9bfa9f2?w=400&h=600&fit=crop", rating: 7.6, year: 2024, genre: ["School", "Romance"], description: "Students at a magical academy uncover a dark prophecy.", type: "anime" },
  { id: "a5", title: "Dragon Pulse", poster: posterBase + "photo-1560393464-5c69a73c5770?w=400&h=600&fit=crop", rating: 9.0, year: 2023, genre: ["Action", "Fantasy"], description: "The last dragon tamer awakens to protect the realm.", type: "anime", trending: true },
  { id: "a6", title: "Phantom Code", poster: posterBase + "photo-1550745165-9bc0b252726f?w=400&h=600&fit=crop", rating: 8.1, year: 2024, genre: ["Sci-Fi", "Mystery"], description: "A hacker discovers a code that can alter reality.", type: "anime" },
];

export const backgrounds: BackgroundItem[] = [
  { id: "b1", title: "Mountain Twilight", image: posterBase + "photo-1506905925346-21bda4d32df4?w=1200&h=800&fit=crop", likes: 245 },
  { id: "b2", title: "Ocean Depths", image: posterBase + "photo-1518837695005-2083093ee35b?w=1200&h=800&fit=crop", likes: 189 },
  { id: "b3", title: "Northern Lights", image: posterBase + "photo-1531366936337-7c912a4589a7?w=1200&h=800&fit=crop", likes: 312 },
  { id: "b4", title: "Urban Night", image: posterBase + "photo-1514565131-fce0801e5785?w=1200&h=800&fit=crop", likes: 156 },
  { id: "b5", title: "Sakura Dreams", image: posterBase + "photo-1522383225653-ed111181a951?w=1200&h=800&fit=crop", likes: 278 },
  { id: "b6", title: "Desert Sunset", image: posterBase + "photo-1509316975850-ff9c5deb0cd9?w=1200&h=800&fit=crop", likes: 201 },
];

export const articles: ArticleItem[] = [
  { id: "ar1", title: "Top 10 Anime of 2024", cover: posterBase + "photo-1578632767115-351597cf2477?w=800&h=400&fit=crop", excerpt: "Our picks for the best anime series and movies this year.", content: "Full article content here...", date: "2024-12-15", likes: 423 },
  { id: "ar2", title: "The Rise of Cyberpunk Cinema", cover: posterBase + "photo-1558618666-fcd25c85f82e?w=800&h=400&fit=crop", excerpt: "How cyberpunk has evolved from niche to mainstream in film.", content: "Full article content here...", date: "2024-11-28", likes: 315 },
  { id: "ar3", title: "Behind the Scenes: VFX in Modern Movies", cover: posterBase + "photo-1536440136628-849c177e76a1?w=800&h=400&fit=crop", excerpt: "A deep dive into the visual effects that bring our favorite films to life.", content: "Full article content here...", date: "2024-10-10", likes: 287 },
];

export const allGenres = ["Action", "Adventure", "Comedy", "Crime", "Drama", "Fantasy", "Horror", "Mystery", "Romance", "Sci-Fi", "School", "Thriller", "War"];
