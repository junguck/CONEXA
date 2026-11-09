import { Injectable } from '@nestjs/common';
import type {
  Agreement,
  CommissionSnapshot,
  JwtClaims,
  ProposeAgreementInput,
} from '@conexa/contracts';
import { forbidden, invalidState, notFound } from '@conexa/errors';
import { randomUUID } from 'node:crypto';

import { canPropose, canSign, nextVersion, snapshotCommission } from './agreements.rules.js';
import { db } from './db.js';

type Row = {
  id: string;
  organisation_id: string;
  version: number;
  commission_pct: number;
  status: 'pending_signature' | 'active' | 'superseded';
  created_at: Date;
  signed_at: Date | null;
};

function toAgreement(row: Row): Agreement {
  return {
    id: row.id,
    organisation_id: row.organisation_id,
    version: row.version,
    commission_pct: row.commission_pct,
    status: row.status,
    created_at: row.created_at.toISOString(),
    signed_at: row.signed_at ? row.signed_at.toISOString() : null,
  };
}

const COLUMNS = [
  'id',
  'organisation_id',
  'version',
  'commission_pct',
  'status',
  'created_at',
  'signed_at',
] as const;

/** Contrats partenaires versionnés : un seul actif, commission figée à la réservation. */
@Injectable()
export class AgreementsService {
  async list(user: JwtClaims, organisationId: string): Promise<Agreement[]> {
    await this.assertOwnerOrAdmin(user, organisationId);
    const rows = await db
      .selectFrom('agreements')
      .select([...COLUMNS])
      .where('organisation_id', '=', organisationId)
      .orderBy('version', 'desc')
      .execute();
    return rows.map(toAgreement);
  }

  /** L'administration propose ; le verrou sur l'organisation sérialise les propositions. */
  async propose(organisationId: string, input: ProposeAgreementInput): Promise<Agreement> {
    return db.transaction().execute(async (trx) => {
      const organisation = await trx
        .selectFrom('organisations')
        .select(['id', 'status'])
        .where('id', '=', organisationId)
        .forUpdate()
        .executeTakeFirst();
      if (!organisation) throw notFound('Organisation');
      if (organisation.status === 'suspended') {
        throw invalidState('Organisation suspendue : aucun contrat ne peut être proposé');
      }
      const existing = await trx
        .selectFrom('agreements')
        .select(['version', 'status'])
        .where('organisation_id', '=', organisationId)
        .execute();
      if (!canPropose(existing)) {
        throw invalidState('Un contrat est déjà en attente de signature');
      }
      const row = await trx
        .insertInto('agreements')
        .values({
          id: randomUUID(),
          organisation_id: organisationId,
          version: nextVersion(existing),
          commission_pct: input.commission_pct,
          status: 'pending_signature',
        })
        .returning([...COLUMNS])
        .executeTakeFirstOrThrow();
      return toAgreement(row);
    });
  }

  /** Le propriétaire signe : l'ancien contrat actif est remplacé dans la même transaction. */
  async sign(user: JwtClaims, agreementId: string): Promise<Agreement> {
    return db.transaction().execute(async (trx) => {
      const found = await trx
        .selectFrom('agreements')
        .select(['organisation_id'])
        .where('id', '=', agreementId)
        .executeTakeFirst();
      if (!found) throw notFound('Contrat');

      const organisation = await trx
        .selectFrom('organisations')
        .select(['id', 'owner_user_id'])
        .where('id', '=', found.organisation_id)
        .forUpdate()
        .executeTakeFirstOrThrow();
      if (organisation.owner_user_id !== user.sub) {
        throw forbidden('Ce contrat appartient à une autre organisation');
      }

      const agreement = await trx
        .selectFrom('agreements')
        .select([...COLUMNS])
        .where('id', '=', agreementId)
        .executeTakeFirstOrThrow();
      if (!canSign(agreement.status)) {
        throw invalidState('Ce contrat ne peut plus être signé');
      }

      const now = new Date();
      await trx
        .updateTable('agreements')
        .set({ status: 'superseded' })
        .where('organisation_id', '=', agreement.organisation_id)
        .where('status', '=', 'active')
        .execute();
      const signed = await trx
        .updateTable('agreements')
        .set({ status: 'active', signed_at: now, signed_by: user.sub })
        .where('id', '=', agreementId)
        .returning([...COLUMNS])
        .executeTakeFirstOrThrow();
      return toAgreement(signed);
    });
  }

  /** Instantané remis à la saga : la commission d'une réservation ne change plus ensuite. */
  async commissionForVenue(venueId: string): Promise<CommissionSnapshot> {
    const row = await db
      .selectFrom('venues')
      .innerJoin('agreements', 'agreements.organisation_id', 'venues.organisation_id')
      .select([
        'agreements.id as id',
        'agreements.version as version',
        'agreements.commission_pct as commission_pct',
        'agreements.status as status',
      ])
      .where('venues.id', '=', venueId)
      .where('agreements.status', '=', 'active')
      .executeTakeFirst();
    const pct = snapshotCommission(row);
    if (!row || pct === null) {
      throw invalidState('Aucun contrat actif pour ce lieu');
    }
    return { agreement_id: row.id, version: row.version, commission_pct: pct };
  }

  private async assertOwnerOrAdmin(user: JwtClaims, organisationId: string): Promise<void> {
    const row = await db
      .selectFrom('organisations')
      .select(['owner_user_id'])
      .where('id', '=', organisationId)
      .executeTakeFirst();
    if (!row) throw notFound('Organisation');
    if (row.owner_user_id !== user.sub && !user.roles.includes('admin')) {
      throw forbidden('Cette organisation appartient à un autre partenaire');
    }
  }
}
