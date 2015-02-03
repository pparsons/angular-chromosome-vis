/**
 * Created by paulparsons on 1/27/15.
 */

(function() {

	var angularChromosomeVis = angular.module('angularChromosomeVis', []);

	/**
	 * service that retrieves DAS model
	 */
	angularChromosomeVis.factory('dasLoader', function() {
		return {
			loadModel: function (segment, assembly) {
				return JSDAS.Simple.getClient("http://www.ensembl.org/das/Homo_sapiens.GRCh" + assembly + ".karyotype");
			}
		}
	});

	/**
	 * service that maintains an array of selectors. can be injected into any controller, directive, etc.
	 */
	angularChromosomeVis.factory('chrSelectors', ['$rootScope', function($rootScope) {
		"use strict";
		var selectors = []; //holds a list of all selectors that are input by the user

		return {
			getSelectors: function () {
				return selectors;
			},
			addSelector: function (selector) {
				selectors.push(selector);
				$rootScope.$broadcast('selectors:updated', selectors); //notify listeners and provide the new selectors array
			},
			deleteSelector: function (selector) {
				selectors = _.without(selectors, selector);
				$rootScope.$broadcast('selectors:updated', selectors); //notify listeners and provide the new selectors array
			},
			deleteAll: function () {
				selectors = [];
				$rootScope.$broadcast('selectors:updated', selectors); //notify listeners and provide the new selectors array
				$rootScope.$broadcast('selectors:deleted');
			}
		};
	}])

	angularChromosomeVis.directive('chromosome', ['dasLoader', 'chrSelectors', function(dasLoader, chrSelectors) {

		function link(scope, element, attr) {

			//set default scope values if not provided
			scope.relSize = angular.isDefined(scope.relSize) ? scope.relSize : true;
			scope.assembly = angular.isDefined(scope.assembly) ? scope.assembly : 37;
			scope.height = angular.isDefined(scope.height) ? scope.height : 20;
			scope.axis = angular.isDefined(scope.axis) ? scope.axis : true;
			scope.mode = angular.isDefined(scope.mode) ? scope.mode : "multi";

			var dasModel;
			scope.selectors = { list: [] }; //holds selector objects

			var CHR1_BP_END = 248956422,
				STALK_MAG_PC = 0.8,
				PADDING = 30,
				LABEL_PADDING = 24,
				AXIS_SPACING = 4,
				STALK_SPACING = 3;

			var target = d3.select(element[0]).append('svg');
			target.attr('id', scope.id + 'svg'); //take id from the scope
			target.attr({width: '100%'});

			if (scope.axis) {
				target.attr({height: scope.height + (2 * PADDING)});
			} else {
				target.attr({height: scope.height + PADDING});
			}
			dasLoader.loadModel(scope.chr, scope.assembly)
				.features({segment: scope.chr}, function (res) {
					//success response
					if (res.GFF.SEGMENT.length > 0) {
						dasModel = {
							id: res.GFF.SEGMENT[0].id,
							start: res.GFF.SEGMENT[0].start,
							stop: res.GFF.SEGMENT[0].stop,
							bands: res.GFF.SEGMENT[0].FEATURE
						};
					} else {
						console.log("JSDAS results empty for segment");
					}


					if (typeof dasModel.err === 'undefined') {

						var rangeTo;

						if (scope.width === 'inherit') {
							var svgWidth = target[0][0].width.baseVal.value;
							rangeTo = scope.relSize ? ((+dasModel.stop / CHR1_BP_END) * svgWidth) - PADDING : svgWidth - PADDING;
						}
						else {
							rangeTo = scope.relSize ? ((+dasModel.stop / CHR1_BP_END) * scope.width) - PADDING : scope.width - PADDING;
						}

						var xscale = d3.scale.linear()
							.domain([dasModel.start, dasModel.stop])
							.range([0, rangeTo]);

						var band = target.selectAll("chromosome" + " g")
							.data(dasModel.bands)
							.enter().append("g");

						band.append("title")
							.text(function(m) {return m.id; });

						band.append('rect')
							.attr('class', function (m) {
								return m.TYPE.id.replace(':', ' ');
							})
							.attr('height', function (m) {
								return (m.TYPE.id === "band:stalk") ? (scope.height * STALK_MAG_PC) : scope.height;
							})
							.attr('width', function (m) {
								return xscale(+m.END.textContent) - xscale(+m.START.textContent);
							})
							.attr('x', function (m) {
								return xscale(m.START.textContent);
							})
							.attr('y', function (m) {
								return (m.TYPE.id === "band:stalk") ? (PADDING + STALK_SPACING) : PADDING;
							});

						var label = target.append("text")
							.attr("class", "band-lbl")
							.attr("y", LABEL_PADDING);

						band.on("mouseover", function (m) {
							label.text(m.id)
								.attr('x', (xscale(m.START.textContent)));
						});

						band.on("mouseout", function (m) {
							label.text(''); //empty the label
						});

						band.on("click", function (m) {
							var start = +m.START.textContent,
								end = +m.END.textContent;

							if (scope.mode === 'multi' || (scope.mode === "single" && scope.selectors.list.length == 0)) {
								var newSel = newSelector(scope, xscale, start, end, (PADDING - AXIS_SPACING)).draw(); //create new selector and draw it
								addSelector(newSel);//add new selector to local scope
								chrSelectors.addSelector(newSel); //add new location to the service
							}
						});

						if (scope.axis) {
							var bpAxis = d3.svg.axis()
								.scale(xscale)
								.tickFormat(d3.format('s'))
								.orient("bottom");

							target.append('g')
								.attr('class', 'bp-axis')
								.attr('transform', 'translate(0,' + (scope.height + PADDING + AXIS_SPACING) + ")")
								.call(bpAxis);
						}
					}

				}, function (err) {
					//error response handler
					console.log("Error from DAS loader: " + err);
				});

			function addSelector(sel) {
				"use strict";
				scope.$apply(function() {
					scope.selectors.list.push(sel);
				})
			}

			//when all selectors have been deleted from outside
			scope.$on('selectors:deleted', function(event) {
				angular.forEach (scope.selectors.list, function(sel) {
					"use strict";
					sel.delete();
				});
				scope.selectors.list = []; //delete locally
			});

			scope.delSelector = function(sel) {
				"use strict";
				sel.delete();
				scope.selectors.list = _.without(scope.selectors.list, sel) //delete locally
				chrSelectors.deleteSelector(sel); //delete from the service
			}

			function newSelector(scope, xscale, start, end, yshift) {
				return new Selector({
					scope: scope,
					xscale: xscale,
					y: yshift,
					target: '#' + scope.id + 'svg'
				}).init(start, end);
			};
		}

		/**
		 * selector object for chromosome. uses D3 brush
		 * @param opt - options for the selector
		 * @constructor
		 */
		function Selector (opt) {

			var self = this,
				_selector,
				_initialized;

			var AXIS_SPACING = 4;

			var options = (function () {
				return _.extend({}, {
					//DEFAULT OPTIONS
					height: 20,
					y:9
				}, opt || {});
			}());

			this.delete = function () {
				_selector.remove();
				_initialized = false;
			};

			function triggerSelectionChange () {
				var ext = self.brush.extent();
				self.start = Math.round(ext[0]);
				self.end = Math.round(ext[1]);
			}

			//initialize the selector
			this.init = function (start, end) {
				self.brush = d3.svg.brush()
					.x(options.xscale)
					.extent([start, end]);

				self.start = Math.round(start);
				self.end = Math.round(end);

				self.brush.on("brush", function () {
					triggerSelectionChange();
					options.scope.$apply();
				});

				//uncomment to use
				//self.brush.on("brushend", function () {
				//	//do something here on brush end
				//});

				_selector = d3.select(options.target).append("g")
					.classed('selector', true)
					.attr('transform',"translate(0,"+ options.y +")")
					.call(self.brush);

				_selector.selectAll('rect')
					.attr('height', options.height + (AXIS_SPACING * 2));

				_initialized = true;
				return self;
			};


			this.draw = function () {
				if (!_initialized) self.init();
				_selector.select('.background').remove();
				_selector.call(self.brush);
				return self;
			};

			this.move = function (to, from) {
				self.brush.extent([to, from]);
				var selector = d3.select(options.target + ' .selector');
				selector.call(self.brush);
				return self;
			};

		};

		return {
			link: link,
			restrict: 'AE',
			scope: {
				chr: '@',
				relSize: '=?',
				assembly: '=?',
				width: '@',
				height: '=?',
				axis: '=?',
				mode: '@',
				id: '@'
			}
		}
	}]);

})();