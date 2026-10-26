import { Inject, Injectable } from '@nestjs/common';
import type {
  Application,
  CreatePostInput,
  Post,
  PostSearchQuery,
  PutSkillsInput,
  UpdatePostInput,
} from '@conexa/contracts';
import { AppError, forbidden, notFound } from '@conexa/errors';
import { sql, type Selectable } from 'kysely';

import { db } from './db.js';
import type { PostsTable } from './db.js';
import { TALENTS_CLOCK } from './gateways.js';

type PostRow = Selectable<PostsTable>;

function toPost(row: PostRow, skillIds: number[]): Post {
  return {
    id: row.id,
    author_id: row.author_id,
    kind: row.kind,
    title: row.title,
    description: row.description,
    budget_fcfa: row.budget_fcfa,
    skill_ids: skillIds,
    status: row.status,
    boosted: row.boosted_until !== null && row.boosted_until > new Date(),
    created_at: row.created_at.toISOString(),
  };
}

@Injectable()
export class PostsService {
  constructor(@Inject(TALENTS_CLOCK) private readonly now: () => Date) {}

  // --- compétences -------------------------------------------------------

  async skills(query?: string) {
    let select = db.selectFrom('skills').selectAll();
    if (query) {
      select = select.where('name', 'ilike', `%${query}%`);
    }
    return select.orderBy('category', 'asc').orderBy('name', 'asc').limit(100).execute();
  }

  async putSkills(userId: string, input: PutSkillsInput): Promise<void> {
    const ids = input.skills.map((skill) => skill.skill_id);
    const known = await db.selectFrom('skills').select('id').where('id', 'in', ids).execute();
    if (known.length !== new Set(ids).size) {
      throw notFound('Compétence');
    }

    await db.transaction().execute(async (trx) => {
      await trx.deleteFrom('user_skills').where('user_id', '=', userId).execute();
      if (input.skills.length > 0) {
        await trx
          .insertInto('user_skills')
          .values(
            input.skills.map((skill) => ({
              user_id: userId,
              skill_id: skill.skill_id,
              level: skill.level,
              proof_url: skill.proof_url ?? null,
              updated_at: this.now(),
            })),
          )
          .execute();
      }
    });
  }

  async userSkills(userId: string) {
    return db
      .selectFrom('user_skills')
      .innerJoin('skills', 'skills.id', 'user_skills.skill_id')
      .select([
        'skills.id',
        'skills.name',
        'skills.category',
        'user_skills.level',
        'user_skills.proof_url',
      ])
      .where('user_skills.user_id', '=', userId)
      .orderBy('skills.name', 'asc')
      .execute();
  }

  // --- publications ------------------------------------------------------

