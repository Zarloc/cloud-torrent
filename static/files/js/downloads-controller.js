/* globals app */

app.controller("DownloadsController", function($scope, $rootScope) {
  $rootScope.downloads = $scope;

  $scope.numDownloads = function() {
    if($scope.state.Downloads && $scope.state.Downloads.Children)
      return $scope.state.Downloads.Children.length;
    return 0;
  };
});

app.controller("NodeController", function($scope, $rootScope, $http, $timeout, $location) {
  var n = $scope.node;
  $scope.isfile = function() { return !n.Children; };
  $scope.isdir = function() { return !$scope.isfile(); };

  var pathArray = [n.Name];
  if($scope.$parent && $scope.$parent.$parent && $scope.$parent.$parent.node) {
    var parentNode = $scope.$parent.$parent.node;
    pathArray.unshift(parentNode.$path);
    n.$depth = parentNode.$depth + 1;
  } else {
    n.$depth = 1;
  }
  var path = n.$path = pathArray.join("/");
  n.$closed = $scope.agoHrs(n.Modified) > 24;

  //search for this file
  var torrents = $rootScope.state.Torrents;
  if($scope.isfile() && torrents) {
    for(var ih in torrents) {
      var files = torrents[ih].Files;
      if(files) {
        for (var i = 0; i < files.length; i++) {
          var f = files[i];
          if(f.Path === path) {
            n.$file = f;
            break;
          }
        }
      }
      if(n.$file)
        break;
    }
  }

  $scope.isdownloading = function() {
    return n.$file && n.$file.Percent < 5;
  };
  
  function ismedia (fileName) {
    if (/\.(mp4|avi|mkv|flv|webm|mp3|ogg|flac|wav)$/.test(fileName)) {
      return true;
    }   
  }

  $scope.preremove = function() {
    $scope.confirm = true;
    $timeout(function() {
      $scope.confirm = false;
    }, 3000);
  };

  //defaults
  $scope.closed = function() { return n.$closed; };
  $scope.toggle = function() { n.$closed = !n.$closed; };
  $scope.icon = function() {
    var c = [];
    if($scope.isdownloading()) {
      c.push("spinner", "loading")
    } else {
      c.push("outline");
      if($scope.isfile()) {
        if(/\.mp3$/.test(path))
          c.push("audio");
        else if(/\.(mp4|avi|mkv)$/.test(path))
          c.push("video");
        else if(/\.(jpe?g|png|gif)$/.test(path))
          c.push("image");
        c.push("file");
      } else {
        c.push("folder");
        if(!$scope.closed())
          c.push("open");
      }
    }
    c.push("icon");
    return c.join(" ");
  };

  $scope.remove = function() {
    $http.delete("/download/" + n.$path);
  };

  $scope.info = function() {
    window.open("/info/" + n.$path, '_blank').focus();
  };


  // M3U8

  function m3uPush (m3uContent,children,path) {
    for (var i in children) {
      if (ismedia(children[i].Name)) {
        m3uContent.push("#EXTINF: " + children[i].Name);
        m3uContent.push(encodeURI(path + children[i].Name));
      } else if (children[i].Children) {
        m3uContent = m3uPush(m3uContent,children[i].Children,path + children[i].Name + "/");
      }
    }
    return m3uContent;
  } 

  $scope.m3uCreator = function () {
    if ($scope.isdir()) {
      //console.log("Node :" +  JSON.stringify(n));
      //console.log("Torrent :" + JSON.stringify(torrents));

      var c = [];
      c.push("#EXTM3U");

      for (var la in torrents) {
        if (torrents[la].Name == n.Name) {
          var files = torrents[la].Files;
          for (var lu in files) {
            if (ismedia(files[lu].Path)) {
              c.push("#EXTINF: " + files[lu].Path);
              c.push(encodeURI($location.absUrl() + "download/" + files[lu].Path));
            }
          }
        }
      }

      if (c.length == 1) {
        c = m3uPush(c,n.Children,$location.absUrl() + "download/" + n.$path + "/");
      }

      if (c.length > 1) {
        var m3uText = c.join("\n");
        var m3uAsBlob = new Blob([m3uText], {type:'text/plain;charset=utf-8;'});
        return URL.createObjectURL(m3uAsBlob);
      }

    }
  };
  
  $scope.m3u = $scope.m3uCreator();

});
