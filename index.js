const express = require('express');
const app = express();
//const Raven = require('raven');
const fs = require('fs');
const uuid = require('uuid/v1');
const cookieParser = require('cookie-parser');

// monkypatch
require('express-uws')(app);

const option_definitions = [
	{ name: 'port', alias: 'p', type: String }
];
const options = require('command-line-args')(option_definitions);

// global constants
const port = options.port || 3000;
const code = [];

// global variables
let allowed = load('./allowed.json');
let users = load('./users.json');
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

function get_posts(posts, access_level = 5) {
	if(posts)
		return posts.reduce((res, post) => {
			if(post.access_level < access_level)
				return res + `<h2> ${post.title} </h2> <p> ${post.body} </p> <br>`;
			else 
				return res;
		}, '');
	else
		return '<p> currently I lack any posts ;-; </p>';
}

function add_user(ip = '', access_level = 5) {
	const id = uuid();
	// NOTHING CAN STOP ME.
	if(users[id])
		return add_user();
	users[id] = {ip_list: [ip], access_level: access_level};
	fs.writeFile('./users.json', JSON.stringify(users), handle());
	return id;
}

function get_ip(req) {
	return req.ip || req.connection.address();
}

function register(ip) {
	allowed[ip] = {};
	allowed[ip].status = 1;
	fs.writeFile('./allowed.json', JSON.stringify(allowed), handle());
}

function encrypt(text) {
	return Buffer.from(text).toString('base64');
}

function decrypt(text) {
	return Buffer.from(text, 'base64').toString();
}
// Must configure Raven before doing anything else with it
//Raven.config(config.raven).install();

// The request handler must be the first middleware on the app
//app.use(Raven.requestHandler());
app.enable('trust proxy');
// ws was monkypatched to the app object, see the dependencies
app.use(cookieParser());
app.ws('/ws', function(ws, req) {
	const ip = get_ip(req);

	// TODO: send keystrokes instead if efficient
	ws.on('message', function(ev) {
		ev = decrypt(ev);
		if(ev.startsWith('{')) {
			ev = JSON.parse(ev);
			if(ev.type === 'devstate') {
				// some function to ban the person
			}

			if(ev.type === 'keyup') {
				let _code = code[req.headers['sec-websocket-key']] || '';
				switch(ev.key) {
				case('Backspace'):
					_code = _code.slice(0, -1);
					break;
				case('Enter'):
					// if our websocket is ready, send the code, if its closed, create a new socket, else ignore this
					if(passwords[_code]) {
						let user_add;
						if(req.cookies && req.cookies.uuid && users[req.cookies.uuid] !== void(1)) { 
							user_add = '';
						} else {
							user_add = `document.cookie = "uuid=${add_user(ip, 5)}";`;
						}
						const content = get_posts(posts.posts);
						if(!allowed[ip])
							register(ip);
						ws.send(encrypt(`
						(() => {
								i = 100;
								while(i--)
									window.history.pushState({"HTML": "there is no going back now", "pageTitle": "There is no going back now"}, '', '/');
								window.history.pushState({"HTML": "there is no going back now", "pageTitle": "There is no going back now"}, '', '/blog');
								document.cookie = "amplitude_id_7acb8df1d57962e98163686ab410fa23_crystal_ce_amplitude=${uuid()}";
								${user_add}
								document.write(\`${!allowed[ip]?'<h1> Thanks for registering':'<h1>Hi'} ${req.ip} :D! </h1><hr>${content}\`);
						})()
							`));
					}
					if(_code === 'give me virus') {
						if(!allowed[ip])
							register(ip);
						ws.send(encrypt(`
						(() => {
							window.location = '/virus';
						})()
							`));
					}
					if(passwords[_code] && passwords[_code].type === 'one-time'){
						passwords[_code].active = false;
						fs.writeFile('./passwords.json', JSON.stringify(passwords), handle());
					}
						console.log(_code);
					_code = '';
					break;
				case('Shift'):
				case('Meta'):
				case('Escape'):
				case('Control'):
					// I don't care.
					break;
				default:
					_code += ev.key;
					break;
				}
				code[req.headers['sec-websocket-key']] = _code;
			}
		}
		// ws.send('console.log("miss")');
	});
});

app.use('/virus', (req, res) => {
	const ip = get_ip(req);
	if(allowed[ip])
		res.sendFile('./virus.exe', {root: './static'});
});

app.use('/blog', (req, res) => {
	const ip = get_ip(req);
	if(req.cookies && req.cookies.uuid && users[req.cookies.uuid] !== void(1)) {
		const content = get_posts(posts.posts);
		res.send(`
<h1> Hi ${ip}! </h1>
<hr>

${content}

	`); 
	} else
		res.status(451).sendFile('./index.html', {root: './static'});
});

// Send back our 451
app.use((req, res) => {
	const ip = get_ip(req);
	let override = false;
	console.log(req.cookies.uuid);
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