  async createPost(userId: string, input: CreatePostInput): Promise<Post> {
    const now = this.now();
    const row = await db.transaction().execute(async (trx) => {
      const created = await trx
        .insertInto('posts')
        .values({
          author_id: userId,
          kind: input.kind,
          title: input.title,
          description: input.description,
          budget_fcfa: input.budget_fcfa ?? null,
          updated_at: now,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      if (input.skill_ids.length > 0) {
        await trx
          .insertInto('post_skills')
          .values(input.skill_ids.map((skillId) => ({ post_id: created.id, skill_id: skillId })))
          .onConflict((oc) => oc.doNothing())
          .execute();
      }
      return created;
    });

    return toPost(row, input.skill_ids);
  }

  async listPosts(
    userId: string,
    query: PostSearchQuery,
  ): Promise<{ data: Post[]; next_cursor: string | null }> {
    let select = db.selectFrom('posts').selectAll().where('status', '=', query.status);
    if (query.kind) {
      select = select.where('kind', '=', query.kind);
    }
    if (query.q) {
      select = select.where((eb) =>
        eb.or([eb('title', 'ilike', `%${query.q}%`), eb('description', 'ilike', `%${query.q}%`)]),
      );
    }
    if (query.mine) {
      select = select.where('author_id', '=', userId);
    }
    if (query.cursor) {
      select = select.where(
        'created_at',
        '<',
        new Date(Buffer.from(query.cursor, 'base64url').toString('utf8')),
      );
    }
    if (query.skill_id) {
      const matching = await db
        .selectFrom('post_skills')
        .select('post_id')
        .where('skill_id', '=', query.skill_id)
        .execute();
      select = select.where(
        'id',
        'in',
        matching.map((row) => row.post_id),
      );
    }

    const rows = await select
      .orderBy('created_at', 'desc')
      .limit(query.limit + 1)
      .execute();
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    const skills = await this.skillIdsFor(page.map((row) => row.id));

    return {
      data: page.map((row) => toPost(row, skills.get(row.id) ?? [])),
      next_cursor:
        rows.length > query.limit && last
          ? Buffer.from(last.created_at.toISOString(), 'utf8').toString('base64url')
          : null,
    };
  }

  async getPost(postId: string): Promise<Post> {
    const row = await db
      .selectFrom('posts')
      .selectAll()
      .where('id', '=', postId)
      .where('status', '!=', 'deleted')
      .executeTakeFirst();
    if (!row) {
      throw notFound('Publication');
    }
    const skills = await this.skillIdsFor([postId]);
    return toPost(row, skills.get(postId) ?? []);
  }

  async updatePost(userId: string, postId: string, input: UpdatePostInput): Promise<Post> {
    const row = await this.requireOpenPost(postId);
    if (row.author_id !== userId) {
      throw forbidden('Seul l’auteur modifie sa publication');
    }

    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable('posts')
        .set({
          ...(input.title === undefined ? {} : { title: input.title }),
          ...(input.description === undefined ? {} : { description: input.description }),
          ...(input.budget_fcfa === undefined ? {} : { budget_fcfa: input.budget_fcfa }),
          updated_at: this.now(),
        })
        .where('id', '=', postId)
        .execute();
      if (input.skill_ids) {
        await trx.deleteFrom('post_skills').where('post_id', '=', postId).execute();
        if (input.skill_ids.length > 0) {
          await trx
            .insertInto('post_skills')
            .values(input.skill_ids.map((skillId) => ({ post_id: postId, skill_id: skillId })))
            .onConflict((oc) => oc.doNothing())
            .execute();
        }
      }
    });

    return this.getPost(postId);
  }

  async setStatus(userId: string, postId: string, status: 'closed' | 'deleted'): Promise<void> {
    const row = await db
      .selectFrom('posts')
      .selectAll()
      .where('id', '=', postId)
      .executeTakeFirst();
    if (!row) {
      throw notFound('Publication');
    }
    if (row.author_id !== userId) {
      throw forbidden('Seul l’auteur clôt sa publication');
    }
    await db
      .updateTable('posts')
      .set({ status, updated_at: this.now() })
      .where('id', '=', postId)
      .execute();
  }

  // --- candidatures ------------------------------------------------------

  async apply(userId: string, postId: string, message?: string): Promise<Application> {
    const post = await this.requireOpenPost(postId);
    if (post.author_id === userId) {
      throw new AppError('INVALID_STATE', 'Tu ne peux pas candidater à ta publication');
    }

    const row = await db
      .insertInto('post_applications')
      .values({ post_id: postId, applicant_id: userId, message: message ?? null })
      .onConflict((oc) => oc.doNothing())
      .returningAll()
      .executeTakeFirst();
    if (!row) {
      throw new AppError('INVALID_STATE', 'Candidature déjà envoyée');
    }
    return toApplication(row);
  }

  async applications(userId: string, postId: string): Promise<Application[]> {
    const post = await db
      .selectFrom('posts')
      .select('author_id')
      .where('id', '=', postId)
      .executeTakeFirst();
    if (!post) {
      throw notFound('Publication');
    }
    if (post.author_id !== userId) {
      throw forbidden('Seul l’auteur voit les candidatures');
    }
    const rows = await db
      .selectFrom('post_applications')
      .selectAll()
      .where('post_id', '=', postId)
      .orderBy('created_at', 'asc')
      .execute();
    return rows.map(toApplication);
  }

