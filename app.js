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
  , fs = require('fs')
  , uuid = require('node-uuid');

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
    callbackURL: "https://localhost:8081/auth/foursquare/callback"
    //"https://ec2-54-86-70-147.compute-1.amazonaws.com:8081/auth/foursquare/callback"
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
          UUID: uuid.v4(),
          seed : getRandomInt(0, 5) % 3 === 0,
          //seed: true,
          endpoint: 'https://ec2-54-86-70-147.compute-1.amazonaws.com:8081/Users/rumors/' + json.response.user.id,
          rumors: [],
          //now in the future searching on User.findOne({'facebook.id': profile.id } will match because of this next line
        })
        addNeighbor(user)
        .then(function(results){
          return done(null, user)
        })
        .catch(function(err){
          return(err)
        })
        //function goes here look in user controller
      } else {
        if(!user.UUID){
          user.UUID = uuid.v4();
        }
        user.endpoint = 'https://ec2-54-86-70-147.compute-1.amazonaws.com:8081/Users/rumors/' + json.response.user.id;
        user.checkins = json.response.user.checkins;
        user.save(function(err){
          if(err) console.log(err);
          return done(err, user)
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
app.get('/Users/rumors/:userId', function(req, res){
  var myUser = null;
  User.findOne({'id': req.params.userId}, function(err, user){
    user.save(function(err) {
      if (err) console.log(err);
    });
    res.render('chat', {id: user.id, rumors: user.rumors})
  })
});

app.post('/Users/rumors/:userId', postRumors);

app.get('/Users/addAnonymous', function(req,res){
  res.render('addAnonymous')
})

app.post('/Users/addAnonymous', function(req, res){
  User.findOne({'id' : 'abcsd1231-1-23-23-12341-4124'}, function(err, user) {
    if(err) return done(err)
    if(!user){
      console.log("creating new anonymous user");
      user = new User({
        id: null,
        firstName: req.body.Name,
        lastName: null,
        checkins: {},
        foursquare: {},
        Token: null,
        UUID: uuid.v4(),
        seed : getRandomInt(0, 5) % 3 === 0,
        //seed: true,
        endpoint: req.body.Endpoint,
        rumors: [],
      });
      saveUser(user)
      .then(function(newUser){
        newUser.id = newUser._id;
        console.log(newUser.seed)
        addNeighbor(newUser)
        .then(function(user2){
          res.render('addAnonymous')
        })
        .catch(function(err){
          console.log(err)
        })
      })
      .catch(function(error){
        console.log(error)
      })
    }
  })
})

app.get('/Users/account/:userId', ensureAuthenticated, function(req, res){
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
    if (req.user.id == req.params.userId) {
      return next();
    } else {
      User.findOne({'id' : req.params.userId}, function(err, users) {
        if (err) {
          return done(err);
          //No user was found... so create a new user with values from Facebook (all the profile. stuff)
        } else {
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
        res.render('not-account', {user: users});
      }
    });
  }
  //res.redirect('/login')
}

function addNeighbor(newUser){
  return new Promise(function(resolve, reject) {
    if (newUser.seed) {
      // Put all the other seeds as its neighbors and give me to them as a neighbor
      User.find({ seed: true }, function(err, users) {
        if (err) return reject(err);
        if (!users) return reject("Unable to get users.")
        
        operations = []
      // TODO: we are pushing ourselves into the neighbor.
        users.forEach(function(user) {
          if (newUser.id != user.id){
            if (user.neighbors.indexOf(newUser.id) == -1) {
              user.neighbors.push(newUser.id)
              operations.push(saveUser(user))
            }
            if (newUser.neighbors.indexOf(user.id) == -1) {
              //user not in neighbors
              newUser.neighbors.push(user.id)
              operations.push(saveUser(newUser))
            }
          }
        })
        if(users.length == 0){
          operations.push(saveUser(newUser))
        }
        Promise.all(operations)
        .then(function(results) {
          // I send my own token here (don't worry about this).
          // You will do res.send(...your view...)
          return resolve(null,users);
        })
        .catch(function(err) {
          console.error(err)
          return resject(err);
        })
      })
    } else {
      User.find({ seed: true}, function(err, users) {
        if (err) return reject(err);
        if (!users) return reject("Unable to get users.")
        
        // Add one of the seeds as its neighbor
        if(users.length > 0){
          var index = getRandomInt(0, users.length);
          var user = users[index]
          newUser.neighbors.push(user.id)
          // The seed user will have this new user as a neighbor
          user.neighbors.push(newUser.id)
        } else {
          //if there are no seeds yet, default this guy to seed.
          newUser.seed = true;
        }
        if(!user){
          // Wait until both users are saved
          Promise.all([
            saveUser(newUser),
          ])
          .then(function(results) {
            return resolve(null,users);
          })
          .catch(function(err) {
            console.log(err)
            return reject(err);
          })
        } else {
          Promise.all([
            saveUser(newUser),
            saveUser(user)
          ])
          .then(function(results) {
            return resolve(users);
          })
          .catch(function(err) {
            console.log(err)
            return reject(err);
          })
        }
      })
    }
  })
}

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}

function saveUser(user) {
  return new Promise(function(resolve, reject) {
    user.save(function(err) {
      if (err) return reject(err)
      User.findOne({UUID: user.UUID}, function(error, newUser){
        if(error) return reject(error)
        if(!newUser) return reject("user not found")
        return resolve(newUser)
      })
    })
  });
}

function postRumors(req, res){
  var rumor = req.body.Rumor;
  var want = req.body.Want;
  var userId = req.params.userId;
  if(rumor){
    User.findOne({
      endpoint: rumor.EndPoint
    }, function(err, user) {
      if (!user) {
        console.log("creating new user");
        user = new User({
          id: null,
          firstName: rumor.Rumor.originator,
          lastName: null,
          checkins: {},
          foursquare: {},
          Token: null,
          UUID: rumor.Rumor.messageID.split(':')[0],
          seed : getRandomInt(0, 5) % 3 === 0,
          //seed: true,
          endpoint: rumor.EndPoint,
          rumors: [rumor],
        });
        saveUser(user)
        .then(function(newUser){
          newUser.id = newUser._id;
          console.log(newUser.seed)
          addNeighbor(newUser)
          .then(function(user2){
            console.log("added user we haven't seen before")
          })
        })
        .catch(function(error){
          console.log(error)
        })
      } else{
          postRumor(userId, rumor)
          .then(function(result){
              res.render('chat', {id: result.id, rumors: result.rumors});
          })
          .catch(function(err){
              console.log(err)
          })
        }
    });
  } else if(want) {
      postWant(userId, want)
      .then(function(result){
        res.render('chat', {id: result.id, rumors: result.rumors});
      })
      .catch(function(err){
        console.log(err)
      })
    } else {
    User.findOne({
      id: userId
    }, function(err, user) {
      createRumor(userId, req.body.message, user.firstName)
      .then(function(result){
        res.render('chat', result);
      })
      .catch(function(err){
        console.log(err)
      })
    })
  }
}

function postWant(userId, want) {
  return new Promise(function(resolve, reject) {
    User.findOne({'id': userId}, function(err, userWithWant) {
      if (err) return reject(err);
      if (!userWithWant) return reject(err)
      User.findOne({endpoint: want.EndPoint }, function(err, userWithRumor) {
        var rumorsToAdd = userWithRumor.rumors.filter(function(rumor) {
          var uuids = Object.keys(want.Want)
          var messageIdParts = rumor.Rumor.messageID.split(":");
          var rumorUuid = messageIdParts[0]
          var rumorSequence = messageIdParts[1]
          return rumorSequence > want.Want[rumorUuid];
        });
        userWithWant.rumors = userWithWant.rumors.concat(rumorsToAdd);
        userWithWant.save(function(err) {
          if (err) return reject(err)
          return resolve(userWithWant)
        })
      })
    });
  });
}

function postRumor(userId, rumor) {
  return new Promise(function(resolve, reject) {
    User.findOne({'id': userId}, function(err, user) {
      if (err) return reject(err);
      //dynamically add the rumor
      if (!user) return reject(err);
      var alreadyExists = user.rumors.filter(function(Rumor) {
          return Rumor.Rumor.messageID === rumor.Rumor.messageID
        }).length > 0;
      if (!alreadyExists) {
        user.rumors.push(rumor)
        user.save(function(err) {
          if (err) return reject(err)
          return resolve(user)
        })
      } else {
        return resolve(user)
      }
    });
  });
}

function createRumor(userId, message) {
  return new Promise(function(resolve,reject){
    User.findOne({'id': userId}, function(err, user){
      console.log("actually creating a rumor bb")
      var maxSequence = maxSequenceNumber(user.rumors, user.UUID);
      var messageId = user.UUID + ":" + (maxSequence + 1);
      var originator = user.firstName
      var rumor = {
        Rumor: { 
          messageID: messageId,
          Originator: originator,
          Text: message
        },
        EndPoint: user.endpoint
      };
      console.log(rumor)
      user.rumors = user.rumors.concat(rumor)
      user.save(function(err) {
        if (err) return reject(err);
        return resolve({id: user.id, rumors: user.rumors})
      });
    })
  })
}

function uniqueItems(duplicatesArr) {
  var arr = [];
  duplicatesArr.forEach(function(item) {
    if(!arr.includes(item)) {
      arr.push(item);
    }
  })
  return arr;
}

function maxSequenceNumber(rumors, uuid) {
  if(rumors.length>0){
     return rumors
    .filter(function(rumor) { 
      return rumor.Rumor.messageID.split(":")[0] === uuid })
    .map(function(rumor) { return parseInt(rumor.Rumor.messageID.split(":")[1]) })
    .reduce(function(a,b) { return Math.max(a,b); }, [])
  }
  else{
    return -1;
  }
}
function makeWant(user){
  var Want = {
    "Want": {},
    "EndPoint": user.endpoint
  }
  uniqueItems(
    user.rumors.map(function(rumor) { 
      return rumor.Rumor.messageID.split(":")[0]})
  ).forEach(function(UUID) {
    var maxSequenceNum = maxSequenceNumber(user.rumors, UUID)
    Want.Want[UUID] = maxSequenceNum
  });
  return Want;
}

setInterval(function(){
  User.find({}, function(err, users) {
    users.forEach(function(user) {
      if (user.neighbors.length > 0 && user.rumors.length > 0) {
        var randomNeighborId = user.neighbors[getRandomInt(0,user.neighbors.length)]
        var neighborUser = users.filter(function(neighbor){
          if(neighbor.id == randomNeighborId) 
            return neighbor;
        })[0]
        if (getRandomInt(0, 2) == 0) {
          var randomRumor = user.rumors[getRandomInt(0, user.rumors.length)]
          if(randomRumor){
            var post_data = JSON.stringify({
                'Rumor' :
                    { 
                      Rumor: { 
                        messageID: randomRumor.Rumor.messageID,
                        Originator: randomRumor.Rumor.Originator,
                        Text: randomRumor.Rumor.Text
                      },
                    EndPoint: user.endpoint
                  }
                });
            };
            var options = {
              host: "localhost",
              port: 8081,
              path: neighborUser.endpoint,
              method: 'POST',
              headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(post_data)
              }
            };
            console.log(neighborUser.endpoint)
            console.log(post_data)
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
            //send an HTTP request to the endpoint
            var post_req = https.request(options, function(resp){
              resp.on('error', function(err){
                console.error(err)
              })
            })
            post_req.write(post_data)
            post_req.end();
          } else {
          // Prepare a want
          var want = makeWant(user);
          var post_data = JSON.stringify({
              'Want' : want,
          });
          var options = {
            host: "localhost",
            port: 8081,
            path: neighborUser.endpoint,
            method: 'POST',
            headers: {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(post_data)
            }
          };
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
          //send an HTTP request to the endpoint
          var post_req = https.request(options, function(resp){
            resp.on('error', function(err){
              console.error(err)
            })
          })
          post_req.write(post_data)
          post_req.end();
        }
      }
    })
  })
}, 3000);
