/*
    Heavily inspired by the original js library copyright Mixpanel, Inc.
    (http://mixpanel.com/)

    Modified to be used as a module, without using nodejs/jquery libs.
    https://github.com/vinodc/mixpanel-node

    Copyright (c) 2012 Carl Sverre

    Released under the MIT license.
*/

(function(global) {
    "use strict";
    
    // http://stackoverflow.com/a/12041192/827437
    var Base64 = (function() {
        var _keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

        var _utf8_encode = function (string) {
            var utftext = "", c, n;
            string = string.replace(/\r\n/g,"\n");
            
            for (n = 0; n < string.length; n++) {
                c = string.charCodeAt(n);
                if (c < 128) {
                    utftext += String.fromCharCode(c);
                } else if((c > 127) && (c < 2048)) {
                    utftext += String.fromCharCode((c >> 6) | 192);
                    utftext += String.fromCharCode((c & 63) | 128);
                } else {
                    utftext += String.fromCharCode((c >> 12) | 224);
                    utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                    utftext += String.fromCharCode((c & 63) | 128);
                }
            }
            
            return utftext;
        };

        var _utf8_decode = function (utftext) {
            var string = "", i = 0, c = 0, c1 = 0, c2 = 0;

            while ( i < utftext.length ) {
                c = utftext.charCodeAt(i);
                if (c < 128) {
                    string += String.fromCharCode(c);
                    i++;
                } else if((c > 191) && (c < 224)) {
                    c1 = utftext.charCodeAt(i+1);
                    string += String.fromCharCode(((c & 31) << 6) | (c1 & 63));
                    i += 2;
                } else {
                    c1 = utftext.charCodeAt(i+1);
                    c2 = utftext.charCodeAt(i+2);
                    string += String.fromCharCode(((c & 15) << 12) | ((c1 & 63) << 6) | (c2 & 63));
                    i += 3;
                }
            }

            return string;
        };

        var _hexEncode = function(input) {
            var output = '', i;

            for(i = 0; i < input.length; i++) {
                output += input.charCodeAt(i).toString(16);
            }

            return output;
        };

        var _hexDecode = function(input) {
            var output = '', i;

            if(input.length % 2 > 0) {
                input = '0' + input;
            }

            for(i = 0; i < input.length; i = i + 2) {
                output += String.fromCharCode(parseInt(input.charAt(i) + input.charAt(i + 1), 16));
            }

            return output;
        };

        var encode = function (input) {
            var output = "", chr1, chr2, chr3, enc1, enc2, enc3, enc4, i = 0;

            input = _utf8_encode(input);

            while (i < input.length) {

                chr1 = input.charCodeAt(i++);
                chr2 = input.charCodeAt(i++);
                chr3 = input.charCodeAt(i++);

                enc1 = chr1 >> 2;
                enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
                enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
                enc4 = chr3 & 63;

                if (isNaN(chr2)) {
                    enc3 = enc4 = 64;
                } else if (isNaN(chr3)) {
                    enc4 = 64;
                }

                output += _keyStr.charAt(enc1);
                output += _keyStr.charAt(enc2);
                output += _keyStr.charAt(enc3);
                output += _keyStr.charAt(enc4);

            }

            return output;
        };

        var decode = function (input) {
            var output = "", chr1, chr2, chr3, enc1, enc2, enc3, enc4, i = 0;

            input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

            while (i < input.length) {

                enc1 = _keyStr.indexOf(input.charAt(i++));
                enc2 = _keyStr.indexOf(input.charAt(i++));
                enc3 = _keyStr.indexOf(input.charAt(i++));
                enc4 = _keyStr.indexOf(input.charAt(i++));

                chr1 = (enc1 << 2) | (enc2 >> 4);
                chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
                chr3 = ((enc3 & 3) << 6) | enc4;

                output += String.fromCharCode(chr1);

                if (enc3 !== 64) {
                    output += String.fromCharCode(chr2);
                }
                if (enc4 !== 64) {
                    output += String.fromCharCode(chr3);
                }

            }

            return _utf8_decode(output);
        };

        var decodeToHex = function(input) {
            return _hexEncode(decode(input));
        };

        var encodeFromHex = function(input) {
            return encode(_hexDecode(input));
        };

        return {
            'encode': encode,
            'decode': decode,
            'decodeToHex': decodeToHex,
            'encodeFromHex': encodeFromHex
        };
    }());

    
    function init(token, config) {
    var metrics = {};

    if(!token) {
        throw new Error("The Mixpanel Client needs a Mixpanel token: `init(token)`");
    }

    metrics.config = {
        test: false,
        debug: false,
        verbose: false
    };

    metrics.token = token;

    /**
        send_request(data)
        ---
        this function sends an async GET request to mixpanel

        data:object                     the data to send in the request
        callback:function(err:Error)    callback is called when the request is
                                        finished or an error occurs
    */
    metrics.send_request = function(endpoint, data, callback) {
        callback = callback || function() {};
        var event_data = JSON.stringify(data);
        var request_data = {
            'data': Base64.encode(event_data),
            'ip': 0,
            'verbose': metrics.config.verbose ? 1 : 0
        };

        if (endpoint === '/import') {
            var key = metrics.config.key;
            if (!key) {
                throw new Error("The Mixpanel Client needs a Mixpanel api key when importing old events: `init(token, { key: ... })`");
            }
            request_data.api_key = key;
        }

        var request_options = {
            host: 'api.mixpanel.com',
            port: 80,
            headers: {}
        };

        if (metrics.config.test) { request_data.test = 1; }

        // http://stackoverflow.com/a/1714899/827437
        var serialize = function(obj) {
            var str = [];
            for(var p in obj)
                str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
            return str.join("&");
        }
        
        var query = serialize(request_data);

        request_options.path = [endpoint,"?",query].join("");

        // Modify code to use JS http request.
        
        var url = ['https://',request_options.host, request_options.path].join("");
        
        var httpRequest = new XMLHttpRequest();

        httpRequest.onreadystatechange = function() {
            try {
                if (httpRequest.readyState === 4) {
                    if (httpRequest.status === 200) {
                        var e;
                        if(metrics.config.verbose) {
                            try {
                                var result = JSON.parse(data);
                                if(result.status != 1) {
                                    e = new Error("Mixpanel Server Error: " + result.error);
                                }
                            }
                            catch(ex) {
                                e = new Error("Could not parse response from Mixpanel");
                            }
                        }
                        else {
                            e = (data !== '1') ? new Error("Mixpanel Server Error: " + data) : undefined;
                        }
                        
                        callback(e);
                    }
                    else {
                        var e = new Error(httpRequest.status + ": " + httpRequest.responseText);
                        if(metrics.config.debug) {
                            console.log(e.toString());
                        }
                        callback(e);
                    }
                }
            }
            catch (ex) {
                if(metrics.config.debug) {
                    console.log("Caught exception: " + e.description);
                }
                callback(new Error(ex.description));
            }
        };

        httpRequest.open('GET', url);
        httpRequest.send();

    };

    /**
        track(event, properties, callback)
        ---
        this function sends an event to mixpanel.

        event:string                    the event name
        properties:object               additional event properties to send
        callback:function(err:Error)    callback is called when the request is
                                        finished or an error occurs
    */
    metrics.track = function(event, properties, callback) {
        if (typeof(properties) === 'function' || !properties) {
            callback = properties;
            properties = {};
        }

        // if properties.time exists, use import endpoint
        var endpoint = (typeof(properties.time) === 'number') ? '/import' : '/track';

        properties.token = metrics.token;
        properties.mp_lib = "js";

        var data = {
            'event' : event,
            'properties' : properties
        };

        if (metrics.config.debug) {
            console.log("Sending the following event to Mixpanel:");
            console.log(data);
        }

        metrics.send_request(endpoint, data, callback);
    };

    /**
        import(event, properties, callback)
        ---
        This function sends an event to mixpanel using the import
        endpoint.  The time argument should be either a Date or Number,
        and should signify the time the event occurred.

        It is highly recommended that you specify the distinct_id
        property for each event you import, otherwise the events will be
        tied to the IP address of the sending machine.

        For more information look at:
        https://mixpanel.com/docs/api-documentation/importing-events-older-than-31-days

        event:string                    the event name
        time:date|number                the time of the event
        properties:object               additional event properties to send
        callback:function(err:Error)    callback is called when the request is
                                        finished or an error occurs
    */
    metrics.import = function(event, time, properties, callback) {
        if (typeof(properties) === 'function' || !properties) {
            callback = properties;
            properties = {};
        }

        if (time === void 0) {
            throw new Error("The import method requires you to specify the time of the event");
        } else if (Object.prototype.toString.call(time) === '[object Date]') {
            time = Math.floor(time.getTime() / 1000);
        }

        properties.time = time;

        metrics.track(event, properties, callback);
    };

    /**
        alias(distinct_id, alias)
        ---
        This function creates an alias for distinct_id

        For more information look at:
        https://mixpanel.com/docs/integration-libraries/using-mixpanel-alias

        distinct_id:string              the current identifier
        alias:string                    the future alias
    */
    metrics.alias = function(distinct_id, alias, callback) {
        var properties = {
            distinct_id: distinct_id,
            alias: alias
        };

        metrics.track('$create_alias', properties, callback);
    };

    metrics.people = {
        /** people.set_once(distinct_id, prop, to, callback)
            ---
            The same as people.set but in the words of mixpanel:
            mixpanel.people.set_once

            " This method allows you to set a user attribute, only if
             it is not currently set. It can be called multiple times
             safely, so is perfect for storing things like the first date
             you saw a user, or the referrer that brought them to your
             website for the first time. "

        */
        set_once: function(distinct_id, prop, to, callback) {
            var $set = {}, data = {};

            if (typeof(prop) === 'object') {
                callback = to;
                $set = prop;
            } else {
                $set[prop] = to;
            }

            this._set(distinct_id, $set, callback, { set_once: true });
        },

        /**
            people.set(distinct_id, prop, to, callback)
            ---
            set properties on an user record in engage

            usage:

                mixpanel.people.set('bob', 'gender', 'm');

                mixpanel.people.set('joe', {
                    'company': 'acme',
                    'plan': 'premium'
                });
        */
        set: function(distinct_id, prop, to, callback) {
            var $set = {}, data = {};

            if (typeof(prop) === 'object') {
                callback = to;
                $set = prop;
            } else {
                $set[prop] = to;
            }

            this._set(distinct_id, $set, callback);
        },

        // used internally by set and set_once
        _set: function(distinct_id, $set, callback, options) {
            var set_key = (options && options.set_once) ? "$set_once" : "$set";

            var data = {
                '$token': metrics.token,
                '$distinct_id': distinct_id
            };
            data[set_key] = $set;

            if ('ip' in $set) {
                data.$ip = $set.ip;
                delete $set.ip;
            }

            if ($set.$ignore_time) {
                data.$ignore_time = $set.$ignore_time;
                delete $set.$ignore_time;
            }

            if(metrics.config.debug) {
                console.log("Sending the following data to Mixpanel (Engage):");
                console.log(data);
            }

            metrics.send_request('/engage', data, callback);
        },

        /**
            people.increment(distinct_id, prop, to, callback)
            ---
            increment/decrement properties on an user record in engage

            usage:

                mixpanel.people.increment('bob', 'page_views', 1);

                // or, for convenience, if you're just incrementing a counter by 1, you can
                // simply do
                mixpanel.people.increment('bob', 'page_views');

                // to decrement a counter, pass a negative number
                mixpanel.people.increment('bob', 'credits_left', -1);

                // like mixpanel.people.set(), you can increment multiple properties at once:
                mixpanel.people.increment('bob', {
                    counter1: 1,
                    counter2: 3,
                    counter3: -2
                });
        */
        increment: function(distinct_id, prop, by, callback) {
            var $add = {};

            if (typeof(prop) === 'object') {
                callback = by;
                Object.keys(prop).forEach(function(key) {
                    var val = prop[key];

                    if (isNaN(parseFloat(val))) {
                        if (metrics.config.debug) {
                            console.error("Invalid increment value passed to mixpanel.people.increment - must be a number");
                            console.error("Passed " + key + ":" + val);
                        }
                        return;
                    } else {
                        $add[key] = val;
                    }
                });
            } else {
                if (!by) { by = 1; }
                $add[prop] = by;
            }

            var data = {
                '$add': $add,
                '$token': metrics.token,
                '$distinct_id': distinct_id
            };

            if(metrics.config.debug) {
                console.log("Sending the following data to Mixpanel (Engage):");
                console.log(data);
            }

            metrics.send_request('/engage', data, callback);
        },

        /**
            people.track_charge(distinct_id, amount, properties, callback)
            ---
            Record that you have charged the current user a certain
            amount of money.

            usage:

                // charge a user $29.99
                mixpanel.people.track_charge('bob', 29.99);

                // charge a user $19 on the 1st of february
                mixpanel.people.track_charge('bob', 19, { '$time': new Date('feb 1 2012') });
        */
        track_charge: function(distinct_id, amount, properties, callback) {
            var $append = {};

            if (!properties) { properties = {}; }

            if (typeof(amount) !== 'number') {
                amount = parseFloat(amount);
                if (isNaN(amount)) {
                    console.error("Invalid value passed to mixpanel.people.track_charge - must be a number");
                    return;
                }
            }

            properties.$amount = amount;

            if (properties.hasOwnProperty('$time')) {
                var time = properties.$time;
                if (Object.prototype.toString.call(time) === '[object Date]') {
                    properties.$time = time.toISOString();
                }
            }

            var data = {
                '$append': { '$transactions': properties },
                '$token': metrics.token,
                '$distinct_id': distinct_id
            };

            if(metrics.config.debug) {
                console.log("Sending the following data to Mixpanel (Engage):");
                console.log(data);
            }

            metrics.send_request('/engage', data, callback);
        },

        /**
            people.clear_charges(distinct_id, callback)
            ---
            Clear all the current user's transactions.

            usage:

                mixpanel.people.clear_charges('bob');
        */
        clear_charges: function(distinct_id, callback) {
            var data = {
                '$set': { '$transactions': [] },
                '$token': metrics.token,
                '$distinct_id': distinct_id
            };

            if(metrics.config.debug) {
                console.log("Clearing this user's charges:", distinct_id);
            }

            metrics.send_request('/engage', data, callback);
        },

        /**
            people.delete_user(distinct_id, callback)
            ---
            delete an user record in engage

            usage:

                mixpanel.people.delete_user('bob');
        */
        delete_user: function(distinct_id, callback) {
            var data = {
                '$delete': distinct_id,
                '$token': metrics.token,
                '$distinct_id': distinct_id
            };

            if(metrics.config.debug) {
                console.log("Deleting the user from engage:", distinct_id);
            }

            metrics.send_request('/engage', data, callback);
        },

        /**
         people.unset(distinct_id, prop, callback)
         ---
         delete a property on an user record in engage

         usage:

            mixpanel.people.unset('bob', 'page_views');

            mixpanel.people.unset('bob', ['page_views', 'last_login']);
         */
        unset: function(distinct_id, prop, callback) {
            var $unset = [];

            if (prop instanceof Array) {
                $unset = prop;
            } else if (typeof(prop) === 'string') {
                $unset = [prop];
            } else {
                if (metrics.config.debug) {
                    console.error("Invalid argument passed to mixpanel.people.unset - must be a string or array");
                    console.error("Passed: " + prop);
                }
                return;
            }

            data = {
                '$unset': $unset,
                '$token': metrics.token,
                '$distinct_id': distinct_id
            };

            if(metrics.config.debug) {
                console.log("Sending the following data to Mixpanel (Engage):");
                console.log(data);
            }

            metrics.send_request('/engage', data, callback);
        }
    };

    /**
        set_config(config)
        ---
        Modifies the mixpanel config

        config:object       an object with properties to override in the
                            mixpanel client config
    */
    metrics.set_config = function(config) {
        for (var c in config) {
            if (config.hasOwnProperty(c)) {
                metrics.config[c] = config[c];
            }
        }
    };

    if (config) {
        metrics.set_config(config);
    }

    return metrics;
    };

    global.Mixpanel = {
        init: init
    };
})(this);
