'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _thaw = require('thaw.js');

var _thaw2 = _interopRequireDefault(_thaw);

var _lookup2 = require('./lookup');

var _lookup3 = _interopRequireDefault(_lookup2);

var _max = require('./utilities/max');

var _max2 = _interopRequireDefault(_max);

var _mse = require('./utilities/mse');

var _mse2 = _interopRequireDefault(_mse);

var _randos = require('./utilities/randos');

var _randos2 = _interopRequireDefault(_randos);

var _range = require('./utilities/range');

var _range2 = _interopRequireDefault(_range);

var _toArray = require('./utilities/to-array');

var _toArray2 = _interopRequireDefault(_toArray);

var _zeros = require('./utilities/zeros');

var _zeros2 = _interopRequireDefault(_zeros);

var _lookupTable = require('./utilities/lookup-table');

var _lookupTable2 = _interopRequireDefault(_lookupTable);

var _cast = require('./utilities/cast');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * @param {object} options
 * @constructor
 */
var NeuralNetwork = function () {
  _createClass(NeuralNetwork, null, [{
    key: 'validateTrainingOptions',


    /**
     *
     * @param options
     * @private
     */
    value: function validateTrainingOptions(options) {
      var validations = {
        iterations: function iterations(val) {
          return typeof val === 'number' && val > 0;
        },
        errorThresh: function errorThresh(val) {
          return typeof val === 'number' && val > 0 && val < 1;
        },
        log: function log(val) {
          return typeof val === 'function' || typeof val === 'boolean';
        },
        logPeriod: function logPeriod(val) {
          return typeof val === 'number' && val > 0;
        },
        learningRate: function learningRate(val) {
          return typeof val === 'number' && val > 0 && val < 1;
        },
        momentum: function momentum(val) {
          return typeof val === 'number' && val > 0 && val < 1;
        },
        callback: function callback(val) {
          return typeof val === 'function' || val === null;
        },
        callbackPeriod: function callbackPeriod(val) {
          return typeof val === 'number' && val > 0;
        },
        timeout: function timeout(val) {
          return typeof val === 'number' && val > 0;
        }
      };
      Object.keys(NeuralNetwork.trainDefaults).forEach(function (key) {
        if (validations.hasOwnProperty(key) && !validations[key](options[key])) {
          throw new Error('[' + key + ', ' + options[key] + '] is out of normal training range, your network will probably not train.');
        }
      });
    }
  }, {
    key: 'trainDefaults',
    get: function get() {
      return {
        iterations: 20000, // the maximum times to iterate the training data
        errorThresh: 0.005, // the acceptable error percentage from training data
        log: false, // true to use console.log, when a function is supplied it is used
        logPeriod: 10, // iterations between logging out
        learningRate: 0.3, // multiply's against the input and the delta then adds to momentum
        momentum: 0.1, // multiply's against the specified "change" then adds to learning rate for change
        callback: null, // a periodic call back that can be triggered while training
        callbackPeriod: 10, // the number of iterations through the training data between callback calls
        timeout: Infinity, // the max number of milliseconds to train for
        praxis: null,
        beta1: 0.9,
        beta2: 0.999,
        epsilon: 1e-8
      };
    }
  }, {
    key: 'defaults',
    get: function get() {
      return {
        leakyReluAlpha: 0.01,
        binaryThresh: 0.5,
        hiddenLayers: [3], // array of ints for the sizes of the hidden layers in the network
        activation: 'sigmoid' // Supported activation types ['sigmoid', 'relu', 'leaky-relu', 'tanh']
      };
    }
  }]);

  function NeuralNetwork() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, NeuralNetwork);

    Object.assign(this, this.constructor.defaults, options);
    this.hiddenLayers = options.hiddenLayers;
    this.trainOpts = {};
    this.updateTrainingOptions(Object.assign({}, this.constructor.trainDefaults, options));

    this.sizes = null;
    this.outputLayer = null;
    this.biases = null; // weights for bias nodes
    this.weights = null;
    this.outputs = null;

    // state for training
    this.deltas = null;
    this.changes = null; // for momentum
    this.errors = null;
    this.errorCheckInterval = 1;
    if (!this.constructor.prototype.hasOwnProperty('runInput')) {
      this.runInput = null;
    }
    if (!this.constructor.prototype.hasOwnProperty('calculateDeltas')) {
      this.calculateDeltas = null;
    }
    this.inputLookup = null;
    this.inputLookupLength = null;
    this.outputLookup = null;
  }

  /**
   *
   * Expects this.sizes to have been set
   */


  _createClass(NeuralNetwork, [{
    key: 'initialize',
    value: function initialize() {
      if (!this.sizes) throw new Error('Sizes must be set before initializing');

      this.outputLayer = this.sizes.length - 1;
      this.biases = []; // weights for bias nodes
      this.weights = [];
      this.outputs = [];

      // state for training
      this.deltas = [];
      this.changes = []; // for momentum
      this.errors = [];

      for (var layer = 0; layer <= this.outputLayer; layer++) {
        var size = this.sizes[layer];
        this.deltas[layer] = (0, _zeros2.default)(size);
        this.errors[layer] = (0, _zeros2.default)(size);
        this.outputs[layer] = (0, _zeros2.default)(size);

        if (layer > 0) {
          this.biases[layer] = (0, _randos2.default)(size);
          this.weights[layer] = new Array(size);
          this.changes[layer] = new Array(size);

          for (var node = 0; node < size; node++) {
            var prevSize = this.sizes[layer - 1];
            this.weights[layer][node] = (0, _randos2.default)(prevSize);
            this.changes[layer][node] = (0, _zeros2.default)(prevSize);
          }
        }
      }

      this.setActivation();
    }

    /**
     *
     * @param activation supported inputs: 'sigmoid', 'relu', 'leaky-relu', 'tanh'
     */

  }, {
    key: 'setActivation',
    value: function setActivation(activation) {
      this.activation = activation ? activation : this.activation;
      switch (this.activation) {
        case 'sigmoid':
          this.runInput = this.runInput || this._runInputSigmoid;
          this.calculateDeltas = this.calculateDeltas || this._calculateDeltasSigmoid;
          break;
        case 'relu':
          this.runInput = this.runInput || this._runInputRelu;
          this.calculateDeltas = this.calculateDeltas || this._calculateDeltasRelu;
          break;
        case 'leaky-relu':
          this.runInput = this.runInput || this._runInputLeakyRelu;
          this.calculateDeltas = this.calculateDeltas || this._calculateDeltasLeakyRelu;
          break;
        case 'tanh':
          this.runInput = this.runInput || this._runInputTanh;
          this.calculateDeltas = this.calculateDeltas || this._calculateDeltasTanh;
          break;
        default:
          throw new Error('unknown activation ' + this.activation + ', The activation should be one of [\'sigmoid\', \'relu\', \'leaky-relu\', \'tanh\']');
      }
    }

    /**
     *
     * @returns boolean
     */

  }, {
    key: 'run',


    /**
     *
     * @param input
     * @returns {*}
     */
    value: function run(input) {
      if (!this.isRunnable) return null;
      if (this.inputLookup) {
        input = _lookup3.default.toArray(this.inputLookup, input, this.inputLookupLength);
      }

      var output = this.runInput(input);

      if (this.outputLookup) {
        output = _lookup3.default.toObject(this.outputLookup, output);
      }
      return output;
    }

    /**
     * trains via sigmoid
     * @param input
     * @returns {*}
     */

  }, {
    key: '_runInputSigmoid',
    value: function _runInputSigmoid(input) {
      this.outputs[0] = input; // set output state of input layer

      var output = null;
      for (var layer = 1; layer <= this.outputLayer; layer++) {
        for (var node = 0; node < this.sizes[layer]; node++) {
          var weights = this.weights[layer][node];

          var sum = this.biases[layer][node];
          for (var k = 0; k < weights.length; k++) {
            sum += weights[k] * input[k];
          }
          //sigmoid
          this.outputs[layer][node] = 1 / (1 + Math.exp(-sum));
        }
        output = input = this.outputs[layer];
      }
      return output;
    }
  }, {
    key: '_runInputRelu',
    value: function _runInputRelu(input) {
      this.outputs[0] = input; // set output state of input layer

      var output = null;
      for (var layer = 1; layer <= this.outputLayer; layer++) {
        for (var node = 0; node < this.sizes[layer]; node++) {
          var weights = this.weights[layer][node];

          var sum = this.biases[layer][node];
          for (var k = 0; k < weights.length; k++) {
            sum += weights[k] * input[k];
          }
          //relu
          this.outputs[layer][node] = sum < 0 ? 0 : sum;
        }
        output = input = this.outputs[layer];
      }
      return output;
    }
  }, {
    key: '_runInputLeakyRelu',
    value: function _runInputLeakyRelu(input) {
      this.outputs[0] = input; // set output state of input layer
      var alpha = this.leakyReluAlpha;
      var output = null;
      for (var layer = 1; layer <= this.outputLayer; layer++) {
        for (var node = 0; node < this.sizes[layer]; node++) {
          var weights = this.weights[layer][node];

          var sum = this.biases[layer][node];
          for (var k = 0; k < weights.length; k++) {
            sum += weights[k] * input[k];
          }
          //leaky relu
          this.outputs[layer][node] = sum < 0 ? 0 : alpha * sum;
        }
        output = input = this.outputs[layer];
      }
      return output;
    }
  }, {
    key: '_runInputTanh',
    value: function _runInputTanh(input) {
      this.outputs[0] = input; // set output state of input layer

      var output = null;
      for (var layer = 1; layer <= this.outputLayer; layer++) {
        for (var node = 0; node < this.sizes[layer]; node++) {
          var weights = this.weights[layer][node];

          var sum = this.biases[layer][node];
          for (var k = 0; k < weights.length; k++) {
            sum += weights[k] * input[k];
          }
          //tanh
          this.outputs[layer][node] = Math.tanh(sum);
        }
        output = input = this.outputs[layer];
      }
      return output;
    }

    /**
     *
     * @param data
     * Verifies network sizes are initilaized
     * If they are not it will initialize them based off the data set.
     */

  }, {
    key: 'verifyIsInitialized',
    value: function verifyIsInitialized(data) {
      var _this = this;

      if (this.sizes) return;

      this.sizes = [];
      this.sizes.push(data[0].input.length);
      if (!this.hiddenLayers) {
        this.sizes.push(Math.max(3, Math.floor(data[0].input.length / 2)));
      } else {
        this.hiddenLayers.forEach(function (size) {
          _this.sizes.push(size);
        });
      }
      this.sizes.push(data[0].output.length);

      this.initialize();
    }

    /**
     *
     * @param opts
     *    Supports all `trainDefaults` properties
     *    also supports:
     *       learningRate: (number),
     *       momentum: (number),
     *       activation: 'sigmoid', 'relu', 'leaky-relu', 'tanh'
     */

  }, {
    key: 'updateTrainingOptions',
    value: function updateTrainingOptions(opts) {
      var _this2 = this;

      Object.keys(NeuralNetwork.trainDefaults).forEach(function (opt) {
        return _this2.trainOpts[opt] = opts.hasOwnProperty(opt) ? opts[opt] : _this2.trainOpts[opt];
      });
      NeuralNetwork.validateTrainingOptions(this.trainOpts);
      this.setLogMethod(opts.log || this.trainOpts.log);
      this.activation = opts.activation || this.activation;
    }

    /**
     *
     *  Gets JSON of trainOpts object
     *    NOTE: Activation is stored directly on JSON object and not in the training options
     */

  }, {
    key: 'getTrainOptsJSON',
    value: function getTrainOptsJSON() {
      var _this3 = this;

      return Object.keys(NeuralNetwork.trainDefaults).reduce(function (opts, opt) {
        if (opt === 'timeout' && _this3.trainOpts[opt] === Infinity) return opts;
        if (_this3.trainOpts[opt]) opts[opt] = _this3.trainOpts[opt];
        if (opt === 'log') opts.log = typeof opts.log === 'function';
        return opts;
      }, {});
    }

    /**
     *
     * @param log
     * if a method is passed in method is used
     * if false passed in nothing is logged
     * @returns error
     */

  }, {
    key: 'setLogMethod',
    value: function setLogMethod(log) {
      if (typeof log === 'function') {
        this.trainOpts.log = log;
      } else if (log) {
        this.trainOpts.log = console.log;
      } else {
        this.trainOpts.log = false;
      }
    }

    /**
     *
     * @param data
     * @returns {Number} error
     */

  }, {
    key: 'calculateTrainingError',
    value: function calculateTrainingError(data) {
      var sum = 0;
      for (var i = 0; i < data.length; ++i) {
        sum += this.trainPattern(data[i].input, data[i].output, true);
      }
      return sum / data.length;
    }

    /**
     * @param data
     * @private
     */

  }, {
    key: 'trainPatterns',
    value: function trainPatterns(data) {
      for (var i = 0; i < data.length; ++i) {
        this.trainPattern(data[i].input, data[i].output, false);
      }
    }

    /**
     *
     * @param {object} data
     * @param {object} status { iterations: number, error: number }
     * @param endTime
     */

  }, {
    key: 'trainingTick',
    value: function trainingTick(data, status, endTime) {
      if (status.iterations >= this.trainOpts.iterations || status.error <= this.trainOpts.errorThresh || Date.now() >= endTime) {
        return false;
      }

      status.iterations++;

      if (this.trainOpts.log && status.iterations % this.trainOpts.logPeriod === 0) {
        status.error = this.calculateTrainingError(data);
        this.trainOpts.log('iterations: ' + status.iterations + ', training error: ' + status.error);
      } else {
        if (status.iterations % this.errorCheckInterval === 0) {
          status.error = this.calculateTrainingError(data);
        } else {
          this.trainPatterns(data);
        }
      }

      if (this.trainOpts.callback && status.iterations % this.trainOpts.callbackPeriod === 0) {
        this.trainOpts.callback({
          iterations: status.iterations,
          error: status.error
        });
      }
      return true;
    }

    /**
     *
     * @param data
     * @param options
     * @protected
     * @return { data, status, endTime }
     */

  }, {
    key: 'prepTraining',
    value: function prepTraining(data, options) {
      this.updateTrainingOptions(options);
      data = this.formatData(data);
      var endTime = Date.now() + this.trainOpts.timeout;

      var status = {
        error: 1,
        iterations: 0
      };

      this.verifyIsInitialized(data);

      return {
        data: data,
        status: status,
        endTime: endTime
      };
    }

    /**
     *
     * @param data
     * @param options
     * @returns {{error: number, iterations: number}}
     */

  }, {
    key: 'train',
    value: function train(data) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      var status = void 0,
          endTime = void 0;

      var _prepTraining = this.prepTraining(data, options);

      data = _prepTraining.data;
      status = _prepTraining.status;
      endTime = _prepTraining.endTime;


      if (options.praxis === 'adam') {
        this._setupAdam();
      }

      while (this.trainingTick(data, status, endTime)) {}
      return status;
    }

    /**
     *
     * @param data
     * @param options
     * @returns {Promise}
     * @resolves {{error: number, iterations: number}}
     * @rejects {{trainError: string, status: {error: number, iterations: number}}
     */

  }, {
    key: 'trainAsync',
    value: function trainAsync(data) {
      var _this4 = this;

      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      var status = void 0,
          endTime = void 0;

      var _prepTraining2 = this.prepTraining(data, options);

      data = _prepTraining2.data;
      status = _prepTraining2.status;
      endTime = _prepTraining2.endTime;


      return new Promise(function (resolve, reject) {
        try {
          var thawedTrain = new _thaw2.default(new Array(_this4.trainOpts.iterations), {
            delay: true,
            each: function each() {
              return _this4.trainingTick(data, status, endTime) || thawedTrain.stop();
            },
            done: function done() {
              return resolve(status);
            }
          });
          thawedTrain.tick();
        } catch (trainError) {
          reject({ trainError: trainError, status: status });
        }
      });
    }

    /**
     *
     * @param input
     * @param target
     */

  }, {
    key: 'trainPattern',
    value: function trainPattern(input, target, logErrorRate) {

      // forward propagate
      this.runInput(input);

      // back propagate
      this.calculateDeltas(target);
      this.adjustWeights();

      if (logErrorRate) {
        return (0, _mse2.default)(this.errors[this.outputLayer]);
      } else {
        return null;
      }
    }

    /**
     *
     * @param target
     */

  }, {
    key: '_calculateDeltasSigmoid',
    value: function _calculateDeltasSigmoid(target) {
      for (var layer = this.outputLayer; layer >= 0; layer--) {
        for (var node = 0; node < this.sizes[layer]; node++) {
          var output = this.outputs[layer][node];

          var error = 0;
          if (layer === this.outputLayer) {
            error = target[node] - output;
          } else {
            var deltas = this.deltas[layer + 1];
            for (var k = 0; k < deltas.length; k++) {
              error += deltas[k] * this.weights[layer + 1][k][node];
            }
          }
          this.errors[layer][node] = error;
          this.deltas[layer][node] = error * output * (1 - output);
        }
      }
    }

    /**
     *
     * @param target
     */

  }, {
    key: '_calculateDeltasRelu',
    value: function _calculateDeltasRelu(target) {
      for (var layer = this.outputLayer; layer >= 0; layer--) {
        for (var node = 0; node < this.sizes[layer]; node++) {
          var output = this.outputs[layer][node];

          var error = 0;
          if (layer === this.outputLayer) {
            error = target[node] - output;
          } else {
            var deltas = this.deltas[layer + 1];
            for (var k = 0; k < deltas.length; k++) {
              error += deltas[k] * this.weights[layer + 1][k][node];
            }
          }
          this.errors[layer][node] = error;
          this.deltas[layer][node] = output > 0 ? error : 0;
        }
      }
    }

    /**
     *
     * @param target
     */

  }, {
    key: '_calculateDeltasLeakyRelu',
    value: function _calculateDeltasLeakyRelu(target) {
      var alpha = this.leakyReluAlpha;
      for (var layer = this.outputLayer; layer >= 0; layer--) {
        for (var node = 0; node < this.sizes[layer]; node++) {
          var output = this.outputs[layer][node];

          var error = 0;
          if (layer === this.outputLayer) {
            error = target[node] - output;
          } else {
            var deltas = this.deltas[layer + 1];
            for (var k = 0; k < deltas.length; k++) {
              error += deltas[k] * this.weights[layer + 1][k][node];
            }
          }
          this.errors[layer][node] = error;
          this.deltas[layer][node] = output > 0 ? error : alpha * error;
        }
      }
    }

    /**
     *
     * @param target
     */

  }, {
    key: '_calculateDeltasTanh',
    value: function _calculateDeltasTanh(target) {
      for (var layer = this.outputLayer; layer >= 0; layer--) {
        for (var node = 0; node < this.sizes[layer]; node++) {
          var output = this.outputs[layer][node];

          var error = 0;
          if (layer === this.outputLayer) {
            error = target[node] - output;
          } else {
            var deltas = this.deltas[layer + 1];
            for (var k = 0; k < deltas.length; k++) {
              error += deltas[k] * this.weights[layer + 1][k][node];
            }
          }
          this.errors[layer][node] = error;
          this.deltas[layer][node] = (1 - output * output) * error;
        }
      }
    }

    /**
     *
     * Changes weights of networks
     */

  }, {
    key: 'adjustWeights',
    value: function adjustWeights() {
      for (var layer = 1; layer <= this.outputLayer; layer++) {
        var incoming = this.outputs[layer - 1];

        for (var node = 0; node < this.sizes[layer]; node++) {
          var delta = this.deltas[layer][node];

          for (var k = 0; k < incoming.length; k++) {
            var change = this.changes[layer][node][k];

            change = this.trainOpts.learningRate * delta * incoming[k] + this.trainOpts.momentum * change;

            this.changes[layer][node][k] = change;
            this.weights[layer][node][k] += change;
          }
          this.biases[layer][node] += this.trainOpts.learningRate * delta;
        }
      }
    }
  }, {
    key: '_setupAdam',
    value: function _setupAdam() {
      this.biasChangesLow = [];
      this.biasChangesHigh = [];
      this.changesLow = [];
      this.changesHigh = [];
      this.iterations = 0;

      for (var layer = 0; layer <= this.outputLayer; layer++) {
        var size = this.sizes[layer];
        if (layer > 0) {
          this.biasChangesLow[layer] = (0, _zeros2.default)(size);
          this.biasChangesHigh[layer] = (0, _zeros2.default)(size);
          this.changesLow[layer] = new Array(size);
          this.changesHigh[layer] = new Array(size);

          for (var node = 0; node < size; node++) {
            var prevSize = this.sizes[layer - 1];
            this.changesLow[layer][node] = (0, _zeros2.default)(prevSize);
            this.changesHigh[layer][node] = (0, _zeros2.default)(prevSize);
          }
        }
      }

      this.adjustWeights = this._adjustWeightsAdam;
    }
  }, {
    key: '_adjustWeightsAdam',
    value: function _adjustWeightsAdam() {
      var trainOpts = this.trainOpts;
      this.iterations++;

      for (var layer = 1; layer <= this.outputLayer; layer++) {
        var incoming = this.outputs[layer - 1];

        for (var node = 0; node < this.sizes[layer]; node++) {
          var delta = this.deltas[layer][node];

          for (var k = 0; k < incoming.length; k++) {
            var gradient = delta * incoming[k];
            var changeLow = this.changesLow[layer][node][k] * trainOpts.beta1 + (1 - trainOpts.beta1) * gradient;
            var changeHigh = this.changesHigh[layer][node][k] * trainOpts.beta2 + (1 - trainOpts.beta2) * gradient * gradient;

            var momentumCorrection = changeLow / (1 - Math.pow(trainOpts.beta1, this.iterations));
            var gradientCorrection = changeHigh / (1 - Math.pow(trainOpts.beta2, this.iterations));

            this.changesLow[layer][node][k] = changeLow;
            this.changesHigh[layer][node][k] = changeHigh;
            this.weights[layer][node][k] += this.trainOpts.learningRate * momentumCorrection / (Math.sqrt(gradientCorrection) + trainOpts.epsilon);
          }

          var biasGradient = this.deltas[layer][node];
          var biasChangeLow = this.biasChangesLow[layer][node] * trainOpts.beta1 + (1 - trainOpts.beta1) * biasGradient;
          var biasChangeHigh = this.biasChangesHigh[layer][node] * trainOpts.beta2 + (1 - trainOpts.beta2) * biasGradient * biasGradient;

          var biasMomentumCorrection = this.biasChangesLow[layer][node] / (1 - Math.pow(trainOpts.beta1, this.iterations));
          var biasGradientCorrection = this.biasChangesHigh[layer][node] / (1 - Math.pow(trainOpts.beta2, this.iterations));

          this.biasChangesLow[layer][node] = biasChangeLow;
          this.biasChangesHigh[layer][node] = biasChangeHigh;
          this.biases[layer][node] += trainOpts.learningRate * biasMomentumCorrection / (Math.sqrt(biasGradientCorrection) + trainOpts.epsilon);
        }
      }
    }

    /**
     *
     * @param data
     * @returns {*}
     */

  }, {
    key: 'formatData',
    value: function formatData(data) {
      if (!Array.isArray(data)) {
        // turn stream datum into array
        data = [data];
      }

      if (!Array.isArray(data[0].input)) {
        if (this.inputLookup) {
          this.inputLookupLength = Object.keys(this.inputLookup).length;
        } else {
          var inputLookup = new _lookupTable2.default(data, 'input');
          this.inputLookup = inputLookup.table;
          this.inputLookupLength = inputLookup.length;
        }
      }

      if (!Array.isArray(data[0].output)) {
        if (this.outputLookup) {
          this.outputLookupLength = Object.keys(this.outputLookup).length;
        } else {
          var _lookup = new _lookupTable2.default(data, 'output');
          this.outputLookup = _lookup.table;
          this.outputLookupLength = _lookup.length;
        }
      }

      function toTrainingData(data, inputTable, outputTable) {
        // turn sparse hash input into arrays with 0s as filler
        var convertInput = getTypedArrayFn(data[0].input, inputTable);
        var convertOutput = getTypedArrayFn(data[0].output, outputTable);
        var result = [];
        if (convertInput && convertOutput) {
          for (var i = 0; i < data.length; i++) {
            result.push({
              input: convertInput(data[i].input),
              output: convertOutput(data[i].output)
            });
          }
        } else if (convertInput) {
          for (var _i = 0; _i < data.length; _i++) {
            result.push({
              input: convertInput(data[_i].input),
              output: data[_i].output
            });
          }
        } else if (convertOutput) {
          for (var _i2 = 0; _i2 < data.length; _i2++) {
            result.push({
              input: data[_i2].input,
              output: convertOutput(data[_i2].output)
            });
          }
        } else {
          return data;
        }
        return result;
      }

      function getTypedArrayFn(value, table) {
        if (value.buffer instanceof ArrayBuffer) {
          return null;
        } else if (Array.isArray(value)) {
          return _cast.arrayToFloat32Array;
        } else {
          var length = Object.keys(table).length;
          return function (v) {
            var array = new Float32Array(length);
            for (var p in table) {
              array[table[p]] = v[p] || 0;
            }
            return array;
          };
        }
      }

      return toTrainingData(data, this.inputLookup, this.outputLookup);
    }

    /**
     *
     * @param data
     * @returns {
     *  {
     *    error: number,
     *    misclasses: Array
     *  }
     * }
     */

  }, {
    key: 'test',
    value: function test(data) {
      var _this5 = this;

      data = this.formatData(data);

      // for binary classification problems with one output node
      var isBinary = data[0].output.length === 1;
      var falsePos = 0;
      var falseNeg = 0;
      var truePos = 0;
      var trueNeg = 0;

      // for classification problems
      var misclasses = [];

      // run each pattern through the trained network and collect
      // error and misclassification statistics
      var sum = 0;

      var _loop = function _loop(i) {
        var output = _this5.runInput(data[i].input);
        var target = data[i].output;

        var actual = void 0,
            expected = void 0;
        if (isBinary) {
          actual = output[0] > _this5.binaryThresh ? 1 : 0;
          expected = target[0];
        } else {
          actual = output.indexOf((0, _max2.default)(output));
          expected = target.indexOf((0, _max2.default)(target));
        }

        if (actual !== expected) {
          var misclass = data[i];
          Object.assign(misclass, {
            actual: actual,
            expected: expected
          });
          misclasses.push(misclass);
        }

        if (isBinary) {
          if (actual === 0 && expected === 0) {
            trueNeg++;
          } else if (actual === 1 && expected === 1) {
            truePos++;
          } else if (actual === 0 && expected === 1) {
            falseNeg++;
          } else if (actual === 1 && expected === 0) {
            falsePos++;
          }
        }

        var errors = output.map(function (value, i) {
          return target[i] - value;
        });
        sum += (0, _mse2.default)(errors);
      };

      for (var i = 0; i < data.length; i++) {
        _loop(i);
      }
      var error = sum / data.length;

      var stats = {
        error: error,
        misclasses: misclasses
      };

      if (isBinary) {
        Object.assign(stats, {
          trueNeg: trueNeg,
          truePos: truePos,
          falseNeg: falseNeg,
          falsePos: falsePos,
          total: data.length,
          precision: truePos > 0 ? truePos / (truePos + falsePos) : 0,
          recall: truePos > 0 ? truePos / (truePos + falseNeg) : 0,
          accuracy: (trueNeg + truePos) / data.length
        });
      }
      return stats;
    }

    /**
     *
     * @returns
     *  {
     *    layers: [
     *      {
     *        x: {},
     *        y: {}
     *      },
     *      {
     *        '0': {
     *          bias: -0.98771313,
     *          weights: {
     *            x: 0.8374838,
     *            y: 1.245858
     *          },
     *        '1': {
     *          bias: 3.48192004,
     *          weights: {
     *            x: 1.7825821,
     *            y: -2.67899
     *          }
     *        }
     *      },
     *      {
     *        f: {
     *          bias: 0.27205739,
     *          weights: {
     *            '0': 1.3161821,
     *            '1': 2.00436
     *          }
     *        }
     *      }
     *    ]
     *  }
     */

  }, {
    key: 'toJSON',
    value: function toJSON() {
      var layers = [];
      for (var layer = 0; layer <= this.outputLayer; layer++) {
        layers[layer] = {};

        var nodes = void 0;
        // turn any internal arrays back into hashes for readable json
        if (layer === 0 && this.inputLookup) {
          nodes = Object.keys(this.inputLookup);
        } else if (layer === this.outputLayer && this.outputLookup) {
          nodes = Object.keys(this.outputLookup);
        } else {
          nodes = (0, _range2.default)(0, this.sizes[layer]);
        }

        for (var j = 0; j < nodes.length; j++) {
          var node = nodes[j];
          layers[layer][node] = {};

          if (layer > 0) {
            layers[layer][node].bias = this.biases[layer][j];
            layers[layer][node].weights = {};
            for (var k in layers[layer - 1]) {
              var index = k;
              if (layer === 1 && this.inputLookup) {
                index = this.inputLookup[k];
              }
              layers[layer][node].weights[k] = this.weights[layer][j][index];
            }
          }
        }
      }
      return {
        sizes: this.sizes,
        layers: layers,
        outputLookup: this.outputLookup !== null,
        inputLookup: this.inputLookup !== null,
        activation: this.activation,
        trainOpts: this.getTrainOptsJSON()
      };
    }

    /**
     *
     * @param json
     * @returns {NeuralNetwork}
     */

  }, {
    key: 'fromJSON',
    value: function fromJSON(json) {
      this.sizes = json.sizes;
      this.initialize();

      for (var i = 0; i <= this.outputLayer; i++) {
        var layer = json.layers[i];
        if (i === 0 && (!layer[0] || json.inputLookup)) {
          this.inputLookup = _lookup3.default.toHash(layer);
          this.inputLookupLength = Object.keys(this.inputLookup).length;
        } else if (i === this.outputLayer && (!layer[0] || json.outputLookup)) {
          this.outputLookup = _lookup3.default.toHash(layer);
        }
        if (i > 0) {
          var nodes = Object.keys(layer);
          this.sizes[i] = nodes.length;
          for (var j in nodes) {
            var node = nodes[j];
            this.biases[i][j] = layer[node].bias;
            this.weights[i][j] = (0, _toArray2.default)(layer[node].weights);
          }
        }
      }
      if (json.hasOwnProperty('trainOpts')) {
        this.updateTrainingOptions(json.trainOpts);
      }
      this.setActivation(this.activation || 'sigmoid');
      return this;
    }

    /**
     *
     * @returns {Function}
     */

  }, {
    key: 'toFunction',
    value: function toFunction() {
      var activation = this.activation;
      var leakyReluAlpha = this.leakyReluAlpha;
      var needsVar = false;
      function nodeHandle(layers, layerNumber, nodeKey) {
        if (layerNumber === 0) {
          return typeof nodeKey === 'string' ? 'input[\'' + nodeKey + '\']' : 'input[' + nodeKey + ']';
        }

        var layer = layers[layerNumber];
        var node = layer[nodeKey];
        var result = ['(', node.bias];
        for (var w in node.weights) {
          if (node.weights[w] < 0) {
            result.push(node.weights[w] + '*' + nodeHandle(layers, layerNumber - 1, w));
          } else {
            result.push('+' + node.weights[w] + '*' + nodeHandle(layers, layerNumber - 1, w));
          }
        }
        result.push(')');

        switch (activation) {
          case 'sigmoid':
            return '1/(1+1/Math.exp(' + result.join('') + '))';
          case 'relu':
            {
              needsVar = true;
              return '((v=' + result.join('') + ')<0?0:v)';
            }
          case 'leaky-relu':
            {
              needsVar = true;
              return '((v=' + result.join('') + ')<0?0:' + leakyReluAlpha + '*v)';
            }
          case 'tanh':
            return 'Math.tanh(' + result.join('') + ')';
          default:
            throw new Error('unknown activation type ' + activation);
        }
      }

      var layers = this.toJSON().layers;
      var layersAsMath = [];
      var result = void 0;
      for (var i in layers[layers.length - 1]) {
        layersAsMath.push(nodeHandle(layers, layers.length - 1, i));
      }
      if (this.outputLookup) {
        result = '{' + Object.keys(this.outputLookup).map(function (key, i) {
          return '\'' + key + '\':' + layersAsMath[i];
        }) + '}';
      } else {
        result = '[' + layersAsMath.join(',') + ']';
      }

      return new Function('input', (needsVar ? 'var v;' : '') + 'return ' + result + ';');
    }
  }, {
    key: 'isRunnable',
    get: function get() {
      var _this6 = this;

      if (!this.runInput) {
        console.error('Activation function has not been initialized, did you run train()?');
        return false;
      }

      var checkFns = ['sizes', 'outputLayer', 'biases', 'weights', 'outputs', 'deltas', 'changes', 'errors'].filter(function (c) {
        return _this6[c] === null;
      });

      if (checkFns.length > 0) {
        console.error('Some settings have not been initialized correctly, did you run train()? Found issues with: ' + checkFns.join(', '));
        return false;
      }
      return true;
    }
  }]);

  return NeuralNetwork;
}();

exports.default = NeuralNetwork;
//# sourceMappingURL=neural-network.js.map