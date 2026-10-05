
/**
 * Base Platform Provider Interface
 * Every platform adapter (LeetCode, CodeChef, HackerRank, etc.) must extend this class.
 *
 * Design rules:
 *  - NO unauthorized scraping, CAPTCHA bypass, or login credential use.
 *  - Use only official public REST APIs or openly accessible JSON endpoints.
 *  - If a field cannot be retrieved, return null (never invent values).
 *  - Report capability honestly via supportsAutoSync and dataFields.
 */

class BaseProvider {
  get name() { throw new Error('BaseProvider.name must be overridden'); }
  get key() { throw new Error('BaseProvider.key must be overridden'); }
  get supportsAutoSync() { return false; }
  get dataFields() { return []; }

  async verifyProfile(url) {
    throw new Error('BaseProvider.verifyProfile must be overridden');
  }

  async fetchProfile(usernameOrUrl) {
    if (!this.supportsAutoSync) {
      return this._unavailable('This platform does not expose a public API for automated sync.');
    }
    throw new Error('BaseProvider.fetchProfile must be overridden when supportsAutoSync is true');
  }

  normalizeData(rawData) {
    return rawData;
  }

  extractUsername(url) {
    return null;
  }

  _unavailable(reason) {
    return {
      success: false,
      platform: this.name,
      key: this.key,
      supportsAutoSync: false,
      availableData: 'Not available from this platform',
      reason: reason || 'Automated sync is not available for this platform without authenticated API access.',
      data: null
    };
  }

  _success(data, message = 'Profile fetched successfully') {
    return {
      success: true,
      platform: this.name,
      key: this.key,
      supportsAutoSync: this.supportsAutoSync,
      message,
      syncedAt: new Date().toISOString(),
      data
    };
  }
}

module.exports = BaseProvider;
