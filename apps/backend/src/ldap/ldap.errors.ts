export class LdapInvalidCredentialsError extends Error {
  constructor() {
    super('Invalid LDAP credentials');
    this.name = 'LdapInvalidCredentialsError';
  }
}

export class LdapUnavailableError extends Error {
  constructor(options?: { cause?: unknown }) {
    super('LDAP server is unavailable', options);
    this.name = 'LdapUnavailableError';
  }
}

export class LdapConfigError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'LdapConfigError';
  }
}
