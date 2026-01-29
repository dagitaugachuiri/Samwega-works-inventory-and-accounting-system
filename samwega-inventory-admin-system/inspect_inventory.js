const http = require('http');

http.get('http://localhost:8080/api/inventory', (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        try {
            const items = JSON.parse(data);
            console.log(JSON.stringify(items.slice(0, 3), null, 2));
        } catch (e) {
            console.error(e);
        }
    });
}).on('error', (err) => {
    console.error(err);
});
