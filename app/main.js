function Application(p){
    var me = this;
    me.getZoom = function(){
        var str = window.location.search;
        var mzoom = str.match("z=([0-9]+)");
        return mzoom && mzoom.length > 1 ? parseInt(mzoom[1]) : 12;
    };
    me.getCenter = function(){
        var str = window.location.search;
        var mlat = str.match("l=([0-9.]+)");
        var mlng = str.match(",([0-9.]+)");
        return [mlat && mlat.length > 1 ? parseFloat(mlat[1]) : 41.73891,mlng && mlng.length > 0 ? parseFloat(mlng[1]) : 44.82697];
    };
    me.getSet = function(){
        var str = window.location.search;
        var set = str.match("m=([a-zA-Z]+)");
        return set && set.length > 1 ? set[1] : "";
        
    };
    me.zoom = ko.observable(me.getZoom());
    me.center = ko.observable(me.getCenter());
    me.activeSet = ko.observable(me.getSet()||p.activeSet);    

    me.url = ko.pureComputed(function(){
        return ["?z=",me.zoom(),"&m=",me.activeSet(),"&l=",Number(me.center()[0]).toFixed(5),",",Number(me.center()[1]).toFixed(5)].join("");
    });
    me.url.subscribe(function(url){
        window.history.pushState(window.history.state,"",url);
    });
    me.isWikiEmbed = ko.observable(false);
    me.provider = ko.observable("L.GeoManager.GoogleGeocode");
    me.toggleMenu = function(){
        me.menu(!me.menu());
    };
    
    me.initializeMap = function(){
        
        me.map = L.map('map',{zoomControl:false,attributionControl:true,animate:true,minZoom: 3}).setView(me.center(), me.zoom());
        me.minimap = null;
        L.control.scale({position:"bottomright"}).addTo(me.map);
        L.control.zoom({position:"bottomleft"}).addTo(me.map);
        L.GeoManager.prototype.registerAPIKeys([
            { name: 'bing', value: 'AnRvpIKUSa29ARhk7djgoB5NjakSkchyrtlEqozjs3cAzwJ5s2SnJ7VAKhW2RVAC'}
            , {name: 'wikimapia', value: '60175C48-4B0C86C-A2D4D106-A5F37CAF-5A760C96-45526DF2-6D90C63B-511E68EE'}
            , {name:'google',value:'AIzaSyAGo33r6UECbDAJV63G20ULh6RtyzKBkXc'}
        ]);
        var apiKeys = {'bing':'AnRvpIKUSa29ARhk7djgoB5NjakSkchyrtlEqozjs3cAzwJ5s2SnJ7VAKhW2RVAC'
                       ,'wikimapia':'60175C48-4B0C86C-A2D4D106-A5F37CAF-5A760C96-45526DF2-6D90C63B-511E68EE'
                       ,'google':'AIzaSyAGo33r6UECbDAJV63G20ULh6RtyzKBkXc'};
        me.geoManager = new L.GeoManager(apiKeys);
        me.geoManager.addTo(me.map);

        me.map.on("moveend",function(e){
            var center = me.map.getCenter();
            me.center([center.lat,center.lng]);
        });
        me.map.on("zoomend",function(e){
            me.zoom(me.map.getZoom());
        });

        // google places autocomplete

        me.autocomplete = new google.maps.places.Autocomplete($("#search")[0]);
        google.maps.event.addListener(me.autocomplete, 'place_changed', function() {
            me.geoManager.geocode({providername: me.provider(), query:$('#search').val()});
        });
        
        $("#nav").show();
    };
    me.updateMinimap = function(l){
        if (l.type !== "layer") return false;
        var provider = me.geoManager._getFunctionByName(l.providername);
        var lprom = provider({providername:l.providername,title:l.title,map:me.map});
        me.activeSet(l.id);
        $.when(lprom).done(function(layer){
            console.log(layer);
            if (me.minimap !== null){
                me.minimap.changeLayer(layer);
            } else {
                me.minimap = new L.Control.MiniMap(layer,{ autoToggleDisplay:true,zoomLevelFixed:3,position:"bottomleft" }).addTo(me.map);
            }
        });
        return true;
    };
    me.bindLayers = function(ls,t){
        return ls.map(function(l){l.parent = me;l.type=t;return new MapLayer(l);});
    };
    me.removeLayers = function(l){
        me.baseL.forEach(function(x){if (x !== l) x.active(false);});
        $(".leaflet-overlay-pane g path.leaflet-clickable").remove();
    };
    me.addLayer = function(l){        
        var provider = me.geoManager._getFunctionByName(l.providername);
        var lprom = provider({providername:l.providername,title:l.title,map:me.map});
        $.when(lprom).done(function(layer){
            me.geoManager._layers.addLayer(layer, true);
            l.lid = me.geoManager._layers.getLayerId(layer);
            if (l.we) {
                me.isWikiEmbed(true);
                me.overlayL.forEach(function(o){o.active(false);});
            };
            me.updateMinimap(l);
            if (l.overlays.length > 0){
                
                l.overlays.forEach(function(o){me.addLayer(o);});
            }
            me.map.closePopup();
        });
    };
    me.removeLayer = function(l){
        me.geoManager._layers.removeLayer(l.lid);
        me.map.closePopup();
        l.lid = null;
        if (l.we) me.isWikiEmbed(false);
        if (l.overlays.length > 0){
            l.overlays.forEach(function(o){me.removeLayer(o);});        
        }
        
    };
    me.getLocation = function() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function(position){
                me.map.setView(L.latLng(position.coords.latitude, position.coords.longitude),me.zoom());
            });
        } else { alert("Geolocation is not supported by this browser.");}
    };
    me.initializeMap(p);
    me.interactiveL = me.bindLayers(p.interactiveL,"object");
    me.baseL = []; // fix me for a greatest good
    me.overlayL = []; // fix me for a greatest good

    me.baseL = me.bindLayers(p.baseL,"layer");
    me.overlayL = me.bindLayers(p.overlayL,"overlay");
    me.menu = ko.observable(p.menu||false);

    if (me.activeSet() && me.activeSet() !== ''){
        me.baseL.forEach(function(l){
            if (l.id === me.activeSet()){
                l.active(true);
            }
        });
    }
    
    return me;

}

