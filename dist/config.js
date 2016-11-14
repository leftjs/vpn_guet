'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.LOCAL_GATEWAY = exports.TEST_GATEWAY = exports.OUTER_INTERFACE_NAME = exports.INNER_INTERFACE_NAME = exports.PSK = exports.SSID = undefined;

var _dotenv = require('dotenv');

var _dotenv2 = _interopRequireDefault(_dotenv);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

_dotenv2.default.config({ silent: true }); /**
                                            * Created by jason on 2016/11/13.
                                            */
var _process$env = process.env;
var SSID = _process$env.SSID,
    PSK = _process$env.PSK,
    INNER_INTERFACE_NAME = _process$env.INNER_INTERFACE_NAME,
    OUTER_INTERFACE_NAME = _process$env.OUTER_INTERFACE_NAME,
    TEST_GATEWAY = _process$env.TEST_GATEWAY,
    LOCAL_GATEWAY = _process$env.LOCAL_GATEWAY;
exports.SSID = SSID;
exports.PSK = PSK;
exports.INNER_INTERFACE_NAME = INNER_INTERFACE_NAME;
exports.OUTER_INTERFACE_NAME = OUTER_INTERFACE_NAME;
exports.TEST_GATEWAY = TEST_GATEWAY;
exports.LOCAL_GATEWAY = LOCAL_GATEWAY;