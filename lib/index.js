/**
 * Created by jason on 2016/11/13.
 */
import os from 'os'
import util from 'util'
import fs from 'fs'
import {SSID, PSK, INNER_INTERFACE_NAME, OUTER_INTERFACE_NAME, TEST_GATEWAY, LOCAL_GATEWAY} from './config'
import 'shelljs/global'
import ping from 'ping'
/**
 * 获取网卡信息
 * @param interfaceName
 * @returns {*}
 */
function getInterface(interfaceName) {
  let interfaces = os.networkInterfaces()
  return !!interfaceName ? interfaces[interfaceName] : interfaces
}

/**
 * 获取指定网卡的ip
 * @param interfaceName
 * @returns {*}
 */
function getLocalIp(interfaceName) {
  let ifs = getInterface(interfaceName)
  return ifs.find((info) => (info["family"] === 'IPv4')).address
}

/**
 * 读取文件内容
 * @param fileName
 * @returns {*}
 */
function readFileContent(fileName) {
  return fs.readFileSync(fileName, {encoding: "utf8"})
}

/**
 * 写入文件内容
 * @param fileName
 * @param content
 */
function writeFileContent(fileName, content) {
  fs.writeFileSync(fileName, content)
}


/**
 * 生成网卡配置文件
 */
function createInterfaces() {
  let raw = readFileContent("./lib/raw_interfaces")
  let newContent = util.format(raw, OUTER_INTERFACE_NAME, OUTER_INTERFACE_NAME, SSID, PSK, INNER_INTERFACE_NAME, INNER_INTERFACE_NAME)
  writeFileContent("./lib/interfaces", newContent)
}

/**
 * 生成pptpd 配置文件
 * @param newIp
 */
function createPptpd(newIp) {
  let raw = readFileContent("./lib/raw_pptpd.conf")
  let newContent = util.format(raw, newIp)
  writeFileContent("./lib/pptpd.conf", newContent)
}

/**
 * 添加路由表
 */
function addRouteItems() {
  exec(`ip route add 202.193.0.0/16 via ${LOCAL_GATEWAY} dev ${INNER_INTERFACE_NAME}`)
  exec(`ip route add 10.100.123.0/24 via ${LOCAL_GATEWAY} dev ${INNER_INTERFACE_NAME}`)
  exec(`ip route add 10.20.0.0/16 via ${LOCAL_GATEWAY} dev ${INNER_INTERFACE_NAME}`)
  exec(`ip route del default dev ${INNER_INTERFACE_NAME}`)
  exec(`ip route add ${LOCAL_GATEWAY}/32 dev ${INNER_INTERFACE_NAME}`)
}

function main() {

  let newIp

  setInterval(() => {
    ping.sys.probe(TEST_GATEWAY, (isAlive) => {
      if (!isAlive || !newIp) {
        // 如果ping不通3教网关
        console.log('网络重启中.........')
        console.log(`当前时间: ${new Date().toLocaleString()}`)

        createInterfaces()
        cp('-f', './lib/iptables-rules', '/etc/iptables-rules')
        cp('-f', './lib/interfaces', '/etc/network/interfaces')
        exec('/etc/init.d/networking restart', {silent:true})
        newIp = getLocalIp(INNER_INTERFACE_NAME)
        console.log(`新的ip为: ${newIp}`)

        createPptpd(newIp)
        cp('-f', './lib/pptpd.conf', '/etc/pptpd.conf')
        exec('/etc/init.d/pptpd restart')

        addRouteItems()
        console.log('配置完成')
      }
    })
  }, 5000)


}

main()