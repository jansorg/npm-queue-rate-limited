A simple, rate limited task queue implementation for NodeJS / Javascript.

npm install queue-rate-limited

var Queue = require('queue-rate-limited');
var q = new Queue(2); //2 calls per seconds at most
q.start();
q.append(function(){
   //do some work
});


See test/queueTest.js how to use the API.