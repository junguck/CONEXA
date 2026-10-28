'use client';

import { Avatar, Badge, Button, Input } from '@conexa/ui';
import {
  Bookmark,
  BookmarkCheck,
  EyeOff,
  MessageCircle,
  Pencil,
  Share2,
  ThumbsUp,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { posts } from './data';
import { Hint, TopBar } from './kit';

type Filter = 'all' | 'missions' | 'network' | 'saved';

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Tout' },
  { id: 'missions', label: 'Missions' },
  { id: 'network', label: 'Réseau' },
  { id: 'saved', label: 'Enregistrées' },
];

const SEED_COMMENTS: Record<string, string[]> = {
  'Léa N.': ['Je peux aider sur la partie design.', 'Intéressé pour le back-end NestJS.'],
  'Convexa Missions': ['Affiche déjà en cours, je t’envoie un message.'],
};

/** Fil Pro : filtres, recherche, j’aime, commentaires et partage, tout local. */
export function ProFeed() {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [all, setAll] = useState(posts);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [masked, setMasked] = useState<string[]>([]);
  const [comments, setComments] = useState<Record<string, string[]>>(SEED_COMMENTS);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [status, setStatus] = useState('');
  const [composer, setComposer] = useState(false);
  const [composerBody, setComposerBody] = useState('');
  const [composerTags, setComposerTags] = useState('');

  const savedCount = Object.values(saved).filter(Boolean).length;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return all.filter((post) => {
      if (masked.includes(post.author)) return false;
      const inFilter =
        filter === 'all' ||
        (filter === 'missions' && post.tag === 'Mission') ||
        (filter === 'network' && post.tag === 'Réseau') ||
        (filter === 'saved' && saved[post.author] === true);
      const matches =
        needle === '' ||
        `${post.author} ${post.body} ${post.hashtags.join(' ')}`.toLowerCase().includes(needle);
      return inFilter && matches;
    });
  }, [all, filter, masked, query, saved]);

  function publish() {
    const body = composerBody.trim();
    if (body.length < 10) {
      setStatus('Écris au moins une phrase avant de publier.');
      return;
    }
    const hashtags = composerTags
      .split(',')
      .map((tag) => tag.trim().replace(/^#/, ''))
      .filter((tag) => tag.length > 0)
      .map((tag) => `#${tag}`);
    setAll((current) => [
      {
        author: 'Brice Junguck',
        headline: 'Génie Civil · L3 · Douala',
        initials: 'BJ',
        time: 'à l’instant',
        tag: 'Réseau',
        body,
        hashtags,
        reactions: 0,
        comments: 0,
      },
      ...current,
    ]);
    setComposerBody('');
    setComposerTags('');
    setComposer(false);
    setFilter('all');
    setStatus('Publication ajoutée en tête du fil. Elle peut être masquée ou supprimée.');
  }

  function addComment(author: string) {
    const text = (draft[author] ?? '').trim();
    if (text === '') return;
    setComments((current) => ({ ...current, [author]: [...(current[author] ?? []), text] }));
    setDraft((current) => ({ ...current, [author]: '' }));
    setStatus('Commentaire ajouté. Il sera visible après le filtrage serveur.');
  }

  async function share(author: string) {
    const link = `${window.location.origin}/pro#${encodeURIComponent(author)}`;
    try {
      await navigator.clipboard.writeText(link);
      setStatus('Lien de la publication copié.');
    } catch {
      setStatus(`Lien à partager : ${link}`);
    }
  }

  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar
        title="Réseau Pro"
        eyebrow={savedCount > 0 ? `Fil · ${savedCount} enregistrée(s)` : 'Fil'}
        right={
          <Link
            href="/pro/messages"
            aria-label="Messages"
            className="relative flex h-11 w-11 items-center justify-center rounded-token border border-line"
          >
            <MessageCircle className="h-5 w-5" aria-hidden />
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 font-mono text-[10px] font-bold text-accent-ink">
              3
            </span>
          </Link>
        }
      />

      <Input
        label="Rechercher"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Un étudiant, une compétence, #hashtag"
      />

      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
            className={`min-h-11 flex-none rounded-full border px-4 text-sm font-semibold ${
              filter === item.id
                ? 'border-accent bg-accent text-accent-ink'
                : 'border-line text-ink'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {composer ? (
        <div className="flex flex-col gap-2 rounded-panel border border-accent/60 bg-surface p-3">
          <div className="flex items-center gap-2">
            <Avatar name="Brice Junguck" size="sm" />
            <span className="text-sm font-semibold">Nouvelle publication</span>
          </div>
          <label htmlFor="pro-composer" className="sr-only">
            Contenu de la publication
          </label>
          <textarea
            id="pro-composer"
            autoFocus
            value={composerBody}
            onChange={(event) => setComposerBody(event.target.value)}
            rows={4}
            maxLength={1200}
            placeholder="Projet, recherche de coéquipiers, retour d’expérience…"
            className="rounded-token border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus-visible:border-accent focus-visible:outline-none"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] text-muted">{composerBody.length} / 1200</span>
            <Link href="/pro/publier" className="text-xs font-semibold text-accent-text">
              Éditeur complet
            </Link>
          </div>
          <input
            value={composerTags}
            onChange={(event) => setComposerTags(event.target.value)}
            placeholder="Compétences, séparées par des virgules"
            aria-label="Compétences de la publication"
            className="min-h-11 rounded-token border border-line bg-bg px-3 text-sm text-ink placeholder:text-muted focus-visible:border-accent focus-visible:outline-none"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setComposer(false)}>
              Annuler
            </Button>
            <Button size="sm" block onClick={publish} disabled={composerBody.trim().length < 10}>
              Publier
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setComposer(true)}
          className="flex min-h-14 items-center gap-3 rounded-panel border border-dashed border-line px-3.5 text-left hover:border-accent"
        >
          <Avatar name="Brice Junguck" size="sm" />
          <span className="flex-1 text-sm text-muted">Partager un projet, une idée…</span>
          <Pencil className="h-4 w-4 text-accent-text" aria-hidden />
        </button>
      )}

      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          {filter === 'saved'
            ? 'Aucune publication enregistrée pour l’instant.'
            : 'Aucune publication ne correspond.'}
        </p>
      ) : null}

      {visible.map((post) => {
        const isLiked = liked[post.author] ?? false;
        const postComments = comments[post.author] ?? [];
        return (
          <article
            key={post.author}
            id={encodeURIComponent(post.author)}
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
              <Link
                href="/pro/profil"
                className="text-xs font-semibold text-accent-text"
                aria-label={`Profil de ${post.author}`}
              >
                Voir
              </Link>
            </div>

            <p className="text-sm leading-relaxed text-ink">{post.body}</p>
            <div className="flex flex-wrap gap-1.5">
              {post.hashtags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setQuery(tag.replace(/^#/, ''))}
                  className="text-xs font-semibold text-accent-text"
                >
                  {tag}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 border-t border-line pt-2 text-xs font-semibold text-muted">
              <button
                type="button"
                aria-pressed={isLiked}
                onClick={() => setLiked((current) => ({ ...current, [post.author]: !isLiked }))}
                className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 ${
                  isLiked ? 'text-accent-text' : ''
                }`}
              >
                <ThumbsUp className="h-4 w-4" aria-hidden /> {post.reactions + (isLiked ? 1 : 0)}
              </button>
              <button
                type="button"
                onClick={() => document.getElementById(`c-${post.author}`)?.focus()}
                className="flex min-h-11 flex-1 items-center justify-center gap-1.5"
              >
                <MessageCircle className="h-4 w-4" aria-hidden /> {postComments.length}
              </button>
              <button
                type="button"
                aria-pressed={saved[post.author] ?? false}
                aria-label={
                  saved[post.author]
                    ? 'Retirer des publications enregistrées'
                    : 'Enregistrer la publication'
                }
                onClick={() =>
                  setSaved((current) => ({ ...current, [post.author]: !current[post.author] }))
                }
                className={`flex min-h-11 w-11 items-center justify-center ${
                  saved[post.author] ? 'text-accent-text' : ''
                }`}
              >
                {saved[post.author] ? (
                  <BookmarkCheck className="h-4 w-4" aria-hidden />
                ) : (
                  <Bookmark className="h-4 w-4" aria-hidden />
                )}
              </button>
              <button
                type="button"
                aria-label="Masquer la publication"
                onClick={() => {
                  setMasked((current) => [...current, post.author]);
                  setStatus('Publication masquée. Elle reste accessible via son lien direct.');
                }}
                className="flex min-h-11 w-11 items-center justify-center"
              >
                <EyeOff className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Partager la publication"
                onClick={() => void share(post.author)}
                className="flex min-h-11 w-11 items-center justify-center"
              >
                <Share2 className="h-4 w-4" aria-hidden />
              </button>
            </div>

            {postComments.length > 0 ? (
              <ul className="flex flex-col gap-1.5 border-t border-line pt-2">
                {postComments.map((comment, index) => (
                  <li key={`${post.author}-${index}`} className="text-xs text-ink">
                    <span className="font-semibold">Toi · </span>
                    {comment}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label htmlFor={`c-${post.author}`} className="sr-only">
                  Commenter la publication de {post.author}
                </label>
                <input
                  id={`c-${post.author}`}
                  value={draft[post.author] ?? ''}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, [post.author]: event.target.value }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addComment(post.author);
                    }
                  }}
                  maxLength={280}
                  placeholder="Écrire un commentaire…"
                  className="min-h-11 w-full rounded-token border border-line bg-bg px-3 text-sm text-ink placeholder:text-muted focus-visible:border-accent focus-visible:outline-none"
                />
              </div>
              <Button size="sm" onClick={() => addComment(post.author)}>
                Envoyer
              </Button>
            </div>
          </article>
        );
      })}

      <p role="status" aria-live="polite" className={status ? 'text-xs text-ink' : 'sr-only'}>
        {status}
      </p>

      <Hint>
        Chaque publication peut être signalée depuis le menu du profil. Les invitations sont
        limitées par semaine ; aucun contact privé n’est affiché sans accord.
      </Hint>
    </div>
  );
}
