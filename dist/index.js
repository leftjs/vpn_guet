'use strict';

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _util = require('util');

var _util2 = _interopRequireDefault(_util);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _config = require('./config');

require('shelljs/global');

var _ping = require('ping');

var _ping2 = _interopRequireDefault(_ping);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * 获取网卡信息
 * @param interfaceName
 * @returns {*}
 */
/**
 * Created by jason on 2016/11/13.
 */
function getInterface(interfaceName) {
  var interfaces = _os2.default.networkInterfaces();
  return !!interfaceName ? interfaces[interfaceName] : interfaces;
}

/**
 * 获取指定网卡的ip
 * @param interfaceName
 * @returns {*}
 */
function getLocalIp(interfaceName) {
  var ifs = getInterface(interfaceName);
  return ifs.find(function (info) {
    return info["family"] === 'IPv4';
  }).address;
}

/**
 * 读取文件内容
 * @param fileName
 * @returns {*}
 */
function readFileContent(fileName) {
  return _fs2.default.readFileSync(fileName, { encoding: "utf8" });
}

/**
 * 写入问价内容
 * @param fileName
 * @param content
 */
function writeFileContent(fileName, content) {
  _fs2.default.writeFileSync(fileName, content);
}

/**
 * 生成网卡配置文件
 * @param newIp
 */
function createInterfaces(newIp) {
  var raw = readFileContent("./lib/raw_interfaces");
  var newContent = _util2.default.format(raw, _config.INNER_INTERFACE_NAME, _config.INNER_INTERFACE_NAME, newIp, _config.OUTER_INTERFACE_NAME, _config.OUTER_INTERFACE_NAME, _config.SSID, _config.PSK);
  writeFileContent("./lib/interfaces", newContent);
}

/**
 * 生成pptpd 配置文件
 * @param newIp
 */
function createPptpd(newIp) {
  var raw = readFileContent("./lib/raw_pptpd.conf");
  var newContent = _util2.default.format(raw, newIp);
  writeFileContent("./lib/pptpd.conf", newContent);
}

function addRouteItems() {
  exec('ip route add 202.193.0.0/16 via ' + _config.LOCAL_GATEWAY + ' dev ' + _config.INNER_INTERFACE_NAME);
  exec('ip route add 10.100.123.0/24 via ' + _config.LOCAL_GATEWAY + ' dev ' + _config.INNER_INTERFACE_NAME);
  exec('ip route add 10.20.0.0/16 via ' + _config.LOCAL_GATEWAY + ' dev ' + _config.INNER_INTERFACE_NAME);
  //exec(`ip route del default dev ${INNER_INTERFACE_NAME}`)
}

function main() {

  var newIp = void 0;

  setInterval(function () {
    _ping2.default.sys.probe(_config.TEST_GATEWAY, function (isAlive) {
      if (!isAlive || !newIp) {
        // 如果ping不通3教网关
        console.log('网络重启中.........');
        console.log('\u65B0\u7684ip\u4E3A: ' + newIp);
        console.log('\u5F53\u524D\u65F6\u95F4: ' + new Date().toLocaleString());
        exec('dhclient ' + _config.INNER_INTERFACE_NAME);
        newIp = getLocalIp(_config.INNER_INTERFACE_NAME);
        try {
          createInterfaces(newIp);
          createPptpd(newIp);
        } catch (err) {
          console.log(err.message);
        }

        cp('-f', './lib/iptables-rules', '/etc/iptables-rules');
        cp('-f', './lib/interfaces', '/etc/network/interfaces');
        exec('/etc/init.d/networking restart', { silent: true });
        cp('-f', './lib/pptpd.conf', '/etc/pptpd.conf');
        exec('/etc/init.d/pptpd restart');

        console.log('配置完成');
      }
    });
  }, 5000);
}

main();