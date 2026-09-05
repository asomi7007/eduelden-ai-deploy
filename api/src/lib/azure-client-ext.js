'use strict';

/**
 * Thin re-export of azure-client.js essentials.
 * getApimBasePath is not exported by the original — rebuild it here.
 */

const azureClient = require('./azure-client');

function getApimBasePath() {
  const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
  const resourceGroup = process.env.AZURE_RESOURCE_GROUP;
  const serviceName = process.env.APIM_SERVICE_NAME || 'apim-eduelden-ai';
  return `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.ApiManagement/service/${serviceName}`;
}

module.exports = {
  getManagementToken: azureClient.getManagementToken,
  getApimBasePath,
};
