module.exports = {
  version: '1.2.0',
  init: function (pluginContext) {
     let policy = require('express-gateway-plugin-gzip/policies/gzip')
     pluginContext.registerPolicy(policy)
  },
  policies:['gzip'], // this is for CLI to automatically add to "policies" whitelist in gateway.config
  schema: {  // This is for CLI to ask about params 'eg plugin configure customer-auth'
    "$id":"https://express-gateway.io/schemas/plugin/blacklist.json"
  }
}