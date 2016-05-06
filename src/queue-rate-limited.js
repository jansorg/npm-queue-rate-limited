(function () {
    "use strict";

    function nullCallback() {
        //empty callback, acts as null pattern
    }

    /**
     * Creates a new rate limited queue. The queue is created with stopped state, i.e. you have to call start() to run jobs.
     * @param {number} maxCallsPerSecond=1 - The rate limit of this queue in maximum calls per seconds which may be executed at any time. Pass values less than 1 to have less than one call per second, e.g. 1/3 for 3 one call in three seconds at maximum.
     *
     * @constructor
     */
    function Queue(maxCallsPerSecond) {
        this.maxCallsPerSecond = typeof(maxCallsPerSecond) === "undefined" ? 1 : maxCallsPerSecond;

        this.tasks = [];
        this.isActive = false;
        this.jobIntervalMillis = 1000 / maxCallsPerSecond;

        this.lastTaskTimestamp = null;
        this.currentTaskTimeoutId = null;
    }

    /**
     * Processes the next task and returns the id of the time used to wait for the next invocation of this method.
     * @return {number} - The id of the started timer. It will return null if no time is necessary, i.e. if no more task is available in the queue.
     * @private
     */
    Queue.prototype.updateTaskSchedule = function () {
        if (this.isEmpty() || this.isStopped()) {
            return;
        }

        var queue = this;

        function processNextTask() {
            var nextTaskItem = queue.tasks.shift();
            if (nextTaskItem) {
                try {
                    var result = nextTaskItem.task.call();

                    queue.lastTaskTimestamp = Date.now();

                    nextTaskItem.onSuccess.call(null, result);
                } catch (e) {
                    nextTaskItem.onError.call(null, e);
                }
            }
        }

        function scheduleNext(timeoutMillisOverride) {
            if (queue.isEmpty()) {
                return;
            }

            queue.currentTaskTimeoutId = setTimeout(function () {
                processNextTask();

                queue.lastTaskTimestamp = Date.now();
            }, timeoutMillisOverride && timeoutMillisOverride > 0 ? timeoutMillisOverride : queue.jobIntervalMillis);
        }

        var sinceLastInterval = Date.now() - this.lastTaskTimestamp;
        if (this.lastTaskTimestamp == null || sinceLastInterval > this.jobIntervalMillis) {
            //the first task ever
            processNextTask();
            scheduleNext();
        } else {
            scheduleNext(this.jobIntervalMillis - sinceLastInterval);
        }
    };

    /**
     * Starts the task processing of this queue.
     *
     * If it is already started, then false will be returned.
     * If it is not yet started then the first task will be processed in the background and true will be returned.
     *
     * @return {boolean} true if this queue wasn't started before and now started to process tasks.
     */
    Queue.prototype.start = function () {
        if (this.isActive) {
            return false;
        }

        this.isActive = true;

        this.updateTaskSchedule();

        return true;
    };

    /**
     * Stops the processing of this queue.
     * @return true if the queue was started and is now stopped. false if it was already stopped.
     */
    Queue.prototype.stop = function () {
        if (this.isActive) {
            this.isActive = false;

            if (this.currentTaskTimeoutId) {
                clearInterval(this.currentTaskTimeoutId);
                this.currentTaskTimeoutId = null;
            }
        }
    };

    Queue.prototype.getMaxCallsPerSecond = function () {
        return this.maxCallsPerSecond;
    };

    Queue.prototype.isStarted = function () {
        return this.isActive;
    };

    Queue.prototype.isStopped = function () {
        return !this.isStarted();
    };

    /**
     * @returns {boolean} true if this queue is currently empty, i.e. if it has no tasks in the queue.
     */
    Queue.prototype.isEmpty = function () {
        return this.tasks.length === 0;
    };

    /**
     * @returns {boolean} true if this queue has one or more entries.
     */
    Queue.prototype.isNotEmpty = function () {
        return !this.isEmpty();
    };

    /**
     * @param {function} task - The task to add.
     * @param {boolean} append - if the task should be appended or prepended to the list of queued tasks
     * @param {function} [onSuccess] - Called after the task was successfully executed
     * @param {function} [onError] - Called when an error occurred while executing the ask. The exception will be passed to the callback.
     */
    Queue.prototype.add = function (task, append, onSuccess, onError) {
        var newTaskItem = {task: task, onSuccess: onSuccess || nullCallback, onError: onError || nullCallback};

        if (this.isEmpty() || append) {
            this.tasks.push(newTaskItem);
        } else {
            this.tasks.unshift(newTaskItem);
        }

        this.updateTaskSchedule();
    };

    /**
     * Appends a new task at the end of the queue.
     * @param {function} task - The task to perform. This function will be called with no arguments.
     * @param {function} [onSuccess] - Called after the task was successfully executed
     * @param {function} [onError] - Called when an error occurred while executing the ask. The exception will be passed to the callback.
     * @return {Queue} - The current queue itself
     */
    Queue.prototype.append = function (task, onSuccess, onError) {
        this.add(task, true, onSuccess, onError);
    };

    /**
     * Adds a new task as first item in the queue.
     * @param task
     * @param {function} [onSuccess] - Called after the task was successfully executed
     * @param {function} [onError] - Called when an error occurred while executing the ask. The exception will be passed to the callback.
     */
    Queue.prototype.prepend = function (task, onSuccess, onError) {
        this.add(task, false, onSuccess, onError);
    };

    /**
     * Removes the task from the qeueue. If the task is contained more than one time then all occurrences will be removed.
     * @param {function} task - The task to remove.
     * @return {number} - The number of items which were removed.
     */
    Queue.prototype.remove = function (task) {
        if (this.isEmpty()) {
            return 0;
        }

        var removedItems = 0;
        for (var i = this.tasks.length-1; i>=0; i--) {
            if (this.tasks[i].task === task) {
                this.tasks.splice(i, 1);
                removedItems++;
            }
        }

        return removedItems;
    };

    Queue.prototype.getQueueSize = function () {
        return this.tasks.length;
    };

    module.exports = Queue;
})();