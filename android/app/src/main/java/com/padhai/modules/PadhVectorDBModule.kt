package com.padhai.modules

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.util.Log
import com.facebook.react.bridge.*
import org.json.JSONObject

/**
 * PadhMemoryDB — Hierarchical memory store for PadhMemoir.
 *
 * Replaces the flat FTS4 MemorySnippets table with a structured
 * MemoryNodes table that supports:
 *   - Path-based storage (dot-notation taxonomy paths)
 *   - O(log n) prefix lookups via indexed path column
 *   - FTS5 full-text search on content
 *   - Aggregation / condensation of memories per node
 *
 * Inspired by zhangfengcdt/memoir ProllyTreeStore, adapted for
 * on-device Android SQLite.
 */

private const val TAG = "PadhMemoryDB"
private const val DB_NAME = "PadhMemory.db"
private const val DB_VERSION = 4 // Bumped: FTS5→FTS4 for device compatibility

class PadhMemoryDBHelper(context: Context) : SQLiteOpenHelper(context, DB_NAME, null, DB_VERSION) {

    override fun onCreate(db: SQLiteDatabase) {
        // Core hierarchical memory table
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS MemoryNodes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT NOT NULL,
                content TEXT NOT NULL,
                summary TEXT,
                confidence REAL DEFAULT 1.0,
                count INTEGER DEFAULT 1,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
        """)

        // Signatures table for SigMap (Project Context)
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS Signatures (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT NOT NULL,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                params TEXT,
                return_type TEXT,
                line_number INTEGER,
                updated_at INTEGER NOT NULL
            )
        """)

        // Index for SigMap file path lookups
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_sig_path ON Signatures(file_path)")
        // Unique constraint on file_path+name+type to prevent duplicates
        db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS idx_sig_unique ON Signatures(file_path, name, type)")

        // Index for O(log n) prefix lookups — the core memoir pattern
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_memory_path ON MemoryNodes(path)")
        // Unique constraint on path+content to prevent exact duplicates
        db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_unique ON MemoryNodes(path, content)")

        // FTS4 for content search (FTS5 not available on all Android SQLite builds)
        db.execSQL("""
            CREATE VIRTUAL TABLE IF NOT EXISTS MemoryNodesFTS USING fts4(
                path, content, summary,
                content=MemoryNodes
            )
        """)

        // Triggers to keep FTS5 in sync with MemoryNodes
        db.execSQL("""
            CREATE TRIGGER IF NOT EXISTS memory_ai AFTER INSERT ON MemoryNodes BEGIN
                INSERT INTO MemoryNodesFTS(rowid, path, content, summary)
                VALUES (new.id, new.path, new.content, new.summary);
            END
        """)
        db.execSQL("""
            CREATE TRIGGER IF NOT EXISTS memory_ad AFTER DELETE ON MemoryNodes BEGIN
                DELETE FROM MemoryNodesFTS WHERE docid = old.id;
            END
        """)
        db.execSQL("""
            CREATE TRIGGER IF NOT EXISTS memory_au AFTER UPDATE ON MemoryNodes BEGIN
                DELETE FROM MemoryNodesFTS WHERE docid = old.id;
                INSERT INTO MemoryNodesFTS(docid, path, content, summary)
                VALUES (new.id, new.path, new.content, new.summary);
            END
        """)

        // Keep the legacy table for backward compatibility (existing cheatsheets)
        db.execSQL("""
            CREATE VIRTUAL TABLE IF NOT EXISTS MemorySnippets USING fts4(
                topic TEXT,
                content TEXT,
                metadata TEXT
            )
        """)

        Log.i(TAG, "Database created with MemoryNodes (v$DB_VERSION)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if (oldVersion < 4) {
            Log.i(TAG, "Upgrading from v$oldVersion to v$newVersion — rebuilding FTS for compatibility")
            // Drop FTS5 tables/triggers that may have failed to create
            try { db.execSQL("DROP TABLE IF EXISTS MemoryNodesFTS") } catch (_: Exception) {}
            try { db.execSQL("DROP TRIGGER IF EXISTS memory_ai") } catch (_: Exception) {}
            try { db.execSQL("DROP TRIGGER IF EXISTS memory_ad") } catch (_: Exception) {}
            try { db.execSQL("DROP TRIGGER IF EXISTS memory_au") } catch (_: Exception) {}
            // Recreate with FTS4
            onCreate(db)
        }
    }
}

class PadhVectorDBModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private val dbHelper = PadhMemoryDBHelper(reactContext)

    override fun getName(): String {
        return "PadhVectorDB"
    }

    // ═══════════════════════════════════════════════════════════════
    // NEW: Hierarchical Memory Node Methods
    // ═══════════════════════════════════════════════════════════════

    /**
     * Upsert a memory node at a taxonomy path.
     * If the exact path+content pair exists, updates confidence and timestamp.
     * Otherwise inserts a new row.
     *
     * Memoir equivalent: ProllyTreeStore.store_memory_async()
     */
    @ReactMethod
    fun upsertNode(path: String, content: String, confidence: Double, promise: Promise) {
        try {
            val db = dbHelper.writableDatabase
            val now = System.currentTimeMillis()

            // Check if this exact path+content already exists
            val cursor = db.rawQuery(
                "SELECT id, count FROM MemoryNodes WHERE path = ? AND content = ?",
                arrayOf(path, content)
            )

            if (cursor.moveToFirst()) {
                // Update existing: bump count and confidence
                val id = cursor.getLong(0)
                val currentCount = cursor.getInt(1)
                cursor.close()

                val values = ContentValues().apply {
                    put("confidence", confidence)
                    put("count", currentCount + 1)
                    put("updated_at", now)
                }
                db.update("MemoryNodes", values, "id = ?", arrayOf(id.toString()))
                Log.d(TAG, "Updated node: $path (count=${currentCount + 1})")
            } else {
                cursor.close()
                // Insert new node
                val values = ContentValues().apply {
                    put("path", path)
                    put("content", content)
                    put("confidence", confidence)
                    put("count", 1)
                    put("created_at", now)
                    put("updated_at", now)
                }
                db.insertWithOnConflict("MemoryNodes", null, values, SQLiteDatabase.CONFLICT_IGNORE)
                Log.d(TAG, "Inserted node: $path")
            }
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "upsertNode failed: ${e.message}")
            promise.reject("MEMOIR_ERROR", e.message)
        }
    }

    /**
     * Get all memory nodes that match a path prefix.
     * Uses the indexed path column for O(log n) lookups.
     *
     * Memoir equivalent: ProllyTreeStore.search() with namespace prefix
     */
    @ReactMethod
    fun getByPrefix(prefix: String, limit: Int, promise: Promise) {
        try {
            val db = dbHelper.readableDatabase
            val cursor = db.rawQuery(
                """SELECT path, content, summary, confidence, count, created_at, updated_at
                   FROM MemoryNodes
                   WHERE path = ? OR path LIKE ?
                   ORDER BY confidence DESC, updated_at DESC
                   LIMIT ?""",
                arrayOf(prefix, "$prefix.%", limit.toString())
            )

            val results = Arguments.createArray()
            while (cursor.moveToNext()) {
                val node = Arguments.createMap().apply {
                    putString("path", cursor.getString(0))
                    putString("content", cursor.getString(1))
                    putString("summary", cursor.getString(2) ?: "")
                    putDouble("confidence", cursor.getDouble(3))
                    putInt("count", cursor.getInt(4))
                    putDouble("createdAt", cursor.getLong(5).toDouble())
                    putDouble("updatedAt", cursor.getLong(6).toDouble())
                }
                results.pushMap(node)
            }
            cursor.close()
            Log.d(TAG, "getByPrefix($prefix): ${results.size()} results")
            promise.resolve(results)
        } catch (e: Exception) {
            Log.e(TAG, "getByPrefix failed: ${e.message}")
            promise.reject("MEMOIR_ERROR", e.message)
        }
    }

    /**
     * Get the most recent / highest-confidence node at an exact path.
     *
     * Memoir equivalent: ProllyTreeStore.get()
     */
    @ReactMethod
    fun getByPath(path: String, promise: Promise) {
        try {
            val db = dbHelper.readableDatabase
            val cursor = db.rawQuery(
                """SELECT path, content, summary, confidence, count, created_at, updated_at
                   FROM MemoryNodes
                   WHERE path = ?
                   ORDER BY confidence DESC, updated_at DESC
                   LIMIT 1""",
                arrayOf(path)
            )

            if (cursor.moveToFirst()) {
                val node = Arguments.createMap().apply {
                    putString("path", cursor.getString(0))
                    putString("content", cursor.getString(1))
                    putString("summary", cursor.getString(2) ?: "")
                    putDouble("confidence", cursor.getDouble(3))
                    putInt("count", cursor.getInt(4))
                    putDouble("createdAt", cursor.getLong(5).toDouble())
                    putDouble("updatedAt", cursor.getLong(6).toDouble())
                }
                cursor.close()
                promise.resolve(node)
            } else {
                cursor.close()
                promise.resolve(null)
            }
        } catch (e: Exception) {
            Log.e(TAG, "getByPath failed: ${e.message}")
            promise.reject("MEMOIR_ERROR", e.message)
        }
    }

    /**
     * Get an aggregated summary of all memories under a prefix.
     * Returns { path, nodeCount, totalMemories, topContent[] }.
     *
     * Memoir equivalent: AggregatedMemory pattern
     */
    @ReactMethod
    fun getAggregatedSummary(prefix: String, limit: Int, promise: Promise) {
        try {
            val db = dbHelper.readableDatabase

            // Count stats
            val statsCursor = db.rawQuery(
                """SELECT COUNT(DISTINCT path), SUM(count)
                   FROM MemoryNodes
                   WHERE path = ? OR path LIKE ?""",
                arrayOf(prefix, "$prefix.%")
            )

            val result = Arguments.createMap()
            if (statsCursor.moveToFirst()) {
                result.putInt("nodeCount", statsCursor.getInt(0))
                result.putInt("totalMemories", statsCursor.getInt(1))
            }
            statsCursor.close()

            // Get top content items (by confidence * recency)
            val contentCursor = db.rawQuery(
                """SELECT path, COALESCE(summary, content) as display_content, confidence
                   FROM MemoryNodes
                   WHERE path = ? OR path LIKE ?
                   ORDER BY confidence DESC, updated_at DESC
                   LIMIT ?""",
                arrayOf(prefix, "$prefix.%", limit.toString())
            )

            val items = Arguments.createArray()
            while (contentCursor.moveToNext()) {
                val item = Arguments.createMap().apply {
                    putString("path", contentCursor.getString(0))
                    putString("content", contentCursor.getString(1))
                    putDouble("confidence", contentCursor.getDouble(2))
                }
                items.pushMap(item)
            }
            contentCursor.close()

            result.putString("prefix", prefix)
            result.putArray("topContent", items)
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "getAggregatedSummary failed: ${e.message}")
            promise.reject("MEMOIR_ERROR", e.message)
        }
    }

    /**
     * Condense memories at a specific path: merge all content entries
     * into a single summary, keeping only the latest N entries.
     *
     * Memoir equivalent: aggregation at semantic paths
     */
    @ReactMethod
    fun condenseNode(path: String, keepCount: Int, promise: Promise) {
        try {
            val db = dbHelper.writableDatabase
            db.beginTransaction()
            try {
                // Get all entries at this exact path, ordered by recency
                val cursor = db.rawQuery(
                    """SELECT id, content, confidence FROM MemoryNodes
                       WHERE path = ?
                       ORDER BY updated_at DESC""",
                    arrayOf(path)
                )

                val allEntries = mutableListOf<Triple<Long, String, Double>>()
                while (cursor.moveToNext()) {
                    allEntries.add(Triple(cursor.getLong(0), cursor.getString(1), cursor.getDouble(2)))
                }
                cursor.close()

                if (allEntries.size <= keepCount) {
                    // Nothing to condense
                    db.setTransactionSuccessful()
                    promise.resolve(false)
                    return
                }

                // Keep the latest `keepCount` entries, condense the rest into summary
                val toKeep = allEntries.take(keepCount)
                val toCondense = allEntries.drop(keepCount)

                // Build summary from condensed entries
                val summaryParts = toCondense.map { it.second }.distinct()
                val condensedSummary = summaryParts.joinToString(" | ") { it.take(80) }

                // Delete old entries
                val idsToDelete = toCondense.map { it.first }
                if (idsToDelete.isNotEmpty()) {
                    val placeholders = idsToDelete.joinToString(",") { "?" }
                    db.execSQL(
                        "DELETE FROM MemoryNodes WHERE id IN ($placeholders)",
                        idsToDelete.map { it.toString() }.toTypedArray()
                    )
                }

                // Update the top entry's summary to include condensed info
                if (toKeep.isNotEmpty()) {
                    val topId = toKeep[0].first
                    val values = ContentValues().apply {
                        put("summary", condensedSummary)
                        put("count", allEntries.size)
                        put("updated_at", System.currentTimeMillis())
                    }
                    db.update("MemoryNodes", values, "id = ?", arrayOf(topId.toString()))
                }

                db.setTransactionSuccessful()
                Log.i(TAG, "Condensed $path: ${toCondense.size} entries → summary")
                promise.resolve(true)
            } finally {
                db.endTransaction()
            }
        } catch (e: Exception) {
            Log.e(TAG, "condenseNode failed: ${e.message}")
            promise.reject("MEMOIR_ERROR", e.message)
        }
    }

    /**
     * FTS5 full-text search across all memory content.
     *
     * Memoir equivalent: IntelligentSearchEngine (offline / single mode)
     */
    @ReactMethod
    fun searchContent(query: String, limit: Int, promise: Promise) {
        try {
            val db = dbHelper.readableDatabase
            val cursor = db.rawQuery(
                """SELECT mn.path, mn.content, mn.summary, mn.confidence
                   FROM MemoryNodesFTS fts
                   JOIN MemoryNodes mn ON fts.docid = mn.id
                   WHERE MemoryNodesFTS MATCH ?
                   ORDER BY mn.confidence DESC
                   LIMIT ?""",
                arrayOf("$query*", limit.toString())
            )

            val results = Arguments.createArray()
            while (cursor.moveToNext()) {
                val item = Arguments.createMap().apply {
                    putString("path", cursor.getString(0))
                    putString("content", cursor.getString(1))
                    putString("summary", cursor.getString(2) ?: "")
                    putDouble("confidence", cursor.getDouble(3))
                }
                results.pushMap(item)
            }
            cursor.close()
            promise.resolve(results)
        } catch (e: Exception) {
            Log.e(TAG, "searchContent failed: ${e.message}")
            promise.reject("MEMOIR_ERROR", e.message)
        }
    }

    /**
     * Get store statistics: total nodes, paths, depth distribution.
     *
     * Memoir equivalent: ProllyTreeStore.get_statistics()
     */
    @ReactMethod
    fun getStats(promise: Promise) {
        try {
            val db = dbHelper.readableDatabase
            val stats = Arguments.createMap()

            // Total nodes
            val countCursor = db.rawQuery("SELECT COUNT(*) FROM MemoryNodes", null)
            if (countCursor.moveToFirst()) stats.putInt("totalNodes", countCursor.getInt(0))
            countCursor.close()

            // Distinct paths
            val pathCursor = db.rawQuery("SELECT COUNT(DISTINCT path) FROM MemoryNodes", null)
            if (pathCursor.moveToFirst()) stats.putInt("distinctPaths", pathCursor.getInt(0))
            pathCursor.close()

            // Total memories (sum of counts)
            val memCursor = db.rawQuery("SELECT COALESCE(SUM(count), 0) FROM MemoryNodes", null)
            if (memCursor.moveToFirst()) stats.putInt("totalMemories", memCursor.getInt(0))
            memCursor.close()

            // Top paths by count
            val topCursor = db.rawQuery(
                "SELECT path, SUM(count) as total FROM MemoryNodes GROUP BY path ORDER BY total DESC LIMIT 10",
                null
            )
            val topPaths = Arguments.createArray()
            while (topCursor.moveToNext()) {
                val item = Arguments.createMap().apply {
                    putString("path", topCursor.getString(0))
                    putInt("count", topCursor.getInt(1))
                }
                topPaths.pushMap(item)
            }
            topCursor.close()
            stats.putArray("topPaths", topPaths)

            promise.resolve(stats)
        } catch (e: Exception) {
            Log.e(TAG, "getStats failed: ${e.message}")
            promise.reject("MEMOIR_ERROR", e.message)
        }
    }

    /**
     * Clear all ephemeral (session.*) nodes.
     * Called on app restart or session end.
     */
    @ReactMethod
    fun clearSessionNodes(promise: Promise) {
        try {
            val db = dbHelper.writableDatabase
            val deleted = db.delete("MemoryNodes", "path LIKE ?", arrayOf("session.%"))
            Log.i(TAG, "Cleared $deleted session nodes")
            promise.resolve(deleted)
        } catch (e: Exception) {
            Log.e(TAG, "clearSessionNodes failed: ${e.message}")
            promise.reject("MEMOIR_ERROR", e.message)
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // NEW: SigMap Context Methods
    // ═══════════════════════════════════════════════════════════════

    /**
     * Upsert a signature (class/method/etc) for a file.
     */
    @ReactMethod
    fun upsertSignature(filePath: String, name: String, type: String, params: String?, returnType: String?, line: Int, promise: Promise) {
        try {
            val db = dbHelper.writableDatabase
            val values = ContentValues().apply {
                put("file_path", filePath)
                put("name", name)
                put("type", type)
                put("params", params)
                put("return_type", returnType)
                put("line_number", line)
                put("updated_at", System.currentTimeMillis())
            }
            db.insertWithOnConflict("Signatures", null, values, SQLiteDatabase.CONFLICT_REPLACE)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "upsertSignature failed: ${e.message}")
            promise.reject("SIGMAP_ERROR", e.message)
        }
    }

    /**
     * Get all signatures for a specific file or folder.
     */
    @ReactMethod
    fun getSignaturesByPath(pathQuery: String, promise: Promise) {
        try {
            val db = dbHelper.readableDatabase
            val cursor = db.rawQuery(
                "SELECT name, type, params, return_type, line_number FROM Signatures WHERE file_path LIKE ?",
                arrayOf("%$pathQuery%")
            )

            val results = Arguments.createArray()
            while (cursor.moveToNext()) {
                val sig = Arguments.createMap().apply {
                    putString("name", cursor.getString(0))
                    putString("type", cursor.getString(1))
                    putString("params", cursor.getString(2) ?: "")
                    putString("returnType", cursor.getString(3) ?: "")
                    putInt("line", cursor.getInt(4))
                }
                results.pushMap(sig)
            }
            cursor.close()
            promise.resolve(results)
        } catch (e: Exception) {
            Log.e(TAG, "getSignaturesByPath failed: ${e.message}")
            promise.reject("SIGMAP_ERROR", e.message)
        }
    }

    /**
     * Clear all signatures.
     */
    @ReactMethod
    fun clearSignatures(promise: Promise) {
        try {
            val db = dbHelper.writableDatabase
            db.execSQL("DELETE FROM Signatures")
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SIGMAP_ERROR", e.message)
        }
    }

    /**
     * Clear ALL memory nodes (full reset).
     */
    @ReactMethod
    fun clearAllNodes(promise: Promise) {
        try {
            val db = dbHelper.writableDatabase
            db.execSQL("DELETE FROM MemoryNodes")
            Log.i(TAG, "Cleared all memory nodes")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "clearAllNodes failed: ${e.message}")
            promise.reject("MEMOIR_ERROR", e.message)
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // LEGACY: Keep existing MemorySnippets methods for backward compat
    // ═══════════════════════════════════════════════════════════════

    @ReactMethod
    fun upsertSnippet(topic: String, content: String, metadataStr: String, promise: Promise) {
        try {
            val db = dbHelper.writableDatabase
            val values = ContentValues().apply {
                put("topic", topic)
                put("content", content)
                put("metadata", metadataStr)
            }
            db.insert("MemorySnippets", null, values)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("DB_ERROR", e.message)
        }
    }

    @ReactMethod
    fun search(query: String, limit: Int, promise: Promise) {
        try {
            val db = dbHelper.readableDatabase
            val cursor = db.rawQuery(
                "SELECT topic, content, metadata FROM MemorySnippets WHERE MemorySnippets MATCH ? LIMIT ?",
                arrayOf("$query*", limit.toString())
            )

            val results = Arguments.createArray()
            while (cursor.moveToNext()) {
                val map = Arguments.createMap()
                map.putString("topic", cursor.getString(0))
                map.putString("content", cursor.getString(1))
                map.putString("metadata", cursor.getString(2))
                results.pushMap(map)
            }
            cursor.close()
            promise.resolve(results)
        } catch (e: Exception) {
            promise.reject("DB_ERROR", e.message)
        }
    }

    @ReactMethod
    fun clearMemory(promise: Promise) {
        try {
            val db = dbHelper.writableDatabase
            db.execSQL("DELETE FROM MemorySnippets")
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("DB_ERROR", e.message)
        }
    }
}
