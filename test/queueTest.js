var test = require('tape');
var Queue = require('../src/queue-rate-limited.js');

test('A new queue is empty', function (t) {
    t.plan(1);

    t.ok(new Queue().isEmpty(), "A new queue is empty");
});

test('A new queue has a default of one call per seconnd', function (t) {
    t.plan(1);

    t.equals(new Queue().getMaxCallsPerSecond(), 1, "The default should be one call per second");
});

test('A queue can take maxCallsPerSeconcd', function (t) {
    t.plan(2);

    t.equals(new Queue(5).getMaxCallsPerSecond(), 5, "5 calls per second expected");
    t.equals(new Queue(1 / 5).getMaxCallsPerSecond(), 0.2, "5 seconds per task expected");
});

test('A new queue is in stopped state', function (t) {
    t.plan(2);

    t.ok(new Queue().isStopped(), "A new queue is stopped");

    t.notOk(new Queue().isStarted(), "A new queue is stopped");
});

test('Calling appends appends the new tasks', function (t) {
    t.plan(4);

    var q = new Queue();
    t.ok(new Queue().isEmpty(), "A new queue must be empty");

    q.append(function () {
    });
    t.notOk(q.isEmpty(), "A modified queue must not be empty");
    t.equals(q.getQueueSize(), 1, "After append one item must be queued.");

    q.prepend(function () {
    });
    t.equals(q.getQueueSize(), 2, "After prepend one more item must be queued.");
});

test('onSuccess must be called with the tasks result if no error occurrs', function (t) {
    t.plan(2);

    var q = new Queue();

    var successCalled = false;
    var successArg = null;

    q.append(function () {
        return 1;
    }, function (arg) {
        successCalled = true;
        successArg = arg;
    });

    q.start();

    t.ok(successCalled, "onSuccess must be called");
    t.equals(successArg, 1, "onSuccess must be called with the task's result");
});

test('onError must be called if an error occurrs', function (t) {
    t.plan(3);

    var q = new Queue();

    var successCalled = false;
    var errorCalled = false;
    var errorArg = null;

    q.append(function () {
        throw "ERROR!"
    }, function () {
        successCalled = true;
    }, function (e) {
        errorCalled = true;
        errorArg = e;
    });

    q.start();

    t.notOk(successCalled, "onSuccess must not be called");
    t.ok(errorCalled, "onSuccess must not be called");
    t.equals(errorArg, "ERROR!", "onError must have the exception as argument");
});

test("The queue does not execute faster than the specified max calls per second", function (t) {
    t.plan(6 + 30);

    var q = new Queue(5);
    q.start();

    t.ok(q.isStarted(), "The queue must be started");
    t.ok(q.isEmpty(), "The queue must be empty at first");

    var execTimestamps = [];
    var execIds = [];

    for (var i = 0; i < 30; i++) {
        const current = i;
        q.append(function () {
            execTimestamps.push(Date.now());
            execIds.push(current);
        });
    }

    setTimeout(function () {
        t.equals(execTimestamps.length, 30, "All tasks must be executed");
        t.equals(execIds.length, 30, "All tasks must be executed");

        for (var i = 0; i < 30; i++) {
            t.equals(execIds[i], i, "The tasks must be executed in insertion order");
        }
    }, 6 * 1000);

    t.ok(q.isEmpty(), "Tee queue should be empty by now");

    q.stop();
    t.ok(q.isStopped(), "The queue should be stopped by now");
});

test("Starting after stopped works", function (t) {
    t.plan(4);

    var q = new Queue();

    t.ok(q.isStopped());

    q.start();
    t.ok(q.isStarted());

    q.stop();
    t.ok(q.isStopped());

    q.start();
    t.ok(q.isStarted());
});