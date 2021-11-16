const Https = require('https');
const Fs = require('fs');

const upload = (cb) => {
    console.log("Uploading source");
    const file = Fs.readFileSync('./src/lib.rs').toString('base64');
    const req = Https.request({
        host: 'vinny.cjdns.fr',
        port: 443,
        path: '/source',
        method: 'POST'
    }, (res) => {
        if (res.statusCode !== 200) { throw new Error("error from the server: " + res.statusMessage); }    
        // console.log('STATUS: ' + res.statusCode);
        // console.log('HEADERS: ' + JSON.stringify(res.headers));
        res.setEncoding('utf8');
        const data = [];
        res.on('data', (chunk) => data.push(chunk));
        res.on('end', () => {
            console.log(data);
            const obj = JSON.parse(data.join(''));
            cb(obj.project_id);
        })
    });
    req.on('error', function(e) {
        throw new Error('problem with request: ' + e.message);
    });
    req.write(JSON.stringify({source: file}));
    req.end();
};

const verify = (projectId) => {
    console.log("Starting verification");
    const req = Https.request({
        host: 'vinny.cjdns.fr',
        port: 443,
        path: '/program-verification/' + projectId,
        method: 'POST'
    }, (res) => {
        if (res.statusCode !== 200) { throw new Error("error from the server: " + res.statusMessage); }    
        // console.log('STATUS: ' + res.statusCode);
        // console.log('HEADERS: ' + JSON.stringify(res.headers));
        res.setEncoding('utf8');
        const data = [];
        res.on('data', (chunk) => data.push(chunk));
        res.on('end', () => {
            console.log(data);
        })
    });
    req.on('error', function(e) {
        throw new Error('problem with request: ' + e.message);
    });
    req.end();
};

const getData = (projectId, endpoint, cb) => {
    const req = Https.request({
        host: 'vinny.cjdns.fr',
        port: 443,
        path: '/program-verification/' + projectId + '/' + endpoint,
        method: 'GET'
    }, (res) => {
        if (res.statusCode !== 200) { throw new Error("error from the server: " + res.statusMessage); }
        // console.log('STATUS: ' + res.statusCode);
        // console.log('HEADERS: ' + JSON.stringify(res.headers));
        res.setEncoding('utf8');
        const data = [];
        res.on('data', (chunk) => data.push(chunk));
        res.on('end', () => {
            const obj = JSON.parse(data.join(''));
            cb(obj);
        })
    });
    req.on('error', (e) => { throw new Error('problem with request: ' + e.message); });
    req.end();
};

const showStderr = process.argv.indexOf("--with-stderr") > -1;
const stdout = (msg) => console.log(msg);
const stderr = (msg) => {
    if (showStderr) {
        console.log("\u001b[31m" + msg + "\u001b[0m");
    }
};

let skipLines = 0;
let rawErr = false;
const getReport = (projectId) => {
    getData(projectId, "report", (report) => {
        const rl = report.raw_log
            .replace('__BEGIN_RAW_STDERR__', '\n__BEGIN_RAW_STDERR__\n')
            .replace('__END_RAW_STDERR__', '\n__END_RAW_STDERR__\n');
        const lines = rl.split('\n').slice(skipLines);
        skipLines += lines.length;
        let l;
        if (lines.length === 0) {
            getData(projectId, "progress", (report) => {
                if (report.raw_status === 'exited') {
                    process.exit(0);
                }
            });
        }
        while (lines.length) {
            const l = lines.shift();
            if (l === '__END_RAW_STDERR__') {
                rawErr = false;
            } else if (l === '__BEGIN_RAW_STDERR__') {
                rawErr = true;
            } else if (rawErr) {
                stderr(l);
            } else {
                stdout(l);
            }
        }
    });
};

upload((projectId) => {
    verify(projectId);
    setInterval(() => {
        getReport(projectId);
    }, 10000);
});