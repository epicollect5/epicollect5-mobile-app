# Epicollect5 Mobile App Database Schema

This document describes the latest SQLite schema defined in the codebase by:

- Base table creation in [`src/services/database/database-create-service.js`](../src/services/database/database-create-service.js)
- Incremental schema changes in [`src/services/database/database-migrate-service.js`](../src/services/database/database-migrate-service.js)

## Effective Schema Version

The highest schema version represented by the migration chain is **5**:

1. Version 2: add `form_ref` to `unique_answers`
2. Version 2: add `form_ref` to `temp_unique_answers`
3. Version 3: add `name` to `users`
4. Version 4: add `email` to `users`
5. Version 5: add `mapping` to `projects`

## Important Note

`src/config/index.js` currently exports:

```js
export const MIGRATIONS = {
    dbVersionName: 'db_version',
    dbVersion: 1
};
```

That does **not** match the migration switch, which includes schema changes up to version `5`. This document reflects the **latest schema implied by the migration code**, not the stale `dbVersion` constant.

## Tables

### `projects`

Source:

- Base definition: `database-create-service.js`
- Migration v5: add `mapping`

| Column         | Type      | Constraints / Notes        |
|----------------|-----------|----------------------------|
| `id`           | `integer` | `PRIMARY KEY`              |
| `name`         | `text`    |                            |
| `slug`         | `text`    |                            |
| `logo_thumb`   | `text`    |                            |
| `project_ref`  | `text`    | Part of unique key         |
| `json_extra`   | `text`    | Serialized project payload |
| `server_url`   | `text`    | Part of unique key         |
| `last_updated` | `text`    |                            |
| `mapping`      | `text`    | Added in migration v5      |

Constraints:

- `UNIQUE (project_ref, server_url)`

### `users`

Source:

- Base definition: `database-create-service.js`
- Migration v3: add `name`
- Migration v4: add `email`

| Column  | Type      | Constraints / Notes   |
|---------|-----------|-----------------------|
| `id`    | `integer` | `PRIMARY KEY`         |
| `jwt`   | `text`    |                       |
| `name`  | `text`    | Added in migration v3 |
| `email` | `text`    | Added in migration v4 |

### `entries`

| Column              | Type        | Constraints / Notes         |
|---------------------|-------------|-----------------------------|
| `id`                | `integer`   | `PRIMARY KEY`               |
| `entry_uuid`        | `text`      | `UNIQUE`                    |
| `parent_entry_uuid` | `text`      |                             |
| `project_ref`       | `text`      |                             |
| `form_ref`          | `text`      |                             |
| `parent_form_ref`   | `text`      |                             |
| `answers`           | `text`      | Serialized answers payload  |
| `created_at`        | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` |
| `updated_at`        | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` |
| `title`             | `text`      |                             |
| `synced`            | `int`       |                             |
| `synced_error`      | `text`      |                             |
| `can_edit`          | `int`       |                             |
| `is_remote`         | `int`       |                             |

### `branch_entries`

| Column             | Type        | Constraints / Notes         |
|--------------------|-------------|-----------------------------|
| `id`               | `integer`   | `PRIMARY KEY`               |
| `entry_uuid`       | `text`      | `UNIQUE`                    |
| `owner_entry_uuid` | `text`      | Parent/owner entry UUID     |
| `owner_input_ref`  | `text`      | Owning branch input         |
| `project_ref`      | `text`      |                             |
| `form_ref`         | `text`      |                             |
| `answers`          | `text`      | Serialized answers payload  |
| `created_at`       | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` |
| `updated_at`       | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` |
| `title`            | `text`      |                             |
| `synced`           | `int`       |                             |
| `synced_error`     | `text`      |                             |
| `can_edit`         | `int`       |                             |
| `is_remote`        | `int`       |                             |

### `temp_branch_entries`

| Column             | Type        | Constraints / Notes         |
|--------------------|-------------|-----------------------------|
| `id`               | `integer`   | `PRIMARY KEY`               |
| `entry_uuid`       | `text`      | `UNIQUE`                    |
| `owner_entry_uuid` | `text`      | Parent/owner entry UUID     |
| `owner_input_ref`  | `text`      | Owning branch input         |
| `project_ref`      | `text`      |                             |
| `form_ref`         | `text`      |                             |
| `answers`          | `text`      | Serialized answers payload  |
| `created_at`       | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` |
| `updated_at`       | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` |
| `title`            | `text`      |                             |
| `synced`           | `int`       |                             |
| `synced_error`     | `text`      |                             |
| `can_edit`         | `int`       |                             |
| `is_remote`        | `int`       |                             |

### `media`

