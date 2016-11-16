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
  //"xieruopeng123@qq.com",
  //"15396753915@163.com"
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
 * 生成DHCP网卡配置文件
 */
function createDHCPInterfaces() {
  let raw = readFileContent("./lib/raw_interfaces")
  let newContent = util.format(raw, OUTER_INTERFACE_NAME, OUTER_INTERFACE_NAME, SSID, PSK, INNER_INTERFACE_NAME, INNER_INTERFACE_NAME, ROUTER_GATEWAY)
  writeFileContent("./lib/interfaces_dhcp", newContent)
}

function createStaticInterfaces(ip) {
  let raw = readFileContent("./lib/raw_interfaces_static")
  let newContent = util.format(raw, OUTER_INTERFACE_NAME, OUTER_INTERFACE_NAME, SSID, PSK, INNER_INTERFACE_NAME, INNER_INTERFACE_NAME, INNER_INTERFACE_NAME, ip, ROUTER_GATEWAY)
  writeFileContent("./lib/interfaces_static", newContent)
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
  mailUtil.sendMail(mail, "新ip下发通知", `您的新ip为: ${ip}`, (err, info) => {
    if (err){
      console.log(`邮件发送失败 ${mail}`)
    }else  {
      console.log(`邮件发送成功 ${mail}`)
    }
  })
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

/**
 * 优雅的实现sleep函数
 * @param ms
 */
function sleep(ms){
  return new Promise(resolve => setTimeout(resolve, ms))
}


/**
 * 执行ping test
 * @param ip
 * @returns {Promise}
 */
function pingTest(ip){
  return new Promise((resolve) => {
    ping.sys.probe((ip), (isAlive) => {
      resolve(isAlive)
    }, { extra: ["-c 2"]})
  })
}



async function setDynamic() {
  let oldIp
  while(isValidTime(new Date())) {
    let isAlive = await pingTest(TEST_GATEWAY)
    if (!oldIp || !isAlive) {
      console.log('网络重启中(dhcp).........')
      console.log(`当前时间: ${new Date().toLocaleString()}`)


      createDHCPInterfaces()
      cp('-f', './lib/iptables-rules', '/etc/iptables-rules')
      cp('-f', './lib/interfaces_dhcp', '/etc/network/interfaces')
      exec('/etc/init.d/networking restart', {silent:true})


      let newIp = getLocalIp(INNER_INTERFACE_NAME)
      console.log(`新的ip为: ${newIp}`)
      createPptpd(newIp)
      cp('-f', './lib/pptpd.conf', '/etc/pptpd.conf')
      exec('/etc/init.d/pptpd restart')

      addRouteItems()
      oldIp = newIp

      // 发送邮件
      mails.map((mail) => {
        sendEmail(mail, newIp)
      })

      console.log('配置完成')

      await sleep(5000)
    }
  }
}

async function setStatic() {
  let oldIp
  let current = new Date()
  while(isValidTime(current)) {
    let isAlive = await pingTest("www.baidu.com")
    if (!oldIp || !isAlive) {
      console.log('网络重启中(static).........')
      console.log(`当前时间: ${current.toLocaleString()}`)
      exec(`dhclient ${INNER_INTERFACE_NAME}`)
      let newIp = getLocalIp(INNER_INTERFACE_NAME)
      console.log(`新的ip为: ${newIp}`)

      createStaticInterfaces(newIp)
      cp('-f', './lib/iptables-rules', '/etc/iptables-rules')
      cp('-f', './lib/interfaces_static', '/etc/network/interfaces')
      exec('/etc/init.d/networking restart', {silent:true})

      createPptpd(newIp)
      cp('-f', './lib/pptpd.conf', '/etc/pptpd.conf')
      exec('/etc/init.d/pptpd restart')

      addRouteItems()
      oldIp = newIp

      // 发送邮件
      mails.map((mail) => {
        sendEmail(mail, newIp)
      })

      console.log('配置完成')

      await sleep(5000)
    }
  }
}

setDynamic()