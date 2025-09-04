import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { permissionsTable, rolePermissionsTable } from '../db/schema';
import { type UserRole } from '../schema';
import { getPermissionsByRole, getAllPermissions, getRolePermissions } from '../handlers/get_permissions';

describe('get_permissions handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('getAllPermissions', () => {
    it('should return empty array when no permissions exist', async () => {
      const result = await getAllPermissions();
      expect(result).toEqual([]);
    });

    it('should return all permissions', async () => {
      // Create test permissions
      const permissions = [
        {
          name: 'read_customers',
          description: 'Can view customer information',
          resource: 'customers',
          action: 'read'
        },
        {
          name: 'write_customers', 
          description: 'Can create and update customers',
          resource: 'customers',
          action: 'write'
        },
        {
          name: 'read_staff',
          description: 'Can view staff information',
          resource: 'staff',
          action: 'read'
        }
      ];

      const createdPermissions = await db.insert(permissionsTable)
        .values(permissions)
        .returning()
        .execute();

      const result = await getAllPermissions();

      expect(result).toHaveLength(3);
      expect(result[0].name).toEqual('read_customers');
      expect(result[0].resource).toEqual('customers');
      expect(result[0].action).toEqual('read');
      expect(result[0].id).toBeDefined();
      expect(result[0].created_at).toBeInstanceOf(Date);

      // Verify all permissions are returned
      const names = result.map(p => p.name).sort();
      expect(names).toEqual(['read_customers', 'read_staff', 'write_customers']);
    });
  });

  describe('getRolePermissions', () => {
    it('should return empty array when no role permissions exist', async () => {
      const result = await getRolePermissions();
      expect(result).toEqual([]);
    });

    it('should return all role permission mappings', async () => {
      // Create test permissions first
      const permissions = await db.insert(permissionsTable)
        .values([
          {
            name: 'read_customers',
            description: 'Can view customer information',
            resource: 'customers',
            action: 'read'
          },
          {
            name: 'write_customers',
            description: 'Can create and update customers', 
            resource: 'customers',
            action: 'write'
          }
        ])
        .returning()
        .execute();

      // Create role permission mappings
      const rolePermissions = [
        {
          role: 'STAFF' as UserRole,
          permission_id: permissions[0].id
        },
        {
          role: 'MANAGER' as UserRole,
          permission_id: permissions[0].id
        },
        {
          role: 'MANAGER' as UserRole,
          permission_id: permissions[1].id
        }
      ];

      await db.insert(rolePermissionsTable)
        .values(rolePermissions)
        .execute();

      const result = await getRolePermissions();

      expect(result).toHaveLength(3);
      expect(result[0].role).toEqual('STAFF');
      expect(result[0].permission_id).toEqual(permissions[0].id);
      expect(result[0].id).toBeDefined();
      expect(result[0].created_at).toBeInstanceOf(Date);

      // Verify all role-permission mappings are returned
      const roles = result.map(rp => rp.role).sort();
      expect(roles).toEqual(['MANAGER', 'MANAGER', 'STAFF']);
    });
  });

  describe('getPermissionsByRole', () => {
    it('should return empty array when role has no permissions', async () => {
      // Create permission but don't assign to role
      await db.insert(permissionsTable)
        .values({
          name: 'read_customers',
          description: 'Can view customer information',
          resource: 'customers',
          action: 'read'
        })
        .execute();

      const result = await getPermissionsByRole('STAFF');
      expect(result).toEqual([]);
    });

    it('should return permissions for a specific role', async () => {
      // Create test permissions
      const permissions = await db.insert(permissionsTable)
        .values([
          {
            name: 'read_customers',
            description: 'Can view customer information',
            resource: 'customers',
            action: 'read'
          },
          {
            name: 'write_customers',
            description: 'Can create and update customers',
            resource: 'customers', 
            action: 'write'
          },
          {
            name: 'read_staff',
            description: 'Can view staff information',
            resource: 'staff',
            action: 'read'
          }
        ])
        .returning()
        .execute();

      // Assign permissions to MANAGER role
      await db.insert(rolePermissionsTable)
        .values([
          {
            role: 'MANAGER',
            permission_id: permissions[0].id
          },
          {
            role: 'MANAGER',
            permission_id: permissions[1].id
          }
        ])
        .execute();

      // Assign one permission to STAFF role
      await db.insert(rolePermissionsTable)
        .values({
          role: 'STAFF',
          permission_id: permissions[0].id
        })
        .execute();

      const managerResult = await getPermissionsByRole('MANAGER');
      const staffResult = await getPermissionsByRole('STAFF');

      // Verify MANAGER has 2 permissions
      expect(managerResult).toHaveLength(2);
      const managerNames = managerResult.map(p => p.name).sort();
      expect(managerNames).toEqual(['read_customers', 'write_customers']);

      // Verify permission structure
      expect(managerResult[0].id).toBeDefined();
      expect(managerResult[0].resource).toEqual('customers');
      expect(managerResult[0].created_at).toBeInstanceOf(Date);

      // Verify STAFF has 1 permission
      expect(staffResult).toHaveLength(1);
      expect(staffResult[0].name).toEqual('read_customers');
      expect(staffResult[0].action).toEqual('read');
    });

    it('should work with all user roles', async () => {
      // Create a permission
      const permission = await db.insert(permissionsTable)
        .values({
          name: 'manage_settings',
          description: 'Can manage system settings',
          resource: 'settings',
          action: 'write'
        })
        .returning()
        .execute();

      // Test each role type
      const roles: UserRole[] = ['SUPER_ADMIN', 'RESTAURANT_OWNER', 'MANAGER', 'STAFF'];
      
      // Assign permission to SUPER_ADMIN only
      await db.insert(rolePermissionsTable)
        .values({
          role: 'SUPER_ADMIN',
          permission_id: permission[0].id
        })
        .execute();

      for (const role of roles) {
        const result = await getPermissionsByRole(role);
        
        if (role === 'SUPER_ADMIN') {
          expect(result).toHaveLength(1);
          expect(result[0].name).toEqual('manage_settings');
        } else {
          expect(result).toEqual([]);
        }
      }
    });
  });
});