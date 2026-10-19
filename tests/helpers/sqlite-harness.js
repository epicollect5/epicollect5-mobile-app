import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import initSqlJs from 'sql.js';

const require = createRequire(import.meta.url);

let sqlJsPromise;

function loadSqlJs() {
    if (!sqlJsPromise) {
        // Read the wasm binary from disk so sql.js does not fall back to fetch,
        // which is unreliable under vitest's jsdom environment.
        const wasmBinary = readFileSync(require.resolve('sql.js/dist/sql-wasm.wasm'));
        sqlJsPromise = initSqlJs({ wasmBinary });
    }
    return sqlJsPromise;
}

/**
 * Count SQLite '?' placeholders in a query, ignoring quoted strings,
 * identifiers, bracket identifiers and comments so that a '?' appearing as
 * data (e.g. inside a LIKE pattern) is not miscounted.
 */
export function countPlaceholders(sql) {
    let count = 0;
    let index = 0;
    const length = sql.length;

    while (index < length) {
        const char = sql[index];

        if (char === '\'' || char === '"' || char === '`') {
            const quote = char;
            index += 1;
            while (index < length) {
                if (sql[index] === quote) {
                    if (sql[index + 1] === quote) {
                        index += 2;
                        continue;
                    }
                    index += 1;
                    break;
                }
                index += 1;
            }
            continue;
        }

        if (char === '[') {
            index += 1;
            while (index < length && sql[index] !== ']') {
                index += 1;
            }
            index += 1;
            continue;
        }

        if (char === '-' && sql[index + 1] === '-') {
            index += 2;
            while (index < length && sql[index] !== '\n') {
                index += 1;
            }
            continue;
        }

        if (char === '/' && sql[index + 1] === '*') {
            index += 2;
            while (index < length && !(sql[index] === '*' && sql[index + 1] === '/')) {
                index += 1;
            }
            index += 2;
            continue;
        }

        if (char === '?') {
            count += 1;
        }
        index += 1;
    }

    return count;
}

function makeRows(rows) {
    return {
        length: rows.length,
        item: (index) => rows[index]
    };
}

function lastInsertId(raw) {
    const result = raw.exec('SELECT last_insert_rowid() AS id');
    if (result.length === 0 || result[0].values.length === 0) {
        return null;
    }
    return result[0].values[0][0];
}

/**
 * Wrap a sql.js Database in the WebSQL API the database services expect:
 * db.transaction(work, error, success) + tx.executeSql(sql, params, success, error).
 */
export function wrapWebSql(raw) {
    let depth = 0;

    function makeTransaction() {
        const tx = {
            aborted: null,
            executeSql(sql, params, success, error) {
                // Once a statement has failed, cordova-sqlite-storage skips the
                // callbacks of the remaining statements, so do not run them.
                if (tx.aborted) {
                    return;
                }
                // WebSQL treats an undefined bind value as NULL; sql.js rejects
                // it outright, so normalise to keep the harness faithful.
                const boundParams = (params == null ? [] : params)
                    .map((value) => (value === undefined ? null : value));

                try {
                    const placeholders = countPlaceholders(sql);
                    if (placeholders !== boundParams.length) {
                        throw new Error(
                            'SQL binding mismatch: query has ' + placeholders +
                            ' placeholder(s) but ' + boundParams.length +
                            ' param(s) were supplied.\n' + sql
                        );
                    }

                    const statement = raw.prepare(sql);
                    const rows = [];
                    try {
                        statement.bind(boundParams);
                        while (statement.step()) {
                            rows.push(statement.getAsObject());
                        }
                    } finally {
                        statement.free();
                    }

                    const result = {
                        rows: makeRows(rows),
                        rowsAffected: raw.getRowsModified(),
                        insertId: lastInsertId(raw)
                    };

                    if (success) {
                        success(tx, result);
                    }
                    return result;
                } catch (err) {
                    // cordova-sqlite-storage aborts the transaction unless the
                    // statement error callback returns exactly false
                    // (handleStatementFailure throws otherwise). The abort is
                    // driven by the plugin, not the JS stack, so record it on the
                    // transaction instead of throwing (a throw here would be
                    // swallowed by the surrounding Promise executor).
                    if (error && error(tx, err) === false) {
                        return;
                    }
                    tx.aborted = err;
                    return;
                }
            }
        };
        return tx;
    }

    function transaction(work, error, success) {
        const tx = makeTransaction();
        const nested = depth > 0;
        depth += 1;

        try {
            if (!nested) {
                raw.run('BEGIN');
            }
            work(tx);

            // A statement failed without being handled: discard the whole
            // transaction, as the real plugin does on abort.
            if (tx.aborted) {
                if (!nested) {
                    raw.run('ROLLBACK');
                }
                if (error) {
                    // cordova-sqlite-storage calls the transaction error
                    // callback with a single argument (the SQL error).
                    error(tx.aborted);
                    return;
                }
                throw tx.aborted;
            }

            if (!nested) {
                raw.run('COMMIT');
            }
            if (success) {
                success();
            }
        } catch (err) {
            if (!nested) {
                try {
                    raw.run('ROLLBACK');
                } catch (_ignored) {
                    // no active transaction to roll back
                }
            }
            if (error) {
                error(err);
                return;
            }
            throw err;
        } finally {
            depth -= 1;
        }
    }

    // Test-only conveniences for seeding fixtures and reading rows back.
    function query(sql, params) {
        const rows = [];
        const statement = raw.prepare(sql);
        try {
            if (params && params.length > 0) {
                statement.bind(params);
            }
            while (statement.step()) {
                rows.push(statement.getAsObject());
            }
        } finally {
            statement.free();
        }
        return rows;
    }

    function run(sql, params) {
        raw.run(sql, params);
    }

    return {
        transaction,
        readTransaction: transaction,
        query,
        run,
        raw
    };
}

export async function createSqliteHarness() {
    const SQL = await loadSqlJs();
    const raw = new SQL.Database();
    return { db: wrapWebSql(raw), raw };
}
