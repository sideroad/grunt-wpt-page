/*global data_graphic, Q, jQuery, hs, Highcharts */

(function( Q, $, hs, Highcharts ){
    'use strict';

    var _ = require('lodash'),
        request = require('superagent'),
        moment = require('moment'),
        bootstrap = require('components-bootstrap'),
        Vue = require('vue'),
        renderGraph = function(data){
            var series = _.map( data.keys, function(key, index){
                            return {
                                name: data.labels[index],
                                data: _.chain(data.data)
                                       .map(function(item){
                                          return {
                                            x: item.date.getTime(),
                                            y: Number(item[key]),
                                            summary: item.summary,
                                            id: item.id
                                          };
                                       })
                                       .sortBy('x')
                                       .value()
                            };
                        });
            $("#"+data.element).html('')
                               .highcharts({
                                  chart: {
                                    type: 'spline'
                                  },
                                  xAxis: {
                                    type: 'datetime'
                                  },
                                  yAxis: {
                                    title: {
                                        text: data.ytitle
                                    }
                                  },
                                  tooltip: {
                                    shared: true,
                                    crosshairs: true,
                                    valueSuffix: data.valueSuffix
                                  },
                                  title: '',
                                  series: series,
                                  plotOptions: {
                                        series: {
                                            cursor: 'pointer',
                                            point: {
                                                events: {
                                                    click: function (e) {
                                                        hs.htmlExpand(null, {
                                                            pageOrigin: {
                                                                x: e.pageX,
                                                                y: e.pageY
                                                            },
                                                            headingText: this.series.name,
                                                            maincontentText: 'Date: '+new Date(this.x)+'<br/>'+
                                                                             'Summary: <a href="'+this.summary+'" >'+this.id+'</a>',
                                                            width: 'auto'
                                                        });
                                                    }
                                                }
                                            },
                                            marker: {
                                                lineWidth: 1
                                            }
                                        }
                                    }
                                });
        };

    var app = new Vue({
        el: '#app',
        data: {
            results: {},
            locations: {},
            statics: 'average',
            average: true,
            median: false,
            colspan: {
                average: 2,
                median: 6
            },
            staticsList: [
                {
                    key: 'average',
                    value: 'Average'
                },
                {
                    key: 'median',
                    value: 'Median'
                }
            ],
            tests: {},
            labels: {
                SpeedIndex: 'Speed Index',
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
                that.renderGraphs();
            });
            this.$watch('statics', function(value){
                that.median = false;
                that.average = false;
                that[value] = true;
                that.renderGraphs();
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
                }).flatten().value();
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

                _(this.testIds).each(function(testId){
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
            renderGraphs: function(){
                var that = this;

                this.getTests(this.testIds).done(function(tests){
                    tests = _.compact(tests);

                    that.$set('tests', tests);

                    that.renderResponseTimeGraph( tests, that.statics, 'first' );
                    that.renderResponseTimeGraph( tests, that.statics, 'repeat' );

                    that.renderSpeedIndexGraph( tests, that.statics, 'first' );
                    that.renderSpeedIndexGraph( tests, that.statics, 'repeat' );

                    that.renderContentsSizeGraph( tests, 'first' );
                    that.renderContentsSizeGraph( tests, 'repeat' );

                    that.renderContentsRequestsGraph( tests, 'first' );
                    that.renderContentsRequestsGraph( tests, 'repeat' );
                });

            },
            renderResponseTimeGraph: function(tests, type, view){
                renderGraph({
                    data: _.map(tests, function(test){
                        var obj = _.extend({}, test.response.data[type][view+'View']);
                        obj.date = new Date( test.response.data.completed );
                        obj.summary = _.extend({}, test).response.data.summary;
                        obj.id = _.extend({}, test).response.data.testId;
                        return obj;
                    }),
                    valueSuffix: ' msec',
                    ytitle: 'Time (msec)',
                    keys: _(this.labels.responseTime[type]).keys().value(),
                    labels: _(this.labels.responseTime[type]).values().value(),
                    element: $.camelCase( view + '-' + type)
                });
            },
            renderSpeedIndexGraph: function(tests, type, view){
                renderGraph({
                    data: _.map(tests, function(test){
                        var obj = _.extend({}, test.response.data[type][view+'View']);
                        obj.date = new Date( test.response.data.completed );
                        obj.summary = _.extend({}, test).response.data.summary;
                        obj.id = _.extend({}, test).response.data.testId;
                        return obj;
                    }),
                    ytitle: 'Score',
                    keys: ['SpeedIndex'],
                    labels: [this.labels.SpeedIndex],
                    element: $.camelCase( view + '-' + type + '-speedIndex')
                });
            },
            renderContentsSizeGraph: function(tests, view){
                renderGraph({
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
                        obj.date = new Date( test.response.data.completed );
                        obj.summary = _.extend({}, test).response.data.summary;
                        obj.id = _.extend({}, test).response.data.testId;
                        return obj;
                    }),
                    valueSuffix: ' KByte',                      
                    ytitle: 'Size (KByte)',
                    keys: _(this.labels.contents).keys().value().concat(['total']),
                    labels: _(this.labels.contents).values().value().concat(['Total']),
                    element: view + 'ContentsSize'
                });
            },
            renderContentsRequestsGraph: function(tests, view){
                renderGraph({
                      data: _.map(tests, function(test){
                        var obj = {};
                        var tmp = 0;
                        _.each(test.response.data.median[view+'View'].breakdown, function(val, key){
                            obj[key] = Number(val.requests||0);
                        });
                        obj.total = _.reduce(obj, function(memo, val, key){
                            return memo + Number(val||0);
                        }, 0);
                        obj.date = new Date( test.response.data.completed );
                        obj.summary = _.extend({}, test).response.data.summary;
                        obj.id = _.extend({}, test).response.data.testId;
                        return obj;
                    }),
                    ytitle: 'Requests',
                    keys: _(this.labels.contents).keys().value().concat(['total']),
                    labels: _(this.labels.contents).values().value().concat(['Total']),
                    element: view + 'ContentsRequests'
                });
            }
        }
    });

})(Q, jQuery, hs, Highcharts);