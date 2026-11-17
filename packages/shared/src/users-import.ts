/** A CSV row rejected by POST /api/users/import. */
export interface UsersImportRowError {
  /** Row number in the uploaded file (the header is row 1). */
  row: number;
  value: string;
  reason: string;
}

/** Response body of POST /api/users/import. */
export interface UsersImportReport {
  /** New students added to the database. */
  created: number;
  /** Valid logins not added: already in the database or repeated in the file. */
  skippedDuplicates: number;
  /** Rows rejected by validation, listed in `errors`. */
  invalid: number;
  errors: UsersImportRowError[];
}