function MapLayer(p){
    var me = this;
    me.id = p.id;
    me.lid = null;
    me.parent = p.parent;
    me.providername = p.providername;
    me.type = p.type;
    me.title = p.title;
    me.we = p.we;
    me.active = ko.observable(false);
    me.overlays = p.overlays && p.overlays.map ? p.overlays.map(function(o){return new MapLayer(o);}) : [];
    me.active.subscribe(function(a){
        if (a) {
            if (me.type == "layer") me.parent.removeLayers(me);
            me.parent.addLayer(me);
        } else {
            me.parent.removeLayer(me);
        }                 
    });
    // if (p.active){
    //     setTimeout(function(){me.active(true);},100);
    // }
    // me.active(p.active||false);
    return me;

}

ko.applyBindings(new Application({interactiveL:[],
                                  baseL:[{id:"googleRoadmap",providername:"L.GeoManager.GoogleRoadmap",title:"Google Карта",active:true,overlays:[{providername:"L.GeoManager.GoogleIdentify", title:"Google"}]},
                                         {id:"googleSatellite",providername:"L.GeoManager.GoogleSatellite",title:"Google Спутник",overlays:[{providername:"L.GeoManager.GoogleIdentify", title:"Google"}]},
                                         {id:"googleHybrid",providername:"L.GeoManager.GoogleHybrid",title:"Google Гибрид",overlays:[{providername:"L.GeoManager.GoogleIdentify", title:"Google"}]},
                                         // {providername:"L.GeoManager.GoogleTerrain",title:"Google Поверхность"},
                                         {id:"osm",providername:"L.GeoManager.OSM",title:"OpenStreetMap",overlays:[{providername:"L.GeoManager.OSMIdentify", title:"OpenStreetMap"}]},
                                         {id:"osmTransport",providername:"L.GeoManager.OpenCycleMapTransport",title:"OpenStreetMap Транспорт",overlays:[{providername:"L.GeoManager.OSMIdentify", title:"OpenStreetMap"}]},
                                         {id:"yandexPublic",providername:"L.GeoManager.YandexPublicMap",title:"Яндекс Народная карта",overlays:[{providername:"L.GeoManager.YandexIdentify", title:"Яндекс"}]},
                                         {id:"yandexMap",providername:"L.GeoManager.YandexMap",title:"Яндекс Карта",overlays:[{providername:"L.GeoManager.YandexIdentify", title:"Яндекс"}]},
                                         {id:"yandexSatellite",providername:"L.GeoManager.YandexSatellite",title:"Яндекс Спутник",overlays:[{providername:"L.GeoManager.YandexIdentify", title:"Яндекс"}]},
                                         {id:"bingMap",providername:"L.GeoManager.BingRoad",title:"Bing",overlays:[{providername:"L.GeoManager.BingIdentify",title:"Bing"}]},
                                         {id:"bingHybrid",providername:"L.GeoManager.BingAerialWithLabels",title:"Bing Гибрид",overlays:[{providername:"L.GeoManager.BingIdentify",title:"Bing"}]},
                                         {id:"bingSatellite",providername:"L.GeoManager.BingAerial",title:"Bing Спутник",overlays:[{providername:"L.GeoManager.BingIdentify",title:"Bing"}]},
                                         {id:"googleSatelliteWikimapia",providername:"L.GeoManager.GoogleSatellite",title:"Wikimapia Google",we: true, overlays:[{providername:"L.GeoManager.WikimapiaOverlay",title:"Wikimapia"},
                                                                                                                         {providername:"L.GeoManager.WikimapiaInteractive",title:"Wikimapia"}]},
                                         {id:"yandexSatelliteWikimapia",providername:"L.GeoManager.YandexSatellite",title:"Wikimapia Яндекс",we: true,overlays:[{providername:"L.GeoManager.WikimapiaOverlay",title:"Wikimapia"},
                                                                                                                         {providername:"L.GeoManager.WikimapiaInteractive",title:"Wikimapia"}]},
                                         {id:"bingSatelliteWikimapia",providername:"L.GeoManager.BingAerial",title:"Wikimapia Bing",we: true,overlays:[{providername:"L.GeoManager.WikimapiaOverlay",title:"Wikimapia"},
                                                                                                                         {providername:"L.GeoManager.WikimapiaInteractive",title:"Wikimapia"}]}
                                        ],
                                  overlayL:[{providername:"L.GeoManager.WikimapiaOverlay",title:"Добавить слой Wikimapia",overlays:[{providername:"L.GeoManager.WikimapiaInteractive",title:"Wikimapia"}]}]
                                  , menu: true
                                  ,activeSet:"googleRoadmap"
                                 }));
