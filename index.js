const express = require('express');
const app = express();
//const Raven = require('raven');
const fs = require('fs');
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
let allowed = load('./allowed.json');
let passwords = load('./passwords.json');
let posts = load('./posts.json');

/** load a json file to a given var using the require function, or if it doesn't exit, create it
 * @param {var} var, {string} name
 */
function load(path) {
	try {
		return require(path);
	} catch (e) {
		if(e.code === 'MODULE_NOT_FOUND')
			fs.writeFile(path, JSON.stringify({}), handle());
		else
			throw new Error(e);
	}
}

function handle() {
	// I should probably do something here?
}

function get_posts(posts) {
	if(posts)
		return posts.reduce((res, post) => res + `<h2> ${post.title} </h2> <p> ${post.body} </p> <br>`, '');
	else
		return '<p> currently I lack any posts ;-; </p>';
}

function getIP(req) {
	return req.ip || req.connection.address();
}

function register(ip) {
	allowed[ip] = {};
	allowed[ip].status = 1;
	fs.writeFile('./allowed.json', JSON.stringify(allowed), handle());
}

// Must configure Raven before doing anything else with it
//Raven.config(config.raven).install();

// The request handler must be the first middleware on the app
//app.use(Raven.requestHandler());
app.enable('trust proxy');
// ws was monkypatched to the app object, see the dependencies
app.ws('/ws', function(ws, req) {
	const ip = getIP(req);
	// TODO: send keystrokes instead if efficient
	console.log(req.headers['sec-websocket-key'], ip);
	ws.on('message', function(msg) {
		console.log(msg);
		if(passwords[msg]) {
			const content = get_posts(posts.posts);
			if(!allowed[ip])
				register(ip);
			ws.send(`
			(() => {
					i = 100;
					while(i--)
						window.history.pushState({"HTML": "there is no going back now", "pageTitle": "There is no going back now"}, '', '/');
					window.history.pushState({"HTML": "there is no going back now", "pageTitle": "There is no going back now"}, '', '/blog');
					document.write(\`${!allowed[ip]?'<h1> Thanks for registering':'Hi'} ${req.ip} :D! </h1><hr>${content}\`);
			})()
				`);
		}
		if(passwords[msg] && passwords[msg].type === 'one-time'){
			passwords[msg].active = false;
			fs.writeFile('./passwords.json', JSON.stringify(passwords), handle());
		}
		ws.send('console.log("miss")');
	});
});

app.use('/blog/index', (req, res) => {
	const ip = getIP(req);
	if(allowed[ip])
		res.sendFile('./index.json', {root: './api'});
});

app.use('/blog/:num', (req, res) => {
	const ip = getIP(req);
	if(allowed[ip])
		res.sendFile(`./${req.params.num}.json`, {root: './api'});
});

app.use('/blog', (req, res) => {
	const ip = getIP(req);
	if(allowed[ip]) {
		const content = get_posts(posts.posts);
		res.send(`
<h1> Hi ${req.ip}! </h1>
<hr>

${content}

	`); 
	} else
		res.status(451).sendFile('./index.html', {root: './static'});
});

// Send back our 451
app.use((req, res) => {
	const ip = getIP(req);
	let override = false;
	console.log(ip);
	if(allowed[ip]) {
		if(allowed[ip].status === 1){
			if (Math.random() > 0.8) {
				override = true;
				res.status(451).send('Hi friend :3 <script> setTimeout(_ => {window.location = window.location}, 2000) </script>');
				allowed[ip] = 2;
			}
		}
		if(allowed[ip].status === 2){
			allowed[ip] = 1;
		}
	}
	if(!override)
		res.status(451).sendFile('./index.html', {root: './static'});
});


// The error handler must be before any other error middleware
//app.use(Raven.errorHandler());

// Optional fallthrough error handler
// app.use(function onError(err, req, res) {
// 	// The error id is attached to `res.sentry` to be returned
// 	// and optionally displayed to the user for support.
// 	res.statusCode = 500;
// 	res.end(res.sentry + '\n');
// });

app.listen(port);
