var mongoose = require('mongoose')
  , express  = require('express')
  , app      = express()
  , server   = require('http').createServer(app)
  , io       = require('socket.io').listen(server);

var Event        = require('./app/models/jobs/event')
  , User         = require('./app/models/people/user')
  , Application  = require('./app/models/people/application')
  , AccessToken  = require('./app/models/people/access_token');

var _  = require('underscore');



/* ---------------- *
 * Socket.io server *
 * ---------------- */

app.configure(function() {
  app.use(express.static(__dirname + '/app/assets/javascripts'));
  app.use(express.static(__dirname + '/app/assets'));
});

app.get('/', function (req, res) {
  res.sendfile(__dirname + '/index.html');
});

app.put('/test', function (request, response) {
  io.sockets.emit('token-1', { data: require('./spec/fixtures/device.json') });
  response.json({});
});

io.sockets.on('connection', function (socket) {
  socket.emit('connected');
});

server.listen(process.env.PORT);



/* ------------- *
 * Realtime loop *
 * ------------- */

// Find the valid tokens associated to property-udpated events
Event.find({ realtime_processed: false, event: 'property-update' }).tailable().stream()
  .on('data', function(collection) { findTokens(collection) });

// Returns all valid access tokens and notifies the apps using them
var findTokens = function(event) {

  // Find all acces tokens to notify
  var tokens = function() {
    event.findAccessTokens(emit);
    event.realtime_processed = true;
    event.save();
  }

  // Send the notification to the authorized clients
  var emit = function(err, tokens) {
    if (process.env.DEBUG) { console.log('LELYLAN: sending update for event', event.event) }
    _.each(tokens, function(token) {
      if (process.env.DEBUG) { console.log('DEBUG:', 'Emitting websocket event for token', token) }
      io.sockets.emit(token.token, event)
    });
  }

  tokens();
};

