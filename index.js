/*global Morris, Q */

(function( Morris, Q ){
    'use strict';

    var $ = require('jquery'),
        _ = require('lodash'),
        request = require('superagent'),
        moment = require('moment'),
        bootstrap = require('components-bootstrap'),
        Vue = require('vue'),
        renderMorris = function(data){
            $("#"+data.element).html('');
            Morris.Area({
              element: data.element,
              data: data.data,
              xkey: 'date',
              ykeys: data.keys.reverse(),
              labels: data.labels.reverse(),
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
                    html: 'HTML',
                    css: 'CSS',
                    image: 'Image',
                    flash: 'Flash',
                    js: 'JavaScript',
                    font: 'Font',
                    other: 'Other'
                }
            }
        },
        created: function(){
            var that = this;

            this.$watch('url', function(){
                that.renderGraph();
                that.renderComparizonGraph();
            });
            this.$watch('results', function(){
                that.renderGraph();
                that.renderComparizonGraph();
            });

            request.get('tests/results.json')
                   .set('Content-Type', 'application/json')
                   .end(function(res){
                        that.results = res.body;
                   });

            request.get('tests/locations.json')
                   .set('Content-Type', 'application/json')
                   .end(function(res){
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
            },
            allTestIds: function(){
                return _.chain(this.urls).map(function(val, key){ 
                    return val;
                }).flatten().map(function(val){
                    return typeof val === 'string' ? val : false;
                }).compact().value();
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
            getTests: function(testIds){
                var requests = [],
                    that = this;

                _(testIds).each(function(testId){
                   var dfd = Q.defer();

                    request.get('tests/'+testId+'.json')
                           .set('Content-Type', 'application/json')
                           .end(function(res){
                                var data = res.body.response.data,
                                    isExists = function(source, target){
                                        return _.every(source, function(val){
                                            return _.contains(target, val);
                                        });
                                    };

                                if(isExists( _.keys(that.labels.responseTime.average), _.keys(data.average.firstView)) &&
                                   isExists( _.keys(that.labels.responseTime.average), _.keys(data.average.repeatView)) &&
                                   isExists( _.keys(that.labels.responseTime.median), _.keys(data.median.firstView)) &&
                                   isExists( _.keys(that.labels.responseTime.median), _.keys(data.median.repeatView)) &&
                                   isExists( _.keys(that.labels.contents), _.keys(data.median.firstView.breakdown)) &&
                                   isExists( _.keys(that.labels.contents), _.keys(data.median.repeatView.breakdown))){
                                    dfd.resolve(res.body);
                                } else {
                                    dfd.resolve();
                                }
                           });
                    requests.push(dfd.promise);
                });

                return Q.all(requests);
            },
            renderComparizonGraph: function(){
                var that = this;

                this.getTests(this.allTestIds).done(function(tests){
                    tests = _.compact(tests);

                    that.$set('tests', tests);

                    that.renderComparizonResponseTimeGraph( tests, 'average', 'first', 'fullyLoaded' );
                    that.renderComparizonResponseTimeGraph( tests, 'average', 'repeat', 'fullyLoaded' );
                });
            },
            renderGraph: function(){
                var that = this;

                this.getTests(this.testIds).done(function(tests){
                    tests = _.compact(tests);

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
            renderComparizonResponseTimeGraph: function(tests, type, view, key){

                var urls = _.keys( this.urls );

                renderMorris({
                    data: _.map(tests, function(test){
                        var obj = {};
                        obj[test.response.data.testUrl] = test.response.data[type][view+'View'][key];
                        obj.date = new Date( test.response.data.completed ).getTime();
                        console.log(obj);
                        return obj;
                    }),
                    keys: urls,
                    labels: urls,
                    element: $.camelCase( view + '-' + type + '-' + key)
                });
            },
            renderResponseTimeGraph: function(tests, type, view){
                renderMorris({
                    data: _.map(tests, function(test){
                        var obj = test.response.data[type][view+'View'] || {};
                        obj.date = new Date( test.response.data.completed ).getTime();
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
                            obj[key] = ( (val.bytes||0) / 1000).toFixed(1);
                            tmp += Number(obj[key]);
                        });
                        obj.total = _.reduce(obj, function(memo, val, key){
                            return memo + Number(val||0);
                        }, 0).toFixed(1);
                        obj.date = new Date( test.response.data.completed ).getTime();
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
                            obj[key] = Number(val.requests||0);
                        });
                        obj.total = _.reduce(obj, function(memo, val, key){
                            return memo + Number(val||0);
                        }, 0);
                        obj.date = new Date( test.response.data.completed ).getTime();
                        return obj;
                    }),
                    keys: _(this.labels.contents).keys().value().concat(['total']),
                    labels: _(this.labels.contents).values().value().concat(['Total']),
                    element: view + 'ContentsRequests'
                });
            }
        }
    });

})(Morris, Q);