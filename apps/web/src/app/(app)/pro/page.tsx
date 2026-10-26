import { Avatar, Badge, Card } from '@conexa/ui';
import { MessageCircle, Search, Share2, ThumbsUp } from 'lucide-react';
import Link from 'next/link';

import { posts } from '../../../shell/maquettes/data';
import { TopBar } from '../../../shell/maquettes/kit';

export default function ProFeedPage() {
  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar title="Réseau Pro" eyebrow="Fil" right={<Avatar name="Brice Junguck" size="sm" />} />

      <div className="flex min-h-11 items-center gap-2 rounded-token bg-surface2 px-3 text-sm text-muted">
        <Search className="h-4 w-4" aria-hidden /> Rechercher un étudiant, une compétence…
      </div>

      <Link href="/pro/publier" aria-label="Publier sur le réseau Pro">
        <Card className="flex items-center gap-3 border-dashed">
          <Avatar name="Brice Junguck" size="sm" />
          <span className="text-sm text-muted">Partager un projet, une idée…</span>
        </Card>
      </Link>

      {posts.map((post) => (
        <article
          key={post.author}
          className="flex flex-col gap-3 border-y border-line bg-surface px-4 py-3.5"
        >
          <div className="flex items-start gap-3">
            <Avatar name={post.author} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold leading-tight">{post.author}</p>
              <p className="text-xs text-muted">{post.headline}</p>
              <p className="mt-0.5 text-[11px] text-muted">
                {post.time} · <Badge tone="accent">{post.tag}</Badge>
              </p>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-ink">{post.body}</p>
          <div className="flex flex-wrap gap-1.5">
            {post.hashtags.map((tag) => (
              <span key={tag} className="text-xs font-semibold text-accent-text">
                {tag}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-4 border-t border-line pt-2 text-xs text-muted">
            <span>{post.reactions} réactions</span>
            <span>{post.comments} commentaires</span>
          </div>
          <div className="flex justify-between border-t border-line pt-2 text-xs font-semibold text-muted">
            <span className="inline-flex items-center gap-1.5">
              <ThumbsUp className="h-4 w-4" aria-hidden /> J’aime
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MessageCircle className="h-4 w-4" aria-hidden /> Commenter
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Share2 className="h-4 w-4" aria-hidden /> Partager
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}
