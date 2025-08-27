import { pgTable, uuid, varchar, text, timestamp, integer, boolean } from 'drizzle-orm/pg-core';
import { usersTable } from './user.model';

export const urlsTable = pgTable('urls', {
    id: uuid().primaryKey().defaultRandom(),
    
    originalUrl: text('original_url').notNull(),
    shortCode: varchar('short_code', { length: 10 }).notNull().unique(),
    
    userId: uuid('user_id')
        .references(() => usersTable.id, { onDelete: 'cascade' })
        .notNull(),
    
    clicks: integer().notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