  async resolveApplication(userId: string, applicationId: string, accept: boolean): Promise<void> {
    const application = await db
      .selectFrom('post_applications')
      .innerJoin('posts', 'posts.id', 'post_applications.post_id')
      .select(['post_applications.id', 'posts.author_id', 'post_applications.status'])
      .where('post_applications.id', '=', applicationId)
      .executeTakeFirst();
    if (!application) {
      throw notFound('Candidature');
    }
    if (application.author_id !== userId) {
      throw forbidden('Seul l’auteur accepte ou refuse');
    }
    if (application.status !== 'pending') {
      throw new AppError('INVALID_STATE', 'Candidature déjà traitée');
    }
    await db
      .updateTable('post_applications')
      .set({ status: accept ? 'accepted' : 'declined', resolved_at: this.now() })
      .where('id', '=', applicationId)
      .execute();
  }

  async withdrawApplication(userId: string, applicationId: string): Promise<void> {
    const result = await db
      .updateTable('post_applications')
      .set({ status: 'withdrawn', resolved_at: this.now() })
      .where('id', '=', applicationId)
      .where('applicant_id', '=', userId)
      .where('status', '=', 'pending')
      .executeTakeFirst();
    if (Number(result.numUpdatedRows) === 0) {
      throw notFound('Candidature');
    }
  }

  /** Suggestions par compétences : aucune donnée d'identité n'est exposée ici. */
  async suggestedUsers(userId: string, postId: string) {
    const post = await db
      .selectFrom('posts')
      .select('author_id')
      .where('id', '=', postId)
      .executeTakeFirst();
    if (!post) {
      throw notFound('Publication');
    }
    if (post.author_id !== userId) {
      throw forbidden('Seul l’auteur voit les suggestions');
    }
    const rows = await db
      .selectFrom('post_skills')
      .innerJoin('user_skills', 'user_skills.skill_id', 'post_skills.skill_id')
      .select([
        'user_skills.user_id',
        sql<number>`count(*)::int`.as('matching_skills'),
        sql<number>`max(user_skills.level)::int`.as('best_level'),
      ])
      .where('post_skills.post_id', '=', postId)
      .where('user_skills.user_id', '!=', userId)
      .groupBy('user_skills.user_id')
      .orderBy('matching_skills', 'desc')
      .orderBy('best_level', 'desc')
      .limit(10)
      .execute();
    return rows;
  }

  // --- internes ----------------------------------------------------------

  private async requireOpenPost(postId: string): Promise<PostRow> {
    const row = await db
      .selectFrom('posts')
      .selectAll()
      .where('id', '=', postId)
      .executeTakeFirst();
    if (!row || row.status === 'deleted') {
      throw notFound('Publication');
    }
    if (row.status !== 'open') {
      throw new AppError('INVALID_STATE', 'Cette publication est clôturée');
    }
    return row;
  }

  private async skillIdsFor(postIds: string[]): Promise<Map<string, number[]>> {
    const map = new Map<string, number[]>();
    if (postIds.length === 0) {
      return map;
    }
    const rows = await db
      .selectFrom('post_skills')
      .selectAll()
      .where('post_id', 'in', postIds)
      .execute();
    for (const row of rows) {
      map.set(row.post_id, [...(map.get(row.post_id) ?? []), row.skill_id]);
    }
    return map;
  }
}

function toApplication(row: {
  id: string;
  post_id: string;
  applicant_id: string;
  message: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'withdrawn';
  created_at: Date;
}): Application {
  return {
    id: row.id,
    post_id: row.post_id,
    applicant_id: row.applicant_id,
    message: row.message,
    status: row.status,
    created_at: row.created_at.toISOString(),
  };
}
