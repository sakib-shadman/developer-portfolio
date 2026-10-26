/** RSS item mapping (FR-15, ADR-0003): references to the Medium originals, never article text. */
import type { RSSFeedItem } from '@astrojs/rss';
import type { ArticleCard } from './content/types';

/**
 * One item per article: title, link = canonical Medium URL (also the guid, isPermaLink, via the
 * library), pubDate, description only when the owner wrote an excerpt, categories = tags.
 * XML escaping is done by the serializer; this function never builds markup.
 */
export function buildFeedItems(articles: readonly ArticleCard[]): RSSFeedItem[] {
  return articles.map((a) => ({
    title: a.title,
    link: a.url,
    pubDate: a.publishedAt,
    ...(a.excerpt ? { description: a.excerpt } : {}),
    ...(a.tags.length > 0 ? { categories: [...a.tags] } : {}),
  }));
}
