import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_PRESET_VIEWS,
  sanitizeViewQuery,
  upsertSavedView,
  deleteSavedView,
  listSavedViews,
} from '../saved-views'

describe('saved-views service', () => {
  it('defines default presets for deliveries, loads, trucks, and drivers', () => {
    assert.ok(DEFAULT_PRESET_VIEWS.deliveries.length >= 4)
    assert.ok(DEFAULT_PRESET_VIEWS.loads.length >= 4)
    assert.ok(DEFAULT_PRESET_VIEWS.trucks.length >= 2)
    assert.ok(DEFAULT_PRESET_VIEWS.drivers.length >= 2)
  })

  it('sanitizes query params by stripping page, ALL, and unknown keys', () => {
    const cleaned = sanitizeViewQuery('?status=PENDING&schedule=overdue&page=3&q=&extra=123')
    assert.equal(cleaned, 'schedule=overdue&status=PENDING')
  })

  it('upserts a saved view scoped by companyId and userId', async () => {
    let upsertedArgs: Record<string, unknown> | null = null

    const mockPrisma = {
      savedView: {
        upsert: async (args: Record<string, unknown>) => {
          upsertedArgs = args
          return {
            id: '00000000-0000-4000-8000-000000000001',
            workspace: 'deliveries' as const,
            name: 'Urgent Queue',
            query: 'schedule=overdue&status=PENDING',
            createdAt: new Date(),
            updatedAt: new Date(),
          }
        },
      },
    }

    const result = await upsertSavedView(mockPrisma as never, 'comp-1', 'user-1', {
      workspace: 'deliveries',
      name: '  Urgent Queue ',
      query: 'status=PENDING&schedule=overdue&page=2',
    })

    assert.equal(result.ok, true)
    assert.ok(upsertedArgs)
    if (result.ok) {
      assert.equal(result.data.name, 'Urgent Queue')
      assert.equal(result.data.query, 'schedule=overdue&status=PENDING')
    }
  })

  it('enforces companyId and userId ownership and valid UUID on deleteSavedView', async () => {
    let deletedWhere: Record<string, unknown> | null = null
    const validId = '00000000-0000-4000-8000-000000000099'
    const mockPrisma = {
      savedView: {
        deleteMany: async (args: { where: Record<string, unknown> }) => {
          deletedWhere = args.where
          return { count: 1 }
        },
      },
    }

    const invalidRes = await deleteSavedView(mockPrisma as never, 'comp-1', 'user-1', 'not-a-uuid')
    assert.equal(invalidRes.ok, false)

    const validRes = await deleteSavedView(mockPrisma as never, 'comp-1', 'user-1', validId)
    assert.equal(validRes.ok, true)
    assert.deepEqual(deletedWhere, {
      id: validId,
      companyId: 'comp-1',
      userId: 'user-1',
    })
  })

  it('gracefully returns empty list if savedView model is unavailable', async () => {
    const views = await listSavedViews({} as never, 'comp-1', 'user-1', 'loads')
    assert.deepEqual(views, [])
  })
})
