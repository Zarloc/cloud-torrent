/* globals app,window */

app.factory('api', function($rootScope, $http, reqerr) {
  window.http = $http;
  var request = function(action, data) {
    var url = "/api/"+action;
    $rootScope.apiing = true;
    return $http.post(url, data).error(reqerr).finally(function() {
      $rootScope.apiing = false;
    });
  };
  var api = {};
  var actions = ["configure","magnet","url","torrent","file"];
  actions.forEach(function(action) {
    api[action] = request.bind(null, action);
  });
  return api;
});

app.factory('search', function($rootScope, $http, reqerr) {
  return {
    all: function(provider, query, page) {
      var params = {query:query};
      if(page !== undefined) params.page = page;
      $rootScope.searching = true;
      var req = $http.get("/search/"+provider, { params: params });
      req.error(reqerr);
      req.finally(function() {
        $rootScope.searching = false;
      });
      return req;
    },
    one: function(provider, path) {
      var opts = { params: { path:path } };
      $rootScope.searching = true;
      var req = $http.get("/search/"+provider+"-item", opts);
      req.error(reqerr);
      req.finally(function() {
        $rootScope.searching = false;
      });
      return req;
    }
  };
});

app.factory('storage', function() {
  return window.localStorage || {};
});

app.factory('reqerr', function() {
  return function(err, status) {
    alert(err.error || err);
    console.error("request error '%s' (%s)", err, status);
  };
});

app.filter('keys', function() {
  return Object.keys;
});

app.filter('addspaces', function() {
  return function(s) {
    if(typeof s !== "string")
      return s;
    return s.replace(/([A-Z]+[a-z]*)/g, function(_, word) {
      return " " + word;
    }).replace(/^\ /, "");
  };
});

app.filter('filename', function() {
  return function(path) {
    return (/\/([^\/]+)$/).test(path) ? RegExp.$1 : path;
  };
});

app.filter('bytes', function(bytes) {
  return bytes;
});

app.factory('bytes', function() {
  var scale = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
  return function(n) {
    if (typeof n !== 'number') {
      return "-";
    }
    var e = Math.floor(Math.log(n) / Math.log(1024))
    var s = scale[e];
    n /= Math.pow(2, e * 10);
    return "" + n.toFixed(e > 0) + " " + s;
  };
});

app.directive('ngEnter', function() {
  return function(scope, element, attrs) {
    element.bind("keydown keypress", function(event) {
      if (event.which === 13) {
        scope.$apply(function() {
          scope.$eval(attrs.ngEnter);
        });
        event.preventDefault();
      }
    });
  };
});

//TODO remove this hack
app.directive('jpSrc', function() {
  return function(scope, element, attrs) {
    scope.$watch(attrs.jpSrc, function(src) {
      element.attr("src", src);
    });
  };
});
