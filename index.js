/*global Morris: true */

(function( Morris ){
    'use strict';

    var $ = require('jquery'),
        _ = require('lodash'),
        request = require('superagent'),
        moment = require('moment'),
        bootstrap = require('components-bootstrap'),
        Q = require('q'),
        Vue = require('vue'),
        renderMorris = function(data){
            $("#"+data.element).html('');
            Morris.Area({
              element: data.element,
              data: data.data,
              xkey: 'date',
              ykeys: data.keys,
              labels: data.labels,
              behaveLikeLine: true
            });
        };

    var app = new Vue({
        el: '#app',
        data: {
            results: {},
            locations: {},
            tests: {},
            labels: {
                responseTime: {
                    median: {
                        domContentLoadedEventStart: 'DOM Content Ready Start',
                        domContentLoadedEventEnd: 'DOM Content Ready End',
                        loadTime: 'Document Complete',
                        loadEventStart: 'Load Event Start',
                        loadEventEnd: 'Load Event End',
                        fullyLoaded: 'Fully Loaded'
                    },
                    average: {
                        loadTime: 'Document Complete',
                        fullyLoaded: 'Fully Loaded'
                    }
                },
                contents: {
                    'html': 'HTML',
                    'css': 'CSS',
                    'image': 'Image',
                    'flash': 'Flash',
                    'js': 'JavaScript',
                    'font': 'Font',
                    'other': 'Other'
                }
            }
        },
        created: function(){
            var that = this;

            this.$watch('url', function(){
                that.renderGraph();
            });

            request.get('tests/results.json', function(res){
                that.results = res.body;
            });

            request.get('tests/locations.json', function(res){
                that.locations = res.body;
                that.location = _.chain(that.locations).keys().first().value();
                that.url = _.chain(that.urls).keys().first().value();
            });

        },
        computed: {
            urls: function(){
                return this.results[this.location]||{};
            },
            testIds: function(){
                return this.urls[this.url];
            }
        },
        filters: {
            convertToDate: function(time){
                return moment(time*1000).format('LLL');
            },
            totalBytes: function(data){
                var total = _.reduce(data, function(memo, val, key){
                    return memo + (val.bytes||0);
                }, 0);

                return total;
            },
            totalRequests: function(data){
                var total = _.reduce(data, function(memo, val, key){
                    return memo + (val.requests||0);
                }, 0);

                return total;
            },
            ms: function(num){
                return String(num).replace(/(\d{1,3})(?=(?:\d{3})+$)/g,"$1,")+' ms';
            },
            KB: function(num){
                return String((num / 1000).toFixed(1)).replace(/(\d{1,3})(?=(?:\d{3})+$)/g,"$1,")+' KB';
            }
        },
        methods: {
            renderGraph: function(){
                var requests = [],
                    that = this;

                _(this.testIds).each(function(testId){
                    var dfd = Q.defer();

                    request.get('tests/'+testId+'.json', function(res){
                        dfd.resolve(res.body);
                    });
                    requests.push(dfd.promise);
                });

                Q.all(requests).then(function(tests){

                    that.$set('tests', tests);

                    that.renderResponseTimeGraph( tests, 'average', 'first' );
                    that.renderResponseTimeGraph( tests, 'median', 'first' );
                    that.renderResponseTimeGraph( tests, 'average', 'repeat' );
                    that.renderResponseTimeGraph( tests, 'median', 'repeat' );
                    that.renderContentsSizeGraph( tests, 'first' );
                    that.renderContentsSizeGraph( tests, 'repeat' );
                    that.renderContentsRequestsGraph( tests, 'first' );
                    that.renderContentsRequestsGraph( tests, 'repeat' );
                });

            },
            renderResponseTimeGraph: function(tests, type, view){
                renderMorris({
                    data: _.map(tests, function(test){
                        var obj = test.response.data[type][view+'View'] || {};
                        obj.date = new Date( test.info.completed*1000 ).getTime();
                        return obj;
                    }),
                    keys: _(this.labels.responseTime[type]).keys().value(),
                    labels: _(this.labels.responseTime[type]).values().value(),
                    element: $.camelCase( view + '-' + type)
                });
            },
            renderContentsSizeGraph: function(tests, view){
                renderMorris({
                      data: _.map(tests, function(test){
                        var obj = {};
                        var tmp = 0;
                        _.each(test.response.data.median[view+'View'].breakdown, function(val, key){
                            obj[key] = ( val.bytes / 1000).toFixed(1);
                            tmp += Number(obj[key]);
                        });
                        obj.total = _.reduce(obj, function(memo, val, key){
                            return memo + Number(val||0);
                        }, 0).toFixed(1);
                        obj.date = new Date( test.info.completed*1000 ).getTime();
                        return obj;
                    }),
                    keys: _(this.labels.contents).keys().value().concat(['total']),
                    labels: _(this.labels.contents).values().value().concat(['Total']),
                    element: view + 'ContentsSize'
                });
            },
            renderContentsRequestsGraph: function(tests, view){
                renderMorris({
                      data: _.map(tests, function(test){
                        var obj = {};
                        var tmp = 0;
                        _.each(test.response.data.median[view+'View'].breakdown, function(val, key){
                            obj[key] = Number(val.requests);
                        });
                        obj.total = _.reduce(obj, function(memo, val, key){
                            return memo + Number(val||0);
                        }, 0);
                        obj.date = new Date( test.info.completed*1000 ).getTime();
                        return obj;
                    }),
                    keys: _(this.labels.contents).keys().value().concat(['total']),
                    labels: _(this.labels.contents).values().value().concat(['Total']),
                    element: view + 'ContentsRequests'
                });
            }
        }
    });

})(Morris);