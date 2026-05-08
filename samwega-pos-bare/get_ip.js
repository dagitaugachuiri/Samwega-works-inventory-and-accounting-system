const os = require('os');
const interfaces = os.networkInterfaces();
const results = Object.create(null);

for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
        // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
        if ('IPv4' !== iface.family || iface.internal) {
            continue;
        }
        if (!results[name]) {
            results[name] = [];
        }
        results[name].push(iface.address);
    }
}
console.log(JSON.stringify(results, null, 2));
