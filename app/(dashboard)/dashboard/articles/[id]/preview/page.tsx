"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getArticleById, type ArticleDoc } from "@/lib/firestore";
import { SeriesBadge } from "@/components/articles/SeriesBadge";
import { ReadTimeDisplay } from "@/components/social/ReadTimeDisplay";
import { AudioPlayer } from "@/components/social/AudioPlayer";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";

const STATUS_BADGE: Record<string, { label: string; variant: "gold" | "green" | "orange" }> = {
  draft: { label: "Draft", variant: "orange" },
  scheduled: { label: "Scheduled", variant: "gold" },
  published: { label: "Published", variant: "green" },
};

export default function ArticlePreviewPage() {
  const { id } = useParams<{ id: string }>();
  const [article, setArticle] = useState<ArticleDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    getArticleById(id)
      .then((a) => {
        if (!a) setError("Article not found.");
        else setArticle(a);
      })
      .catch(() => setError("Failed to load article."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="font-mono text-[#5a5a64] animate-pulse">
          Loading preview…
        </span>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="font-mono text-red-400">{error || "Not found."}</span>
      </div>
    );
  }

  const statusInfo = STATUS_BADGE[article.status] ?? STATUS_BADGE.draft;

  return (
    <div className="min-h-screen">
      {/* Preview banner */}
      <div className="sticky top-0 z-40 bg-[#1e1e2a] border-b border-[#2a2a3a] px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-bold text-[#fbbf24] uppercase tracking-widest">
            Preview
          </span>
          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
        </div>
        <Link
          href={`/dashboard/articles/${id}/edit`}
          className="text-xs font-mono text-[#8a8a94] hover:text-[#e8e6e3] transition-colors"
        >
          Back to Editor
        </Link>
      </div>

      {/* Article preview — mirrors public layout */}
      <article className="bg-[#0a0a0f]">
        {/* Cover image */}
        {article.coverImageUrl && (
          <div className="relative h-64 sm:h-96 w-full overflow-hidden">
            <Image
              src={article.coverImageUrl}
              alt={article.title}
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/40 to-transparent" />
          </div>
        )}

        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Article header */}
          <header
            className={`${article.coverImageUrl ? "-mt-20 relative" : "pt-12"} mb-8`}
          >
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <SeriesBadge series={article.series} />
              <ReadTimeDisplay minutes={article.readTimeMinutes} />
            </div>
            <h1 className="font-mono font-bold text-3xl sm:text-4xl text-[#e8e6e3] leading-tight mb-4">
              {article.title}
            </h1>
            <div className="text-sm font-mono text-[#5a5a64]">
              <span className="text-[#8a8a94]">{article.authorName}</span>
              {article.publishedAt && (
                <>
                  {" "}&middot;{" "}
                  <time dateTime={article.publishedAt.toDate().toISOString()}>
                    {formatDate(article.publishedAt)}
                  </time>
                </>
              )}
            </div>
          </header>

          {/* Audio player */}
          {article.audioUrl && (
            <div className="mb-8">
              <AudioPlayer
                url={article.audioUrl}
                title={`Listen: ${article.title}`}
              />
            </div>
          )}

          {/* Article body */}
          <div
            className={`max-w-none mb-16 ${article.content.includes('<style>') ? '' : 'prose prose-invert'}`}
            dangerouslySetInnerHTML={{ __html: article.content }}
          />

          {/* Tags */}
          {article.tags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap mb-12 pt-8 border-t border-[#1e1e2a]">
              <span className="text-xs font-mono text-[#5a5a64] uppercase tracking-widest">
                Tags:
              </span>
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-xs font-mono text-[#8a8a94] bg-[#111118] border border-[#1e1e2a] rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </article>
    </div>
  );
}
