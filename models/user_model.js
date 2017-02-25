var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var config = {
    "USER" : "",
    "PASS" : "",
    "HOST" : "localhost",
    "PORT" : "27017",
    "DATABASE" : "userDB"
}
var dbPath = "mongodb://"+config.USER + ":"+
    config.PASS + "@"+
    config.HOST + ":"+
    config.PORT + "/"+
    config.DATABASE;

var db = mongoose.createConnection(dbPath);


mongoose.connect(dbPath, function(err) {
    if (err) {
        console.log(err);
    } else {
        console.log('Connected');
    }    
});
var UserSchema = new mongoose.Schema({
        id: String,
        firstName: String,
        lastName: String,
        checkins: {},
        foursquare: {},
        Token: String,
        UUID: String,
        endpoint: String,
        seed: {type: Boolean, default: false},
        rumors: [ 
                  { messageId: String, 
                    originator: String, 
                    text: String 
                  } 
               ],
        neighbors: [String]

    });

var User = mongoose.model('Users', UserSchema)

/*User.remove({}, function(err) { 
   console.log('collection removed') 
});*/
module.exports = User;