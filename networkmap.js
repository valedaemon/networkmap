//Declare the Mongo collection.
NSpots = new Mongo.Collection('nspots');

if (Meteor.isClient) {
  //Handlebars helper for the main template. Configures the reactive table.
  Template.main.helpers({
    settings: function() {
      return {
        collection: NSpots,
        rowsPerPage: 10,
        showFilter: true,
        fields: [
          {key: 'vtypes', label: 'Virus Type', sort: 'ascending'},
          {key: 'wtype', label: 'Server Type'},
          {key: 'ip', label: 'IP'}
        ]
      }
    }
  })

  //Meteor's equivalent to $(document).ready(). Init Google Maps API.
  Template.main.rendered = function(){
    GoogleMaps.init(
      {
        'sensor': false,
      },
      function() {
        var DANGER_MAP_ID = 'custom';

        var mapOptions = {
          zoom: 4,
          mapTypeControl: true,
          mapTypeId: DANGER_MAP_ID,
          zoomControl: true,
          scaleControl: true,
          zoomControlOptions: {
            style: google.maps.ZoomControlStyle.SMALL
          }
        };
        
        var styledMapOptions = {
          name: 'Custom Style'
        };

        var featureOpts = [
          {
            stylers: [
              { hue: '#890000' },
              { visibility: 'simplified' },
              { gamma: 0.5 },
              { weight: 0.5 }
            ]
          },
          {
            elementType: 'labels',
            stylers: [
              { visibility: 'off' }
            ]
          },
          {
            featureType: 'water',
            stylers: [
              { color: '#890000' }
            ]
          }
        ];

        //Set map canvas, center, and styling
        map = new google.maps.Map(document.getElementById("map-canvas"), mapOptions);
        map.setCenter(new google.maps.LatLng(38.5000, -98.0000));

        var customMapType = new google.maps.StyledMapType(featureOpts, styledMapOptions);
        
        map.mapTypes.set(DANGER_MAP_ID, customMapType);

        //Function to place marker and infoWindow for the .observe
        function placeMarker(location, obj) {
          var img = 'img/biohazard-sm.png';
          var marker = new google.maps.Marker({
            position: location,
            map: map,
            icon: img,
            animation: google.maps.Animation.DROP,
            clickable: true
          });  
          marker.info = new google.maps.InfoWindow({
            content: '<strong>IP:</strong>' + obj.ip + '<br><strong>VType:</strong> ' + obj.vtypes + '<br><strong>Type:</strong> ' + obj.wtype
          });
          google.maps.event.addListener(marker,'click',function() {
            marker.info.open(map,marker);
          })
        }

        //Find new entries in the Mongo Collection.
        NSpots.find({}).observe({
          added: function(m) {
            console.log(m);
            var latlng = new google.maps.LatLng(m.lat, m.lon);
            placeMarker(latlng, m);
          }
        })
      }
    );
  };
}



if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup. This starts up internal cron functionality.
    SyncedCron.start();
  });

  //Prepare the chance npm library for use
  var Chance = Meteor.npmRequire('chance');
  var chance = new Chance();
  
  //Following are individual functions for creating new entries in Mongo.
  function getOwner() {
    return chance.hash();
  }

  function randomIP() {
    return chance.ip();
  }

  function getLat() {
    return chance.floating({min: 31.391, max: 48.7780});
  }

  function getLon() {
    return chance.floating({min: -123.9210, max: -79.7120});
  }

  function getVNum() {
    return chance.integer({min:1, max: 2});
  }

  function getVName() {
    var l = getVNum();
    var varr = [];
    var vtypes = ['APT1','Spam','Botnet','StealCreds'];
    for (var i=0;i<l;i++) {
      var pick = chance.pick(vtypes);
      varr.push(pick);
    }
    return varr;
  }

  function getIPFunction() {
    return chance.pick(['web server', 'mail server', 'ftp server']);
  }

  function createEntry() {
    return {
      owner: getOwner(),
      ip: randomIP(),
      lat: getLat(),
      lon: getLon(),
      vtypes: getVName(),
      wtype: getIPFunction()
    }
  }

  //Internal cron to add new entries every five seconds
  SyncedCron.add({
    name: 'add entry',
    schedule: function(parser) {
      return parser.text('every 5 seconds');
    },
    job: function() {
      return Meteor.call('storeEntry', function(err, res) {
        if (err) {
          console.log(err);
        } else {
          console.log("Inserted entries");
        }
      });
    }
  })

  console.log(createEntry());

  //Internal Meteor method to insert data
  Meteor.methods({
    storeEntry: function() {
      var entry = createEntry();
      var entry2 = createEntry();
      NSpots.insert(entry);
      NSpots.insert(entry2);
    }
  });

}
