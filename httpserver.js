var http = require("http");
var url = require("url");

//
// ===============================================
//
//                  HttpServer
//
// ===============================================
//

var HttpServer = function(settings) {
    // public:
    this.addUrlRewrite = function(pattern, rule) {
        _rewrites.push({"pattern": pattern, "rule": rule});
    };

    this.addGetHandler = function(pattern, callback) {
        _getHandlers.push({"pattern": pattern, "callback": callback});
    };

    this.addPostHandler = function(pattern, callback) {
        _postHandlers.push({"pattern": pattern, "callback": callback});
    };

    this.addDefaultGetHandler = function(callback) {
        _defaultGetHandler = callback;
    };

    this.addDefaultPostHandler = function(callback) {
        _defaultPostHandler = callback;
    };

    this.addGetLogger = function(callback) {
        _getLoggers.push(callback);
    };

    this.addPostLogger = function(callback) {
        _postLoggers.push(callback);
    };

    this.run = function() {
        if (_settings.catchExceptions) {
            try {
                _createServer();
            } catch(err) {
                log.error(err);
            }
        } else {
            _createServer();
        }
    };

    // private:
    var _createServer = function() {
        http.createServer(function(request, response) {
            if (_settings.catchExceptions) {
                try {
                    _handleRequest(request, response);
                } catch(err) {
                    log.error(err);
                }
            } else {
                _handleRequest(request, response);
            }
        }).listen(_settings.port);
    };

    var _handleRequest = function(request, response) {
        _handleTrailingSlashes(request, response);
        _handleUrlRewrites(request, response);

        request.urls = url.parse(request.url, true);
        if (!request.urls.pathname)
            request.urls.pathname = "";
        request.path = request.urls.pathname.substring(1); // get rid of leading '/'

        log.info("request to " + request.originalUrl);

        if (request.method == "GET")
            _handleGetRequest(request, response);
        else if (request.method == "POST")
            _handlePostRequest(request, response);
    };

    var _handleTrailingSlashes = function(request, response) {
        request.originalUrl = request.url;
        if (_settings.removeTrailingSlashes) {
            if (request.url.endsWith("/"))
                request.url = request.url.substring(0, request.url.length - 1);
        }
    };

    var _handleUrlRewrites = function(request, response) {
        var i, max;
        for (i = 0, max = _rewrites.length; i < max; i += 1) {
            var rewrite = _rewrites[i];
            if (rewrite.pattern.test(request.url)) {
                request.url = rewrite.rule(request.url);
                return;
            }
        }
    };

    var _routeRequest = function(handlers, defaultHandler, request, response) {
        var i, max;
        for (i = 0, max = handlers.length; i < max; i += 1) {
            var handler = handlers[i];
            if (handler.pattern.test(request.url)) {
                handler.callback(request, response);
                return;
            }
        }
        defaultHandler(request, response);
    };

    var _handleGetRequest = function(request, response) {
        var i, max;
        for (i = 0, max = _getLoggers.length; i < max; i += 1) {
            _getLoggers[i](request);
        }
        _routeRequest(_getHandlers, _defaultGetHandler, request, response);
    };

    var _handlePostRequest = function(request, response) {
        var i, max;
        _savePostData(request);
        for (i = 0, max = _postLoggers.length; i < max; i += 1) {
            _postLoggers[i](request);
        }
        request.on("end", function() {
            _routeRequest(_postHandlers, _defaultPostHandler, request, response);
        });
    };

    var _savePostData = function(request) {
        request.postData = "";
        request.on("data", function(chunk) {
            request.postData += chunk.toString();
        });
    };

    var log = settings["logger"];
    var _settings = settings;
    var _rewrites = [];
    var _getHandlers = [];
    var _postHandlers = [];
    var _defaultGetHandler = function(request, response) {};
    var _defaultPostHandler = function(request, response) {};
    var _getLoggers = [];
    var _postLoggers = [];
};

module.exports.create = function(settings) {
    return new HttpServer(settings);
};
