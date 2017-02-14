var express = require('express')
  , passport = require('passport')
  , util = require('util')
  , FoursquareStrategy = require('passport-foursquare').Strategy
  , connect = require('connect')
  , cookieParser = require('cookie-parser')
  , cookieSession = require('cookie-session')
  , bodyParser = require('body-parser')
  , methodOverride = require('method-override')
  , session = require('express-session')
  , User = require('./models/user_model.js')
  , https = require('https')
  , fs = require('fs');

var FOURSQUARE_CLIENT_ID = "2YE3DQJGJ3HNVPUVAAHP1QMJX3ENVK5HX4ZDKIL5ARCB1VNJ"
var FOURSQUARE_CLIENT_SECRET = "O2PWREEFRDL55ZZKF03NFWCQ1HVOT0NYJRIOBW0IVVA5W2X0";


// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the complete Foursquare profile is
//   serialized and deserialized.
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});


// Use the FoursquareStrategy within Passport.
//   Strategies in Passport require a `verify` function, which accept
//   credentials (in this case, an accessToken, refreshToken, and Foursquare
//   profile), and invoke a callback with a user object.
passport.use(new FoursquareStrategy({
    clientID: FOURSQUARE_CLIENT_ID,
    clientSecret: FOURSQUARE_CLIENT_SECRET,
    callbackURL: "https://ec2-54-86-70-147.compute-1.amazonaws.com:8081/auth/foursquare/callback"
  },
  function(accessToken, refreshToken, profile, done) {
      var json = JSON.parse(profile._raw);
          //check user table for anyone with a facebook ID of profile.id
      User.findOne({
          'id': profile.id 
      }, function(err, user) {
          if (err) {
              return done(err);
          }
          //No user was found... so create a new user with values from Facebook (all the profile. stuff)
          if (!user) {
              console.log("creating new user");
              user = new User({
                  id : json.response.user.id,
                  firstName: json.response.user.firstName,
                  lastName: json.response.user.lastName,
                  checkins: json.response.user.checkins,
                  foursquare: profile._json,
                  Token: accessToken,
                  //now in the future searching on User.findOne({'facebook.id': profile.id } will match because of this next line
              });
              user.save(function(err) {
                  if (err) console.log(err);
                  return done(err, user);
              });
          } else {
              User.findOneAndUpdate({'id' : profile.id}, json.response.user.checkins, function(err, user){
                return done(err, user);
              });
          }
      });
    }
));




var app = express(); 
var options = {
  key: fs.readFileSync('./ssl/key.pem', 'utf8'),
  cert: fs.readFileSync('./ssl/cert.pem', 'utf8'),
  passphrase: "andrew18871",
};// configure Express

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(cookieParser('keyboard cat'));
//app.use(cookieSession({
//   name: 'session',
//    secret: 'keyboard cat',
//    cookie: {
//      maxAge: 24 * 60 * 60 * 1000
//    }
//}));
app.use(bodyParser());
app.use(methodOverride());
app.use(session({
  secret: 'keyboard cat',
  cookie: {
    expires:false,
  }
}));
// Initialize Passport!  Also use passport.session() middleware, to support
// persistent login sessions (recommended).
app.use(passport.initialize());
app.use(passport.session({secret: 'keyboard cat'}));
app.use(express.static(__dirname + '/public'));
var server = https.createServer(options, app).listen(8081, function(){
  console.log("Express server listening on port " + 8081);
});


app.get('/', function(req, res){
         User.find({}, function(err, users) {
            if (err) {
                console.log(err);
                return done(err);
            //No user was found... so create a new user with values from Facebook (all the profile. stuff)
            } else {
                res.render('index1', { user: req.user, users: users });
                //found user. Return
            }
        });
  //res.render('index', { user: req.user });
});

app.get('/Users/:userId/account', ensureAuthenticated, function(req, res){
  console.log("here I am");
  var options = {
    hostname: 'api.foursquare.com',
    path: '/v2/users/self/checkins',
    method: 'GET',
    oauth_token : req.user.Token,
  };
  var URI = 'https://api.foursquare.com/v2/users/self/checkins';
  var query = "?oauth_token=" + req.user.Token + '&v=20170209';
  var completeURI = URI + query;
  console.log(completeURI);
  var body = '';
  var json = '';
  https.get(completeURI, function(resp){
    resp.on("data", function(chunk) {
      body += chunk;
    });
    resp.on('end', function(){
      var checkin = JSON.parse(body).response.checkins;
      User.findOneAndUpdate({'id' : req.user.id}, checkin, function(err, users){
          return users;
      });
      res.render('account', {user: req.user, checkins: checkin});

      json = JSON.parse(body);
    });
  })
});

app.get('/login', function(req, res){
  res.render('login', { user: req.user });
});

// GET /auth/foursquare
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in Foursquare authentication will involve
//   redirecting the user to foursquare.com.  After authorization, Foursquare
//   will redirect the user back to this application at /auth/foursquare/callback
app.get('/auth/foursquare',
  passport.authenticate('foursquare'),
  function(req, res){
    // The request will be redirected to Foursquare for authentication, so this
    // function will not be called.
  });

// GET /auth/foursquare/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get('/auth/foursquare/callback', 
  passport.authenticate('foursquare', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  });

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

app.listen(8080);


// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { 
    console.log(req.user.id);
    console.log(req.params.userId);
    if (req.user.id == req.params.userId) {
      return next();
    } else { 
        User.findOne({'id' : req.params.userId}, function(err, users) {
          if (err) {
            return done(err);
             //No user was found... so create a new user with values from Facebook (all the profile. stuff)
          } else {
            console.log(users.checkins[0]);
            res.render('not-account', {user: users});          
        }
      });
    }
  } else {
      //Replace req.user.id with the request id param
      User.findOne({'id' : req.params.userId}, function(err, users) {
      if (err) {
        return done(err);
             //No user was found... so create a new user with values from Facebook (all the profile. stuff)
      } else {
          console.log(users.checkins);
          res.render('not-account', {user: users});          
      }
    });
  }
  //res.redirect('/login')
}
