// Test-only network boundary; synthetic transport factories remain usable.
const net = require('node:net');
const tls = require('node:tls');
const { syncBuiltinESMExports } = require('node:module');
const denied = () => { throw Error('Offline tests forbid real network access'); };
globalThis.fetch = denied;
net.Socket.prototype.connect = denied;
tls.connect = denied;
syncBuiltinESMExports();
