import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type User } from '../schema';
import { createHash, randomBytes } from 'crypto';

export const createUser = async (input: CreateUserInput): Promise<User> => {
  try {
    // Hash the password with salt using Node.js crypto
    const salt = randomBytes(16).toString('hex');
    const password_hash = createHash('sha256').update(input.password + salt).digest('hex') + ':' + salt;

    // Insert user record
    const result = await db.insert(usersTable)
      .values({
        email: input.email,
        password_hash: password_hash,
        first_name: input.first_name,
        last_name: input.last_name,
        role: input.role || 'STAFF', // Default to STAFF if not provided
        restaurant_id: input.restaurant_id || null, // Super admins won't have restaurant_id
        is_active: true, // Default to active
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('User creation failed:', error);
    throw error;
  }
};