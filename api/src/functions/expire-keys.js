'use strict';

const { app, output } = require('@azure/functions');
const { findExpiringKeys, upsertKey, writeAudit } = require('../lib/tableStorage');
const { setSubscriptionState } = require('../lib/apim');

/**
 * Timer: every 5 minutes — expire ACTIVE keys past ExpiresAt.
 * APIM Subscription → suspended, DB → EXPIRED, audit log.
 */
app.timer('expireWorkshopKeys', {
  schedule: '0 */5 * * * *',
  handler: async (myTimer, context) => {
    const now = new Date().toISOString();
    context.log('expireWorkshopKeys running at', now);
    let expired = 0;
    const failed = [];
    try {
      const targets = await findExpiringKeys(now);
      for (const k of targets) {
        try {
          await setSubscriptionState(k.apimSubscriptionId, 'suspended');
          await upsertKey({ ...k, status: 'EXPIRED' });
          expired++;
        } catch (e) {
          failed.push({ keyId: k.keyId, error: e.message });
        }
      }
      if (expired || failed.length) {
        await writeAudit('key.autoExpire', { expired, failed });
      }
      context.log(`expired=${expired} failed=${failed.length}`);
    } catch (e) {
      context.error('expireWorkshopKeys fatal:', e.message);
      throw e;
    }
  },
});
