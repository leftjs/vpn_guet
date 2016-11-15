/**
 * Created by jason on 2016/11/13.
 */
import os from 'os'
import util from 'util'
import fs from 'fs'
import {ROUTER_GATEWAY, SSID, PSK, INNER_INTERFACE_NAME, OUTER_INTERFACE_NAME, TEST_GATEWAY, LOCAL_GATEWAY} from './config'
import 'shelljs/global'
import ping from 'ping'
import * as mailUtil from './mailUtils'
import moment from 'moment'

/**
 * 接受新ip的邮箱
 * @type {string[]}
 */
const mails = [
  "leftjs@foxmail.com",
  "xieruopeng123@qq.com",
  "15396753915@163.com"
]
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
  let newContent = util.format(raw, OUTER_INTERFACE_NAME, OUTER_INTERFACE_NAME, SSID, PSK, INNER_INTERFACE_NAME, INNER_INTERFACE_NAME, ROUTER_GATEWAY)
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
  exec(`ip route del default dev ${INNER_INTERFACE_NAME}`, {silent: true})
  exec(`ip route add ${LOCAL_GATEWAY}/32 dev ${INNER_INTERFACE_NAME}`, {silent:true})
  exec(`ip route add 10.20.0.0/16 via ${LOCAL_GATEWAY} dev ${INNER_INTERFACE_NAME}`, {silent:true})
  exec(`ip route add 202.193.0.0/16 via ${LOCAL_GATEWAY} dev ${INNER_INTERFACE_NAME}`, {silent:true})
  exec(`ip route add 10.100.123.0/24 via ${LOCAL_GATEWAY} dev ${INNER_INTERFACE_NAME}`, {silent:true})
}



function sendEmail(mail, ip) {
  mailUtil.sendMail(mail, "新ip下发通知", `您的新ip为: ${ip}`)
}


/**
 * 判断当前时候在有效时间周期内，默认为6:00 - 23:59
 * @param date
 */
function isValidTime(date) {
  let endTime = moment(date).set('hour', 23).set('minute', 59).set('second', 59)
  let startTime = moment(date).set('hour', 6).set('minute', 1).set('second', 59)
  return (moment(date).isAfter(startTime) && (moment(date).isBefore(endTime)))

}

function main() {

  let oldIp

  setInterval(() => {
    let currentTime = new Date()

    if (isValidTime(currentTime)){
      // 在有效时间段内的话
      ping.sys.probe(TEST_GATEWAY, (isAlive) => {

        if (!isAlive || !oldIp) {
          // 如果ping不通3教网关
          console.log('网络重启中.........')
          console.log(`当前时间: ${currentTime.toLocaleString()}`)

          createInterfaces()
          cp('-f', './lib/iptables-rules', '/etc/iptables-rules')
          cp('-f', './lib/interfaces', '/etc/network/interfaces')
          exec('/etc/init.d/networking restart', {silent:true})
          let newIp = getLocalIp(INNER_INTERFACE_NAME)
          if (oldIp !== newIp) {
            // 需要发邮件
            mails.map((mail) => {
              sendEmail(mail, newIp)
            })
          }
          console.log(`新的ip为: ${newIp}`)

          createPptpd(newIp)
          cp('-f', './lib/pptpd.conf', '/etc/pptpd.conf')
          exec('/etc/init.d/pptpd restart')

          addRouteItems()

          oldIp = newIp
          console.log('配置完成')
        }
      })

    }
  }, 5000)


}

//main()