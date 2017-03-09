var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var config = {
    "USER" : "",
    "PASS" : "",
    "HOST" : "ec2-54-237-237-91.compute-1.amazonaws.com",
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
        rumors: [ {
                    Rumor: { messageID: String, 
                    Originator: String, 
                    Text: String 
                    },
                EndPoint: String
            }
        ],
        neighbors: [String]

    });

var User = mongoose.model('Users', UserSchema)
/*
User.remove({}, function(err) { 
   console.log('collection removed') 
});*/
module.exports = User;