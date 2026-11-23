import type { Category, CategoryInput } from '@shared';
import { badRequest, conflict, notFound } from '../../types/errors';
import { isUniqueViolation } from '../../types/pg';
import * as repo from './categories.repo';

const DUPLICATE_NAME = { name: 'A category with that name already exists' };

function normalise(input: CategoryInput) {
  return {
    name: input.name,
    description: input.description ? input.description : null,
  };
}

export function list(): Promise<Category[]> {
  return repo.findAll();
}

export async function get(id: number): Promise<Category> {
  const category = await repo.findById(id);
  if (!category) throw notFound('That category does not exist.');
  return category;
}

export async function create(input: CategoryInput): Promise<Category> {
  try {
    const id = await repo.insert(normalise(input));
    return await get(id);
  } catch (error) {
    // §9: category names are unique. The database is the authority — checking
    // first and inserting after would leave a race between the two.
    if (isUniqueViolation(error)) {
      throw badRequest('Please correct the highlighted fields.', DUPLICATE_NAME);
    }
    throw error;
  }
}

export async function update(id: number, input: CategoryInput): Promise<Category> {
  await get(id);
  try {
    await repo.update(id, normalise(input));
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw badRequest('Please correct the highlighted fields.', DUPLICATE_NAME);
    }
    throw error;
  }
  return get(id);
}

/**
 * BR12 — a category referenced by any product cannot be deleted. Reported as a
 * 409 with the count, so the message can say what is actually blocking it.
 */
export async function remove(id: number): Promise<void> {
  const category = await get(id);
  const inUse = await repo.countProductsUsing(id);

  if (inUse > 0) {
    throw conflict(
      `“${category.name}” is used by ${inUse} product${inUse === 1 ? '' : 's'} and cannot be deleted. Move those products to another category first.`
    );
  }

  await repo.remove(id);
}