| Column              | Type        | Constraints / Notes                        |
|---------------------|-------------|--------------------------------------------|
| `id`                | `integer`   | `PRIMARY KEY`                              |
| `entry_uuid`        | `text`      |                                            |
| `branch_entry_uuid` | `text`      | Empty for hierarchy entries                |
| `input_ref`         | `text`      |                                            |
| `project_ref`       | `text`      |                                            |
| `form_ref`          | `text`      |                                            |
| `file_name`         | `text`      | Comment notes this should have been unique |
| `file_path`         | `text`      |                                            |
| `file_type`         | `text`      |                                            |
| `synced`            | `int`       |                                            |
| `synced_error`      | `text`      |                                            |
| `created_at`        | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP`                |

### `unique_answers`

Source:

- Base definition: `database-create-service.js`
- Migration v2: add `form_ref`

| Column              | Type        | Constraints / Notes         |
|---------------------|-------------|-----------------------------|
| `id`                | `integer`   | `PRIMARY KEY`               |
| `project_ref`       | `text`      |                             |
| `entry_uuid`        | `text`      |                             |
| `input_ref`         | `text`      |                             |
| `parent_entry_uuid` | `text`      |                             |
| `owner_entry_uuid`  | `text`      |                             |
| `answer`            | `text`      |                             |
| `created_at`        | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` |
| `form_ref`          | `text`      | Added in migration v2       |

Constraints:

- `UNIQUE (entry_uuid, input_ref)`

### `temp_unique_answers`

Source:

- Base definition: `database-create-service.js`
- Migration v2: add `form_ref`

| Column              | Type        | Constraints / Notes         |
|---------------------|-------------|-----------------------------|
| `id`                | `integer`   | `PRIMARY KEY`               |
| `project_ref`       | `text`      |                             |
| `entry_uuid`        | `text`      |                             |
| `input_ref`         | `text`      |                             |
| `parent_entry_uuid` | `text`      |                             |
| `owner_entry_uuid`  | `text`      |                             |
| `answer`            | `text`      |                             |
| `created_at`        | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` |
| `form_ref`          | `text`      | Added in migration v2       |

Constraints:

- `UNIQUE (entry_uuid, input_ref)`

### `bookmarks`

| Column              | Type        | Constraints / Notes         |
|---------------------|-------------|-----------------------------|
| `id`                | `integer`   | `PRIMARY KEY`               |
| `project_ref`       | `text`      |                             |
| `form_ref`          | `text`      |                             |
| `parent_entry_uuid` | `text`      |                             |
| `title`             | `text`      |                             |
| `bookmark`          | `text`      |                             |
| `created_at`        | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` |

### `settings`

| Column  | Type      | Constraints / Notes |
|---------|-----------|---------------------|
| `id`    | `integer` | `PRIMARY KEY`       |
| `field` | `text`    | Unique setting name |
| `value` | `text`    | Setting value       |

Constraints:

- `UNIQUE (field)`

Known seeded row:

- `field = 'db_version'`
- `value = <schema version>`

## Relationships and Conventions

The schema does not declare foreign keys, but the application uses these logical relationships:

- `projects.project_ref` is the logical project identifier
- `entries.project_ref`, `branch_entries.project_ref`, `temp_branch_entries.project_ref`, `media.project_ref`, `unique_answers.project_ref`, `temp_unique_answers.project_ref`, and `bookmarks.project_ref` refer to the project
- `entries.entry_uuid` is referenced by:
  - `entries.parent_entry_uuid`
  - `media.entry_uuid`
  - `unique_answers.entry_uuid`
  - `temp_unique_answers.entry_uuid`
  - `bookmarks.parent_entry_uuid`
- `branch_entries.entry_uuid` and `temp_branch_entries.entry_uuid` are used as branch-entry identifiers
- `branch_entries.owner_entry_uuid` and `temp_branch_entries.owner_entry_uuid` refer back to the owning root entry

## Constraints and Indexes

Explicit constraints found in the DDL:

- `projects`: `UNIQUE (project_ref, server_url)`
- `entries`: `entry_uuid text UNIQUE`
- `branch_entries`: `entry_uuid text UNIQUE`
- `temp_branch_entries`: `entry_uuid text UNIQUE`
- `unique_answers`: `UNIQUE (entry_uuid, input_ref)`
- `temp_unique_answers`: `UNIQUE (entry_uuid, input_ref)`
- `settings`: `UNIQUE (field)`

No explicit secondary indexes are created by the current migration chain.

## Source References

- [`src/services/database/database-create-service.js`](../src/services/database/database-create-service.js)
- [`src/services/database/database-migrate-service.js`](../src/services/database/database-migrate-service.js)
- [`src/config/index.js`](../src/config/index.js)
