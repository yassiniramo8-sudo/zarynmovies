import { useLegalPage, LegalPageKey } from "@/hooks/useLegalPages";
import { SEOHead } from "@/components/SEOHead";
import { useLanguage } from "@/contexts/LanguageContext";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  pageKey: LegalPageKey;
  fallbackTitle: string;
  fallbackDescription: string;
  fallbackContent: string;
}

export function DynamicLegalPage({ pageKey, fallbackTitle, fallbackDescription, fallbackContent }: Props) {
  const { data: page, isLoading } = useLegalPage(pageKey);
  const { dir } = useLanguage();

  const title = page?.title || fallbackTitle;
  const content = page?.content || fallbackContent;

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <SEOHead title={title} description={fallbackDescription} />
      <div className="container mx-auto max-w-4xl px-4 py-12">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-[400px] w-full" />
          </div>
        ) : (
          <>
            <h1 className="mb-8 text-3xl font-bold text-foreground md:text-4xl">{title}</h1>
            {page && (
              <p className="mb-4 text-sm text-muted-foreground">
                Version {page.version} — {new Date(page.updated_at).toLocaleDateString()}
              </p>
            )}
            <div
              className="prose prose-lg max-w-none text-foreground/90 leading-relaxed [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-8 [&_ul]:list-disc [&_ul]:pr-6 [&_ul]:space-y-2 [&_ol]:list-decimal [&_ol]:pr-6 [&_ol]:space-y-2 [&_a]:text-primary [&_a]:hover:underline"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          </>
        )}
      </div>
    </div>
  );
}
