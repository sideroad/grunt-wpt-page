/*global data_graphic, Q, jQuery, hs, Highcharts */

(function( Q, $, hs, Highcharts ){
    'use strict';

    var _ = require('lodash'),
        request = require('superagent'),
        moment = require('moment'),
        bootstrap = require('components-bootstrap'),
        Vue = require('vue'),
        cached = {},
        renderGraph = function(data){
            var series = _.map( data.keys, function(key, index){
                            return {
                                name: data.labels[index],
                                data: _.chain(data.data)
                                       .map(function(item){
                                           if(!item[key]){
                                               return false;
                                           } else {
                                               return {
                                                   x: item.date.getTime(),
                                                   y: Number(item[key]),
                                                   summary: item.summary,
                                                   id: item.id
                                              };
                                           }
                                       })
                                       .compact()
                                       .sortBy('x')
                                       .value()
                            };
                        });

            $("#"+data.element).html('')
                               .highcharts({
                                  chart: {
                                    type: 'spline',
                                    zoomType: 'x'
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
                                    shared: data.tooltip ? true : false,
                                    crosshairs: data.tooltip ? true : false,
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
                                                                             data.ytitle+': '+this.y+' '+data.valueSuffix+'<br/>'+
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
            urls: {},
            url: '',
            tests: {},
            statics: 'average',
            average: true,
            median: false,
            view: 'firstView',
            firstView: true,
            repeatView: false,
            comparizon: false,
            colspan: {
                average: 2,
                median: 6
            },
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
            }, true);

            this.$watch('statics', function(value){
                that.median = false;
                that.average = false;
                that[value] = true;
                that.renderGraphs();
            });            

            this.$watch('view', function(value){
                that.firstView = false;
                that.repeatView = false;
                that[value] = true;
                that.renderGraphs();
            });

            this.$watch('comparizon', function(isChecked){
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
            keys: function(items){
                return _.map(items, function(item){
                    return item.key;
                });
            },
            values: function(items){
                return _.map(items, function(item){
                    return item.value;
                });
            },
            ms: function(num){
                return String(num).replace(/(\d{1,3})(?=(?:\d{3})+$)/g,"$1,")+' ms';
            },
            KB: function(num){
                return String((num / 1000).toFixed(1)).replace(/(\d{1,3})(?=(?:\d{3})+$)/g,"$1,")+' KB';
            }
        },
        methods: {
            getAllTests: function(){
                var testIds = _.chain(this.urls)
                               .map(function(url){
                                    return url;
                                })
                               .flatten()
                               .value(),
                    requests = [];

                return this.getTests(testIds);
            },
            getTests: function(testIds){
                var requests = [],
                    that = this;

                _(testIds).each(function(testId){
                    var dfd = Q.defer();

                    if(cached[testId]){
                        dfd.resolve(cached[testId]);
                    } else {
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
                                        cached[testId] = res.body;
                                        dfd.resolve(res.body);
                                    } else {
                                        dfd.resolve();
                                    }
                               });
                    }
                    requests.push(dfd.promise);
                });

                return Q.all(requests);
            },
            renderGraphs: function(){
                var that = this;

                if(this.comparizon){
                    this.getAllTests().done(function(){
                        var tests = _.map(that.urls, function(testIds, url){
                            return {
                                url: url,
                                response: _.map(testIds, function(testId){
                                          return cached[testId].response;
                                      })
                            };
                        });
                        that.renderComparizonResponseTimeGraph( tests, 'loadTime' );
                        that.renderComparizonResponseTimeGraph( tests, 'fullyLoaded' );

                        that.renderComparizonContentsSizeGraph( tests );
                        that.renderComparizonContentsRequestGraph( tests );

                        that.renderComparizonSpeedIndexGraph( tests );


                    });
                } else {
                    this.getTests(this.testIds).done(function(tests){
                        tests = _.compact(tests);
                        that.$set('tests', tests);

                        that.renderResponseTimeGraph( tests );
                        that.renderSpeedIndexGraph( tests );
                        that.renderContentsSizeGraph( tests );
                        that.renderContentsRequestsGraph( tests );
                    });
                }

            },
            renderResponseTimeGraph: function(tests){
                var statics = this.statics,
                    view = this.view;
                renderGraph({
                    data: _.map(tests, function(test){
                        var obj = _.extend({}, test.response.data[statics][view]);
                        obj.date = new Date( test.response.data.completed );
                        obj.summary = _.extend({}, test).response.data.summary;
                        obj.id = _.extend({}, test).response.data.testId;
                        return obj;
                    }),
                    valueSuffix: ' msec',
                    ytitle: 'Time (msec)',
                    tooltip: true,
                    keys: _(this.labels.responseTime[statics]).keys().value().reverse(),
                    labels: _(this.labels.responseTime[statics]).values().value().reverse(),
                    element: 'responseTimeGraph'
                });
            },
            renderSpeedIndexGraph: function(tests){
                var statics = this.statics,
                    view = this.view;

                renderGraph({
                    data: _.map(tests, function(test){
                        var obj = _.extend({}, test.response.data[statics][view]);
                        obj.date = new Date( test.response.data.completed );
                        obj.summary = _.extend({}, test).response.data.summary;
                        obj.id = _.extend({}, test).response.data.testId;
                        return obj;
                    }),
                    ytitle: 'Score',
                    tooltip: true,
                    keys: ['SpeedIndex'],
                    labels: [this.labels.SpeedIndex],
                    element: 'speedIndexGraph'
                });
            },
            renderContentsSizeGraph: function(tests){
                var view = this.view;

                renderGraph({
                      data: _.map(tests, function(test){
                        var obj = {};
                        var tmp = 0;
                        _.each(test.response.data.median[view].breakdown, function(val, key){
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
                    tooltip: true,
                    keys: _(this.labels.contents).keys().value().concat(['total']).reverse(),
                    labels: _(this.labels.contents).values().value().concat(['Total']).reverse(),
                    element: 'contentsSizeGraph'
                });
            },
            renderContentsRequestsGraph: function(tests){
                var view = this.view;

                renderGraph({
                      data: _.map(tests, function(test){
                        var obj = {};
                        var tmp = 0;
                        _.each(test.response.data.median[view].breakdown, function(val, key){
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
                    tooltip: true,
                    keys: _(this.labels.contents).keys().value().concat(['total']).reverse(),
                    labels: _(this.labels.contents).values().value().concat(['Total']).reverse(),
                    element: 'contentsRequestsGraph'
                });
            },
            renderComparizonResponseTimeGraph: function(tests, key){
                var statics = this.statics,
                    view = this.view,
                    list = [];

                _.each(tests, function(test){
                     _.each(test.response, function(response){
                        var obj = {};
                        obj[test.url] = response.data[statics][view][key];
                        obj.date = new Date( response.data.completed );
                        obj.summary = response.data.summary;
                        obj.id = response.data.testId;
                        list.push(obj);
                    }); 
                });
                renderGraph({
                    data: list,
                    valueSuffix: ' msec',
                    ytitle: 'Time (msec)',
                    keys: _(this.urls).keys().value(),
                    labels: _(this.urls).keys().value(),
                    element: key+'Graph'
                });

                this.$set(key+'ResponseTimeComparizon', _(this.urls).keys().map(function(key){
                    var item = _(list).reduce(function(item, obj){
                                 return {
                                        sum: item.sum + (obj[key]||0),
                                        length: obj[key] ? item.length+1 : item.length
                                    };
                               }, {sum: 0, length: 0});
                    return Math.ceil( item.sum/item.length );
                }).value());

            },
            renderComparizonSpeedIndexGraph: function(tests){
                var statics = this.statics,
                    view = this.view,
                    list = [];

                _.each(tests, function(test){
                     _.each(test.response, function(response){
                        var obj = {};
                        obj[test.url] = response.data[statics][view].SpeedIndex;
                        obj.date = new Date( response.data.completed );
                        obj.summary = response.data.summary;
                        obj.id = response.data.testId;
                        list.push(obj);
                    }); 
                });
                renderGraph({
                    data: list,
                    ytitle: 'Score',
                    keys: _(this.urls).keys().value(),
                    labels: _(this.urls).keys().value(),
                    element: 'speedIndexGraph'
                });

                this.$set('speedIndexComparizon', _(this.urls).keys().map(function(key){
                    var item = _(list).reduce(function(item, obj){
                                 return {
                                        sum: item.sum + (obj[key]||0),
                                        length: obj[key] ? item.length+1 : item.length
                                    };
                               }, {sum: 0, length: 0});
                    return Math.ceil( item.sum/item.length );
                }).value());

            },
            renderComparizonContentsSizeGraph: function(tests){
                var view = this.view,
                    list = [];

                _.each(tests, function(test){
                     _.each(test.response, function(response){
                        var obj = {};
                        obj[test.url] = Number(_.reduce( response.data.median[view].breakdown, function(sum, val, key){
                            return sum + (Number(val.bytes||0)/1000);
                        }, 0).toFixed(0));
                        obj.date = new Date( response.data.completed );
                        obj.summary = response.data.summary;
                        obj.id = response.data.testId;
                        list.push(obj);
                    }); 
                });
                renderGraph({
                    data: list,
                    valueSuffix: ' KByte',
                    ytitle: 'Size (KByte)',
                    keys: _(this.urls).keys().value(),
                    labels: _(this.urls).keys().value(),
                    element: 'contentsSizeGraph'
                });

                this.$set('contentsSizeComparizon', _(this.urls).keys().map(function(key){
                    var item = _(list).reduce(function(item, obj){
                                 return {
                                        sum: item.sum + (obj[key]||0),
                                        length: obj[key] ? item.length+1 : item.length
                                    };
                               }, {sum: 0, length: 0});
                    return Math.ceil( item.sum/item.length );
                }).value());
            },
            renderComparizonContentsRequestGraph: function(tests){
                var view = this.view,
                    list = [];

                _.each(tests, function(test){
                     _.each(test.response, function(response){
                        var obj = {};
                        obj[test.url] = _.reduce( response.data.median[view].breakdown, function(sum, val, key){
                            return sum + ( Number(val.requests) );
                        }, 0);
                        obj.date = new Date( response.data.completed );
                        obj.summary = response.data.summary;
                        obj.id = response.data.testId;
                        list.push(obj);
                    }); 
                });
                renderGraph({
                    data: list,
                    ytitle: 'Requests',
                    keys: _(this.urls).keys().value(),
                    labels: _(this.urls).keys().value(),
                    element: 'contentsRequestsGraph'
                });

                this.$set('contentsRequestComparizon', _(this.urls).keys().map(function(key){
                    var item = _(list).reduce(function(item, obj){
                                 return {
                                        sum: item.sum + (obj[key]||0),
                                        length: obj[key] ? item.length+1 : item.length
                                    };
                               }, {sum: 0, length: 0});
                    return Math.ceil( item.sum/item.length );
                }).value());
            }       

        }
    });

})(Q, jQuery, hs, Highcharts);