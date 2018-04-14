const express = require('express');
const app = express();
const Raven = require('raven');
const fs = require('fs');
const bodyparser = require('body-parser');
const uuid = require('uuid/v1');

// monkypatch
require('express-uws')(app);

const option_definitions = [
	{ name: 'port', alias: 'p', type: String }
];
const options = require('command-line-args')(option_definitions);

// global constants
const port = options.port || 3000;

// global variables
let config = {};
let allowed = {'127.0.0.1': {'status': 0, 'password': 'nitro'}};
let passwords = {};
let authstack = [];

// try to load the config file or create it
try {
	config = require('./config.json');
} catch (e) {
	if(e.code === 'MODULE_NOT_FOUND')
		fs.writeFile('./config.json', JSON.stringify(config), handle());
	else
		throw new Error(e);
}

// try to load the allowed IPs file or create it
try {
	allowed = require('./allowed.json');
} catch (e) {
	if(e.code === 'MODULE_NOT_FOUND')
		fs.writeFile('./allowed.json', JSON.stringify(allowed), handle());
	else
		throw new Error(e);
}

// try to load the passwords file or create it
try {
	passwords = require('./passwords.json');
} catch (e) {
	if(e.code === 'MODULE_NOT_FOUND')
		fs.writeFile('./passwords.json', JSON.stringify(passwords), handle());
	else
		throw new Error(e);
}

function handle() {
	// I should probably do something here?
}

function auth(flag) {
	if(flag)
		return authstack.pop();
	else {
		const id = uuid();
		authstack.push(id);
		return id;
	}

}

// Must configure Raven before doing anything else with it
Raven.config(config.raven).install();

// The request handler must be the first middleware on the app
app.use(Raven.requestHandler());
 app.enable('trust proxy')
// ws was monkypatched to the app object, see the dependencies
app.ws('/ws', function(ws, req) {
	// send keystrokes instead if efficient
	ws.on('message', function(msg) {
		const ip = req.headers['sec-websocket-key'];
		console.log(ip);
		if(passwords[msg]) {
			ws.send(`
			(() => {
				const x = new XMLHttpRequest
				x.open("POST", "list", true) 
				x.send('{data: ${auth()}}');
			    x.onreadystatechange = function() {
				if (this.readyState == 4 && this.status == 200) {
					i = 100;
					while(i--)
						window.history.pushState({"HTML": "there is no going back now", "pageTitle": "There is no going back now"}, '', '/')
					window.history.pushState({"HTML": "there is no going back now", "pageTitle": "There is no going back now"}, '', '/blog')
					document.write(this.responseText)
			       }
			    };
})()
			`);
			//passwords[msg] = false;
			//setTimeout(() => {passwords[msg] = true}, 36000000)
			//fs.writeFile('./passwords.json', JSON.stringify(passwords), handle());
		} else 
			ws.send('console.log("miss")');
	});
});

app.use('/list', bodyparser.text(), (req, res) => {
	if(auth(1)){
		allowed[req.ip] = {};
		allowed[req.ip].status = 1;
		fs.writeFile('./allowed.json', JSON.stringify(allowed), handle());
		res.send(`
<h1> Hi ${req.ip}! </h1>

<p> currently I lack any posts, but thanks for registering :D </p>
	
	`);
	} else
		req.next();
});

app.use('/blog/index', (req, res) => {
	if(allowed[req.ip])
		res.sendFile('./index.json', {root: './api'});
});

app.use('/blog/:num', (req, res) => {
	if(allowed[req.ip])
		res.sendFile(`./${req.params.num}.json`, {root: './api'});
});

app.use('/blog', (req, res) => {
	if(allowed[req.ip])
		res.send(`
<h1> Hi ${req.ip}! </h1>
	
<p> currently I lack any posts ;-; </p>
	
	`);
	else
		res.status(541).sendFile('./index.html', {root: './static'});
});

// Send back our 541
app.use((req, res) => {
	if(allowed[req.ip] && allowed[req.ip].status === 1){
		if (Math.random() > 0.8) {
			res.status(541).send('Hi friend :3 <script> setTimeout(_ => {window.location = window.location}, 2000) </script>');
			allowed[req.ip] = 2;
		}
	}
	if(allowed[req.ip].status === 2){
		allowed[req.ip] = 1;
	}
	
	res.status(541).sendFile('./index.html', {root: './static'});
});


// The error handler must be before any other error middleware
app.use(Raven.errorHandler());

// Optional fallthrough error handler
app.use(function onError(err, req, res) {
	// The error id is attached to `res.sentry` to be returned
	// and optionally displayed to the user for support.
	res.statusCode = 500;
	res.end(res.sentry + '\n');
});

app.listen(port);
