import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginInput, type User } from '../schema';
import { eq } from 'drizzle-orm';
import { createHash, timingSafeEqual } from 'crypto';

// Simple password hashing function using Node.js crypto
const hashPassword = (password: string, salt: string): string => {
  return createHash('sha256').update(password + salt).digest('hex');
};

// Verify password against stored hash
const verifyPassword = (password: string, storedHash: string): boolean => {
  try {
    // Extract salt from stored hash (assuming format: salt:hash)
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) {
      return false;
    }
    
    const computedHash = hashPassword(password, salt);
    
    // Use timing-safe comparison to prevent timing attacks
    return timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(computedHash, 'hex')
    );
  } catch (error) {
    return false;
  }
};

export const authenticateUser = async (input: LoginInput): Promise<User | null> => {
  try {
    // Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (users.length === 0) {
      return null; // User not found
    }

    const user = users[0];

    // Check if user is active
    if (!user.is_active) {
      return null; // User is inactive
    }

    // Verify password
    const isPasswordValid = verifyPassword(input.password, user.password_hash);
    
    if (!isPasswordValid) {
      return null; // Invalid password
    }

    // Return user data
    return {
      id: user.id,
      email: user.email,
      password_hash: user.password_hash,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      restaurant_id: user.restaurant_id,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
  } catch (error) {
    console.error('Authentication failed:', error);
    throw error;
  }
};